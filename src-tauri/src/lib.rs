mod gocardless;

use tauri::Manager;

pub fn run() {
    tauri::Builder::default()
        // .plugin(tauri_plugin_single_instance::init())
        .invoke_handler(tauri::generate_handler![
            gocardless::call_gocardless_get_access_token
        ])
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            let salt_path = app
                .path()
                .app_local_data_dir()
                .expect("could not resolve app local data path")
                .join("salt.txt");
            app.handle()
                .plugin(tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build())?;
            Ok(())
        })
        .plugin(
            tauri_plugin_log::Builder::new()
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
