use crate::storage::VectorClient;
use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TriageScoreResult {
    pub match_score: f64,
    pub match_percentage: i64,
    pub recommendation: String, // "HIGH_MATCH" | "MODERATE_MATCH" | "LOW_MATCH"
    pub top_matched_evidence: Vec<String>,
}

pub struct SemanticTriageScorer;

impl SemanticTriageScorer {
    /// Evaluates a job posting's title and description against Cloudflare Vectorize
    /// knowledge index `candidate-knowledge-v1` using Workers AI 768d embeddings.
    pub async fn score_job(
        vector_client: &VectorClient,
        title: &str,
        company: &str,
        description: &str,
    ) -> Result<TriageScoreResult> {
        let snippet: String = description.chars().take(500).collect();
        let query_text = format!("{} at {}. Requirements: {}", title, company, snippet);

        let query_vec = vector_client.create_embedding(&query_text).await?;
        let matches = vector_client.query_vectors(&query_vec, 5).await?;

        if matches.is_empty() {
            return Ok(TriageScoreResult {
                match_score: 0.0,
                match_percentage: 0,
                recommendation: "LOW_MATCH".into(),
                top_matched_evidence: Vec::new(),
            });
        }

        let top_score = matches.first().map(|m| m.score).unwrap_or(0.0);
        let match_percentage = (top_score * 100.0).round() as i64;

        let mut evidence = Vec::new();
        for m in &matches {
            let meta = m.metadata.as_ref();
            let title = meta.and_then(|v| v.get("title")).and_then(|v| v.as_str()).unwrap_or("");
            let key = meta.and_then(|v| v.get("key")).and_then(|v| v.as_str()).unwrap_or("");
            let val = meta.and_then(|v| v.get("value")).and_then(|v| v.as_str()).unwrap_or("");

            if !title.is_empty() {
                evidence.push(format!("Project: {} ({:.0}%)", title, m.score * 100.0));
            } else if !key.is_empty() {
                let short_val: String = val.chars().take(80).collect();
                evidence.push(format!("Skill/Attribute: {} - {} ({:.0}%)", key, short_val, m.score * 100.0));
            }
        }

        let recommendation = if top_score >= 0.70 {
            "HIGH_MATCH".to_string()
        } else if top_score >= 0.50 {
            "MODERATE_MATCH".to_string()
        } else {
            "LOW_MATCH".to_string()
        };

        Ok(TriageScoreResult {
            match_score: top_score,
            match_percentage,
            recommendation,
            top_matched_evidence: evidence,
        })
    }
}
