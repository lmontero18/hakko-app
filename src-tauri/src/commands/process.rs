use std::process::Stdio;
use std::sync::LazyLock;
use std::time::Duration;

use chrono::Utc;
use regex::Regex;
use tauri::{AppHandle, Emitter, Manager, State};
use tokio::io::{AsyncBufReadExt, AsyncRead, BufReader};
use tokio::net::TcpListener;
use tokio::process::Command;
use tokio::sync::oneshot;
use tokio::time::timeout;

/// Matches any `host:port` token the typical dev server prints in its
/// startup logs (Vite, Next, Strapi, Django, Rails, etc.).
static PORT_REGEX: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]):(\d{2,5})")
        .expect("port regex must compile")
});

fn sniff_port(line: &str) -> Option<u16> {
    PORT_REGEX
        .captures(line)
        .and_then(|caps| caps.get(1)?.as_str().parse::<u16>().ok())
        .filter(|&p| p > 0)
}

/// Checks if `port` can be bound by both an IPv4 and an IPv6 wildcard
/// listener. macOS (and Linux without IPV6_V6ONLY=0) treats these as
/// independent sockets, so a process on `[::]:3000` does NOT block a bind
/// to `127.0.0.1:3000`. We need to check both to catch every case.
async fn is_port_free(port: u16) -> bool {
    let v4 = TcpListener::bind(("0.0.0.0", port)).await;
    if v4.is_err() {
        return false;
    }
    let v6 = TcpListener::bind(("::", port)).await;
    v6.is_ok()
}

/// Starts at `start` and walks up looking for a free TCP port.
/// Tries `start`, `start+1`, ..., up to 30 candidates. Returns the first
/// fully-free port (both IPv4 and IPv6 wildcards bindable).
///
/// Used to auto-shift dev servers off conflicting ports — if user asks for
/// 3000 but it's taken, we'll inject PORT=3001, etc.
async fn find_available_port(start: u16) -> Option<u16> {
    const MAX_TRIES: u16 = 30;
    for offset in 0..MAX_TRIES {
        let Some(p) = start.checked_add(offset) else {
            break;
        };
        if p == 0 {
            continue;
        }
        if is_port_free(p).await {
            return Some(p);
        }
    }
    None
}

use crate::commands::sessions::{record_session, SessionEntry};
use crate::commands::storage;
use crate::models::{LogPayload, Service, ServiceState, ServiceStatus};
use crate::state::{AppState, ChildHandle};

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// Build a PATH that includes the common install locations on macOS / Linux.
///
/// macOS GUI apps launched from Finder inherit a minimal PATH that doesn't
/// include Homebrew, Docker Desktop's symlink dir, or per-user bin dirs.
/// We prepend those so commands like `docker`, `node`, `python`, `pnpm`
/// are findable without the user having to do `PATH=... <cmd>` themselves.
fn enriched_path() -> String {
    let home = std::env::var("HOME").unwrap_or_default();
    let mut extras = vec![
        "/opt/homebrew/bin".to_string(),
        "/opt/homebrew/sbin".to_string(),
        "/usr/local/bin".to_string(),
        "/usr/local/sbin".to_string(),
        // GUI app bundles that ship their own CLIs (no symlink required)
        "/Applications/Docker.app/Contents/Resources/bin".to_string(),
        "/Applications/OrbStack.app/Contents/MacOS/bin".to_string(),
    ];
    if !home.is_empty() {
        extras.push(format!("{home}/.local/bin"));
        extras.push(format!("{home}/.cargo/bin"));
        extras.push(format!("{home}/.docker/bin"));
    }
    let existing = std::env::var("PATH").unwrap_or_default();
    if existing.is_empty() {
        extras.join(":")
    } else {
        format!("{}:{}", extras.join(":"), existing)
    }
}

fn find_service(service_id: &str) -> Result<Service, String> {
    let projects = storage::read_db().map_err(err)?;
    for project in projects {
        for service in project.services {
            if service.id == service_id {
                return Ok(service);
            }
        }
    }
    Err(format!("service {service_id} not found"))
}

/// (project_id, project_name) for the project that owns `service_id`. Used to
/// snapshot context onto a tracked session.
fn find_project_meta(service_id: &str) -> (Option<String>, Option<String>) {
    if let Ok(projects) = storage::read_db() {
        for project in projects {
            if project.services.iter().any(|s| s.id == service_id) {
                return (Some(project.id), Some(project.name));
            }
        }
    }
    (None, None)
}

#[tauri::command]
pub async fn start_service(
    service_id: String,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<u32, String> {
    {
        let map = state.processes.lock().map_err(err)?;
        if map.contains_key(&service_id) {
            return Err(format!("service {service_id} is already running"));
        }
    }

    let service = find_service(&service_id)?;
    let service_name = service.name.clone();
    let (project_id, project_name) = find_project_meta(&service_id);

    let mut command = if cfg!(windows) {
        let mut c = Command::new("cmd");
        c.args(["/C", &service.command]);
        c
    } else {
        let mut c = Command::new("sh");
        c.args(["-c", &service.command]);
        c
    };

    command
        .current_dir(&service.cwd)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .stdin(Stdio::null())
        .kill_on_drop(true)
        .env("PATH", enriched_path());

    // Auto-inject PORT env var when configured. If the configured port is
    // already taken, walk up (3000 → 3001 → 3002 …) until we find a free
    // one. Most modern dev servers (Next.js, Vite, CRA, Strapi, custom
    // Node) respect PORT. User-set env below takes precedence.
    let effective_port = if let Some(configured) = service.port {
        let resolved = find_available_port(configured)
            .await
            .unwrap_or(configured);
        command.env("PORT", resolved.to_string());
        Some(resolved)
    } else {
        None
    };

    if let Some(env) = &service.env {
        for (k, v) in env {
            command.env(k, v);
        }
    }

    // On Unix: detach into a new session/process group so SIGTERM can
    // be delivered to the entire descendant tree (npm → node → …).
    #[cfg(unix)]
    unsafe {
        command.pre_exec(|| {
            if libc::setsid() == -1 {
                return Err(std::io::Error::last_os_error());
            }
            Ok(())
        });
    }

    let mut child = command
        .spawn()
        .map_err(|e| format!("failed to spawn `{}`: {}", service.command, e))?;

    let pid = child
        .id()
        .ok_or_else(|| "child has no pid (already exited?)".to_string())?;

    let stdout = child.stdout.take().expect("stdout was piped");
    let stderr = child.stderr.take().expect("stderr was piped");

    let (stop_tx, stop_rx) = oneshot::channel::<()>();

    let started_at = Utc::now();
    let initial_state = ServiceState {
        service_id: service_id.clone(),
        status: ServiceStatus::Running,
        pid: Some(pid),
        started_at: Some(started_at.to_rfc3339()),
        // Pre-populate with the resolved port; the log sniffer will keep
        // this honest if the framework decides to ignore PORT and bind
        // somewhere else.
        actual_port: effective_port,
    };

    {
        let mut map = state.processes.lock().map_err(err)?;
        map.insert(
            service_id.clone(),
            ChildHandle {
                state: initial_state.clone(),
                stop_tx: Some(stop_tx),
            },
        );
    }

    let _ = app.emit("service-status", initial_state);

    spawn_drain(app.clone(), stdout, service_id.clone(), "stdout");
    spawn_drain(app.clone(), stderr, service_id.clone(), "stderr");

    // Waiter task: owns the child, races stop signal vs natural exit
    let app_for_wait = app.clone();
    let sid = service_id.clone();
    tokio::spawn(async move {
        let final_status = tokio::select! {
            res = child.wait() => match res {
                Ok(status) if status.success() => ServiceStatus::Stopped,
                _ => ServiceStatus::Crashed,
            },
            _ = stop_rx => {
                #[cfg(unix)]
                unsafe {
                    libc::killpg(pid as i32, libc::SIGTERM);
                }
                let timed_out = timeout(Duration::from_secs(5), child.wait()).await.is_err();
                if timed_out {
                    let _ = child.kill().await;
                }
                ServiceStatus::Stopped
            }
        };

        if let Some(state) = app_for_wait.try_state::<AppState>() {
            if let Ok(mut map) = state.processes.lock() {
                map.remove(&sid);
            }
        }

        let stopped_at = Utc::now();
        record_session(SessionEntry {
            project_id,
            project_name,
            service_id: sid.clone(),
            service_name: Some(service_name),
            started_at: started_at.to_rfc3339(),
            stopped_at: stopped_at.to_rfc3339(),
            duration_secs: (stopped_at - started_at).num_seconds(),
        });

        let final_state = ServiceState {
            service_id: sid,
            status: final_status,
            pid: None,
            started_at: None,
            actual_port: None,
        };
        let _ = app_for_wait.emit("service-status", final_state);
    });

    Ok(pid)
}

fn spawn_drain<R: AsyncRead + Unpin + Send + 'static>(
    app: AppHandle,
    reader: R,
    service_id: String,
    stream: &'static str,
) {
    tokio::spawn(async move {
        let mut lines = BufReader::new(reader).lines();
        loop {
            match lines.next_line().await {
                Ok(Some(line)) => {
                    // Sniff a port from this line. If we find one and it
                    // differs from the cached actual_port, update state +
                    // emit a service-status event so the UI knows the real
                    // port (e.g. when configured :3000 falls back to :3001).
                    if let Some(detected) = sniff_port(&line) {
                        if let Some(app_state) = app.try_state::<AppState>() {
                            let updated = {
                                let mut map = match app_state.processes.lock() {
                                    Ok(m) => m,
                                    Err(_) => continue,
                                };
                                match map.get_mut(&service_id) {
                                    Some(handle)
                                        if handle.state.actual_port
                                            != Some(detected) =>
                                    {
                                        handle.state.actual_port = Some(detected);
                                        Some(handle.state.clone())
                                    }
                                    _ => None,
                                }
                            };
                            if let Some(state) = updated {
                                let _ = app.emit("service-status", state);
                            }
                        }
                    }

                    let payload = LogPayload {
                        service_id: service_id.clone(),
                        line,
                        stream: stream.to_string(),
                        timestamp: Utc::now().to_rfc3339(),
                    };
                    if let Some(state) = app.try_state::<AppState>() {
                        state.push_log(payload.clone());
                    }
                    let _ = app.emit("service-log", payload);
                }
                Ok(None) | Err(_) => break,
            }
        }
    });
}

#[tauri::command]
pub async fn stop_service(
    service_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let tx = {
        let mut map = state.processes.lock().map_err(err)?;
        match map.get_mut(&service_id) {
            Some(handle) => handle.stop_tx.take(),
            None => return Ok(()), // Idempotent: not running == already stopped
        }
    };
    if let Some(tx) = tx {
        let _ = tx.send(());
    }
    Ok(())
}

#[tauri::command]
pub async fn list_running(
    state: State<'_, AppState>,
) -> Result<Vec<ServiceState>, String> {
    let map = state.processes.lock().map_err(err)?;
    Ok(map.values().map(|h| h.state.clone()).collect())
}
