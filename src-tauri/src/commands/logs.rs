use tauri::State;

use crate::models::LogPayload;
use crate::state::AppState;

#[tauri::command]
pub async fn get_recent_logs(
    service_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<LogPayload>, String> {
    Ok(state.recent_logs(&service_id))
}
