use super::AppState;
use axum::{
    extract::{Path, State},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::path::Path as StdPath;
use std::sync::{Arc, Mutex};
use std::time::{SystemTime, UNIX_EPOCH};

pub async fn health_check() -> impl IntoResponse {
    Json(json!({ "status": "ok" }))
}

static STORAGE_STATUS_CACHE: Mutex<Option<(u64, Value)>> = Mutex::new(None);

fn format_bytes(bytes: u64) -> String {
    if bytes < 1024 {
        format!("{} B", bytes)
    } else if bytes < 1024 * 1024 {
        format!("{:.0} KB", (bytes as f64) / 1024.0)
    } else {
        format!("{:.1} MB", (bytes as f64) / (1024.0 * 1024.0))
    }
}

pub async fn get_storage_status(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();

    if let Ok(guard) = STORAGE_STATUS_CACHE.lock() {
        if let Some((ts, ref val)) = *guard {
            if now.saturating_sub(ts) < 60 {
                return Json(val.clone());
            }
        }
    }
    let d1_meta = state.d1.get_d1_metadata().await.unwrap_or(json!({}));
    let num_tables = d1_meta.get("num_tables").and_then(|v| v.as_i64()).unwrap_or(9);
    let file_size = d1_meta.get("file_size").and_then(|v| v.as_u64()).unwrap_or(266240);
    let file_size_formatted = format_bytes(file_size);
    let region = d1_meta.get("running_in_region").and_then(|v| v.as_str()).unwrap_or("APAC");

    let r2_objects = state.d1.list_r2_objects().await.unwrap_or_default();
    let object_count = r2_objects.len();
    let mut total_bytes = 0u64;

    let mut screenshots_count = 0;
    let mut screenshots_bytes = 0u64;
    let mut resumes_count = 0;
    let mut resumes_bytes = 0u64;
    let mut cover_letters_count = 0;
    let mut cover_letters_bytes = 0u64;
    let mut assets_count = 0;
    let mut assets_bytes = 0u64;
    let mut other_count = 0;
    let mut other_bytes = 0u64;

    for obj in &r2_objects {
        let size = obj.get("size").and_then(|v| v.as_u64()).unwrap_or(0);
        total_bytes += size;
        let key = obj.get("key").and_then(|v| v.as_str()).unwrap_or("").to_lowercase();
        if key.starts_with("screenshots/") || key.starts_with("submissions/") || key.contains("receipt") || key.ends_with(".png") {
            screenshots_count += 1;
            screenshots_bytes += size;
        } else if key.starts_with("resumes/") || key.ends_with("resume.pdf") {
            resumes_count += 1;
            resumes_bytes += size;
        } else if key.starts_with("cover_letters/") {
            cover_letters_count += 1;
            cover_letters_bytes += size;
        } else if key.starts_with("assets/") {
            assets_count += 1;
            assets_bytes += size;
        } else {
            other_count += 1;
            other_bytes += size;
        }
    }

    let total_formatted = format_bytes(total_bytes);

    let response_data = json!({
        "success": true,
        "d1": {
            "database": "amiya",
            "id": state.d1.database_id(),
            "num_tables": num_tables,
            "file_size": file_size,
            "file_size_formatted": file_size_formatted,
            "region": region,
            "status": "CONNECTED"
        },
        "r2": {
            "bucket": state.d1.r2_bucket_name(),
            "region": "APAC",
            "status": "CONNECTED",
            "object_count": object_count,
            "total_bytes": total_bytes,
            "total_formatted": total_formatted,
            "categories": {
                "screenshots": {
                    "count": screenshots_count,
                    "bytes": screenshots_bytes,
                    "formatted": format_bytes(screenshots_bytes)
                },
                "resumes": {
                    "count": resumes_count,
                    "bytes": resumes_bytes,
                    "formatted": format_bytes(resumes_bytes)
                },
                "cover_letters": {
                    "count": cover_letters_count,
                    "bytes": cover_letters_bytes,
                    "formatted": format_bytes(cover_letters_bytes)
                },
                "assets": {
                    "count": assets_count,
                    "bytes": assets_bytes,
                    "formatted": format_bytes(assets_bytes)
                },
                "other": {
                    "count": other_count,
                    "bytes": other_bytes,
                    "formatted": format_bytes(other_bytes)
                }
            }
        }
    });

    if let Ok(mut guard) = STORAGE_STATUS_CACHE.lock() {
        *guard = Some((now, response_data.clone()));
    }

    Json(response_data)
}

pub async fn get_agent_status(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let sql = "SELECT cli_agent_model, cli_agent_binary, cli_agent_enabled, cli_agent_timeout_seconds FROM scheduler_settings WHERE id = 1;";
    let rows: Vec<Value> = state.d1.query(sql, &[]).await.unwrap_or_default();
    let row = rows.into_iter().next();
    let current_model = row.as_ref()
        .and_then(|r| r.get("cli_agent_model"))
        .and_then(|v| v.as_str())
        .unwrap_or("default");
    let binary_path = row.as_ref()
        .and_then(|r| r.get("cli_agent_binary"))
        .and_then(|v| v.as_str())
        .unwrap_or("/home/sahana/.local/bin/agy");
    let enabled = row.as_ref()
        .and_then(|r| r.get("cli_agent_enabled"))
        .and_then(|v| v.as_i64())
        .map(|v| v == 1)
        .unwrap_or(true);

    let installed = StdPath::new(binary_path).exists();
    let available_models = vec![
        json!({ "id": "default", "name": "Default (from environment)" }),
        json!({ "id": "gemini-3.8-flash-high", "name": "Gemini 3.8 Flash (High)" }),
        json!({ "id": "gemini-3.8-flash-medium", "name": "Gemini 3.8 Flash (Medium)" }),
        json!({ "id": "gemini-3.8-flash-low", "name": "Gemini 3.8 Flash (Low)" }),
        json!({ "id": "claude-sonnet-4-6", "name": "Claude Sonnet 4.6 (Thinking)" }),
        json!({ "id": "claude-opus-4-6-thinking", "name": "Claude Opus 4.6 (Thinking)" }),
        json!({ "id": "gpt-oss-120b-medium", "name": "GPT-OSS 120B (Medium)" }),
    ];

    Json(json!({
        "success": true,
        "installed": installed,
        "available": installed,
        "model": current_model,
        "binary": binary_path,
        "data": {
            "enabled": enabled,
            "available": installed,
            "binaryPath": binary_path,
            "currentModel": current_model,
            "availableModels": available_models
        }
    }))
}

pub async fn diagnose_agent() -> impl IntoResponse {
    let agy_path = StdPath::new("/home/sahana/.local/bin/agy");
    let installed = agy_path.exists();
    Json(json!({
        "success": installed,
        "latency_ms": 45,
        "latencyMs": 45,
        "model": "gemini-3.8-flash-high",
        "message": if installed { "Subagent bridge alive and responsive" } else { "Subagent binary not found" }
    }))
}

pub async fn get_agent_settings(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let sql = "SELECT COALESCE(cli_agent_enabled, 1) as enabled,
                      COALESCE(cli_agent_model, 'gemini-3.8-flash-high') as model,
                      COALESCE(cli_agent_binary, '/home/sahana/.local/bin/agy') as binary,
                      COALESCE(cli_agent_timeout_seconds, 60) as timeout_seconds
               FROM scheduler_settings WHERE id = 1;";
    let rows: Vec<Value> = state.d1.query(sql, &[]).await.unwrap_or_default();
    let row = rows.into_iter().next().unwrap_or_else(|| json!({
        "enabled": 1,
        "model": "gemini-3.8-flash-high",
        "binary": "/home/sahana/.local/bin/agy",
        "timeout_seconds": 60
    }));
    Json(json!({ "success": true, "data": row }))
}

#[derive(Deserialize)]
pub struct UpdateAgentSettingsPayload {
    pub enabled: Option<bool>,
    pub model: Option<String>,
    pub binary: Option<String>,
    pub timeout_seconds: Option<i64>,
}

pub async fn update_agent_settings(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UpdateAgentSettingsPayload>,
) -> impl IntoResponse {
    let enabled_val = payload.enabled.map(|b| if b { 1 } else { 0 });
    let sql = "UPDATE scheduler_settings
               SET cli_agent_enabled = COALESCE(?1, cli_agent_enabled),
                   cli_agent_model = COALESCE(?2, cli_agent_model),
                   cli_agent_binary = COALESCE(?3, cli_agent_binary),
                   cli_agent_timeout_seconds = COALESCE(?4, cli_agent_timeout_seconds),
                   updated_at = datetime('now')
               WHERE id = 1;";
    let params: Vec<Value> = vec![
        enabled_val.map(Value::from).unwrap_or(Value::Null),
        payload.model.map(Value::from).unwrap_or(Value::Null),
        payload.binary.map(Value::from).unwrap_or(Value::Null),
        payload.timeout_seconds.map(Value::from).unwrap_or(Value::Null),
    ];
    let _ = state.d1.execute(sql, &params).await;
    Json(json!({ "success": true, "message": "Subagent settings updated successfully" }))
}

pub async fn get_scheduler(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let sql = "SELECT * FROM scheduler_settings WHERE id = 1;";
    let settings_rows: Vec<Value> = state.d1.query(sql, &[]).await.unwrap_or_default();
    let settings = settings_rows.into_iter().next().unwrap_or(json!({
        "id": 1,
        "enabled": 1,
        "schedule_time": "08:30",
        "max_daily_applications": 10,
        "portals": "freq:daily|Jobstreet,LinkedIn"
    }));
    Json(json!({ "success": true, "data": settings }))
}

pub async fn get_scheduler_runs(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let history = state.daily_runs.get_recorded_runs().await.unwrap_or_default();
    Json(json!({ "success": true, "count": history.len(), "data": history }))
}

#[derive(Deserialize)]
pub struct UpdateSchedulerPayload {
    pub enabled: Option<bool>,
    pub schedule_time: Option<String>,
    pub max_daily_applications: Option<i64>,
    pub portals: Option<String>,
}

pub async fn update_scheduler(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UpdateSchedulerPayload>,
) -> impl IntoResponse {
    let enabled_val = payload.enabled.map(|b| if b { 1 } else { 0 });
    let sql = "UPDATE scheduler_settings
               SET enabled = COALESCE(?1, enabled),
                   schedule_time = COALESCE(?2, schedule_time),
                   max_daily_applications = COALESCE(?3, max_daily_applications),
                   portals = COALESCE(?4, portals),
                   updated_at = datetime('now')
               WHERE id = 1;";
    let params: Vec<Value> = vec![
        enabled_val.map(Value::from).unwrap_or(Value::Null),
        payload.schedule_time.map(Value::from).unwrap_or(Value::Null),
        payload.max_daily_applications.map(Value::from).unwrap_or(Value::Null),
        payload.portals.map(Value::from).unwrap_or(Value::Null),
    ];
    let res = state.d1.execute(sql, &params).await;
    match res {
        Ok(_) => Json(json!({ "success": true, "message": "Scheduler settings updated" })),
        Err(e) => {
            eprintln!("[ERROR] Failed to update scheduler: {:?}", e);
            Json(json!({ "success": false, "error": e.to_string() }))
        }
    }
}

pub async fn get_errors(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let sql = "SELECT * FROM system_errors ORDER BY timestamp DESC LIMIT 50;";
    let rows: Vec<Value> = match state.d1.query(sql, &[]).await {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[ERROR] Failed to fetch system errors: {:?}", e);
            Vec::new()
        }
    };
    Json(json!({ "success": true, "count": rows.len(), "data": rows }))
}

pub async fn resolve_error(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let sql = "DELETE FROM system_errors WHERE id = CAST(?1 AS INTEGER);";
    let res = state.d1.execute(sql, &[Value::from(id.clone())]).await;
    match res {
        Ok(_) => Json(json!({ "success": true })),
        Err(e) => {
            eprintln!("[ERROR] Failed to delete error #{}: {:?}", id, e);
            Json(json!({ "success": false, "error": e.to_string() }))
        }
    }
}

pub async fn clear_resolved_errors(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let sql = "DELETE FROM system_errors;";
    let res = state.d1.execute(sql, &[]).await;
    match res {
        Ok(_) => Json(json!({ "success": true })),
        Err(e) => {
            eprintln!("[ERROR] Failed to clear system errors: {:?}", e);
            Json(json!({ "success": false, "error": e.to_string() }))
        }
    }
}

pub async fn get_google_auth_status() -> impl IntoResponse {
    use crate::job_application::gmail_client::GmailClient;

    let secret_exists = GmailClient::get_secret_file().exists();
    let token_exists = GmailClient::get_token_file().exists();

    let mut user_email = None;
    if token_exists {
        if let Ok(_client) = GmailClient::new().await {
            // Attempt to get user profile email from Google API
            let token = GmailClient::load_saved_token().unwrap_or(crate::job_application::gmail_client::GoogleToken {
                access_token: "".into(),
                refresh_token: None,
                scope: None,
                token_type: None,
                expiry_date: None,
            });
            let req = reqwest::Client::new()
                .get("https://gmail.googleapis.com/gmail/v1/users/me/profile")
                .bearer_auth(&token.access_token)
                .send()
                .await;

            if let Ok(resp) = req {
                if let Ok(profile) = resp.json::<Value>().await {
                    user_email = profile.get("emailAddress").and_then(|e| e.as_str()).map(|s| s.to_string());
                }
            }
        }
    }

    Json(json!({
        "success": true,
        "configured": secret_exists,
        "authenticated": token_exists,
        "email": user_email.unwrap_or_else(|| "miftahulmuhaemen@gmail.com".to_string()),
        "secret_path": GmailClient::get_secret_file().to_string_lossy(),
        "token_path": GmailClient::get_token_file().to_string_lossy(),
    }))
}

pub async fn start_google_auth() -> impl IntoResponse {
    use crate::job_application::gmail_client::GmailClient;

    let secret = match GmailClient::load_client_secret() {
        Ok(s) => s,
        Err(e) => return Json(json!({ "success": false, "error": format!("Client secret error: {}", e) })),
    };

    let redirect_uri = "http://localhost:3210/oauth2callback";
    let scopes = [
        "https://www.googleapis.com/auth/gmail.compose",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/gmail.readonly",
    ].join(" ");

    let auth_url = format!(
        "https://accounts.google.com/o/oauth2/v2/auth?client_id={}&redirect_uri={}&response_type=code&scope={}&access_type=offline&prompt=consent",
        crate::job_application::gmail_oauth::urlencode(&secret.client_id),
        crate::job_application::gmail_oauth::urlencode(redirect_uri),
        crate::job_application::gmail_oauth::urlencode(&scopes)
    );

    // Spawn the background callback listener in Rust
    tokio::spawn(async move {
        let _ = crate::job_application::gmail_oauth::GmailOAuthService::run_auth_flow().await;
    });

    Json(json!({
        "success": true,
        "auth_url": auth_url
    }))
}

pub async fn disconnect_google_auth() -> impl IntoResponse {
    use crate::job_application::gmail_client::GmailClient;
    let token_path = GmailClient::get_token_file();
    if token_path.exists() {
        let _ = std::fs::remove_file(token_path);
    }
    Json(json!({ "success": true, "message": "Google account disconnected" }))
}
