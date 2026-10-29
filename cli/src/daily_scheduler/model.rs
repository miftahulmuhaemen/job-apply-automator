use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SchedulerSettings {
    pub id: i64,
    pub enabled: bool,
    pub schedule_time: String,
    pub max_daily_applications: i64,
    pub portals: String,
    pub last_run_at: Option<String>,
    pub next_run_at: Option<String>,
    pub cli_agent_enabled: bool,
    pub cli_agent_model: String,
    pub cli_agent_binary: String,
    pub cli_agent_timeout_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyRunRecord {
    pub id: Option<i64>,
    pub uuid: String,
    pub run_date: String,
    pub batch_size: i64,
    pub processed_count: i64,
    pub success_count: i64,
    pub skipped_count: i64,
    pub failed_count: i64,
    pub status: String,
    pub details: String,
    pub created_at: Option<String>,
}
