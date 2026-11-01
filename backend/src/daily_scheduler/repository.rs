use super::model::{DailyRunRecord, SchedulerSettings};
use crate::storage::D1Client;
use anyhow::{anyhow, Result};
use chrono::Local;
use serde_json::Value;
use uuid::Uuid;

#[derive(Clone, Debug)]
pub struct SchedulerRepository {
    client: D1Client,
}

impl SchedulerRepository {
    pub fn new(client: D1Client) -> Self {
        Self { client }
    }

    pub async fn get_settings(&self) -> Result<SchedulerSettings> {
        let sql = "SELECT id, enabled, schedule_time, max_daily_applications, portals, last_run_at, next_run_at,
                          COALESCE(cli_agent_enabled, 1) as cli_agent_enabled,
                          COALESCE(cli_agent_model, 'gemini-3.8-flash-high') as cli_agent_model,
                          COALESCE(cli_agent_binary, '/home/sahana/.local/bin/agy') as cli_agent_binary,
                          COALESCE(cli_agent_timeout_seconds, 60) as cli_agent_timeout_seconds
                   FROM scheduler_settings 
                   WHERE id = 1;";

        let rows: Vec<Value> = self.client.query(sql, &[]).await?;
        let row = rows.into_iter().next().ok_or_else(|| anyhow!("Scheduler settings row not found"))?;

        let enabled_val = match row.get("enabled") {
            Some(Value::Bool(b)) => *b,
            Some(Value::Number(n)) => n.as_i64().unwrap_or(1) == 1,
            _ => true,
        };

        let cli_enabled_val = match row.get("cli_agent_enabled") {
            Some(Value::Bool(b)) => *b,
            Some(Value::Number(n)) => n.as_i64().unwrap_or(1) == 1,
            _ => true,
        };

        Ok(SchedulerSettings {
            id: row.get("id").and_then(|v| v.as_i64()).unwrap_or(1),
            enabled: enabled_val,
            schedule_time: row.get("schedule_time").and_then(|v| v.as_str()).unwrap_or("09:00").to_string(),
            max_daily_applications: row.get("max_daily_applications").and_then(|v| v.as_i64()).unwrap_or(10),
            portals: row.get("portals").and_then(|v| v.as_str()).unwrap_or("Jobstreet, LinkedIn").to_string(),
            last_run_at: row.get("last_run_at").and_then(|v| v.as_str()).map(|s| s.to_string()),
            next_run_at: row.get("next_run_at").and_then(|v| v.as_str()).map(|s| s.to_string()),
            cli_agent_enabled: cli_enabled_val,
            cli_agent_model: row.get("cli_agent_model").and_then(|v| v.as_str()).unwrap_or("gemini-3.8-flash-high").to_string(),
            cli_agent_binary: row.get("cli_agent_binary").and_then(|v| v.as_str()).unwrap_or("/home/sahana/.local/bin/agy").to_string(),
            cli_agent_timeout_seconds: row.get("cli_agent_timeout_seconds").and_then(|v| v.as_u64()).unwrap_or(60),
        })
    }

    pub async fn has_run_completed_today(&self) -> Result<bool> {
        let today = Local::now().format("%Y-%m-%d").to_string();
        let sql = "SELECT id FROM daily_runs WHERE run_date = ?1 AND status = 'COMPLETED' LIMIT 1;";
        let rows: Vec<Value> = self.client.query(sql, &[Value::String(today)]).await?;
        Ok(!rows.is_empty())
    }

    pub async fn record_batch_run(&self, record: &DailyRunRecord) -> Result<()> {
        let new_uuid = Uuid::now_v7().to_string();
        let sql = "INSERT INTO daily_runs (
            uuid, run_date, batch_size, processed_count, success_count, skipped_count, failed_count, status, details, created_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, datetime('now'))
        ON CONFLICT(run_date) DO UPDATE SET
            batch_size = excluded.batch_size,
            processed_count = excluded.processed_count,
            success_count = excluded.success_count,
            skipped_count = excluded.skipped_count,
            failed_count = excluded.failed_count,
            status = excluded.status,
            details = excluded.details,
            created_at = datetime('now');";

        self.client.execute(
            sql,
            &[
                Value::String(new_uuid),
                Value::String(record.run_date.clone()),
                Value::from(record.batch_size),
                Value::from(record.processed_count),
                Value::from(record.success_count),
                Value::from(record.skipped_count),
                Value::from(record.failed_count),
                Value::String(record.status.clone()),
                Value::String(record.details.clone()),
            ],
        ).await?;

        // Update last run timestamp in settings
        let update_sql = "UPDATE scheduler_settings 
                          SET last_run_at = datetime('now'), next_run_at = datetime('now', '+1 day') 
                          WHERE id = 1;";
        let _ = self.client.execute(update_sql, &[]).await;

        Ok(())
    }
}
