use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleClientSecretInfo {
    pub client_id: String,
    pub client_secret: String,
    pub auth_uri: Option<String>,
    pub token_uri: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleClientSecretFile {
    pub installed: Option<GoogleClientSecretInfo>,
    pub web: Option<GoogleClientSecretInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GoogleToken {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub scope: Option<String>,
    pub token_type: Option<String>,
    pub expiry_date: Option<u64>,
}

pub struct GmailClient {
    client_id: String,
    client_secret: String,
    token: GoogleToken,
}

impl GmailClient {
    pub fn get_credentials_dir() -> PathBuf {
        std::env::var("JOB_APPLY_DATA_DIR")
            .map(PathBuf::from)
            .or_else(|_| std::env::var("HOME").map(|h| PathBuf::from(h).join(".job_apply_automator")))
            .unwrap_or_else(|_| PathBuf::from(".job_apply_automator"))
            .join("credentials")
    }

    pub fn get_secret_file() -> PathBuf {
        Self::get_credentials_dir().join("gmail_client_secret.json")
    }

    pub fn get_token_file() -> PathBuf {
        Self::get_credentials_dir().join("gmail_token.json")
    }

    pub fn load_client_secret() -> Result<GoogleClientSecretInfo> {
        let path = Self::get_secret_file();
        if !path.exists() {
            return Err(anyhow!(
                "Gmail client secret not found at: {}",
                path.display()
            ));
        }
        let content = fs::read_to_string(&path)?;
        let parsed: GoogleClientSecretFile = serde_json::from_str(&content)?;
        parsed
            .installed
            .or(parsed.web)
            .ok_or_else(|| anyhow!("Invalid client secret format in {}", path.display()))
    }

    pub fn load_saved_token() -> Result<GoogleToken> {
        let path = Self::get_token_file();
        if !path.exists() {
            return Err(anyhow!(
                "Gmail token not found. Please run `job-apply-backend auth-gmail` first."
            ));
        }
        let content = fs::read_to_string(&path)?;
        let token: GoogleToken = serde_json::from_str(&content)?;
        Ok(token)
    }

    pub fn save_token(token: &GoogleToken) -> Result<()> {
        let dir = Self::get_credentials_dir();
        fs::create_dir_all(&dir)?;
        let path = Self::get_token_file();
        let json = serde_json::to_string_pretty(token)?;
        fs::write(&path, json)?;
        Ok(())
    }

    pub async fn new() -> Result<Self> {
        let secret = Self::load_client_secret()?;
        let token = Self::load_saved_token()?;
        let mut client = Self {
            client_id: secret.client_id,
            client_secret: secret.client_secret,
            token,
        };
        client.ensure_valid_token().await?;
        Ok(client)
    }

    pub async fn ensure_valid_token(&mut self) -> Result<()> {
        if let Some(refresh_token) = &self.token.refresh_token {
            let client = reqwest::Client::new();
            let res = client
                .post("https://oauth2.googleapis.com/token")
                .form(&[
                    ("client_id", self.client_id.as_str()),
                    ("client_secret", self.client_secret.as_str()),
                    ("refresh_token", refresh_token.as_str()),
                    ("grant_type", "refresh_token"),
                ])
                .send()
                .await;

            if let Ok(resp) = res {
                if resp.status().is_success() {
                    #[derive(Deserialize)]
                    struct RefreshResponse {
                        access_token: String,
                    }
                    if let Ok(data) = resp.json::<RefreshResponse>().await {
                        self.token.access_token = data.access_token;
                        let _ = Self::save_token(&self.token);
                    }
                }
            }
        }
        Ok(())
    }

    pub async fn create_draft(&self, raw_mime: &str) -> Result<serde_json::Value> {
        use base64::Engine;
        let encoded = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(raw_mime);

        let client = reqwest::Client::new();
        let resp = client
            .post("https://gmail.googleapis.com/gmail/v1/users/me/drafts")
            .bearer_auth(&self.token.access_token)
            .json(&serde_json::json!({
                "message": {
                    "raw": encoded
                }
            }))
            .send()
            .await?;

        if !resp.status().is_success() {
            let err_txt = resp.text().await.unwrap_or_default();
            return Err(anyhow!("Failed to create draft in Gmail: {}", err_txt));
        }

        let body: serde_json::Value = resp.json().await?;
        Ok(body)
    }

    pub async fn send_message(&self, raw_mime: &str) -> Result<serde_json::Value> {
        use base64::Engine;
        let encoded = base64::engine::general_purpose::URL_SAFE_NO_PAD.encode(raw_mime);

        let client = reqwest::Client::new();
        let resp = client
            .post("https://gmail.googleapis.com/gmail/v1/users/me/messages/send")
            .bearer_auth(&self.token.access_token)
            .json(&serde_json::json!({
                "raw": encoded
            }))
            .send()
            .await?;

        if !resp.status().is_success() {
            let err_txt = resp.text().await.unwrap_or_default();
            return Err(anyhow!("Failed to send email via Gmail: {}", err_txt));
        }

        let body: serde_json::Value = resp.json().await?;
        Ok(body)
    }
}
