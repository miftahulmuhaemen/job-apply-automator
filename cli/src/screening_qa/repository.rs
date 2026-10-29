use rusqlite::{params, Connection, Result};

pub struct ScreeningQaRepository<'a> {
    conn: &'a Connection,
}

impl<'a> ScreeningQaRepository<'a> {
    pub fn new(conn: &'a Connection) -> Self {
        Self { conn }
    }

    pub fn find_answer(&self, question_text: &str) -> Result<Option<String>> {
        let clean = question_text.trim().to_lowercase();
        let mut stmt = self.conn.prepare(
            "SELECT answer FROM screening_qa 
             WHERE lower(question_pattern) = ?1 OR instr(?1, lower(question_pattern)) > 0 
             LIMIT 1",
        )?;

        let mut rows = stmt.query(params![clean])?;
        if let Some(row) = rows.next()? {
            let answer: String = row.get(0)?;
            // Increment usage count
            let _ = self.conn.execute(
                "UPDATE screening_qa 
                 SET usage_count = usage_count + 1, updated_at = datetime('now') 
                 WHERE lower(question_pattern) = ?1",
                params![clean],
            );
            return Ok(Some(answer));
        }
        Ok(None)
    }

    pub fn save_answer(&self, pattern: &str, answer: &str, category: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO screening_qa (question_pattern, answer, category, usage_count, updated_at)
             VALUES (?1, ?2, ?3, 1, datetime('now'))
             ON CONFLICT(question_pattern) DO UPDATE SET
               answer = excluded.answer,
               category = excluded.category,
               usage_count = screening_qa.usage_count + 1,
               updated_at = datetime('now')",
            params![pattern.trim(), answer.trim(), category],
        )?;
        Ok(())
    }
}
