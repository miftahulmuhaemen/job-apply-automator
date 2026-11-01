use super::model::{JobRecord, JobStats};
use crate::storage::D1Client;
use anyhow::Result;
use chrono::Local;
use serde::Deserialize;
use serde_json::Value;
use uuid::Uuid;

#[derive(Deserialize)]
struct CountRow {
    count: i64,
}

#[derive(Deserialize)]
struct IdRow {
    id: i64,
}

#[derive(Clone, Debug)]
pub struct JobTriageRepository {
    client: D1Client,
}

impl JobTriageRepository {
    pub fn new(client: D1Client) -> Self {
        Self { client }
    }

    pub async fn get_today_application_count(&self) -> Result<i64> {
        let today = Local::now().format("%Y-%m-%d").to_string();
        let sql = "SELECT COUNT(*) as count FROM jobs_ledger 
                   WHERE UPPER(status) = 'APPLIED' AND applied_at LIKE ?1 || '%';";
        let rows: Vec<CountRow> = self.client.query(sql, &[Value::String(today)]).await?;
        Ok(rows.first().map(|r| r.count).unwrap_or(0))
    }

    pub async fn has_applied_url(&self, url: &str) -> Result<bool> {
        let sql = "SELECT id FROM jobs_ledger WHERE job_url = ?1 AND UPPER(status) = 'APPLIED' LIMIT 1;";
        let rows: Vec<IdRow> = self.client.query(sql, &[Value::String(url.to_string())]).await?;
        Ok(!rows.is_empty())
    }

    pub async fn is_company_in_cooldown(&self, company: &str, cooldown_days: i64) -> Result<bool> {
        let clean = company.trim().to_lowercase();
        let days_param = format!("-{} days", cooldown_days);
        let sql = "SELECT id FROM jobs_ledger 
                   WHERE lower(company) = ?1 AND UPPER(status) = 'APPLIED' 
                   AND applied_at >= datetime('now', ?2) 
                   LIMIT 1;";
        let rows: Vec<IdRow> = self.client.query(
            sql,
            &[Value::String(clean), Value::String(days_param)],
        ).await?;
        Ok(!rows.is_empty())
    }

    pub async fn log_job_record(&self, job: &JobRecord) -> Result<()> {
        let new_uuid = job.uuid.clone().unwrap_or_else(|| Uuid::now_v7().to_string());
        let initial_history = format!(
            r#"[{{ "from_status": null, "to_status": "{}", "timestamp": "{}", "note": "Ingested via Native Rust CLI" }}]"#,
            job.status.to_uppercase(),
            Local::now().to_rfc3339()
        );

        let sql = "INSERT INTO jobs_ledger (
            uuid, job_id, company, title, portal, job_url, location,
            salary_raw, salary_min, salary_max, status, skip_reason, resume_path, applied_at, histories
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
        ON CONFLICT(job_url) DO UPDATE SET
            status = excluded.status,
            skip_reason = excluded.skip_reason,
            applied_at = excluded.applied_at,
            resume_path = excluded.resume_path;";

        self.client.execute(
            sql,
            &[
                Value::String(new_uuid),
                job.job_id.as_deref().map(Value::from).unwrap_or(Value::Null),
                Value::String(job.company.clone()),
                Value::String(job.title.clone()),
                Value::String(job.portal.clone()),
                Value::String(job.job_url.clone()),
                job.location.as_deref().map(Value::from).unwrap_or(Value::Null),
                job.salary_raw.as_deref().map(Value::from).unwrap_or(Value::Null),
                job.salary_min.map(Value::from).unwrap_or(Value::Null),
                job.salary_max.map(Value::from).unwrap_or(Value::Null),
                Value::String(job.status.clone()),
                job.skip_reason.as_deref().map(Value::from).unwrap_or(Value::Null),
                job.resume_path.as_deref().map(Value::from).unwrap_or(Value::Null),
                job.applied_at.as_deref().map(Value::from).unwrap_or(Value::Null),
                Value::String(initial_history),
            ],
        ).await?;

        Ok(())
    }

    pub async fn get_stats(&self) -> Result<JobStats> {
        let total_crawled_rows: Vec<CountRow> = self
            .client
            .query("SELECT COUNT(*) as count FROM jobs_ledger;", &[])
            .await?;
        let total_crawled = total_crawled_rows.first().map(|r| r.count).unwrap_or(0);

        let total_applied_rows: Vec<CountRow> = self
            .client
            .query("SELECT COUNT(*) as count FROM jobs_ledger WHERE UPPER(status) = 'APPLIED';", &[])
            .await?;
        let total_applied = total_applied_rows.first().map(|r| r.count).unwrap_or(0);

        let applied_today = self.get_today_application_count().await?;

        Ok(JobStats {
            total_crawled,
            total_applied,
            applied_today,
        })
    }

    pub async fn get_recent_jobs(&self, limit: usize) -> Result<Vec<JobRecord>> {
        let sql = "SELECT id, uuid, company, title, portal, job_url, location, salary_raw, status, skip_reason, applied_at
                   FROM jobs_ledger 
                   ORDER BY id DESC LIMIT ?1;";

        self.client.query(sql, &[Value::from(limit as i64)]).await
    }
}
