use crate::storage::{
    CandidateRepository, CompaniesRepository, D1Client, DailyRunsRepository,
    JobsLedgerRepository, WebsitesRepository,
};
use axum::{
    extract::{Path, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::Deserialize;
use serde_json::json;
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
        // Pure zero-query ping-pong health check (Issue 7)
        .route("/api/health", get(health_check))
        // Companies (Issue 1)
        .route("/api/companies", get(get_companies))
        // Candidate profile & attributes (Issues 2, 3)
        .route(
            "/api/candidate/attributes",
            get(get_candidate_attributes).post(update_candidate_attribute),
        )
        .route(
            "/api/candidate/attributes/{key}/delegate",
            post(toggle_candidate_delegation),
        )
        // Websites (Issues 3, 6)
        .route("/api/websites", get(get_websites))
        .route("/api/websites/{id}", post(update_website))
        // Jobs Ledger (Issues 4, 5)
        .route("/api/jobs", get(get_jobs))
        .route("/api/jobs/{id}/status", post(update_job_status))
        .route("/api/jobs/batch-status", post(batch_update_job_status))
        // Scheduler (Issue 6)
        .route("/api/scheduler", get(get_scheduler_runs))
        .with_state(state)
}

async fn health_check() -> impl IntoResponse {
    Json(json!({ "status": "ok" }))
}

async fn get_companies(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match state.companies.get_companies().await {
        Ok(companies) => (StatusCode::OK, Json(json!({ "success": true, "data": companies }))),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "success": false, "error": e.to_string() })),
        ),
    }
}

async fn get_candidate_attributes(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match state.candidate.get_all_attributes().await {
        Ok(attrs) => (StatusCode::OK, Json(json!({ "success": true, "data": attrs }))),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "success": false, "error": e.to_string() })),
        ),
    }
}

#[derive(Deserialize)]
struct UpdateAttributePayload {
    key: String,
    value: String,
}

async fn update_candidate_attribute(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UpdateAttributePayload>,
) -> impl IntoResponse {
    match state.candidate.update_attribute(&payload.key, &payload.value).await {
        Ok(success) => (StatusCode::OK, Json(json!({ "success": success }))),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(json!({ "success": false, "error": e.to_string() })),
        ),
    }
}

#[derive(Deserialize)]
struct DelegatePayload {
    delegate: Option<bool>,
}

async fn toggle_candidate_delegation(
    State(state): State<Arc<AppState>>,
    Path(key): Path<String>,
    Json(payload): Json<DelegatePayload>,
) -> impl IntoResponse {
    let delegate = payload.delegate.unwrap_or(true);
    match state.candidate.toggle_delegation(&key, delegate).await {
        Ok(success) => (StatusCode::OK, Json(json!({ "success": success }))),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(json!({ "success": false, "error": e.to_string() })),
        ),
    }
}

async fn get_websites(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match state.websites.get_websites().await {
        Ok(sites) => (StatusCode::OK, Json(json!({ "success": true, "data": sites }))),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "success": false, "error": e.to_string() })),
        ),
    }
}

#[derive(Deserialize)]
struct UpdateWebsitePayload {
    name: Option<String>,
    url: Option<String>,
    allowed: Option<bool>,
    auth_type: Option<String>,
    username: Option<String>,
    credential_note: Option<String>,
    notes: Option<String>,
}

async fn update_website(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<UpdateWebsitePayload>,
) -> impl IntoResponse {
    let update = crate::storage::websites::WebsiteUpdate {
        name: payload.name,
        url: payload.url,
        allowed: payload.allowed,
        auth_type: payload.auth_type,
        username: payload.username,
        credential_note: payload.credential_note,
        notes: payload.notes,
    };

    match state.websites.update_website(&id, &update).await {
        Ok(success) => (StatusCode::OK, Json(json!({ "success": success }))),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(json!({ "success": false, "error": e.to_string() })),
        ),
    }
}

async fn get_jobs(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match state.jobs.get_all_jobs().await {
        Ok(jobs) => (StatusCode::OK, Json(json!({ "success": true, "data": jobs }))),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "success": false, "error": e.to_string() })),
        ),
    }
}

#[derive(Deserialize)]
struct UpdateJobStatusPayload {
    status: String,
    note: Option<String>,
}

async fn update_job_status(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Json(payload): Json<UpdateJobStatusPayload>,
) -> impl IntoResponse {
    let note = payload.note.as_deref().unwrap_or("Status updated via web console");
    match state.jobs.update_status(id, &payload.status, note, None).await {
        Ok(success) => (StatusCode::OK, Json(json!({ "success": success, "id": id }))),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(json!({ "success": false, "error": e.to_string() })),
        ),
    }
}

#[derive(Deserialize)]
struct BatchStatusPayload {
    #[serde(rename = "jobIds")]
    job_ids: Vec<i64>,
    status: String,
}

async fn batch_update_job_status(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<BatchStatusPayload>,
) -> impl IntoResponse {
    match state.jobs.batch_update_status(&payload.job_ids, &payload.status).await {
        Ok(changes) => (
            StatusCode::OK,
            Json(json!({ "success": true, "count": changes })),
        ),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(json!({ "success": false, "error": e.to_string() })),
        ),
    }
}

async fn get_scheduler_runs(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    match state.daily_runs.get_recorded_runs().await {
        Ok(runs) => (StatusCode::OK, Json(json!({ "success": true, "data": runs }))),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({ "success": false, "error": e.to_string() })),
        ),
    }
}
