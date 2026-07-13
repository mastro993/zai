mod commands;

use dotenvy::dotenv;
use std::sync::Arc;
use tauri::Manager;
use tauri_plugin_log::log::error;
use zai_app::initialize_context;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
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
                let app_data_dir = handle.path().app_data_dir()?;

                let context = match initialize_context(&app_data_dir) {
                    Ok(ctx) => Arc::new(ctx),
                    Err(e) => {
                        error!("Failed to initialize context: {}", e);
                        return Err(Box::<dyn std::error::Error>::from(e));
                    }
                };

                handle.manage(context);

                Ok(())
            })
            .map_err(|e: Box<dyn std::error::Error>| {
                error!("Critical setup failed: {}", e);
                tauri::Error::Setup(e.into())
            })?;

            let salt_path = app.path().app_local_data_dir()?.join("salt.txt");

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
            commands::budgets::get_budgets,
            commands::budgets::get_budget,
            commands::budgets::get_budget_history,
            commands::budgets::create_budget,
            commands::budgets::update_budget,
            commands::budgets::pause_budget,
            commands::budgets::resume_budget,
            commands::stronghold::get_stronghold_vault_password,
            commands::transaction_categories::get_transaction_category,
            commands::transaction_categories::get_transaction_categories,
            commands::transaction_categories::create_transaction_category,
            commands::transaction_categories::update_transaction_category,
            commands::transaction_categories::delete_transaction_categories,
            commands::transaction_categories::import_transaction_categories,
            commands::transactions::get_transactions,
            commands::transactions::get_transaction,
            commands::transactions::create_transaction,
            commands::transactions::update_transaction,
            commands::transactions::delete_transaction,
            commands::transactions::delete_transactions,
            commands::transactions::import_transactions,
            commands::transactions::import_transaction_batch,
        ])
        .build(tauri::generate_context!())
        .expect("error while running tauri application");

    app.run(|_app_handle, _event| {});
}
