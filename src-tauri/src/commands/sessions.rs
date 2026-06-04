use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::{LazyLock, Mutex};

use chrono::{DateTime, Duration, Local, Utc};
use serde::{Deserialize, Serialize};
use tauri::State;

use crate::commands::storage;
use crate::state::AppState;

const SESSIONS_FILE_NAME: &str = "sessions.json";

/// Serializes append-to-file so two services stopping at once (e.g. "Stop all")
/// don't clobber each other's write.
static FILE_LOCK: LazyLock<Mutex<()>> = LazyLock::new(|| Mutex::new(()));

/// One completed run of a service: from start to stop. Names are snapshotted so
/// stats still read well even after a project or service is renamed/deleted.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SessionEntry {
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub project_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub project_name: Option<String>,
    pub service_id: String,
    #[serde(skip_serializing_if = "Option::is_none", default)]
    pub service_name: Option<String>,
    pub started_at: String,
    pub stopped_at: String,
    pub duration_secs: i64,
}

fn sessions_path() -> Option<PathBuf> {
    storage::app_config_dir().ok().map(|d| d.join(SESSIONS_FILE_NAME))
}

fn read_sessions() -> Vec<SessionEntry> {
    let Some(path) = sessions_path() else {
        return Vec::new();
    };
    let Ok(raw) = fs::read_to_string(&path) else {
        return Vec::new();
    };
    if raw.trim().is_empty() {
        return Vec::new();
    }
    serde_json::from_str(&raw).unwrap_or_default()
}

/// Appends a finished session to `sessions.json`. Best-effort: a tracking
/// failure must never break the actual start/stop of a service, so errors are
/// swallowed. Ignores sub-second blips so we don't log noise.
pub fn record_session(entry: SessionEntry) {
    if entry.duration_secs <= 0 {
        return;
    }
    let _guard = FILE_LOCK.lock();
    let Some(path) = sessions_path() else {
        return;
    };
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
    }
    let mut sessions = read_sessions();
    sessions.push(entry);
    if let Ok(raw) = serde_json::to_string(&sessions) {
        let _ = fs::write(&path, raw);
    }
}

// ---- Aggregation (get_stats) ----

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceStat {
    service_id: String,
    service_name: String,
    total_secs: i64,
    sessions: u32,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectStat {
    project_id: String,
    project_name: String,
    total_secs: i64,
    week_secs: i64,
    sessions: u32,
    services: Vec<ServiceStat>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StatsSummary {
    total_secs: i64,
    week_secs: i64,
    total_sessions: u32,
    projects: Vec<ProjectStat>,
}

#[derive(Default)]
struct ServiceAccum {
    name: String,
    total: i64,
    sessions: u32,
}

#[derive(Default)]
struct ProjectAccum {
    name: String,
    total: i64,
    week: i64,
    sessions: u32,
    services: HashMap<String, ServiceAccum>,
}

struct Contribution {
    project_id: String,
    project_name: String,
    service_id: String,
    service_name: String,
    secs: i64,
    in_week: bool,
}

/// Aggregates completed sessions (`sessions.json`) PLUS the live elapsed time
/// of any currently-running services into per-project / per-service totals,
/// with a rolling 7-day window. Computed fresh on every call so it ticks in
/// real time while services run.
#[tauri::command]
pub async fn get_stats(state: State<'_, AppState>) -> Result<StatsSummary, String> {
    let now = Utc::now();
    let week_ago = now - Duration::days(7);

    // service_id -> (project_id, project_name, service_name) for live lookups.
    let mut svc_meta: HashMap<String, (String, String, String)> = HashMap::new();
    if let Ok(projects) = storage::read_db() {
        for p in projects {
            for s in &p.services {
                svc_meta.insert(
                    s.id.clone(),
                    (p.id.clone(), p.name.clone(), s.name.clone()),
                );
            }
        }
    }

    let mut contribs: Vec<Contribution> = Vec::new();

    // Completed sessions from disk.
    for s in read_sessions() {
        if s.duration_secs <= 0 {
            continue;
        }
        let in_week = DateTime::parse_from_rfc3339(&s.started_at)
            .map(|d| d.with_timezone(&Utc) >= week_ago)
            .unwrap_or(false);
        contribs.push(Contribution {
            project_id: s.project_id.clone().unwrap_or_else(|| "(unknown)".into()),
            project_name: s.project_name.clone().unwrap_or_else(|| "Unknown project".into()),
            service_id: s.service_id.clone(),
            service_name: s.service_name.clone().unwrap_or_else(|| s.service_id.clone()),
            secs: s.duration_secs,
            in_week,
        });
    }

    // Live elapsed time for services running right now (not yet on disk).
    {
        let map = state.processes.lock().map_err(|e| e.to_string())?;
        for handle in map.values() {
            let Some(started) = handle.state.started_at.as_ref() else {
                continue;
            };
            let Ok(parsed) = DateTime::parse_from_rfc3339(started) else {
                continue;
            };
            let secs = (now - parsed.with_timezone(&Utc)).num_seconds().max(0);
            if secs == 0 {
                continue;
            }
            let sid = handle.state.service_id.clone();
            let (project_id, project_name, service_name) =
                svc_meta.get(&sid).cloned().unwrap_or_else(|| {
                    ("(unknown)".into(), "Unknown project".into(), sid.clone())
                });
            contribs.push(Contribution {
                project_id,
                project_name,
                service_id: sid,
                service_name,
                secs,
                in_week: true,
            });
        }
    }

    let mut projects: HashMap<String, ProjectAccum> = HashMap::new();
    let mut total_secs = 0i64;
    let mut week_secs = 0i64;
    let mut total_sessions = 0u32;

    for c in &contribs {
        total_secs += c.secs;
        total_sessions += 1;
        if c.in_week {
            week_secs += c.secs;
        }

        let project = projects.entry(c.project_id.clone()).or_default();
        project.name = c.project_name.clone();
        project.total += c.secs;
        project.sessions += 1;
        if c.in_week {
            project.week += c.secs;
        }

        let service = project.services.entry(c.service_id.clone()).or_default();
        service.name = c.service_name.clone();
        service.total += c.secs;
        service.sessions += 1;
    }

    let mut project_stats: Vec<ProjectStat> = projects
        .into_iter()
        .map(|(id, acc)| {
            let mut services: Vec<ServiceStat> = acc
                .services
                .into_iter()
                .map(|(sid, sa)| ServiceStat {
                    service_id: sid,
                    service_name: sa.name,
                    total_secs: sa.total,
                    sessions: sa.sessions,
                })
                .collect();
            services.sort_by(|a, b| b.total_secs.cmp(&a.total_secs));
            ProjectStat {
                project_id: id,
                project_name: acc.name,
                total_secs: acc.total,
                week_secs: acc.week,
                sessions: acc.sessions,
                services,
            }
        })
        .collect();
    project_stats.sort_by(|a, b| b.total_secs.cmp(&a.total_secs));

    Ok(StatsSummary {
        total_secs,
        week_secs,
        total_sessions,
        projects: project_stats,
    })
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DayActivity {
    /// Local calendar date, `YYYY-MM-DD`.
    date: String,
    total_secs: i64,
    sessions: u32,
}

/// Per-day activity buckets for the contribution heatmap, optionally filtered to
/// a single project. Covers ~the last 53 weeks, in the user's local timezone,
/// and includes the live elapsed time of currently-running services. A session
/// that spans midnight is attributed to the day it started (v1 simplification).
#[tauri::command]
pub async fn get_daily_activity(
    project_id: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<DayActivity>, String> {
    let now = Utc::now();

    // service_id -> project_id, for filtering live services.
    let mut svc_project: HashMap<String, String> = HashMap::new();
    if let Ok(projects) = storage::read_db() {
        for p in projects {
            for s in &p.services {
                svc_project.insert(s.id.clone(), p.id.clone());
            }
        }
    }

    let mut days: HashMap<String, (i64, u32)> = HashMap::new();

    // Completed sessions
    for s in read_sessions() {
        if s.duration_secs <= 0 {
            continue;
        }
        if let Some(filter) = &project_id {
            if s.project_id.as_deref() != Some(filter.as_str()) {
                continue;
            }
        }
        let Ok(started) = DateTime::parse_from_rfc3339(&s.started_at) else {
            continue;
        };
        let date = started.with_timezone(&Local).format("%Y-%m-%d").to_string();
        let e = days.entry(date).or_insert((0, 0));
        e.0 += s.duration_secs;
        e.1 += 1;
    }

    // Live, currently-running services
    {
        let map = state.processes.lock().map_err(|e| e.to_string())?;
        for handle in map.values() {
            let sid = &handle.state.service_id;
            if let Some(filter) = &project_id {
                if svc_project.get(sid).map(|p| p != filter).unwrap_or(true) {
                    continue;
                }
            }
            let Some(started) = handle.state.started_at.as_ref() else {
                continue;
            };
            let Ok(parsed) = DateTime::parse_from_rfc3339(started) else {
                continue;
            };
            let secs = (now - parsed.with_timezone(&Utc)).num_seconds().max(0);
            if secs == 0 {
                continue;
            }
            let date = parsed.with_timezone(&Local).format("%Y-%m-%d").to_string();
            let e = days.entry(date).or_insert((0, 0));
            e.0 += secs;
            e.1 += 1;
        }
    }

    let mut out: Vec<DayActivity> = days
        .into_iter()
        .map(|(date, (total, sessions))| DayActivity {
            date,
            total_secs: total,
            sessions,
        })
        .collect();
    out.sort_by(|a, b| a.date.cmp(&b.date));
    Ok(out)
}
