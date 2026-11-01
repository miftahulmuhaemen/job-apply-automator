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
    pub products_summary: Option<String>,
    pub applications_count: Option<i64>,
    pub crawled_count: Option<i64>,
    pub first_crawled_at: Option<String>,
    pub last_applied_at: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    pub cooldown_days: Option<i64>,
    pub cooldown_status: Option<String>,
    pub cooldown_days_remaining: Option<i64>,
    pub jobs_json: Option<String>,
}

#[derive(Clone, Debug)]
pub struct CompaniesRepository {
    client: D1Client,
}

impl CompaniesRepository {
    pub fn new(client: D1Client) -> Self {
        Self { client }
    }

    /// Single roundtrip query against v_companies_summary view (Issue 1)
    pub async fn get_companies(&self) -> Result<Vec<CompanyRecord>> {
        let sql = "SELECT
            id, name, normalized_name, industry, company_size, location, overview,
            website, headquarters, leaders, hr_contacts, products_summary,
            applications_count, crawled_count, first_crawled_at, last_applied_at,
            created_at, updated_at, cooldown_days, cooldown_status, cooldown_days_remaining,
            jobs_json
        FROM v_companies_summary
        ORDER BY applications_count DESC, crawled_count DESC;";

        self.client.query(sql, &[]).await
    }
}
