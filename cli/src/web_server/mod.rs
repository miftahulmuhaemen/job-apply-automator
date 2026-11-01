pub mod routes;

use crate::storage::D1Client;
use anyhow::{Context, Result};
use axum::Router;
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};
use tower_http::services::{ServeDir, ServeFile};

pub struct WebServer;

impl WebServer {
    pub async fn start(port: u16) -> Result<()> {
        let d1 = D1Client::new_from_env().context("Failed to initialize Cloudflare D1 client")?;
        let state = Arc::new(routes::AppState::new(d1));

        let api_router = routes::create_api_router(state);

        // Find dist directory
        let dist_candidates = [
            PathBuf::from("web/frontend/dist"),
            PathBuf::from("../web/frontend/dist"),
            PathBuf::from("dist"),
        ];

        let dist_path = dist_candidates
            .into_iter()
            .find(|p| p.join("index.html").exists())
            .unwrap_or_else(|| PathBuf::from("web/frontend/dist"));

        let index_file = dist_path.join("index.html");

        let cors = CorsLayer::new()
            .allow_origin(Any)
            .allow_methods(Any)
            .allow_headers(Any);

        let app = if index_file.exists() {
            println!("Serving SPA static assets from: {}", dist_path.display());
            let serve_dir = ServeDir::new(&dist_path)
                .fallback(ServeFile::new(&index_file));
            Router::new()
                .merge(api_router)
                .fallback_service(serve_dir)
                .layer(cors)
        } else {
            println!("Static assets not found at {}, serving API routes only", dist_path.display());
            Router::new().merge(api_router).layer(cors)
        };

        let addr = SocketAddr::from(([0, 0, 0, 0], port));
        println!("Rust Embedded Web Console running at http://localhost:{}", port);

        let listener = tokio::net::TcpListener::bind(addr).await?;
        axum::serve(listener, app).await?;

        Ok(())
    }
}
