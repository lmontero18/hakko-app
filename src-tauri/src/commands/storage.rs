use std::fs;
use std::path::PathBuf;

use anyhow::{Context, Result};

use crate::models::Project;

const APP_DIR_NAME: &str = "Hakko";
const LEGACY_APP_DIR_NAMES: &[&str] = &["Hako", "env-local-managment"];
const DB_FILE_NAME: &str = "db.json";

pub fn app_config_dir() -> Result<PathBuf> {
    let base = dirs::config_dir().context("could not resolve user config dir")?;
    Ok(base.join(APP_DIR_NAME))
}

pub fn db_path() -> Result<PathBuf> {
    Ok(app_config_dir()?.join(DB_FILE_NAME))
}

fn migrate_from_legacy() {
    let Ok(new_dir) = app_config_dir() else { return };
    if new_dir.exists() {
        return;
    }
    let Some(base) = dirs::config_dir() else { return };
    for legacy in LEGACY_APP_DIR_NAMES {
        let old_dir = base.join(legacy);
        if old_dir.exists() {
            let _ = fs::rename(&old_dir, &new_dir);
            return;
        }
    }
}

pub fn read_db() -> Result<Vec<Project>> {
    migrate_from_legacy();
    let path = db_path()?;
    if !path.exists() {
        return Ok(vec![]);
    }
    let raw = fs::read_to_string(&path)
        .with_context(|| format!("failed to read db file at {}", path.display()))?;
    if raw.trim().is_empty() {
        return Ok(vec![]);
    }
    let projects: Vec<Project> = serde_json::from_str(&raw)
        .with_context(|| format!("failed to parse db file at {}", path.display()))?;
    Ok(projects)
}

pub fn write_db(projects: &[Project]) -> Result<()> {
    let dir = app_config_dir()?;
    fs::create_dir_all(&dir)
        .with_context(|| format!("failed to create config dir {}", dir.display()))?;
    let path = db_path()?;
    let raw = serde_json::to_string_pretty(projects)?;
    fs::write(&path, raw)
        .with_context(|| format!("failed to write db file at {}", path.display()))?;
    Ok(())
}
