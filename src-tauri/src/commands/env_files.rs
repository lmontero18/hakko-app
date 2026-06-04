use std::fs;
use std::path::Path;

use serde::Serialize;

/// Standard dotenv file names Hako is allowed to read/write. Keeping this an
/// explicit allowlist means the frontend can never read or write an arbitrary
/// file through these commands — a name with path separators (or anything
/// else not listed here) is rejected, so we can't escape the target folder.
const ALLOWED_ENV_FILES: &[&str] = &[".env", ".env.local", ".env.example"];

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EnvFile {
    pub name: String,
    pub content: String,
}

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

/// Reads the standard dotenv files that exist in `dir`. Missing files are
/// simply omitted from the result (never an error). Files are returned in the
/// canonical order defined by `ALLOWED_ENV_FILES`.
#[tauri::command]
pub async fn read_env_files(dir: String) -> Result<Vec<EnvFile>, String> {
    let root = Path::new(&dir);
    if !root.is_dir() {
        return Err(format!("{dir} is not a directory"));
    }

    let mut files = Vec::new();
    for name in ALLOWED_ENV_FILES {
        let path = root.join(name);
        if path.is_file() {
            let content = fs::read_to_string(&path).map_err(err)?;
            files.push(EnvFile {
                name: (*name).to_string(),
                content,
            });
        }
    }
    Ok(files)
}

/// Writes `content` to `<dir>/<name>`. `name` must be one of the allowed
/// dotenv file names — anything else is rejected, so this command can never
/// touch a file outside `dir`.
#[tauri::command]
pub async fn write_env_file(dir: String, name: String, content: String) -> Result<(), String> {
    if !ALLOWED_ENV_FILES.contains(&name.as_str()) {
        return Err(format!("{name} is not an editable env file"));
    }

    let root = Path::new(&dir);
    if !root.is_dir() {
        return Err(format!("{dir} is not a directory"));
    }

    fs::write(root.join(&name), content).map_err(err)?;
    Ok(())
}
