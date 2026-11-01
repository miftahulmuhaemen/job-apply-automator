use crate::storage::d1_client::D1Client;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebsiteRecord {
    pub id: String,
    pub name: String,
    pub url: String,
    pub allowed: Option<i64>,
    pub auth_type: Option<String>,
    pub username: Option<String>,
    pub credential_note: Option<String>,
    pub notes: Option<String>,
    pub cooldown_days: Option<i64>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct WebsiteUpdate {
    pub name: Option<String>,
    pub url: Option<String>,
    pub allowed: Option<bool>,
    pub auth_type: Option<String>,
    pub username: Option<String>,
    pub credential_note: Option<String>,
    pub notes: Option<String>,
}

#[derive(Clone, Debug)]
pub struct WebsitesRepository {
    client: D1Client,
}

impl WebsitesRepository {
    pub fn new(client: D1Client) -> Self {
        Self { client }
    }

    /// Single roundtrip query without pre-count query, lazy seed on empty (Issue 6)
    pub async fn get_websites(&self) -> Result<Vec<WebsiteRecord>> {
        let sql = "SELECT
            id, name, url, allowed, auth_type, username, credential_note, notes,
            cooldown_days, created_at, updated_at
        FROM websites_master
        ORDER BY allowed DESC, name ASC;";

        let rows: Vec<WebsiteRecord> = self.client.query(sql, &[]).await?;
        if rows.is_empty() {
            self.seed_defaults().await?;
            return self.client.query(sql, &[]).await;
        }

        Ok(rows)
    }

    /// Single roundtrip COALESCE update without read-before-write (Issue 3)
    pub async fn update_website(&self, id: &str, update: &WebsiteUpdate) -> Result<bool> {
        let sql = "UPDATE websites_master
        SET name = COALESCE(?1, name),
            url = COALESCE(?2, url),
            allowed = COALESCE(?3, allowed),
            auth_type = COALESCE(?4, auth_type),
            username = COALESCE(?5, username),
            credential_note = COALESCE(?6, credential_note),
            notes = COALESCE(?7, notes),
            updated_at = datetime('now')
        WHERE id = ?8;";

        let params = vec![
            update.name.as_deref().map(Value::from).unwrap_or(Value::Null),
            update.url.as_deref().map(Value::from).unwrap_or(Value::Null),
            update.allowed.map(|a| Value::from(if a { 1 } else { 0 })).unwrap_or(Value::Null),
            update.auth_type.as_deref().map(Value::from).unwrap_or(Value::Null),
            update.username.as_deref().map(Value::from).unwrap_or(Value::Null),
            update.credential_note.as_deref().map(Value::from).unwrap_or(Value::Null),
            update.notes.as_deref().map(Value::from).unwrap_or(Value::Null),
            Value::String(id.to_string()),
        ];

        let res = self.client.execute(sql, &params).await?;
        Ok(res.changes > 0)
    }

    pub async fn seed_defaults(&self) -> Result<()> {
        let sites = [
            ("Jobstreet Indonesia", "https://www.jobstreet.co.id", "Google PIN / OTP"),
            ("LinkedIn Indonesia", "https://www.linkedin.com", "Session Cookie / OTP"),
            ("Kalibrr", "https://www.kalibrr.com", "Password / Email"),
            ("Glints Indonesia", "https://glints.com/id", "Google SSO / Email"),
            ("Deel Careers", "https://www.deel.com/careers", "Direct Application"),
        ];

        for (name, url, auth_type) in sites {
            let id = Uuid::now_v7().to_string();
            let sql = "INSERT INTO websites_master (id, name, url, allowed, auth_type)
            VALUES (?1, ?2, ?3, 1, ?4)
            ON CONFLICT(url) DO NOTHING;";
            let _ = self.client.execute(sql, &[
                Value::String(id),
                Value::String(name.to_string()),
                Value::String(url.to_string()),
                Value::String(auth_type.to_string()),
            ]).await;
        }

        Ok(())
    }
}
