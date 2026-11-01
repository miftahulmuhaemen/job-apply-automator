use super::AppState;
use axum::{
    extract::{Path, State},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

pub async fn get_websites(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let websites = state.websites.get_websites().await.unwrap_or_default();
    Json(json!({ "success": true, "data": websites }))
}

#[derive(Deserialize)]
pub struct AddWebsitePayload {
    pub name: String,
    pub url: String,
    pub allowed: Option<bool>,
    pub auth_type: Option<String>,
    pub username: Option<String>,
    pub credential_note: Option<String>,
    pub notes: Option<String>,
    pub cooldown_days: Option<i64>,
}

pub async fn add_website(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<AddWebsitePayload>,
) -> impl IntoResponse {
    let id = Uuid::now_v7().to_string();
    let sql = "INSERT INTO websites_master (id, name, url, allowed, auth_type, username, credential_note, notes, cooldown_days, created_at, updated_at)
               VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, datetime('now'), datetime('now'));";
    let params: Vec<serde_json::Value> = vec![
        serde_json::Value::from(id),
        serde_json::Value::from(payload.name),
        serde_json::Value::from(payload.url),
        serde_json::Value::from(if payload.allowed.unwrap_or(true) { 1 } else { 0 }),
        serde_json::Value::from(payload.auth_type.unwrap_or_else(|| "NONE".into())),
        payload.username.map(serde_json::Value::from).unwrap_or(serde_json::Value::Null),
        payload.credential_note.map(serde_json::Value::from).unwrap_or(serde_json::Value::Null),
        payload.notes.map(serde_json::Value::from).unwrap_or(serde_json::Value::Null),
        serde_json::Value::from(payload.cooldown_days.unwrap_or(30)),
    ];
    let res = state.d1.execute(sql, &params).await;
    match res {
        Ok(_) => Json(json!({ "success": true })),
        Err(e) => Json(json!({ "success": false, "error": e.to_string() })),
    }
}

pub async fn update_website(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<serde_json::Value>,
) -> impl IntoResponse {
    let update = crate::storage::websites::WebsiteUpdate {
        name: payload.get("name").and_then(|v| v.as_str()).map(|s| s.to_string()),
        url: payload.get("url").and_then(|v| v.as_str()).map(|s| s.to_string()),
        allowed: payload.get("allowed").and_then(|v| v.as_bool()),
        auth_type: payload.get("auth_type").and_then(|v| v.as_str()).map(|s| s.to_string()),
        username: payload.get("username").and_then(|v| v.as_str()).map(|s| s.to_string()),
        credential_note: payload.get("credential_note").and_then(|v| v.as_str()).map(|s| s.to_string()),
        notes: payload.get("notes").and_then(|v| v.as_str()).map(|s| s.to_string()),
    };

    let res = state.websites.update_website(&id, &update).await;
    match res {
        Ok(_) => Json(json!({ "success": true })),
        Err(e) => Json(json!({ "success": false, "error": e.to_string() })),
    }
}

pub async fn delete_website(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let _ = state.d1.execute("DELETE FROM websites_master WHERE id = ?1;", &[serde_json::Value::from(id)]).await;
    Json(json!({ "success": true }))
}

pub async fn toggle_website(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let res = state.d1.execute(
        "UPDATE websites_master SET allowed = CASE WHEN allowed = 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = ?1;",
        &[serde_json::Value::from(id)]
    ).await;
    match res {
        Ok(_) => Json(json!({ "success": true })),
        Err(e) => Json(json!({ "success": false, "error": e.to_string() })),
    }
}

use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::time::{SystemTime, UNIX_EPOCH};

static LAST_SESSION_CHECK_TIME: AtomicU64 = AtomicU64::new(0);
static LAST_SESSION_CHECK_RESULT: AtomicBool = AtomicBool::new(false);

pub async fn get_websites_session_status() -> impl IntoResponse {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let last = LAST_SESSION_CHECK_TIME.load(Ordering::Relaxed);

    let is_connected = if now.saturating_sub(last) < 5 {
        LAST_SESSION_CHECK_RESULT.load(Ordering::Relaxed)
    } else {
        let connected = crate::job_application::browser::BrowserSession::get_ws_url().await.is_ok();
        LAST_SESSION_CHECK_TIME.store(now, Ordering::Relaxed);
        LAST_SESSION_CHECK_RESULT.store(connected, Ordering::Relaxed);
        connected
    };

    Json(json!({
        "success": true,
        "cdpConnected": is_connected,
        "activePort": 9222,
        "sessions": [
            { "portal": "kalibrr", "name": "Kalibrr", "authenticated": is_connected },
            { "portal": "glints", "name": "Glints", "authenticated": is_connected },
            { "portal": "jobstreet", "name": "Jobstreet", "authenticated": is_connected },
            { "portal": "linkedin", "name": "LinkedIn", "authenticated": is_connected }
        ]
    }))
}

pub async fn authenticate_website(Path(id): Path<String>) -> impl IntoResponse {
    let target_url = match id.as_str() {
        "kalibrr" => "https://www.kalibrr.com/login?locale=id_ID",
        "glints" => "https://glints.com/id/login",
        "jobstreet" => "https://www.jobstreet.co.id",
        "linkedin" => "https://www.linkedin.com/login",
        _ => "https://www.google.com",
    };

    let _ = crate::browser_cdp::BrowserLauncher::launch(Some(target_url));
    Json(json!({ "success": true, "message": format!("Launched browser session for portal {}", id) }))
}
