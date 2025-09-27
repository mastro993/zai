#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;
mod context;

use dotenvy::dotenv;
use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_log::log::error;

fn main() {
    dotenv().ok();

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|_, _, _| {}))
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .setup(move |app| {
            let handle = app.handle().clone();

            tauri::async_runtime::block_on(async {
                let app_data_dir = handle
                    .path()
                    .app_data_dir()? // Use ? directly on the Result
                    .to_str()
                    .ok_or("Failed to convert app data dir path to string")?
                    .to_string();

                let context = match context::initialize_context(&app_data_dir).await {
                    Ok(ctx) => Arc::new(ctx),
                    Err(e) => {
                        error!("Failed to initialize context: {}", e);
                        // Propagate the original boxed error
                        return Err(e);
                    }
                };

                handle.manage(context.clone());

                Ok(())
            }) // Handle potential errors from the block_on section
            .map_err(|e: Box<dyn std::error::Error>| {
                error!("Critical setup failed: {}", e);
                // Convert the boxed error into Tauri's setup error type if needed, or handle otherwise
                tauri::Error::Setup(e.into()) // Or Box::new(tauri::Error::Setup(e.into())) depending on signature needs
            })?;

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
        .invoke_handler(tauri::generate_handler![
            commands::transaction_categories::get_transaction_categories,
            commands::transaction_categories::get_transaction_category,
            commands::transaction_categories::create_transaction_category,
            commands::transaction_categories::update_transaction_category,
            commands::transaction_categories::delete_transaction_category,
            commands::transaction_categories::import_transaction_categories,
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    app.run(|_app_handle, _event| {});
}
