use crate::constants::{job_status, triage_decision};
use crate::storage::d1_client::D1Client;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TriageJobRecord {
    pub id: i64,
    pub uuid: Option<String>,
    pub job_id: Option<String>,
    pub company: String,
    pub title: String,
    pub portal: String,
    pub job_url: Option<String>,
    pub location: Option<String>,
    pub salary_raw: Option<String>,
    pub salary_min: Option<i64>,
    pub salary_max: Option<i64>,
    pub status: String,
    pub skip_reason: Option<String>,
    pub resume_path: Option<String>,
    pub applied_at: Option<String>,
    pub created_at: Option<String>,
    pub triage_decision: Option<String>,
    pub histories: Option<String>,
    pub last_error: Option<String>,
    pub roadblock_url: Option<String>,
    pub roadblock_screenshot: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct JobStatusMetadata {
    pub resume_path: Option<String>,
    pub applied_at: Option<String>,
    pub last_error: Option<String>,
    pub roadblock_url: Option<String>,
    pub roadblock_screenshot: Option<String>,
}

#[derive(Clone, Debug)]
pub struct JobsLedgerRepository {
    client: D1Client,
}

impl JobsLedgerRepository {
    pub fn new(client: D1Client) -> Self {
        Self { client }
    }

    pub async fn get_all_jobs(&self) -> Result<Vec<TriageJobRecord>> {
        let sql = "SELECT
            id, uuid, job_id, company, title, portal, job_url, location,
            salary_raw, salary_min, salary_max, status, skip_reason,
            resume_path, applied_at, created_at, triage_decision, histories,
            last_error, roadblock_url, roadblock_screenshot
        FROM jobs_ledger
        WHERE is_deleted = 0 OR is_deleted IS NULL
        ORDER BY id DESC;";

        self.client.query(sql, &[]).await
    }

    pub async fn query_jobs(
        &self,
        status: &str,
        portal: &str,
        search: &str,
        limit: i64,
        offset: i64,
    ) -> Result<(Vec<TriageJobRecord>, i64)> {
        let pattern = if search.is_empty() {
            "".to_string()
        } else {
            format!("%{}%", search)
        };

        #[derive(serde::Deserialize)]
        struct CountRow {
            count: i64,
        }

        let count_sql = "SELECT COUNT(*) as count FROM jobs_ledger
        WHERE (is_deleted = 0 OR is_deleted IS NULL)
          AND (?1 = 'ALL' OR UPPER(status) = UPPER(?1))
          AND (?2 = 'ALL' OR UPPER(portal) = UPPER(?2))
          AND (?3 = '' OR title LIKE ?4 OR company LIKE ?4);";

        let count_rows: Vec<CountRow> = self
            .client
            .query(
                count_sql,
                &[
                    Value::String(status.to_string()),
                    Value::String(portal.to_string()),
                    Value::String(search.to_string()),
                    Value::String(pattern.clone()),
                ],
            )
            .await?;
        let total = count_rows.first().map(|r| r.count).unwrap_or(0);

        let data_sql = "SELECT
            id, uuid, job_id, company, title, portal, job_url, location,
            salary_raw, salary_min, salary_max, status, skip_reason,
            resume_path, applied_at, created_at, triage_decision, histories,
            last_error, roadblock_url, roadblock_screenshot
        FROM jobs_ledger
        WHERE (is_deleted = 0 OR is_deleted IS NULL)
          AND (?1 = 'ALL' OR UPPER(status) = UPPER(?1))
          AND (?2 = 'ALL' OR UPPER(portal) = UPPER(?2))
          AND (?3 = '' OR title LIKE ?4 OR company LIKE ?4)
        ORDER BY id DESC
        LIMIT ?5 OFFSET ?6;";

        let rows: Vec<TriageJobRecord> = self
            .client
            .query(
                data_sql,
                &[
                    Value::String(status.to_string()),
                    Value::String(portal.to_string()),
                    Value::String(search.to_string()),
                    Value::String(pattern),
                    Value::from(limit),
                    Value::from(offset),
                ],
            )
            .await?;

        Ok((rows, total))
    }

    pub async fn find_by_id(&self, id: &str) -> Result<Option<TriageJobRecord>> {
        let sql = "SELECT
            id, uuid, job_id, company, title, portal, job_url, location,
            salary_raw, salary_min, salary_max, status, skip_reason,
            resume_path, applied_at, created_at, triage_decision, histories,
            last_error, roadblock_url, roadblock_screenshot
        FROM jobs_ledger
        WHERE id = ?1 OR uuid = ?1;";

        let rows: Vec<TriageJobRecord> = self.client.query(sql, &[Value::String(id.to_string())]).await?;
        Ok(rows.into_iter().next())
    }

    /// Single atomic statement for status + metadata commit (Issue 4)
    pub async fn update_status(
        &self,
        id: i64,
        target_status: &str,
        _note: &str,
        metadata: Option<JobStatusMetadata>,
    ) -> Result<bool> {
        let triage_decision = match target_status {
            s if s == job_status::APPROVED => triage_decision::KEEP,
            s if s == job_status::DROPPED => triage_decision::FILTER_OUT,
            _ => triage_decision::PENDING,
        };

        let applied_at_val = if target_status == job_status::APPLIED
            || target_status == job_status::SUBMITTED_UNVERIFIED
        {
            metadata.as_ref().and_then(|m| m.applied_at.clone()).or_else(|| Some(chrono::Utc::now().to_rfc3339()))
        } else {
            None
        };

        let meta = metadata.unwrap_or_default();

        let sql = "UPDATE jobs_ledger
        SET status = ?1,
            triage_decision = ?2,
            applied_at = COALESCE(?3, applied_at),
            resume_path = COALESCE(?4, resume_path),
            last_error = ?5,
            roadblock_url = ?6,
            roadblock_screenshot = ?7,
            updated_at = datetime('now')
        WHERE id = ?8;";

        let params = vec![
            Value::String(target_status.to_string()),
            Value::String(triage_decision.to_string()),
            applied_at_val.map(Value::from).unwrap_or(Value::Null),
            meta.resume_path.map(Value::from).unwrap_or(Value::Null),
            meta.last_error.map(Value::from).unwrap_or(Value::Null),
            meta.roadblock_url.map(Value::from).unwrap_or(Value::Null),
            meta.roadblock_screenshot.map(Value::from).unwrap_or(Value::Null),
            Value::from(id),
        ];

        let res = self.client.execute(sql, &params).await?;
        Ok(res.changes > 0)
    }

    /// Parameterized batch status update in 1-2 roundtrips (Issue 5)
    pub async fn batch_update_status(&self, ids: &[i64], target_status: &str) -> Result<u64> {
        if ids.is_empty() {
            return Ok(0);
        }

        let triage_decision = match target_status {
            s if s == job_status::APPROVED => triage_decision::KEEP,
            s if s == job_status::DROPPED => triage_decision::FILTER_OUT,
            _ => triage_decision::PENDING,
        };

        let placeholders: Vec<String> = ids.iter().map(|_| "?".to_string()).collect();
        let in_clause = placeholders.join(", ");

        let sql = format!(
            "UPDATE jobs_ledger
            SET status = ?1,
                triage_decision = ?2,
                updated_at = datetime('now')
            WHERE id IN ({});",
            in_clause
        );

        let mut params = vec![
            Value::String(target_status.to_string()),
            Value::String(triage_decision.to_string()),
        ];
        for id in ids {
            params.push(Value::from(*id));
        }

        let res = self.client.execute(&sql, &params).await?;
        Ok(res.changes)
    }
}
