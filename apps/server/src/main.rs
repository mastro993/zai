use zai_server::{ServerConfig, serve};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = ServerConfig::from_env().map_err(|error| {
        eprintln!("{error}");
        error
    })?;

    serve(config).await?;

    Ok(())
}
