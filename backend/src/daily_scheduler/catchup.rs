use super::model::DailyRunRecord;
use super::repository::SchedulerRepository;
use crate::storage::D1Client;
use anyhow::Result;
use chrono::Local;

pub struct CatchupEngine {
    repo: SchedulerRepository,
}

impl CatchupEngine {
    pub fn new(client: D1Client) -> Self {
        Self {
            repo: SchedulerRepository::new(client),
        }
    }

    pub async fn should_run_now(&self, force: bool) -> Result<bool> {
        if force {
            return Ok(true);
        }

        let settings = self.repo.get_settings().await?;
        if !settings.enabled {
            println!("[SCHEDULER] Daily scheduler is disabled in settings. Skipping.");
            return Ok(false);
        }

        let already_completed = self.repo.has_run_completed_today().await?;
        if already_completed {
            println!("[SCHEDULER] Batch run already completed for today. Catch-up skipped.");
            return Ok(false);
        }

        println!("[SCHEDULER] Catch-up condition satisfied: No completed run found for today.");
        Ok(true)
    }

    pub async fn record_success(&self, total_processed: i64, applied: i64, skipped: i64, details: &str) -> Result<()> {
        let today = Local::now().format("%Y-%m-%d").to_string();
        let record = DailyRunRecord {
            id: None,
            uuid: String::new(),
            run_date: today,
            batch_size: 10,
            processed_count: total_processed,
            success_count: applied,
            skipped_count: skipped,
            failed_count: 0,
            status: "COMPLETED".to_string(),
            details: details.to_string(),
            created_at: None,
        };
        self.repo.record_batch_run(&record).await?;
        Ok(())
    }

    pub async fn record_failure(&self, error_msg: &str) -> Result<()> {
        let today = Local::now().format("%Y-%m-%d").to_string();
        let record = DailyRunRecord {
            id: None,
            uuid: String::new(),
            run_date: today,
            batch_size: 10,
            processed_count: 0,
            success_count: 0,
            skipped_count: 0,
            failed_count: 1,
            status: "FAILED".to_string(),
            details: format!("Execution failed: {}", error_msg),
            created_at: None,
        };
        self.repo.record_batch_run(&record).await?;
        Ok(())
    }
}
