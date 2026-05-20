use chrono::Utc;
use uuid::Uuid;

use crate::commands::storage;
use crate::models::{DetectionResult, Project};

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

#[tauri::command]
pub async fn list_projects() -> Result<Vec<Project>, String> {
    storage::read_db().map_err(err)
}

#[tauri::command]
pub async fn create_project_from_detection(
    detection: DetectionResult,
) -> Result<Project, String> {
    let mut projects = storage::read_db().map_err(err)?;

    let project = Project {
        id: Uuid::new_v4().to_string(),
        name: detection.folder_label.clone(),
        color: None,
        services: detection.services.clone(),
        created_at: Utc::now().to_rfc3339(),
    };

    projects.push(project.clone());
    storage::write_db(&projects).map_err(err)?;
    Ok(project)
}

#[tauri::command]
pub async fn add_folder_to_project(
    project_id: String,
    detection: DetectionResult,
) -> Result<Project, String> {
    let mut projects = storage::read_db().map_err(err)?;
    let target = projects
        .iter_mut()
        .find(|p| p.id == project_id)
        .ok_or_else(|| format!("project {project_id} not found"))?;

    target.services.extend(detection.services.clone());
    let updated = target.clone();
    storage::write_db(&projects).map_err(err)?;
    Ok(updated)
}

#[tauri::command]
pub async fn update_project(project: Project) -> Result<(), String> {
    let mut projects = storage::read_db().map_err(err)?;
    let pos = projects
        .iter()
        .position(|p| p.id == project.id)
        .ok_or_else(|| format!("project {} not found", project.id))?;
    projects[pos] = project;
    storage::write_db(&projects).map_err(err)
}

#[tauri::command]
pub async fn delete_project(project_id: String) -> Result<(), String> {
    let mut projects = storage::read_db().map_err(err)?;
    let before = projects.len();
    projects.retain(|p| p.id != project_id);
    if projects.len() == before {
        return Err(format!("project {project_id} not found"));
    }
    storage::write_db(&projects).map_err(err)
}
