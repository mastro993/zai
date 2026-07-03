use base64::{Engine, engine::general_purpose::STANDARD};
use keyring::Entry;
use rand::RngCore;

const SERVICE_NAME: &str = "zai-app";
const ACCOUNT_NAME: &str = "stronghold-vault-password";

fn credential_store_error() -> String {
    "Failed to access secure credential store".to_string()
}

fn generate_vault_password() -> String {
    let mut bytes = [0u8; 32];
    rand::rng().fill_bytes(&mut bytes);
    STANDARD.encode(bytes)
}

#[tauri::command]
pub fn get_stronghold_vault_password() -> Result<String, String> {
    let entry = Entry::new(SERVICE_NAME, ACCOUNT_NAME).map_err(|_| credential_store_error())?;

    match entry.get_password() {
        Ok(password) => Ok(password),
        Err(keyring::Error::NoEntry) => {
            let password = generate_vault_password();
            entry
                .set_password(&password)
                .map_err(|_| credential_store_error())?;
            Ok(password)
        }
        Err(_) => Err(credential_store_error()),
    }
}
