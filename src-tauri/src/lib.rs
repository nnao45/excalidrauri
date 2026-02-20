mod commands;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // Create base canvas directory on startup
            let base_dir = commands::resolve_base_dir(app.handle())?;
            std::fs::create_dir_all(&base_dir)?;
            // Create trash directory on startup
            let trash_dir = commands::resolve_trash_dir(app.handle())?;
            std::fs::create_dir_all(&trash_dir)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_dir,
            commands::create_folder,
            commands::create_canvas,
            commands::delete_item,
            commands::rename_item,
            commands::read_canvas,
            commands::save_canvas,
            commands::get_base_directory,
            commands::trash_item,
            commands::list_trash,
            commands::restore_item,
            commands::delete_permanently,
            commands::empty_trash,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
