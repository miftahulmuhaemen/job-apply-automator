use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobRecord {
    pub id: Option<i64>,
    pub uuid: Option<String>,
    pub job_id: Option<String>,
    pub company: String,
    pub title: String,
    pub portal: String,
    pub job_url: String,
    pub location: Option<String>,
    pub salary_raw: Option<String>,
    pub salary_min: Option<i64>,
    pub salary_max: Option<i64>,
    pub status: String,
    pub skip_reason: Option<String>,
    pub resume_path: Option<String>,
    pub applied_at: Option<String>,
    pub created_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobStats {
    pub total_crawled: i64,
    pub total_applied: i64,
    pub applied_today: i64,
}
