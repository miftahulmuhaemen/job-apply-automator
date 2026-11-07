use super::model::{DeallsExploreJobResponse, DeallsJobDoc};
use crate::job_triage::JobRecord;
use anyhow::{anyhow, Result};
use chrono::{Duration, Utc};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, USER_AGENT};

pub struct DeallsCrawler {
    client: reqwest::Client,
    auth_token: Option<String>,
}

impl DeallsCrawler {
    pub fn new(auth_token: Option<String>) -> Result<Self> {
        let auth_token = auth_token
            .or_else(|| std::env::var("DEALLS_TOKEN").ok())
            .or_else(|| std::env::var("DEALLS_JWT").ok());

        let mut headers = HeaderMap::new();
        headers.insert(
            USER_AGENT,
            HeaderValue::from_static(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            ),
        );

        if let Some(ref token) = auth_token {
            let auth_val = format!("Bearer {}", token.trim());
            if let Ok(hv) = HeaderValue::from_str(&auth_val) {
                headers.insert(AUTHORIZATION, hv);
            }
        }

        let client = reqwest::Client::builder()
            .default_headers(headers)
            .timeout(std::time::Duration::from_secs(30))
            .build()?;

        Ok(Self { client, auth_token })
    }

    pub async fn fetch_page(&self, page: i64, limit: i64) -> Result<Vec<DeallsJobDoc>> {
        let url = if self.auth_token.is_some() {
            format!(
                "https://api.sejutacita.id/v1/explore-job/job/you-may-like?page={}&published=true&limit={}&status=active&sortParam=mostRelevant&sortBy=desc&prioritizeNonFilledApplicantQuota=true&boostTheBoostedJob=true&ignoreAppliedJobs=true&version=v2",
                page, limit
            )
        } else {
            format!(
                "https://api.sejutacita.id/v1/explore-job/job?page={}&published=true&limit={}&status=active&sortParam=mostRelevant&sortBy=desc&boostTheBoostedJob=true",
                page, limit
            )
        };

        let resp = self.client.get(&url).send().await?;
        if !resp.status().is_success() {
            return Err(anyhow!("Dealls API error: HTTP {}", resp.status()));
        }

        let body: DeallsExploreJobResponse = resp.json().await?;
        Ok(body.data.map(|d| d.docs).unwrap_or_default())
    }

    pub async fn crawl_active_jobs(&self, max_pages: i64, max_age_days: i64) -> Result<Vec<JobRecord>> {
        let cutoff = Utc::now() - Duration::days(max_age_days);
        let mut results = Vec::new();

        for page in 1..=max_pages {
            let mut docs = Vec::new();
            for attempt in 1..=3 {
                match self.fetch_page(page, 18).await {
                    Ok(d) => {
                        docs = d;
                        break;
                    }
                    Err(e) if attempt < 3 => {
                        eprintln!("[CRAWL WARNING] Page {} attempt {} failed: {}. Retrying in 1s...", page, attempt, e);
                        tokio::time::sleep(std::time::Duration::from_secs(1)).await;
                    }
                    Err(e) => return Err(e),
                }
            }

            if docs.is_empty() {
                break;
            }

            for doc in docs {
                if let Some(record) = Self::evaluate_and_transform(doc, cutoff) {
                    results.push(record);
                }
            }
        }

        Ok(results)
    }

    fn evaluate_and_transform(doc: DeallsJobDoc, cutoff: chrono::DateTime<Utc>) -> Option<JobRecord> {
        let role = doc.role.trim();
        let role_lower = role.to_lowercase();
        let company_name = doc.company.as_ref().and_then(|c| c.name.clone()).unwrap_or_else(|| "Unknown".to_string());

        let is_blacklisted = role_lower.contains(".net")
            || role_lower.contains(". net")
            || role_lower.contains("dotnet")
            || role_lower.contains("c#")
            || role_lower.contains("sales")
            || role_lower.contains("teacher")
            || role_lower.contains("crypto")
            || role_lower.contains("gambling")
            || role_lower.contains("judi")
            || role_lower.contains("chemical")
            || role_lower.contains("civil")
            || role_lower.contains("mechanical")
            || role_lower.contains("medical")
            || role_lower.contains("security")
            || role_lower.contains("devsecops")
            || role_lower.contains("appsec")
            || role_lower.contains("network")
            || role_lower.contains("service desk")
            || role_lower.contains("customer service")
            || role_lower.contains("customer success")
            || role_lower.contains("support")
            || role_lower.contains("helpdesk")
            || role_lower.contains("automation engineer")
            || role_lower.contains("ios")
            || role_lower.contains("android")
            || role_lower.contains("mobile engineer")
            || role_lower.contains("qa")
            || role_lower.contains("quality assurance")
            || role_lower.contains("test engineer")
            || role_lower.contains("sdet")
            || role_lower.contains("engineer in test")
            || role_lower.contains("tester")
            || role_lower.contains("sap")
            || role_lower.contains("hris")
            || role_lower.contains("consultant")
            || role_lower.contains("technical writer")
            || role_lower.contains("product manager")
            || role_lower.contains("program manager")
            || role_lower.contains("project manager")
            || role_lower.contains("system analyst")
            || role_lower.contains("database administrator")
            || role_lower.contains("dba");

        if is_blacklisted {
            return None;
        }

        // Java role title rule:
        // "Java (only if listed Java, if in search for Backend but require Java or other language, I still interest to apply)"
        if role_lower.contains("java") {
            let is_backend = role_lower.contains("backend")
                || role_lower.contains("back end")
                || role_lower.contains("back-end");
            if !is_backend {
                return None;
            }
        }

        if let Some(ref sec) = doc.company.as_ref().and_then(|c| c.sector.as_ref()) {
            let sec_lower = sec.to_lowercase();
            if sec_lower.contains("crypto")
                || sec_lower.contains("blockchain")
                || sec_lower.contains("gambling")
                || sec_lower.contains("judi")
            {
                return None;
            }
        }

        let is_backend_or_fullstack = role_lower.contains("backend")
            || role_lower.contains("back end")
            || role_lower.contains("back-end")
            || role_lower.contains("fullstack")
            || role_lower.contains("full stack")
            || role_lower.contains("full-stack");

        if let Some(ref skills) = doc.skills {
            for skill in skills {
                if let Some(ref sname) = skill.name {
                    let s_lower = sname.to_lowercase();
                    if s_lower.contains(".net")
                        || s_lower.contains(". net")
                        || s_lower.contains("c#")
                    {
                        return None;
                    }
                    if s_lower.contains("spring boot") && !is_backend_or_fullstack {
                        return None;
                    }
                }
            }
        }

        let is_target_role = role_lower.contains("backend")
            || role_lower.contains("back end")
            || role_lower.contains("back-end")
            || role_lower.contains("software engineer")
            || role_lower.contains("software developer")
            || role_lower.contains("fullstack")
            || role_lower.contains("full stack")
            || role_lower.contains("full-stack")
            || role_lower.contains("devops")
            || role_lower.contains("platform engineer")
            || role_lower.contains("ai infrastructure")
            || role_lower.contains("data engineer")
            || role_lower.contains("solution engineer")
            || role_lower.contains("golang")
            || role_lower.contains("python")
            || role_lower.contains("rust")
            || role_lower.contains("programmer")
            || role_lower.contains("developer");

        if !is_target_role {
            return None;
        }

        let is_recent = doc
            .last_actively_hiring_at
            .as_deref()
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&Utc) >= cutoff)
            .or_else(|| {
                doc.published_at
                    .as_deref()
                    .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
                    .map(|dt| dt.with_timezone(&Utc) >= cutoff)
            })
            .unwrap_or(true);

        if !is_recent {
            return None;
        }

        let company_slug = doc.company.as_ref().and_then(|c| c.slug.clone()).unwrap_or_default();
        let job_url = if !company_slug.is_empty() {
            format!("https://dealls.com/loker/{}~{}", doc.slug, company_slug)
        } else {
            format!("https://dealls.com/loker/{}", doc.slug)
        };
        let location = doc.city.as_ref().and_then(|c| c.name.clone()).unwrap_or_else(|| "Indonesia".to_string());

        let salary_raw = match doc.salary_range {
            Some(ref r) if r.start.is_some() || r.end.is_some() => {
                let start = r.start.unwrap_or(0);
                let end = r.end.unwrap_or(0);
                format!("IDR {} - {}", start, end)
            }
            _ => "Competitive / Disclosed during interview".to_string(),
        };

        let salary_min = doc.salary_range.as_ref().and_then(|r| r.start);
        let salary_max = doc.salary_range.as_ref().and_then(|r| r.end);

        Some(JobRecord {
            id: None,
            uuid: None,
            job_id: Some(doc.id),
            company: company_name,
            title: role.to_string(),
            portal: "Dealls".to_string(),
            job_url,
            location: Some(location),
            salary_raw: Some(salary_raw),
            salary_min,
            salary_max,
            status: "pending_human".to_string(),
            skip_reason: Some("Crawled from Dealls recommendation feed".to_string()),
            resume_path: None,
            applied_at: None,
            created_at: None,
            posted_at: doc.published_at,
            last_active_at: doc.last_actively_hiring_at.or(doc.updated_at_by_employer),
        })
    }
}
