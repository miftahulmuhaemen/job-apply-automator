use serde::{Deserialize, Serialize};

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
