use crate::storage::D1Client;
use anyhow::Result;
use serde_json::Value;

#[derive(Clone, Debug)]
pub struct ScreeningQaRepository {
    client: D1Client,
}

impl ScreeningQaRepository {
    pub fn new(client: D1Client) -> Self {
        Self { client }
    }

    pub async fn find_answer(&self, question_text: &str) -> Result<Option<String>> {
        let clean = question_text.trim().to_lowercase();
        let sql = "SELECT answer FROM screening_qa 
                   WHERE lower(question_pattern) = ?1 OR instr(?1, lower(question_pattern)) > 0 
                   LIMIT 1;";

        let rows: Vec<Value> = self.client.query(sql, &[Value::String(clean.clone())]).await?;
        if let Some(first) = rows.into_iter().next() {
            let answer = first.get("answer").and_then(|v| v.as_str()).unwrap_or_default().to_string();
            let update_sql = "UPDATE screening_qa 
                              SET usage_count = usage_count + 1, updated_at = datetime('now') 
                              WHERE lower(question_pattern) = ?1;";
            let _ = self.client.execute(update_sql, &[Value::String(clean)]).await;
            return Ok(Some(answer));
        }
        Ok(None)
    }

    pub async fn save_answer(&self, pattern: &str, answer: &str, category: &str) -> Result<()> {
        let sql = "INSERT INTO screening_qa (question_pattern, answer, category, usage_count, updated_at)
                   VALUES (?1, ?2, ?3, 1, datetime('now'))
                   ON CONFLICT(question_pattern) DO UPDATE SET
                     answer = excluded.answer,
                     category = excluded.category,
                     usage_count = screening_qa.usage_count + 1,
                     updated_at = datetime('now');";

        let _ = self.client.execute(
            sql,
            &[
                Value::String(pattern.trim().to_string()),
                Value::String(answer.trim().to_string()),
                Value::String(category.to_string()),
            ],
        ).await?;
        Ok(())
    }
}
