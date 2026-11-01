use super::AppState;
use axum::{
    body::{Body, Bytes},
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::{Html, IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use serde_json::json;
use std::fs;
use std::path::PathBuf;
use std::sync::Arc;

fn get_local_assets_dir() -> PathBuf {
    std::env::var("HOME")
        .map(|h| PathBuf::from(h).join(".job_apply_automator").join("assets"))
        .unwrap_or_else(|_| PathBuf::from(".job_apply_automator").join("assets"))
}

#[derive(Deserialize)]
pub struct CandidateSearchQuery {
    pub search: Option<String>,
}

pub async fn get_candidate_attributes(
    State(state): State<Arc<AppState>>,
    Query(query): Query<CandidateSearchQuery>,
) -> impl IntoResponse {
    let search = query.search.as_deref().unwrap_or("").trim();
    let attrs = state.candidate.query_attributes(search).await.unwrap_or_default();
    let profile = crate::storage::candidate::CandidateProfile::from_attributes(&attrs);
    Json(json!({
        "success": true,
        "data": attrs,
        "profile": profile
    }))
}

#[derive(Deserialize)]
pub struct UpdateAttributePayload {
    pub key: String,
    pub value: Option<String>,
}

pub async fn update_candidate_attribute(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UpdateAttributePayload>,
) -> impl IntoResponse {
    let val = payload.value.as_deref().unwrap_or("");
    let res = state.candidate.update_attribute(&payload.key, val).await;
    match res {
        Ok(_) => Json(json!({ "success": true })),
        Err(e) => Json(json!({ "success": false, "error": e.to_string() })),
    }
}

pub async fn toggle_candidate_delegation(
    State(state): State<Arc<AppState>>,
    Path(key): Path<String>,
) -> impl IntoResponse {
    let res = state.candidate.toggle_delegation(&key, true).await;
    match res {
        Ok(_) => Json(json!({ "success": true })),
        Err(e) => Json(json!({ "success": false, "error": e.to_string() })),
    }
}

pub async fn get_candidate_photo(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let assets_dir = get_local_assets_dir();
    let local_paths = [
        assets_dir.join("photo.jpg"),
        assets_dir.join("photo.png"),
        assets_dir.join("photo.jpeg"),
    ];

    for path in &local_paths {
        if let Ok(bytes) = fs::read(path) {
            let mime = if path.extension().and_then(|s| s.to_str()) == Some("png") { "image/png" } else { "image/jpeg" };
            return Response::builder()
                .status(StatusCode::OK)
                .header(header::CONTENT_TYPE, mime)
                .body(Body::from(bytes))
                .unwrap();
        }
    }

    if let Ok(Some(bytes)) = state.d1.r2_get("assets/photo.jpg").await {
        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "image/jpeg")
            .body(Body::from(bytes))
            .unwrap();
    }

    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .body(Body::from("Candidate photo not found"))
        .unwrap()
}

pub async fn upload_candidate_photo(
    State(state): State<Arc<AppState>>,
    body: Bytes,
) -> impl IntoResponse {
    let dir = get_local_assets_dir();
    let _ = fs::create_dir_all(&dir);
    let path = dir.join("photo.jpg");
    let _ = fs::write(&path, &body);

    let _ = state.d1.r2_put("assets/photo.jpg", body.to_vec(), "image/jpeg").await;
    Json(json!({ "success": true, "path": path.to_string_lossy() }))
}

pub async fn get_candidate_portfolio() -> impl IntoResponse {
    let local_path = get_local_assets_dir().join("portfolio.html");
    if let Ok(content) = fs::read_to_string(&local_path) {
        return Html(content).into_response();
    }
    Html("<html><body><h1>Candidate Portfolio</h1><p>Portfolio generated dynamically via Native Engine.</p></body></html>").into_response()
}

pub async fn generate_candidate_portfolio(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let profile = state.candidate.get_candidate_profile().await.ok();
    let name = profile.as_ref().map(|p| p.personal.full_name.as_str()).unwrap_or("Candidate");
    let html = format!(
        "<!DOCTYPE html><html><head><title>{} - Portfolio</title></head><body><h1>{}</h1><p>Full-Stack Software Engineer</p></body></html>",
        name, name
    );
    let dir = get_local_assets_dir();
    let _ = fs::create_dir_all(&dir);
    let _ = fs::write(dir.join("portfolio.html"), &html);
    let _ = state.d1.r2_put("assets/portfolio.html", html.into_bytes(), "text/html").await;

    Json(json!({ "success": true, "url": "/api/candidate/portfolio" }))
}
