use anyhow::{anyhow, Context, Result};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::env;
use std::time::Duration;

pub const DEFAULT_VECTOR_INDEX: &str = "candidate-knowledge-v1";

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorRecord {
    pub id: String,
    pub values: Vec<f32>,
    pub metadata: Value,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VectorMatch {
    pub id: String,
    pub score: f64,
    pub metadata: Option<Value>,
}

#[derive(Debug, Clone)]
pub struct VectorClient {
    client: reqwest::Client,
    account_id: String,
    index_name: String,
}

impl VectorClient {
    pub fn new_from_env() -> Result<Self> {
        let _ = dotenvy::dotenv();

        let account_id = env::var("CLOUDFLARE_ACCOUNT_ID")
            .unwrap_or_else(|_| "c9c8f7d136addc5b184df921cfb2b4fd".to_string());
        let index_name = env::var("VECTORIZE_INDEX_NAME")
            .unwrap_or_else(|_| DEFAULT_VECTOR_INDEX.to_string());
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
            index_name,
        })
    }

    /// Generate a 768-dimensional embedding via Cloudflare Workers AI (@cf/baai/bge-base-en-v1.5)
    pub async fn create_embedding(&self, text: &str) -> Result<Vec<f32>> {
        let url = format!(
            "https://api.cloudflare.com/client/v4/accounts/{}/ai/run/@cf/baai/bge-base-en-v1.5",
            self.account_id
        );

        let body = json!({
            "text": [text]
        });

        let resp = self.client.post(&url).json(&body).send().await?;
        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            return Err(anyhow!("Workers AI embedding failed: {}", err_text));
        }

        let json_val: Value = resp.json().await?;
        let vector = json_val
            .get("result")
            .and_then(|r| r.get("data"))
            .and_then(|d| d.get(0))
            .and_then(|arr| serde_json::from_value::<Vec<f32>>(arr.clone()).ok())
            .ok_or_else(|| anyhow!("Failed to parse embedding vector from Workers AI response"))?;

        Ok(vector)
    }

    /// Upsert vector records into Cloudflare Vectorize index using NDJSON
    pub async fn upsert_vectors(&self, records: &[VectorRecord]) -> Result<()> {
        if records.is_empty() {
            return Ok(());
        }

        let url = format!(
            "https://api.cloudflare.com/client/v4/accounts/{}/vectorize/v2/indexes/{}/upsert",
            self.account_id, self.index_name
        );

        let mut ndjson = String::new();
        for rec in records {
            ndjson.push_str(&serde_json::to_string(rec)?);
            ndjson.push('\n');
        }

        let resp = self
            .client
            .post(&url)
            .header("Content-Type", "application/x-ndjson")
            .body(ndjson)
            .send()
            .await?;

        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            return Err(anyhow!("Vectorize upsert failed: {}", err_text));
        }

        Ok(())
    }

    /// Query the Vectorize index with a vector to find top_k nearest matches
    pub async fn query_vectors(&self, vector: &[f32], top_k: usize) -> Result<Vec<VectorMatch>> {
        let url = format!(
            "https://api.cloudflare.com/client/v4/accounts/{}/vectorize/v2/indexes/{}/query",
            self.account_id, self.index_name
        );

        let body = json!({
            "vector": vector,
            "topK": top_k,
            "returnValues": false,
            "returnMetadata": "all"
        });

        let resp = self.client.post(&url).json(&body).send().await?;
        if !resp.status().is_success() {
            let err_text = resp.text().await.unwrap_or_default();
            return Err(anyhow!("Vectorize query failed: {}", err_text));
        }

        let val: Value = resp.json().await?;
        let mut matches = Vec::new();

        if let Some(matches_arr) = val.get("result").and_then(|r| r.get("matches")).and_then(|m| m.as_array()) {
            for m in matches_arr {
                let id = m.get("id").and_then(|i| i.as_str()).unwrap_or_default().to_string();
                let score = m.get("score").and_then(|s| s.as_f64()).unwrap_or(0.0);
                let metadata = m.get("metadata").cloned();
                matches.push(VectorMatch { id, score, metadata });
            }
        }

        Ok(matches)
    }

    /// Ensure the target Vectorize index exists, creating it if needed
    pub async fn ensure_index(&self) -> Result<()> {
        let list_url = format!(
            "https://api.cloudflare.com/client/v4/accounts/{}/vectorize/v2/indexes",
            self.account_id
        );

        let resp = self.client.get(&list_url).send().await?;
        if !resp.status().is_success() {
            return Err(anyhow!("Failed to list Vectorize indexes: HTTP {}", resp.status()));
        }

        let json_val: Value = resp.json().await?;
        let exists = json_val
            .get("result")
            .and_then(|r| r.as_array())
            .map(|arr| {
                arr.iter().any(|idx| {
                    idx.get("name").and_then(|n| n.as_str()) == Some(&self.index_name)
                })
            })
            .unwrap_or(false);

        if !exists {
            let create_url = format!(
                "https://api.cloudflare.com/client/v4/accounts/{}/vectorize/v2/indexes",
                self.account_id
            );
            let body = json!({
                "name": self.index_name,
                "description": "Candidate knowledge base and portfolio embeddings for job applications",
                "config": {
                    "dimensions": 768,
                    "metric": "cosine"
                }
            });

            let create_resp = self.client.post(&create_url).json(&body).send().await?;
            if !create_resp.status().is_success() {
                let err = create_resp.text().await.unwrap_or_default();
                return Err(anyhow!("Failed to create Vectorize index {}: {}", self.index_name, err));
            }
        }

        Ok(())
    }
}
