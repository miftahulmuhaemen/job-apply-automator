pub mod candidate;
pub mod companies;
pub mod criteria;
pub mod jobs;
pub mod system;
pub mod websites;

use crate::storage::{
    CandidateRepository, CompaniesRepository, D1Client, DailyRunsRepository,
    JobsLedgerRepository, WebsitesRepository,
};
use axum::{
    routing::{delete, get, post},
    Router,
};
use std::sync::Arc;

#[derive(Clone)]
pub struct AppState {
    pub d1: D1Client,
    pub companies: CompaniesRepository,
    pub candidate: CandidateRepository,
    pub websites: WebsitesRepository,
    pub daily_runs: DailyRunsRepository,
    pub jobs: JobsLedgerRepository,
}

impl AppState {
    pub fn new(d1: D1Client) -> Self {
        Self {
            companies: CompaniesRepository::new(d1.clone()),
            candidate: CandidateRepository::new(d1.clone()),
            websites: WebsitesRepository::new(d1.clone()),
            daily_runs: DailyRunsRepository::new(d1.clone()),
            jobs: JobsLedgerRepository::new(d1.clone()),
            d1,
        }
    }
}

pub fn create_api_router(state: Arc<AppState>) -> Router {
    Router::new()
        // Core & System Health
        .route("/api/health", get(system::health_check))
        .route("/api/storage/status", get(system::get_storage_status))
        // Agent Bridge & Settings
        .route("/api/agent/status", get(system::get_agent_status))
        .route("/api/agent/diagnose", post(system::diagnose_agent))
        .route("/api/agent/settings", get(system::get_agent_settings).post(system::update_agent_settings))
        // Daily Scheduler
        .route("/api/scheduler", get(system::get_scheduler).post(system::update_scheduler))
        .route("/api/scheduler/runs", get(system::get_scheduler_runs))
        // Companies
        .route("/api/companies", get(companies::get_companies))
        .route("/api/companies/{company}/jobs", get(companies::get_company_jobs))
        // Websites Directory
        .route("/api/websites", get(websites::get_websites).post(websites::add_website))
        .route("/api/websites/session-status", get(websites::get_websites_session_status))
        .route("/api/websites/{id}", post(websites::update_website).delete(websites::delete_website))
        .route("/api/websites/{id}/toggle", post(websites::toggle_website))
        .route("/api/websites/{id}/authenticate", post(websites::authenticate_website))
        // Personalization & Criteria
        .route("/api/personalization", get(criteria::get_personalization).post(criteria::add_personalization))
        .route("/api/personalization/{id}", post(criteria::update_personalization).delete(criteria::delete_personalization))
        .route("/api/personalization/{id}/toggle", post(criteria::toggle_personalization))
        .route("/api/criteria", get(criteria::get_personalization))
        // System Errors
        .route("/api/errors", get(system::get_errors).delete(system::clear_resolved_errors))
        .route("/api/errors/{id}", delete(system::resolve_error))
        .route("/api/errors/{id}/resolve", post(system::resolve_error))
        .route("/api/errors/clear", post(system::clear_resolved_errors))
        .route("/api/errors/clear-resolved", post(system::clear_resolved_errors))
        // Candidate Profile & Attributes
        .route("/api/candidate/attributes", get(candidate::get_candidate_attributes).post(candidate::update_candidate_attribute))
        .route("/api/candidate/attributes/{key}/delegate", post(candidate::toggle_candidate_delegation))
        .route("/api/candidate/photo", get(candidate::get_candidate_photo).post(candidate::upload_candidate_photo))
        .route("/api/candidate/portfolio", get(candidate::get_candidate_portfolio))
        .route("/api/candidate/portfolio/generate", post(candidate::generate_candidate_portfolio))
        // Jobs Ledger & Submissions
        .route("/api/jobs", get(jobs::get_jobs))
        .route("/api/jobs/{id}/status", post(jobs::update_job_status))
        .route("/api/jobs/batch-status", post(jobs::batch_update_job_status))
        .route("/api/jobs/{id}/form-preview", get(jobs::get_job_form_preview))
        .route("/api/jobs/{id}/documents", get(jobs::get_job_documents))
        .route("/api/jobs/{id}/pdf", get(jobs::get_job_pdf))
        .route("/api/jobs/{id}/roadblock-screenshot", get(jobs::get_job_roadblock_screenshot))
        .route("/api/jobs/{id}/submit", post(jobs::submit_job))
        .with_state(state)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_api_router() {
        let d1 = D1Client::new(
            "dummy_account".into(),
            "dummy_db".into(),
            "dummy_token".into(),
        );
        let state = Arc::new(AppState::new(d1));
        let _router = create_api_router(state);
    }
}
