use std::path::Path;

use serde::{Deserialize, Serialize};
use tokio::process::Command;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct EditorInfo {
    /// Stable identifier for the editor.
    pub id: String,
    /// Display name (what we pass to `open -a "<name>"`).
    pub name: String,
}

// Order matters: this is the "preferred" order when multiple editors are
// installed. Cursor > Antigravity > VS Code > others.
const KNOWN_EDITORS: &[(&str, &str, &str)] = &[
    // (id, name, .app file under /Applications/)
    ("cursor", "Cursor", "Cursor.app"),
    ("antigravity", "Antigravity", "Antigravity.app"),
    ("vscode", "Visual Studio Code", "Visual Studio Code.app"),
    ("vscode-insiders", "VS Code Insiders", "Visual Studio Code - Insiders.app"),
    ("zed", "Zed", "Zed.app"),
    ("webstorm", "WebStorm", "WebStorm.app"),
    ("phpstorm", "PhpStorm", "PhpStorm.app"),
    ("pycharm", "PyCharm", "PyCharm.app"),
    ("intellij", "IntelliJ IDEA", "IntelliJ IDEA.app"),
    ("rustrover", "RustRover", "RustRover.app"),
    ("sublime", "Sublime Text", "Sublime Text.app"),
    ("nova", "Nova", "Nova.app"),
    ("xcode", "Xcode", "Xcode.app"),
];

#[tauri::command]
pub async fn list_available_editors() -> Result<Vec<EditorInfo>, String> {
    let mut found = Vec::new();
    for (id, name, app) in KNOWN_EDITORS {
        let direct = format!("/Applications/{}", app);
        let user_apps = std::env::var("HOME")
            .ok()
            .map(|h| format!("{}/Applications/{}", h, app));

        let exists = Path::new(&direct).exists()
            || user_apps
                .as_ref()
                .map(|p| Path::new(p).exists())
                .unwrap_or(false);

        if exists {
            found.push(EditorInfo {
                id: id.to_string(),
                name: name.to_string(),
            });
        }
    }
    Ok(found)
}

#[tauri::command]
pub async fn open_in_editor(editor_name: String, path: String) -> Result<(), String> {
    let output = Command::new("open")
        .args(["-a", &editor_name, &path])
        .output()
        .await
        .map_err(|e| format!("Failed to launch editor: {}", e))?;

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
