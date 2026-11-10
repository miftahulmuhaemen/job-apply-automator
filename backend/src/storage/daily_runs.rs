use crate::storage::d1_client::D1Client;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyRunRecord {
    pub id: Option<i64>,
    pub uuid: Option<String>,
    pub run_date: String,
    pub batch_size: Option<i64>,
    pub processed_count: Option<i64>,
    pub success_count: Option<i64>,
    pub skipped_count: Option<i64>,
    pub failed_count: Option<i64>,
    pub status: Option<String>,
    pub details: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Clone, Debug)]
pub struct DailyRunsRepository {
    client: D1Client,
}

impl DailyRunsRepository {
    pub fn new(client: D1Client) -> Self {
        Self { client }
    }

    /// Direct projected column query with lazy seed on empty (Issue 6)
    pub async fn get_recorded_runs(&self) -> Result<Vec<DailyRunRecord>> {
        let sql = "SELECT
            id, uuid, run_date, batch_size, processed_count, success_count,
            skipped_count, failed_count, status, details, created_at
        FROM daily_runs
        ORDER BY created_at DESC, id DESC;";

        let rows: Vec<DailyRunRecord> = self.client.query(sql, &[]).await?;
        if rows.is_empty() {
            self.seed_defaults().await?;
            return self.client.query(sql, &[]).await;
        }

        Ok(rows)
    }

    pub async fn seed_defaults(&self) -> Result<()> {
        let run_id = Uuid::now_v7().to_string();
        let sql = "INSERT INTO daily_runs (
            uuid, run_date, batch_size, processed_count, success_count, skipped_count, failed_count, status, details
        ) VALUES (?1, date('now'), 10, 0, 0, 0, 0, 'INITIALIZED', 'Initial schedule ledger record created.');";

        let _ = self.client.execute(sql, &[Value::String(run_id)]).await;
        Ok(())
    }
}
