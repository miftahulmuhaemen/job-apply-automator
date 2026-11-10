use crate::job_crawling::portfolio_crawler::{PartitionedPortfolioData, PartitionedPortfolioItem};
use crate::storage::{CandidateRepository, VectorClient, VectorRecord};
use anyhow::Result;
use serde_json::json;

pub struct VectorIndexer;

impl VectorIndexer {
    /// Format a single portfolio item into an embedding-optimized text representation
    pub fn format_portfolio_chunk(item: &PartitionedPortfolioItem) -> String {
        let mut parts = Vec::new();
        parts.push(format!("Title: {}", item.title));
        parts.push(format!("Category: {}", item.category));
        if !item.date.is_empty() {
            parts.push(format!("Date/Period: {}", item.date));
        }
        if !item.description.is_empty() {
            parts.push(format!("Description: {}", item.description));
        }
        if !item.highlights.is_empty() {
            parts.push(format!("Architectural Highlights: {}", item.highlights.join("; ")));
        }
        if !item.tech_stack.is_empty() {
            parts.push(format!("Technologies & Stack: {}", item.tech_stack.join(", ")));
        }
        if let Some(ref iss) = item.issuer {
            parts.push(format!("Issuing Organization: {}", iss));
        }
        if let Some(ref ct) = item.cert_type {
            parts.push(format!("Certification Type: {}", ct));
        }
        if !item.coverage.is_empty() {
            parts.push(format!("Domain Coverage: {}", item.coverage.join(", ")));
        }
        if let Some(ref vr) = item.volunteer_role {
            parts.push(format!("Role: {}", vr));
        }
        if let Some(ref vs) = item.volunteer_scope {
            parts.push(format!("Scope: {}", vs));
        }
        if let Some(ref pu) = item.project_url {
            parts.push(format!("Live Project URL: {}", pu));
        }
        if let Some(ref au) = item.article_url {
            parts.push(format!("Article / Case Study: {}", au));
        }

        parts.join("\n")
    }

    /// Format a candidate attribute into an embedding-optimized text representation
    pub fn format_attribute_chunk(key: &str, category: &str, label: &str, value: &str, description: &str) -> String {
        format!(
            "Candidate Information [{category}]: {label} ({key})\nValue: {value}\nDescription/Context: {description}"
        )
    }

    /// Ensure vector IDs strictly conform to Cloudflare Vectorize's 64-byte limit
    pub fn sanitize_id(prefix: &str, sub: &str, identifier: &str) -> String {
        let base = format!("{}:{}:", prefix, sub);
        let allowed_len = 64usize.saturating_sub(base.len());
        let truncated = if identifier.len() > allowed_len {
            &identifier[..allowed_len]
        } else {
            identifier
        };
        format!("{}{}", base, truncated)
    }

    /// Granular re-embedding: embed and upsert ONLY a single portfolio item chunk
    pub async fn index_single_portfolio_item(
        vector_client: &VectorClient,
        item: &PartitionedPortfolioItem,
    ) -> Result<()> {
        let text = Self::format_portfolio_chunk(item);
        let vector = vector_client.create_embedding(&text).await?;

        let record = VectorRecord {
            id: Self::sanitize_id("port", &item.category, &item.slug),
            values: vector,
            metadata: json!({
                "type": "portfolio",
                "slug": item.slug,
                "category": item.category,
                "title": item.title,
                "date": item.date,
                "project_url": item.project_url,
                "article_url": item.article_url,
                "tech_stack": item.tech_stack,
            }),
        };

        vector_client.upsert_vectors(&[record]).await?;
        Ok(())
    }

    /// Granular re-embedding: embed and upsert ONLY a single candidate attribute chunk
    pub async fn index_single_attribute(
        vector_client: &VectorClient,
        key: &str,
        category: &str,
        label: &str,
        value: &str,
        description: &str,
    ) -> Result<()> {
        if value.trim().is_empty() {
            return Ok(());
        }

        let text = Self::format_attribute_chunk(key, category, label, value, description);
        let vector = vector_client.create_embedding(&text).await?;

        let record = VectorRecord {
            id: Self::sanitize_id("attr", category, key),
            values: vector,
            metadata: json!({
                "type": "attribute",
                "key": key,
                "category": category,
                "label": label,
                "value": value,
            }),
        };

        vector_client.upsert_vectors(&[record]).await?;
        Ok(())
    }

    /// Sync and index all candidate knowledge (called during initial sync or full recrawl)
    pub async fn index_all_knowledge(
        vector_client: &VectorClient,
        candidate_repo: &CandidateRepository,
        portfolio_data: Option<&PartitionedPortfolioData>,
    ) -> Result<usize> {
        let mut records = Vec::new();

        // 1. Index Candidate Attributes
        let attrs = candidate_repo.get_all_attributes().await.unwrap_or_default();
        for a in &attrs {
            // Skip large serialized JSON keys or empty values
            if a.key.starts_with("portfolio_") || a.value.as_deref().unwrap_or("").trim().is_empty() {
                continue;
            }
            let val = a.value.as_deref().unwrap_or("");
            let desc = a.description.as_deref().unwrap_or("");
            let text = Self::format_attribute_chunk(&a.key, &a.category, &a.label, val, desc);
            if let Ok(vector) = vector_client.create_embedding(&text).await {
                records.push(VectorRecord {
                    id: Self::sanitize_id("attr", &a.category, &a.key),
                    values: vector,
                    metadata: json!({
                        "type": "attribute",
                        "key": a.key,
                        "category": a.category,
                        "label": a.label,
                        "value": val,
                    }),
                });
            }
        }

        // 2. Index Portfolio Items
        if let Some(port) = portfolio_data {
            for items in port.categories.values() {
                for item in items {
                    let text = Self::format_portfolio_chunk(item);
                    if let Ok(vector) = vector_client.create_embedding(&text).await {
                        records.push(VectorRecord {
                            id: Self::sanitize_id("port", &item.category, &item.slug),
                            values: vector,
                            metadata: json!({
                                "type": "portfolio",
                                "slug": item.slug,
                                "category": item.category,
                                "title": item.title,
                                "date": item.date,
                                "project_url": item.project_url,
                                "article_url": item.article_url,
                                "tech_stack": item.tech_stack,
                            }),
                        });
                    }
                }
            }
        }

        let total = records.len();
        if !records.is_empty() {
            vector_client.upsert_vectors(&records).await?;
        }

        Ok(total)
    }
}
