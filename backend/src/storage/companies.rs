use crate::storage::d1_client::D1Client;
use anyhow::Result;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CompanyRecord {
    pub id: Option<String>,
    pub name: String,
    pub normalized_name: Option<String>,
    pub industry: Option<String>,
    pub company_size: Option<String>,
    pub location: Option<String>,
    pub overview: Option<String>,
    pub website: Option<String>,
    pub headquarters: Option<String>,
    pub leaders: Option<String>,
    pub hr_contacts: Option<String>,
    #[serde(default)]
    pub products_summary: Option<String>,
    pub applications_count: Option<i64>,
    pub crawled_count: Option<i64>,
    pub first_crawled_at: Option<String>,
    pub last_applied_at: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
    #[serde(default)]
    pub jobs: Option<Vec<serde_json::Value>>,
}

#[derive(Clone, Debug)]
pub struct CompaniesRepository {
    client: D1Client,
}

impl CompaniesRepository {
    pub fn new(client: D1Client) -> Self {
        Self { client }
    }

    /// Direct query against physical `companies` table with name-only search
    pub async fn query_companies(&self, search: &str) -> Result<Vec<CompanyRecord>> {
        let pattern = if search.is_empty() {
            "".to_string()
        } else {
            format!("%{}%", search)
        };

        let sql = "SELECT
            id, name, normalized_name, industry, company_size, location, overview,
            website, headquarters, leaders, hr_contacts, products_summary,
            applications_count, crawled_count, first_crawled_at, last_applied_at,
            created_at, updated_at
        FROM companies
        WHERE (?1 = '' OR name LIKE ?2)
        ORDER BY applications_count DESC, crawled_count DESC;";

        self.client
            .query(
                sql,
                &[
                    serde_json::Value::String(search.to_string()),
                    serde_json::Value::String(pattern),
                ],
            )
            .await
    }

    pub async fn get_companies(&self) -> Result<Vec<CompanyRecord>> {
        self.query_companies("").await
    }

    pub async fn get_company_jobs(&self, company_name: &str) -> Result<Vec<serde_json::Value>> {
        let sql = "SELECT id, uuid, company, title, portal, job_url, location, salary_raw, status, created_at FROM jobs_ledger WHERE LOWER(company) = LOWER(?1) AND (is_deleted = 0 OR is_deleted IS NULL) ORDER BY created_at DESC;";
        self.client.query(sql, &[serde_json::Value::from(company_name)]).await
    }
}
