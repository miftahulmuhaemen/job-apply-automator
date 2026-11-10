use super::AppState;
use crate::storage::candidate::UpsertAttributeParams;
use crate::storage::CreateNotificationParams;
use axum::{
    extract::{Path, State},
    response::IntoResponse,
    Json,
};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

pub async fn get_notifications(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let items = state.notifications.get_all().await.unwrap_or_default();
    let unread_count = state.notifications.get_unread_count().await.unwrap_or(0);
    Json(json!({
        "success": true,
        "data": items,
        "unread_count": unread_count
    }))
}

#[derive(Deserialize)]
pub struct CreateNotificationPayload {
    pub title: String,
    pub message: String,
    pub notification_type: Option<String>,
    pub target_job_id: Option<i64>,
    pub candidate_key: Option<String>,
    pub candidate_label: Option<String>,
    pub candidate_category: Option<String>,
}

pub async fn create_notification(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<CreateNotificationPayload>,
) -> impl IntoResponse {
    let n_type = payload.notification_type.as_deref().unwrap_or("FIELD_MISSING");
    let res = state
        .notifications
        .create(CreateNotificationParams {
            title: &payload.title,
            message: &payload.message,
            notification_type: n_type,
            target_job_id: payload.target_job_id,
            candidate_key: payload.candidate_key.as_deref(),
            candidate_label: payload.candidate_label.as_deref(),
            candidate_category: payload.candidate_category.as_deref(),
        })
        .await;

    match res {
        Ok(id) => Json(json!({ "success": true, "id": id })),
        Err(e) => Json(json!({ "success": false, "error": e.to_string() })),
    }
}

pub async fn mark_notification_read(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> impl IntoResponse {
    let res = state.notifications.mark_as_read(id).await;
    match res {
        Ok(_) => Json(json!({ "success": true })),
        Err(e) => Json(json!({ "success": false, "error": e.to_string() })),
    }
}

pub async fn mark_all_notifications_read(
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let res = state.notifications.mark_all_as_read().await;
    match res {
        Ok(_) => Json(json!({ "success": true })),
        Err(e) => Json(json!({ "success": false, "error": e.to_string() })),
    }
}

pub async fn delete_notification(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> impl IntoResponse {
    let res = state.notifications.delete_notification(id).await;
    match res {
        Ok(_) => Json(json!({ "success": true })),
        Err(e) => Json(json!({ "success": false, "error": e.to_string() })),
    }
}

pub async fn clear_all_notifications(
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    let res = state.notifications.clear_all().await;
    match res {
        Ok(_) => Json(json!({ "success": true })),
        Err(e) => Json(json!({ "success": false, "error": e.to_string() })),
    }
}

#[derive(Deserialize)]
pub struct ResolveNotificationPayload {
    pub value: String,
}

/// Resolve notification by directly writing value to Candidate Profile attributes
pub async fn resolve_notification(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Json(payload): Json<ResolveNotificationPayload>,
) -> impl IntoResponse {
    let notifications = state.notifications.get_all().await.unwrap_or_default();
    let target = notifications.into_iter().find(|n| n.id == id);

    if let Some(item) = target {
        if let Some(ref key) = item.candidate_key {
            let label = item.candidate_label.as_deref().unwrap_or(key);
            let category = item.candidate_category.as_deref().unwrap_or("custom");
            let val_str = payload.value.trim();

            let _ = state
                .candidate
                .upsert_attribute(UpsertAttributeParams {
                    key,
                    category,
                    label,
                    description: Some(&item.message),
                    value: Some(val_str),
                    source_portal: None,
                    required_by_default: true,
                    is_delegated: false,
                })
                .await;
        }

        let _ = state.notifications.mark_as_read(id).await;
        Json(json!({ "success": true }))
    } else {
        Json(json!({ "success": false, "error": "Notification not found" }))
    }
}
