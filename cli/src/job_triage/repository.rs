use super::model::{JobRecord, JobStats};
use chrono::Local;
use rusqlite::{params, Connection, Result};
use uuid::Uuid;

pub struct JobTriageRepository<'a> {
    conn: &'a Connection,
}

impl<'a> JobTriageRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn get_today_application_count(&self) -> Result<i64> {
        let today = Local::now().format("%Y-%m-%d").to_string();
        let mut stmt = self.conn.prepare(
            "SELECT COUNT(*) FROM jobs_ledger 
             WHERE status = 'applied' AND applied_at LIKE ?1 || '%'",
        )?;
        let count: i64 = stmt.query_row(params![today], |r| r.get(0))?;
        Ok(count)
    }

    pub fn has_applied_url(&self, url: &str) -> Result<bool> {
        let mut stmt = self.conn.prepare(
            "SELECT id FROM jobs_ledger WHERE job_url = ?1 AND status = 'applied' LIMIT 1",
        )?;
        let exists = stmt.exists(params![url])?;
        Ok(exists)
    }

    pub fn is_company_in_cooldown(&self, company: &str, cooldown_days: i64) -> Result<bool> {
        let clean = company.trim().to_lowercase();
        let query = format!(
            "SELECT id FROM jobs_ledger 
             WHERE lower(company) = ?1 AND status = 'applied' 
             AND applied_at >= datetime('now', '-{} days') 
             LIMIT 1",
            cooldown_days
        );
        let mut stmt = self.conn.prepare(&query)?;
        let exists = stmt.exists(params![clean])?;
        Ok(exists)
    }

    pub fn log_job_record(&self, job: &JobRecord) -> Result<()> {
        let new_uuid = job.uuid.clone().unwrap_or_else(|| Uuid::now_v7().to_string());
        let initial_history = format!(
            r#"[{{ "from_status": null, "to_status": "{}", "timestamp": "{}", "note": "Ingested via Native Rust CLI" }}]"#,
            job.status.to_uppercase(),
            Local::now().to_rfc3339()
        );

        self.conn.execute(
            "INSERT INTO jobs_ledger (
                uuid, job_id, company, title, portal, job_url, location,
                salary_raw, salary_min, salary_max, status, skip_reason, resume_path, applied_at, histories
             ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15)
             ON CONFLICT(job_url) DO UPDATE SET
                status = excluded.status,
                skip_reason = excluded.skip_reason,
                applied_at = excluded.applied_at,
                resume_path = excluded.resume_path",
            params![
                new_uuid,
                job.job_id,
                job.company,
                job.title,
                job.portal,
                job.job_url,
                job.location,
                job.salary_raw,
                job.salary_min,
                job.salary_max,
                job.status,
                job.skip_reason,
                job.resume_path,
                job.applied_at,
                initial_history
            ],
        )?;

        Ok(())
    }

    pub fn get_stats(&self) -> Result<JobStats> {
        let total_crawled: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM jobs_ledger",
            [],
            |r| r.get(0),
        )?;

        let total_applied: i64 = self.conn.query_row(
            "SELECT COUNT(*) FROM jobs_ledger WHERE status = 'applied'",
            [],
            |r| r.get(0),
        )?;

        let applied_today = self.get_today_application_count()?;

        Ok(JobStats {
            total_crawled,
            total_applied,
            applied_today,
        })
    }

    pub fn get_recent_jobs(&self, limit: usize) -> Result<Vec<JobRecord>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, uuid, company, title, portal, job_url, location, salary_raw, status, skip_reason, applied_at
             FROM jobs_ledger 
             ORDER BY id DESC LIMIT ?1",
        )?;

        let rows = stmt.query_map(params![limit as i64], |r| {
            Ok(JobRecord {
                id: Some(r.get(0)?),
                uuid: r.get(1)?,
                job_id: None,
                company: r.get(2)?,
                title: r.get(3)?,
                portal: r.get(4)?,
                job_url: r.get(5)?,
                location: r.get(6)?,
                salary_raw: r.get(7)?,
                salary_min: None,
                salary_max: None,
                status: r.get(8)?,
                skip_reason: r.get(9)?,
                resume_path: None,
                applied_at: r.get(10)?,
                created_at: None,
            })
        })?;

        let mut list = Vec::new();
        for item in rows {
            list.push(item?);
        }
        Ok(list)
    }
}
