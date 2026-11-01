use super::AppState;
use axum::{
    extract::{Path, State},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::{json, Value};
use std::sync::Arc;
use uuid::Uuid;

pub async fn get_personalization(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let sql = "SELECT id, COALESCE(uuid, 'rule-' || id) as uuid, category, key, value, description, is_enabled, is_deleted, deleted_at, updated_at FROM personalization_rules WHERE (is_deleted = 0 OR is_deleted IS NULL) ORDER BY id ASC;";
    let rows: Vec<Value> = match state.d1.query(sql, &[]).await {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[ERROR] Failed to fetch personalization rules: {:?}", e);
            Vec::new()
        }
    };

    Json(json!({
        "success": true,
        "count": rows.len(),
        "data": rows
    }))
}

#[derive(Deserialize)]
pub struct AddCriteriaPayload {
    pub category: String,
    pub key: String,
    pub value: String,
    pub description: Option<String>,
}

pub async fn add_personalization(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<AddCriteriaPayload>,
) -> impl IntoResponse {
    let id = Uuid::now_v7().to_string();
    let desc = payload.description.unwrap_or_default();
    let sql = "INSERT INTO personalization_rules (uuid, category, key, value, description, is_enabled, is_deleted, updated_at)
               VALUES (?1, ?2, ?3, ?4, ?5, 1, 0, datetime('now'));";
    let params: Vec<Value> = vec![
        Value::from(id),
        Value::from(payload.category),
        Value::from(payload.key),
        Value::from(payload.value),
        Value::from(desc),
    ];
    let res = state.d1.execute(sql, &params).await;
    match res {
        Ok(_) => Json(json!({ "success": true })),
        Err(e) => {
            eprintln!("[ERROR] Failed to add personalization rule: {:?}", e);
            Json(json!({ "success": false, "error": e.to_string() }))
        }
    }
}

pub async fn update_personalization(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
    Json(payload): Json<serde_json::Value>,
) -> impl IntoResponse {
    let category = payload.get("category").and_then(|v| v.as_str());
    let key = payload.get("key").and_then(|v| v.as_str());
    let value = payload.get("value").and_then(|v| v.as_str());
    let description = payload.get("description").and_then(|v| v.as_str());

    let sql = "UPDATE personalization_rules
               SET category = COALESCE(?1, category),
                   key = COALESCE(?2, key),
                   value = COALESCE(?3, value),
                   description = COALESCE(?4, description),
                   updated_at = datetime('now')
               WHERE id = CAST(?5 AS INTEGER) OR uuid = ?5;";
    let params: Vec<Value> = vec![
        category.map(Value::from).unwrap_or(Value::Null),
        key.map(Value::from).unwrap_or(Value::Null),
        value.map(Value::from).unwrap_or(Value::Null),
        description.map(Value::from).unwrap_or(Value::Null),
        Value::from(id),
    ];
    let res = state.d1.execute(sql, &params).await;
    match res {
        Ok(_) => Json(json!({ "success": true })),
        Err(e) => {
            eprintln!("[ERROR] Failed to update personalization rule: {:?}", e);
            Json(json!({ "success": false, "error": e.to_string() }))
        }
    }
}

pub async fn delete_personalization(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let sql = "UPDATE personalization_rules SET is_deleted = 1, deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = CAST(?1 AS INTEGER) OR uuid = ?1;";
    let res = state.d1.execute(sql, &[Value::from(id)]).await;
    match res {
        Ok(_) => Json(json!({ "success": true })),
        Err(e) => {
            eprintln!("[ERROR] Failed to delete personalization rule: {:?}", e);
            Json(json!({ "success": false, "error": e.to_string() }))
        }
    }
}

pub async fn toggle_personalization(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let sql = "UPDATE personalization_rules SET is_enabled = CASE WHEN is_enabled = 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = CAST(?1 AS INTEGER) OR uuid = ?1;";
    let res = state.d1.execute(sql, &[Value::from(id)]).await;
    match res {
        Ok(_) => Json(json!({ "success": true })),
        Err(e) => {
            eprintln!("[ERROR] Failed to toggle personalization rule: {:?}", e);
            Json(json!({ "success": false, "error": e.to_string() }))
        }
    }
}
