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
pub struct CandidateExperienceItem {
    pub company: String,
    pub role: String,
    pub location: Option<String>,
    pub start_date: String,
    pub end_date: String,
    pub highlights: Vec<String>,
    pub industry: Option<String>,
}




#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CandidateEducationItem {
    pub institution: String,
    pub degree: String,
    pub field: String,
    pub gpa: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CandidateProjectItem {
    pub title: String,
    pub slug: Option<String>,
    pub url: Option<String>,
    pub date: String,
    pub tech_stack: Vec<String>,
    pub category: Option<String>,
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CandidateProfile {
    pub personal: CandidateProfilePersonal,
    pub summary: String,
    pub experience: Vec<CandidateExperienceItem>,
    pub education: Vec<CandidateEducationItem>,
    pub projects: Vec<CandidateProjectItem>,
    pub attributes_map: HashMap<String, String>,
}

impl CandidateProfile {
    pub fn default_experience(map: &HashMap<String, String>) -> Vec<CandidateExperienceItem> {
        vec![
            CandidateExperienceItem {
                company: map
                    .get("experience_company")
                    .cloned()
                    .unwrap_or_else(|| "Blue Sky Tech (Bythen AI)".into()),
                role: map
                    .get("experience_role")
                    .cloned()
                    .unwrap_or_else(|| "Data and Backend Engineer".into()),
                location: Some("Remote".into()),
                start_date: map
                    .get("experience_start_date")
                    .cloned()
                    .unwrap_or_else(|| "2025-03".into()),
                end_date: map
                    .get("experience_end_date")
                    .cloned()
                    .unwrap_or_else(|| "2026-06".into()),
                highlights: vec![
                    "Architected foundational analytical Data Warehouse using star schema, orchestrating scheduled batch pipelines in Python/Airflow to aggregate millions of operational records into Metabase dashboards.".into(),
                    "Engineered core Go microservices and event-driven task queue backed by GCP Pub/Sub and webhook callbacks, decoupling long-running GPU generative rendering clusters from API gateways.".into(),
                    "Embedded automated data quality assertions with Great Expectations in Airflow DAGs, preventing corrupt schema metrics and upstream pipeline failures.".into(),
                ],
                industry: Some("Artificial Intelligence / Software".into()),
            },
            CandidateExperienceItem {
                company: map
                    .get("experience_2_company")
                    .cloned()
                    .unwrap_or_else(|| "Astro Technologies Indonesia".into()),
                role: map
                    .get("experience_2_role")
                    .cloned()
                    .unwrap_or_else(|| "Senior Backend Engineer".into()),
                location: Some("Indonesia".into()),
                start_date: map
                    .get("experience_2_start_date")
                    .cloned()
                    .unwrap_or_else(|| "2022-07".into()),
                end_date: map
                    .get("experience_2_end_date")
                    .cloned()
                    .unwrap_or_else(|| "2025-02".into()),
                highlights: vec![
                    "Architected and scaled distributed backend microservices handling high-throughput order dispatching, inventory reservations, and payment processing.".into(),
                    "Optimized PostgreSQL queries and Redis caching layers, cutting P99 latency by 35%.".into(),
                    "Collaborated with engineering team to administer production Kubernetes clusters across GKE and AKS, conducting cluster monitoring, service incident triage, and database migrations.".into(),
                ],
                industry: Some("Quick Commerce / Distributed Systems".into()),
            },
            CandidateExperienceItem {
                company: map
                    .get("experience_3_company")
                    .cloned()
                    .unwrap_or_else(|| "PT Datanest Solusi Otomasi".into()),
                role: map
                    .get("experience_3_role")
                    .cloned()
                    .unwrap_or_else(|| "Backend Engineer".into()),
                location: Some("Indonesia".into()),
                start_date: map
                    .get("experience_3_start_date")
                    .cloned()
                    .unwrap_or_else(|| "2020-04".into()),
                end_date: map
                    .get("experience_3_end_date")
                    .cloned()
                    .unwrap_or_else(|| "2022-06".into()),
                highlights: vec![
                    "Developed automated data ingestion and telemetry pipelines in Go and Python with MongoDB time-series storage.".into(),
                    "Built resilient event-driven background workers and integrated external enterprise partner APIs.".into(),
                    "Established CI/CD Docker deployment pipelines and automated test suites for continuous integration.".into(),
                ],
                industry: Some("Big Data & Automation Solutions".into()),
            },
        ]
    }

    pub fn default_education(map: &HashMap<String, String>) -> Vec<CandidateEducationItem> {
        vec![CandidateEducationItem {
            institution: map
                .get("school")
                .or_else(|| map.get("education_institution"))
                .cloned()
                .unwrap_or_else(|| "Universitas Lambung Mangkurat".into()),
            degree: map
                .get("degree")
                .cloned()
                .unwrap_or_else(|| "Bachelor's Degree in Computer Science".into()),
            field: map
                .get("field_of_study")
                .or_else(|| map.get("major"))
                .cloned()
                .unwrap_or_else(|| "Computer Science".into()),
            gpa: map.get("gpa").cloned().or_else(|| Some("3.62".into())),
            start_date: map
                .get("education_start_date")
                .cloned()
                .or_else(|| Some("2015-08".into())),
            end_date: map
                .get("education_end_date")
                .cloned()
                .or_else(|| Some("2020-03".into())),
        }]
    }

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

        let experience = if let Some(exp_json) = map.get("experience_json") {
            serde_json::from_str::<Vec<CandidateExperienceItem>>(exp_json)
                .unwrap_or_else(|_| Self::default_experience(&map))
        } else {
            Self::default_experience(&map)
        };

        let education = if let Some(edu_json) = map.get("education_json") {
            serde_json::from_str::<Vec<CandidateEducationItem>>(edu_json)
                .unwrap_or_else(|_| Self::default_education(&map))
        } else {
            Self::default_education(&map)
        };

        let projects = if let Some(proj_json) = map.get("portfolio_projects").or_else(|| map.get("projects_json")) {
            serde_json::from_str::<Vec<CandidateProjectItem>>(proj_json)
                .unwrap_or_else(|_| Self::default_projects())
        } else {
            Self::default_projects()
        };

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
                .unwrap_or_else(|| "Results-oriented Fullstack & Backend Engineer with 5+ years of professional experience across Golang (Go), TypeScript, React.js, distributed microservices, and cloud infrastructure.".to_string()),
            experience,
            education,
            projects,
            attributes_map: map,
        }
    }

    pub fn default_projects() -> Vec<CandidateProjectItem> {
        vec![
            CandidateProjectItem {
                title: "Point of Sale & Inventory System Koperasi KHMB".into(),
                slug: Some("025_koperasi_khmb".into()),
                url: Some("https://muhaemen.my.id/025_koperasi_khmb/".into()),
                date: "15.10.2026".into(),
                tech_stack: vec!["Go".into(), "Echo".into(), "React".into(), "TypeScript".into(), "Vite".into(), "PostgreSQL".into(), "Tailwind CSS".into(), "Docker".into(), "IndexedDB".into(), "WebSerial ESC/POS".into()],
                category: Some("Fullstack & Retail POS".into()),
                description: "Production offline-first Point of Sale and inventory platform pairing a high-throughput Go backend with a responsive React/TypeScript client. Features IndexedDB local transaction buffer with background delta sync, PostgreSQL Common Table Expressions (CTEs) for 70% faster stock aggregations, hardware USB/Bluetooth barcode scanner HID heuristics, and native ESC/POS thermal printing over WebSerial/WebUSB.".into(),
            },
            CandidateProjectItem {
                title: "Sanak Keluarga".into(),
                slug: Some("024_sanak_keluarga".into()),
                url: Some("https://muhaemen.my.id/024_sanak_keluarga/".into()),
                date: "01.12.2025".into(),
                tech_stack: vec!["React".into(), "TypeScript".into(), "Vite".into(), "Tailwind CSS".into(), "Monaco Editor".into(), "IndexedDB".into(), "Cloudflare Pages".into()],
                category: Some("Fullstack Web App".into()),
                description: "Interactive genealogical tree and familial data visualizer featuring client-side IndexedDB persistence, Monaco editor integration, and edge hosting on Cloudflare Pages.".into(),
            },
            CandidateProjectItem {
                title: "Sipamanobat: Drugstore Formulary Glossary".into(),
                slug: Some("023_sipamanobat".into()),
                url: Some("https://muhaemen.my.id/023_sipamanobat/".into()),
                date: "01.08.2025".into(),
                tech_stack: vec!["React".into(), "TypeScript".into(), "Vite".into(), "Tailwind CSS".into(), "Python".into(), "Selenium".into()],
                category: Some("Fullstack Web App & Data Pipeline".into()),
                description: "Searchable pharmaceutical catalog and formulary glossary with automated ingestion scrapers in Python/Selenium and a fast fuzzy-search React frontend.".into(),
            },
            CandidateProjectItem {
                title: "Software Engineer at Feedloop AI".into(),
                slug: Some("020_work_feedloop".into()),
                url: Some("https://muhaemen.my.id/020_work_feedloop/".into()),
                date: "01.12.2022".into(),
                tech_stack: vec!["TypeScript".into(), "NestJS".into(), "Node.js".into(), "React".into(), "Deno".into(), "Kubernetes".into(), "GCP".into(), "AWS Bedrock".into(), "Docker".into()],
                category: Some("Fullstack & AI Engineering".into()),
                description: "Engineered scalable AI web application platforms, NestJS microservices, and interactive frontend interfaces backed by Kubernetes clusters on GCP.".into(),
            },
            CandidateProjectItem {
                title: "Software Engineer at PT Arkan Jaya Nusantara".into(),
                slug: Some("019_work_arkan_jaya".into()),
                url: Some("https://muhaemen.my.id/019_work_arkan_jaya/".into()),
                date: "01.01.2021".into(),
                tech_stack: vec!["Go".into(), "TypeScript".into(), "React".into(), "MongoDB".into(), "Docker".into(), "GitHub Actions".into(), "Web Bluetooth".into()],
                category: Some("Fullstack & IoT Engineering".into()),
                description: "Built fullstack IoT monitoring platforms using Go backend services and React frontends with Web Bluetooth device communication.".into(),
            },
        ]
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
        WHERE (?1 = '' OR key LIKE ?2 OR label LIKE ?2 OR description LIKE ?2)
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

    pub async fn save_partitioned_portfolio(&self, data: &crate::job_crawling::PartitionedPortfolioData) -> Result<()> {
        let full_json = serde_json::to_string(data)?;
        self.upsert_attribute(UpsertAttributeParams {
            key: "portfolio_items_partitioned",
            category: "portfolio",
            label: "Partitioned Portfolio (muhaemen.my.id)",
            description: Some("Structured multi-source portfolio partitioned by category: product, work, certification, volunteer"),
            value: Some(&full_json),
            source_portal: Some("crawler"),
            required_by_default: false,
            is_delegated: false,
        }).await?;

        for (cat, items) in &data.categories {
            let key = format!("portfolio_{}", cat);
            let cat_json = serde_json::to_string(items)?;
            self.upsert_attribute(UpsertAttributeParams {
                key: &key,
                category: "portfolio",
                label: &format!("Portfolio - {}", cat),
                description: Some(&format!("Crawled items for {}", cat)),
                value: Some(&cat_json),
                source_portal: Some("crawler"),
                required_by_default: false,
                is_delegated: false,
            }).await?;
        }

        self.upsert_attribute(UpsertAttributeParams {
            key: "portfolio_crawled_at",
            category: "portfolio",
            label: "Portfolio Last Crawled At",
            description: Some("Timestamp of last automated portfolio crawl"),
            value: Some(&data.crawled_at),
            source_portal: Some("crawler"),
            required_by_default: false,
            is_delegated: false,
        }).await?;

        Ok(())
    }
}
