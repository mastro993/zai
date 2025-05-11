use std::collections::HashMap;
use dotenvy::dotenv;
use tauri_plugin_http::reqwest;
use std::env;

const BASE_URL: &str = "https://bankaccountdata.gocardless.com/api/v2";

#[tauri::command]
pub async fn call_gocardless_get_access_token() -> Result<String, String> {
    dotenv().expect(".env file not found");

    let secret_id = env::var("GOCARDLESS_SECRET_ID").unwrap_or_default();
    let secret_key = env::var("GOCARDLESS_SECRET_KEY").unwrap_or_default();

    let mut map = HashMap::new();
    map.insert("secret_id", secret_id);
    map.insert("secret_key", secret_key);

    let client = reqwest::Client::new();
    let res = client
        .post(BASE_URL.to_string() + "/token/new/")
        .json(&map)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    let body = res.text().await.map_err(|e| e.to_string())?;
    Ok(body)
}