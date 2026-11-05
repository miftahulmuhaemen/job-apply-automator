use crate::storage::candidate::CandidateProfile;
use crate::storage::{CandidateRepository, VectorClient};
use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MatchedFieldAnswer {
    pub matched_id: String,
    pub match_type: String, // "portfolio" | "attribute" | "certification"
    pub title_or_key: String,
    pub answer_text: String,
    pub score: f64,
}

pub struct SemanticMatcher;

impl SemanticMatcher {
    /// Query Cloudflare Vectorize to find the most relevant candidate knowledge chunk for a screener question or field label
    pub async fn match_question(
        vector_client: &VectorClient,
        candidate_repo: &CandidateRepository,
        question: &str,
    ) -> Result<Option<MatchedFieldAnswer>> {
        let matches = Self::query_top_matches(vector_client, candidate_repo, question, 3).await?;

        // Production confidence threshold: >= 0.70 for confident auto-fill
        if let Some(top) = matches.into_iter().find(|m| m.score >= 0.70) {
            return Ok(Some(top));
        }

        Ok(None)
    }

    /// Query Cloudflare Vectorize and return top-k matches resolved with deep candidate data
    pub async fn query_top_matches(
        vector_client: &VectorClient,
        candidate_repo: &CandidateRepository,
        query: &str,
        top_k: usize,
    ) -> Result<Vec<MatchedFieldAnswer>> {
        let embedding = vector_client.create_embedding(query).await?;
        let matches = vector_client.query_vectors(&embedding, top_k).await?;

        let mut results = Vec::new();
        let attrs = candidate_repo.get_all_attributes().await.unwrap_or_default();
        let partitioned_data = attrs
            .iter()
            .find(|a| a.key == "portfolio_items_partitioned")
            .and_then(|a| a.value.as_ref())
            .and_then(|v| serde_json::from_str::<crate::job_crawling::PartitionedPortfolioData>(v).ok());

        for m in matches {
            let meta = m.metadata.unwrap_or_default();
            let match_type = meta
                .get("type")
                .and_then(|t| t.as_str())
                .unwrap_or_default()
                .to_string();

            if match_type == "attribute" {
                let key = meta.get("key").and_then(|k| k.as_str()).unwrap_or_default();
                let live_val = attrs
                    .iter()
                    .find(|a| a.key == key)
                    .and_then(|a| a.value.as_deref())
                    .unwrap_or_else(|| meta.get("value").and_then(|v| v.as_str()).unwrap_or_default());
                let clean_val = live_val
                    .replace("Go 1.22", "Go")
                    .replace("Echo v4", "Echo")
                    .replace("PostgreSQL 14", "PostgreSQL");
                results.push(MatchedFieldAnswer {
                    matched_id: m.id,
                    match_type: "attribute".to_string(),
                    title_or_key: key.to_string(),
                    answer_text: clean_val,
                    score: m.score,
                });
            } else if match_type == "portfolio" {
                let slug = meta.get("slug").and_then(|s| s.as_str()).unwrap_or_default();
                let title = meta.get("title").and_then(|t| t.as_str()).unwrap_or_default();

                if let Some(ref data) = partitioned_data {
                    for items in data.categories.values() {
                        if let Some(item) = items.iter().find(|i| i.slug == slug) {
                            let mut answer = String::new();
                            if !item.description.is_empty() {
                                answer.push_str(&item.description);
                            }
                            if !item.highlights.is_empty() {
                                if !answer.is_empty() {
                                    answer.push_str("\n\nKey Highlights:\n");
                                }
                                for hl in &item.highlights {
                                    answer.push_str(&format!("• {}\n", hl));
                                }
                            }
                            if !item.tech_stack.is_empty() {
                                answer.push_str(&format!("\nTech Stack: {}", item.tech_stack.join(", ")));
                            }
                            if let Some(ref pu) = item.project_url {
                                answer.push_str(&format!("\nProject Demo: {}", pu));
                            }

                            let clean_answer = answer
                                .replace("Go 1.22", "Go")
                                .replace("Echo v4", "Echo")
                                .replace("PostgreSQL 14", "PostgreSQL");

                            results.push(MatchedFieldAnswer {
                                matched_id: m.id.clone(),
                                match_type: "portfolio".to_string(),
                                title_or_key: title.to_string(),
                                answer_text: clean_answer.trim().to_string(),
                                score: m.score,
                            });
                            break;
                        }
                    }
                }
            }
        }

        Ok(results)
    }

    /// Dynamically synthesize an evidence-backed tailored cover letter using semantic search
    /// to retrieve the candidate's most relevant projects and credentials for the target role.
    pub async fn synthesize_tailored_cover_letter(
        vector_client: &VectorClient,
        candidate_repo: &CandidateRepository,
        company: &str,
        title: &str,
        location: &str,
        profile: &CandidateProfile,
    ) -> Result<String> {
        let query = format!("{} role at {} {} software engineering", title, company, location);
        let matches = Self::query_top_matches(vector_client, candidate_repo, &query, 4).await.unwrap_or_default();

        let mut project_references = Vec::new();
        for m in matches.iter().filter(|m| m.match_type == "portfolio") {
            project_references.push(format!("• {}: {}", m.title_or_key, m.answer_text.lines().next().unwrap_or("")));
        }

        let projects_paragraph = if !project_references.is_empty() {
            format!(
                "My technical background directly aligns with your requirements, as evidenced by relevant production systems from my engineering portfolio:\n{}\n",
                project_references.join("\n")
            )
        } else {
            format!(
                "Across recent engineering roles, I have designed scalable event-driven microservices, optimized high-throughput database systems, and managed containerized cloud deployments as documented on my portfolio ({}).\n",
                profile.personal.portfolio
            )
        };

        let cover_letter = format!(
            "Dear Hiring Team at {company},\n\nI am writing to express my strong enthusiasm for the {title} position at {company}. With over 5 years of professional software engineering experience architecting scalable backend systems, resilient cloud infrastructure, and modern web applications, I look forward to contributing to your engineering squads.\n\n{projects_paragraph}\nI am available to join immediately (ASAP notice period) and welcome the opportunity to discuss how my qualifications can accelerate {company}'s technical roadmap.\n\nSincerely,\n{full_name}\n{email} | {phone} | {portfolio}",
            company = company,
            title = title,
            projects_paragraph = projects_paragraph,
            full_name = profile.personal.full_name,
            email = profile.personal.email,
            phone = profile.personal.phone,
            portfolio = profile.personal.portfolio
        );

        Ok(cover_letter)
    }
}
