#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use dotenvy::dotenv;

fn main() {
    dotenv().ok();

    Zai::run();
}
