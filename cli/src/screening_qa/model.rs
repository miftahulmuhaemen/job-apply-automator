use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreeningQA {
    pub id: Option<i64>,
    pub question_pattern: String,
    pub answer: String,
    pub category: String,
    pub usage_count: i64,
    pub updated_at: Option<String>,
}
