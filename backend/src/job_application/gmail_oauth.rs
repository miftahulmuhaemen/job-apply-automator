use anyhow::{anyhow, Result};
use axum::{
    extract::Query,
    response::{Html, IntoResponse},
    routing::get,
    Router,
};
use serde::Deserialize;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::oneshot;

use super::gmail_client::{GmailClient, GoogleToken};

#[derive(Deserialize)]
struct CallbackQuery {
    code: Option<String>,
}

pub struct GmailOAuthService;

impl GmailOAuthService {
    pub async fn run_auth_flow() -> Result<()> {
        let secret = GmailClient::load_client_secret()?;

        let redirect_uri = "http://localhost:3210/oauth2callback";
        let scopes = [
            "https://www.googleapis.com/auth/gmail.compose",
            "https://www.googleapis.com/auth/gmail.send",
            "https://www.googleapis.com/auth/gmail.readonly",
        ]
        .join(" ");

        let auth_url = format!(
            "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent",
            urlencode(&secret.client_id),
            urlencode(redirect_uri),
            urlencode(&scopes)
        );

        println!("\n========================================================");
        println!("  NATIVE RUST GMAIL OAUTH (Google SSO)");
        println!("========================================================");
        println!("Opening browser to authorize Gmail API access...\n");
        println!("If browser does not open automatically, visit this URL:\n");
        println!("{}\n", auth_url);

        // Open browser
        let _ = std::process::Command::new("cmd.exe")
            .args(["/c", "start", "", &auth_url])
            .spawn()
            .or_else(|_| {
                std::process::Command::new("xdg-open")
                    .arg(&auth_url)
                    .spawn()
            });

        // Set up one-time axum listener on port 3210
        let (tx, rx) = oneshot::channel::<String>();
        let tx = Arc::new(tokio::sync::Mutex::new(Some(tx)));

        let app = Router::new().route(
            "/oauth2callback",
            get({
                let tx = tx.clone();
                move |Query(query): Query<CallbackQuery>| async move {
                    if let Some(code) = query.code {
                        let mut lock = tx.lock().await;
                        if let Some(sender) = lock.take() {
                            let _ = sender.send(code);
                        }
                        Html("<html><body style=\"font-family: sans-serif; background: #09090b; color: #fff; text-align: center; padding: 50px;\"><h1 style=\"color: #22c55e;\">Authentication Successful!</h1><p>Native Rust Gmail integration authorized.</p><p>You can close this tab now.</p></body></html>")
                    } else {
                        Html("<html><body><h1>Authentication Failed: Missing code</h1></body></html>")
                    }
                }
            }),
        );

        let addr = SocketAddr::from(([127, 0, 0, 1], 3210));
        let listener = tokio::net::TcpListener::bind(addr).await?;
        println!("Listening for OAuth callback on http://localhost:3210/oauth2callback ...");

        tokio::select! {
            res = axum::serve(listener, app) => {
                res?;
                return Err(anyhow!("Server closed unexpectedly"));
            }
            code_res = rx => {
                let code = code_res?;
                println!("Authorization code received! Exchanging for tokens...");

                let client = reqwest::Client::new();
                let token_res = client
                    .post("https://oauth2.googleapis.com/token")
                    .form(&[
                        ("client_id", secret.client_id.as_str()),
                        ("client_secret", secret.client_secret.as_str()),
                        ("code", code.as_str()),
                        ("grant_type", "authorization_code"),
                        ("redirect_uri", redirect_uri),
                    ])
                    .send()
                    .await?;

                if !token_res.status().is_success() {
                    let err = token_res.text().await.unwrap_or_default();
                    return Err(anyhow!("Token exchange failed: {}", err));
                }

                #[derive(Deserialize)]
                struct TokenResponse {
                    access_token: String,
                    refresh_token: Option<String>,
                    expires_in: Option<u64>,
                    token_type: Option<String>,
                    scope: Option<String>,
                }

                let tokens: TokenResponse = token_res.json().await?;
                let saved_token = GoogleToken {
                    access_token: tokens.access_token,
                    refresh_token: tokens.refresh_token,
                    scope: tokens.scope,
                    token_type: tokens.token_type,
                    expiry_date: tokens.expires_in.map(|secs| chrono::Utc::now().timestamp() as u64 + secs),
                };

                GmailClient::save_token(&saved_token)?;
                println!("Tokens securely saved to: {}", GmailClient::get_token_file().display());
                println!("Native Gmail OAuth setup COMPLETE!\n");
            }
        }

        Ok(())
    }
}

pub fn urlencode(s: &str) -> String {
    let mut result = String::new();
    for b in s.bytes() {
        match b {
            b'a'..=b'z' | b'A'..=b'Z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                result.push(b as char);
            }
            _ => {
                result.push_str(&format!("%{:02X}", b));
            }
        }
    }
    result
}
