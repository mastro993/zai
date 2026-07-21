use zai_db::recurring_transactions::run_crash_child_from_env;

#[tokio::main(flavor = "current_thread")]
async fn main() {
    run_crash_child_from_env().await;
}
