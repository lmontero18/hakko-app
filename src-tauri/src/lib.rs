mod commands;
mod models;
mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::projects::list_projects,
            commands::projects::create_project_from_detection,
            commands::projects::add_folder_to_project,
            commands::projects::update_project,
            commands::projects::delete_project,
            commands::detection::detect_services,
            commands::process::start_service,
            commands::process::stop_service,
            commands::process::list_running,
            commands::logs::get_recent_logs,
            commands::ports::list_listening_ports,
            commands::ports::kill_port_process,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
