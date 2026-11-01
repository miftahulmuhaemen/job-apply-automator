use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmissionContext {
    pub job_id: i64,
    pub job_url: String,
    pub company: String,
    pub title: String,
    pub portal: String,
    pub interactive: bool,
    pub resume_pdf_path: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubmissionReceipt {
    pub job_id: i64,
    pub portal: String,
    pub status: String, // "APPLIED", "PREFILLED", "FAILED", "BLOCKED_ROADBLOCK"
    pub confirmation_text: Option<String>,
    pub receipt_screenshot_path: Option<String>,
    pub roadblock_url: Option<String>,
    pub submitted_at: String,
    pub error_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApplicationPayload {
    pub company: String,
    pub title: String,
    pub portal: String,
    pub url: String,
    pub location: Option<String>,
    pub salary: Option<String>,
    pub resume_path: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SubmissionDecision {
    Submit,
    Bailout,
}
