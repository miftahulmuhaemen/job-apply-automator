use crate::storage::D1Client;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::Value;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationRecord {
    pub id: i64,
    pub title: String,
    pub message: String,
    #[serde(rename = "type")]
    pub notification_type: String,
    pub target_job_id: Option<i64>,
    pub candidate_key: Option<String>,
    pub candidate_label: Option<String>,
    pub candidate_category: Option<String>,
    pub is_read: i64,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Default)]
pub struct CreateNotificationParams<'a> {
    pub title: &'a str,
    pub message: &'a str,
    pub notification_type: &'a str,
    pub target_job_id: Option<i64>,
    pub candidate_key: Option<&'a str>,
    pub candidate_label: Option<&'a str>,
    pub candidate_category: Option<&'a str>,
}

#[derive(Clone, Debug)]
pub struct NotificationsRepository {
    client: D1Client,
}

impl NotificationsRepository {
    pub fn new(client: D1Client) -> Self {
        Self { client }
    }

    pub async fn get_all(&self) -> Result<Vec<NotificationRecord>> {
        let sql = "SELECT id, title, message, type, target_job_id, candidate_key, candidate_label, candidate_category, is_read, created_at, updated_at
        FROM system_notifications
        ORDER BY is_read ASC, id DESC
        LIMIT 50;";

        self.client.query(sql, &[]).await
    }

    pub async fn get_unread_count(&self) -> Result<i64> {
        let sql = "SELECT COUNT(*) as count FROM system_notifications WHERE is_read = 0;";
        let rows: Vec<Value> = self.client.query(sql, &[]).await?;
        let count = rows
            .first()
            .and_then(|r| r.get("count"))
            .and_then(|v| v.as_i64())
            .unwrap_or(0);
        Ok(count)
    }

    pub async fn create(&self, params: CreateNotificationParams<'_>) -> Result<i64> {
        let sql = "INSERT INTO system_notifications (
            title, message, type, target_job_id, candidate_key, candidate_label, candidate_category, is_read, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, datetime('now'), datetime('now'));";

        let db_params = vec![
            Value::String(params.title.to_string()),
            Value::String(params.message.to_string()),
            Value::String(params.notification_type.to_string()),
            params.target_job_id.map(Value::from).unwrap_or(Value::Null),
            params.candidate_key.map(|s| Value::String(s.to_string())).unwrap_or(Value::Null),
            params.candidate_label.map(|s| Value::String(s.to_string())).unwrap_or(Value::Null),
            params.candidate_category.map(|s| Value::String(s.to_string())).unwrap_or(Value::Null),
        ];

        let res = self.client.execute(sql, &db_params).await?;
        Ok(res.last_row_id as i64)
    }

    pub async fn mark_as_read(&self, id: i64) -> Result<bool> {
        let sql = "UPDATE system_notifications SET is_read = 1, updated_at = datetime('now') WHERE id = ?1;";
        let res = self.client.execute(sql, &[Value::from(id)]).await?;
        Ok(res.changes > 0)
    }

    pub async fn mark_all_as_read(&self) -> Result<bool> {
        let sql = "UPDATE system_notifications SET is_read = 1, updated_at = datetime('now') WHERE is_read = 0;";
        let res = self.client.execute(sql, &[]).await?;
        Ok(res.changes > 0)
    }

    pub async fn delete_notification(&self, id: i64) -> Result<bool> {
        let sql = "DELETE FROM system_notifications WHERE id = ?1;";
        let res = self.client.execute(sql, &[Value::from(id)]).await?;
        Ok(res.changes > 0)
    }

    pub async fn clear_all(&self) -> Result<bool> {
        let sql = "DELETE FROM system_notifications;";
        let res = self.client.execute(sql, &[]).await?;
        Ok(res.changes > 0)
    }
}
