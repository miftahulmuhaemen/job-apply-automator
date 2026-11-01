use crate::storage::d1_client::D1Client;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CandidateAttributeRecord {
    pub key: String,
    pub category: String,
    pub label: String,
    pub description: Option<String>,
    pub value: Option<String>,
    pub status: String,
    pub source_portal: Option<String>,
    pub required_by_default: Option<i64>,
    pub is_agent_delegated: Option<i64>,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CandidateProfilePersonal {
    pub full_name: String,
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub phone: String,
    pub location: String,
    pub country: String,
    pub linkedin: String,
    pub github: String,
    pub portfolio: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CandidateProfile {
    pub personal: CandidateProfilePersonal,
    pub summary: String,
    pub attributes_map: HashMap<String, String>,
}

impl CandidateProfile {
    /// In-memory single-scan profile derivation (Issue 2)
    pub fn from_attributes(attributes: &[CandidateAttributeRecord]) -> Self {
        let mut map = HashMap::new();
        for attr in attributes {
            if let Some(ref val) = attr.value {
                map.insert(attr.key.clone(), val.clone());
            }
        }

        let full_name = map.get("full_name").cloned().unwrap_or_default();
        let name_parts: Vec<&str> = full_name.split_whitespace().collect();
        let first_name = map
            .get("first_name")
            .cloned()
            .unwrap_or_else(|| name_parts.first().copied().unwrap_or("").to_string());
        let last_name = map.get("last_name").cloned().unwrap_or_else(|| {
            if name_parts.len() > 1 {
                name_parts[1..].join(" ")
            } else {
                first_name.clone()
            }
        });

        Self {
            personal: CandidateProfilePersonal {
                full_name,
                first_name,
                last_name,
                email: map.get("email").cloned().unwrap_or_default(),
                phone: map.get("phone").cloned().unwrap_or_default(),
                location: map.get("location").cloned().unwrap_or_default(),
                country: map
                    .get("country")
                    .cloned()
                    .unwrap_or_else(|| "Indonesia".to_string()),
                linkedin: map.get("linkedin").cloned().unwrap_or_default(),
                github: map.get("github").cloned().unwrap_or_default(),
                portfolio: map.get("portfolio").cloned().unwrap_or_default(),
            },
            summary: map
                .get("summary")
                .cloned()
                .unwrap_or_else(|| "Software & Data Engineer".to_string()),
            attributes_map: map,
        }
    }
}

#[derive(Debug, Clone, Default)]
pub struct UpsertAttributeParams<'a> {
    pub key: &'a str,
    pub category: &'a str,
    pub label: &'a str,
    pub description: Option<&'a str>,
    pub value: Option<&'a str>,
    pub source_portal: Option<&'a str>,
    pub required_by_default: bool,
    pub is_delegated: bool,
}

#[derive(Clone, Debug)]
pub struct CandidateRepository {
    client: D1Client,
}

impl CandidateRepository {
    pub fn new(client: D1Client) -> Self {
        Self { client }
    }

    /// Single roundtrip attribute scan (Issue 2)
    pub async fn get_all_attributes(&self) -> Result<Vec<CandidateAttributeRecord>> {
        let sql = "SELECT key, category, label, description, value, status, source_portal, required_by_default, is_agent_delegated, updated_at
        FROM candidate_profile_attributes
        ORDER BY category, key;";

        self.client.query(sql, &[]).await
    }

    /// Parameterized search filtered strictly by label & description
    pub async fn query_attributes(&self, search: &str) -> Result<Vec<CandidateAttributeRecord>> {
        let pattern = if search.is_empty() {
            "".to_string()
        } else {
            format!("%{}%", search)
        };

        let sql = "SELECT key, category, label, description, value, status, source_portal, required_by_default, is_agent_delegated, updated_at
        FROM candidate_profile_attributes
        WHERE (?1 = '' OR label LIKE ?2 OR description LIKE ?2)
        ORDER BY category, key;";

        self.client
            .query(
                sql,
                &[
                    Value::String(search.to_string()),
                    Value::String(pattern),
                ],
            )
            .await
    }

    /// Single roundtrip profile resolution (Issue 2)
    pub async fn get_candidate_profile(&self) -> Result<CandidateProfile> {
        let attrs = self.get_all_attributes().await?;
        Ok(CandidateProfile::from_attributes(&attrs))
    }

    /// Single-statement update with CASE status resolution (Issue 3)
    pub async fn update_attribute(&self, key: &str, value: &str) -> Result<bool> {
        let sql = "UPDATE candidate_profile_attributes
        SET value = ?1,
            status = CASE
              WHEN is_agent_delegated = 1 THEN 'DELEGATED_TO_AGY'
              WHEN LENGTH(TRIM(COALESCE(?1, ''))) > 0 THEN 'RESOLVED'
              ELSE 'UNRESOLVED'
            END,
            updated_at = datetime('now')
        WHERE key = ?2;";

        let res = self
            .client
            .execute(
                sql,
                &[Value::String(value.to_string()), Value::String(key.to_string())],
            )
            .await?;
        Ok(res.changes > 0)
    }

    /// Single-statement delegation toggle (Issue 3)
    pub async fn toggle_delegation(&self, key: &str, delegate: bool) -> Result<bool> {
        let delegated_num = if delegate { 1 } else { 0 };
        let sql = "UPDATE candidate_profile_attributes
        SET is_agent_delegated = ?1,
            status = CASE
              WHEN ?1 = 1 THEN 'DELEGATED_TO_AGY'
              WHEN LENGTH(TRIM(COALESCE(value, ''))) > 0 THEN 'RESOLVED'
              ELSE 'UNRESOLVED'
            END,
            updated_at = datetime('now')
        WHERE key = ?2;";

        let res = self
            .client
            .execute(
                sql,
                &[Value::from(delegated_num), Value::String(key.to_string())],
            )
            .await?;
        Ok(res.changes > 0)
    }

    /// Single-statement ON CONFLICT DO UPDATE upsert (Issue 3)
    pub async fn upsert_attribute(&self, params: UpsertAttributeParams<'_>) -> Result<()> {
        let sql = "INSERT INTO candidate_profile_attributes (
            key, category, label, description, value, status, source_portal, required_by_default, is_agent_delegated, updated_at
        ) VALUES (
            ?1, ?2, ?3, ?4, ?5,
            CASE
              WHEN ?6 = 1 THEN 'DELEGATED_TO_AGY'
              WHEN LENGTH(TRIM(COALESCE(?5, ''))) > 0 THEN 'RESOLVED'
              ELSE 'UNRESOLVED'
            END,
            ?7, ?8, ?6, datetime('now')
        )
        ON CONFLICT(key) DO UPDATE SET
            value = COALESCE(excluded.value, candidate_profile_attributes.value),
            status = CASE
              WHEN candidate_profile_attributes.is_agent_delegated = 1 THEN 'DELEGATED_TO_AGY'
              WHEN LENGTH(TRIM(COALESCE(excluded.value, candidate_profile_attributes.value, ''))) > 0 THEN 'RESOLVED'
              ELSE 'UNRESOLVED'
            END,
            updated_at = datetime('now');";

        let db_params = vec![
            Value::String(params.key.to_string()),
            Value::String(params.category.to_string()),
            Value::String(params.label.to_string()),
            params.description.map(|s| Value::String(s.to_string())).unwrap_or(Value::Null),
            params.value.map(|s| Value::String(s.to_string())).unwrap_or(Value::Null),
            Value::from(if params.is_delegated { 1 } else { 0 }),
            params.source_portal.map(|s| Value::String(s.to_string())).unwrap_or(Value::Null),
            Value::from(if params.required_by_default { 1 } else { 0 }),
        ];

        self.client.execute(sql, &db_params).await?;
        Ok(())
    }
}
