use std::collections::HashSet;

use serde::{Deserialize, Serialize};
use tokio::process::Command;

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PortInfo {
    pub port: u16,
    pub pid: u32,
    pub command: String,
    pub address: String,
}

#[tauri::command]
pub async fn list_listening_ports() -> Result<Vec<PortInfo>, String> {
    let output = Command::new("lsof")
        .args(["-iTCP", "-sTCP:LISTEN", "-P", "-n"])
        .output()
        .await
        .map_err(|e| format!("lsof failed: {e}"))?;

    let text = String::from_utf8_lossy(&output.stdout);
    let mut ports = Vec::new();
    let mut seen = HashSet::new();

    for (i, line) in text.lines().enumerate() {
        if i == 0 {
            continue; // header
        }
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 9 {
            continue;
        }

        let command = parts[0].to_string();
        let Ok(pid) = parts[1].parse::<u32>() else {
            continue;
        };

        // NAME column may have spaces (rare). Take the address:port token only.
        let addr_port = parts[8];
        let Some(colon_idx) = addr_port.rfind(':') else {
            continue;
        };
        let address = addr_port[..colon_idx].to_string();
        let port_str = &addr_port[colon_idx + 1..];
        let Ok(port) = port_str.parse::<u16>() else {
            continue;
        };

        if !seen.insert((pid, port)) {
            continue;
        }

        ports.push(PortInfo {
            port,
            pid,
            command,
            address,
        });
    }

    ports.sort_by_key(|p| p.port);
    Ok(ports)
}

#[tauri::command]
pub async fn kill_port_process(pid: u32, force: bool) -> Result<(), String> {
    let signal = if force { "-9" } else { "-15" };
    let output = Command::new("kill")
        .args([signal, &pid.to_string()])
        .output()
        .await
        .map_err(|e| format!("kill failed: {e}"))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(if stderr.trim().is_empty() {
            format!("kill exited with status {:?}", output.status.code())
        } else {
            stderr.trim().to_string()
        });
    }
    Ok(())
}
