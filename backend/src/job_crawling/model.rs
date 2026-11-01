use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortalEvaluation {
    pub allowed: bool,
    pub skip_reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ParsedJobListing {
    pub title: String,
    pub company: String,
    pub location: String,
    pub salary: String,
    pub experience_required: String,
    pub tech_stack: Vec<String>,
    pub responsibilities_summary: String,
    pub apply_action_selector: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FormFieldMapping {
    pub selector: String,
    pub field_name: String,
    pub field_type: String,
    pub candidate_profile_key: String,
    pub proposed_value: String,
}
