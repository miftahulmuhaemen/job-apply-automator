use super::AppState;
use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

#[derive(Deserialize)]
pub struct CompanySearchQuery {
    pub search: Option<String>,
}

pub async fn get_companies(
    State(state): State<Arc<AppState>>,
    Query(query): Query<CompanySearchQuery>,
) -> impl IntoResponse {
    let search = query.search.as_deref().unwrap_or("").trim();
    let companies = match state.companies.query_companies(search).await {
        Ok(c) => c,
        Err(e) => {
            eprintln!("[ERROR] Failed to fetch companies: {:?}", e);
            Vec::new()
        }
    };

    Json(json!({
        "success": true,
        "count": companies.len(),
        "data": companies,
        "stats": {
            "total_companies": companies.len()
        }
    }))
}

pub async fn get_company_jobs(
    State(state): State<Arc<AppState>>,
    Path(company): Path<String>,
) -> impl IntoResponse {
    let jobs = match state.companies.get_company_jobs(&company).await {
        Ok(j) => j,
        Err(e) => {
            eprintln!("[ERROR] Failed to fetch company jobs: {:?}", e);
            Vec::new()
        }
    };

    Json(json!({
        "success": true,
        "company": company,
        "count": jobs.len(),
        "data": jobs
    }))
}
