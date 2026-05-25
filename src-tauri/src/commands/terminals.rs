use std::path::Path;

use serde::{Deserialize, Serialize};
use tokio::process::Command;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct TerminalInfo {
    pub id: String,
    pub name: String,
}

// Order matters: preferred terminal first. Modern ones (Warp, Ghostty, iTerm)
// before the built-in Terminal.app.
const KNOWN_TERMINALS: &[(&str, &str, &str, &str)] = &[
    // (id, display name, .app filename, default install location)
    ("warp", "Warp", "Warp.app", "/Applications"),
    ("ghostty", "Ghostty", "Ghostty.app", "/Applications"),
    ("iterm2", "iTerm", "iTerm.app", "/Applications"),
    ("alacritty", "Alacritty", "Alacritty.app", "/Applications"),
    ("kitty", "kitty", "kitty.app", "/Applications"),
    ("wezterm", "WezTerm", "WezTerm.app", "/Applications"),
    ("hyper", "Hyper", "Hyper.app", "/Applications"),
    ("tabby", "Tabby", "Tabby.app", "/Applications"),
    // Built-in macOS — always present.
    (
        "terminal",
        "Terminal",
        "Terminal.app",
        "/System/Applications/Utilities",
    ),
];

#[tauri::command]
pub async fn list_available_terminals() -> Result<Vec<TerminalInfo>, String> {
    let mut found = Vec::new();
    for (id, name, app, base) in KNOWN_TERMINALS {
        let primary = format!("{}/{}", base, app);
        let user_apps = std::env::var("HOME")
            .ok()
            .map(|h| format!("{}/Applications/{}", h, app));

        let exists = Path::new(&primary).exists()
            || user_apps
                .as_ref()
                .map(|p| Path::new(p).exists())
                .unwrap_or(false);

        if exists {
            found.push(TerminalInfo {
                id: id.to_string(),
                name: name.to_string(),
            });
        }
    }
    Ok(found)
}

#[tauri::command]
pub async fn open_in_terminal(terminal_name: String, path: String) -> Result<(), String> {
    let output = Command::new("open")
        .args(["-a", &terminal_name, &path])
        .output()
        .await
        .map_err(|e| format!("Failed to launch terminal: {}", e))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(if stderr.trim().is_empty() {
            format!("`open -a` exited with {:?}", output.status.code())
        } else {
            stderr.trim().to_string()
        });
    }
    Ok(())
}
