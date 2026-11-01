use anyhow::{anyhow, Context, Result};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use serde_json::{json, Value};
use std::env;
use std::time::Duration;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct D1ExecResult {
    pub success: bool,
    pub changes: u64,
    pub last_row_id: u64,
}

#[derive(Debug, Clone)]
pub struct D1Client {
    client: reqwest::Client,
    account_id: String,
    database_id: String,
    auth_token: String,
}

impl D1Client {
    pub fn new_from_env() -> Result<Self> {
        let _ = dotenvy::dotenv();

        let account_id = env::var("CLOUDFLARE_ACCOUNT_ID")
            .unwrap_or_else(|_| "c9c8f7d136addc5b184df921cfb2b4fd".to_string());
        let database_id = env::var("D1_DATABASE_ID")
            .unwrap_or_else(|_| "b54fd60b-28c4-4577-b02c-478797c90122".to_string());
        let auth_token = env::var("CLOUDFLARE_API_TOKEN")
            .context("Missing CLOUDFLARE_API_TOKEN environment variable")?;

        let mut headers = HeaderMap::new();
        headers.insert(
            AUTHORIZATION,
            HeaderValue::from_str(&format!("Bearer {}", auth_token.trim()))?,
        );
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));

        let client = reqwest::Client::builder()
            .default_headers(headers)
            .timeout(Duration::from_secs(30))
            .pool_idle_timeout(Duration::from_secs(90))
            .pool_max_idle_per_host(10)
            .build()?;

        Ok(Self {
            client,
            account_id,
            database_id,
            auth_token,
        })
    }

    pub fn account_id(&self) -> &str {
        &self.account_id
    }

    pub fn database_id(&self) -> &str {
        &self.database_id
    }

    pub fn auth_token(&self) -> &str {
        &self.auth_token
    }

    pub async fn query<T: DeserializeOwned>(&self, sql: &str, params: &[Value]) -> Result<Vec<T>> {
        let url = format!(
            "https://api.cloudflare.com/client/v4/accounts/{}/d1/database/{}/query",
            self.account_id, self.database_id
        );

        let mut body = json!({
            "sql": sql
        });

        if !params.is_empty() {
            body["params"] = Value::Array(params.to_vec());
        }

        let resp = self.client.post(&url).json(&body).send().await?;
        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(anyhow!("D1 HTTP error {}: {}", status, text));
        }

        let json_val: Value = resp.json().await?;
        if !json_val["success"].as_bool().unwrap_or(false) {
            let err_msg = json_val["errors"][0]["message"]
                .as_str()
                .unwrap_or("D1 query failed");
            return Err(anyhow!("D1 query error: {}", err_msg));
        }

        let results_val = &json_val["result"][0]["results"];
        if results_val.is_null() {
            return Ok(Vec::new());
        }

        let items: Vec<T> = serde_json::from_value(results_val.clone())
            .with_context(|| format!("Failed to deserialize D1 results: {}", results_val))?;

        Ok(items)
    }

    pub async fn execute(&self, sql: &str, params: &[Value]) -> Result<D1ExecResult> {
        let url = format!(
            "https://api.cloudflare.com/client/v4/accounts/{}/d1/database/{}/query",
            self.account_id, self.database_id
        );

        let mut body = json!({
            "sql": sql
        });

        if !params.is_empty() {
            body["params"] = Value::Array(params.to_vec());
        }

        let resp = self.client.post(&url).json(&body).send().await?;
        if !resp.status().is_success() {
            let status = resp.status();
            let text = resp.text().await.unwrap_or_default();
            return Err(anyhow!("D1 HTTP error {}: {}", status, text));
        }

        let json_val: Value = resp.json().await?;
        if !json_val["success"].as_bool().unwrap_or(false) {
            let err_msg = json_val["errors"][0]["message"]
                .as_str()
                .unwrap_or("D1 execute failed");
            return Err(anyhow!("D1 execute error: {}", err_msg));
        }

        let meta = &json_val["result"][0]["meta"];
        let changes = meta["changes"].as_u64().unwrap_or(0);
        let last_row_id = meta["last_row_id"].as_u64().unwrap_or(0);

        Ok(D1ExecResult {
            success: true,
            changes,
            last_row_id,
        })
    }
}
