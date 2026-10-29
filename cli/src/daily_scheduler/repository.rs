use super::model::{DailyRunRecord, SchedulerSettings};
use chrono::Local;
use rusqlite::{params, Connection, Result};
use uuid::Uuid;

pub struct SchedulerRepository<'a> {
    conn: &'a Connection,
}

impl<'a> SchedulerRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn get_settings(&self) -> Result<SchedulerSettings> {
        let mut stmt = self.conn.prepare(
            "SELECT id, enabled, schedule_time, max_daily_applications, portals, last_run_at, next_run_at,
                    COALESCE(cli_agent_enabled, 1),
                    COALESCE(cli_agent_model, 'gemini-3.8-flash-high'),
                    COALESCE(cli_agent_binary, '/home/sahana/.local/bin/agy'),
                    COALESCE(cli_agent_timeout_seconds, 60)
             FROM scheduler_settings 
             WHERE id = 1",
        )?;

        let row = stmt.query_row([], |r| {
            Ok(SchedulerSettings {
                id: r.get(0)?,
                enabled: r.get::<_, i64>(1)? == 1,
                schedule_time: r.get(2)?,
                max_daily_applications: r.get(3)?,
                portals: r.get(4)?,
                last_run_at: r.get(5)?,
                next_run_at: r.get(6)?,
                cli_agent_enabled: r.get::<_, i64>(7)? == 1,
                cli_agent_model: r.get(8)?,
                cli_agent_binary: r.get(9)?,
                cli_agent_timeout_seconds: r.get::<_, i64>(10)? as u64,
            })
        })?;

        Ok(row)
    }

    pub fn has_run_completed_today(&self) -> Result<bool> {
        let today = Local::now().format("%Y-%m-%d").to_string();
        let mut stmt = self.conn.prepare(
            "SELECT id FROM daily_runs WHERE run_date = ?1 AND status = 'COMPLETED' LIMIT 1",
        )?;
        let exists = stmt.exists(params![today])?;
        Ok(exists)
    }

    pub fn record_batch_run(&self, record: &DailyRunRecord) -> Result<()> {
        let new_uuid = Uuid::now_v7().to_string();
        self.conn.execute(
            "INSERT INTO daily_runs (
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
                created_at = datetime('now')",
            params![
                new_uuid,
                record.run_date,
                record.batch_size,
                record.processed_count,
                record.success_count,
                record.skipped_count,
                record.failed_count,
                record.status,
                record.details
            ],
        )?;

        // Update last run timestamp in settings
        let _ = self.conn.execute(
            "UPDATE scheduler_settings 
             SET last_run_at = datetime('now'), next_run_at = datetime('now', '+1 day') 
             WHERE id = 1",
            [],
        );

        Ok(())
    }
}
