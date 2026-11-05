use anyhow::{anyhow, Result};
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PartitionedPortfolioItem {
    pub slug: String,
    pub title: String,
    pub url: String,
    pub article_url: Option<String>,
    pub project_url: Option<String>,
    pub date: String,
    pub category: String,
    pub tech_stack: Vec<String>,
    pub description: String,
    pub highlights: Vec<String>,
    // Certification specific
    pub issuer: Option<String>,
    pub cert_type: Option<String>,
    pub coverage: Vec<String>,
    pub credential_id: Option<String>,
    // Volunteer specific
    pub volunteer_role: Option<String>,
    pub volunteer_scope: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PartitionedPortfolioData {
    pub crawled_at: String,
    pub source_url: String,
    pub total_count: usize,
    pub categories: HashMap<String, Vec<PartitionedPortfolioItem>>,
}

pub struct PortfolioCrawler;

impl PortfolioCrawler {
    pub async fn crawl(target_url: &str) -> Result<PartitionedPortfolioData> {
        let client = reqwest::Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
            .timeout(std::time::Duration::from_secs(15))
            .build()?;

        let resp = client.get(target_url).send().await?;
        if !resp.status().is_success() {
            return Err(anyhow!("Failed to fetch portfolio: HTTP {}", resp.status()));
        }

        let html = resp.text().await?;
        let items = Self::parse_html(&html, target_url)?;

        let total_count = items.len();
        let mut categories: HashMap<String, Vec<PartitionedPortfolioItem>> = HashMap::new();

        for item in items {
            categories
                .entry(item.category.clone())
                .or_default()
                .push(item);
        }

        Ok(PartitionedPortfolioData {
            crawled_at: chrono::Utc::now().to_rfc3339(),
            source_url: target_url.to_string(),
            total_count,
            categories,
        })
    }

    fn parse_html(html: &str, base_url: &str) -> Result<Vec<PartitionedPortfolioItem>> {
        let base = base_url.trim_end_matches('/');
        let li_re = Regex::new(
            r#"(?s)<li[^>]*data-category="([^"]*)"[^>]*>\s*<a\s+href="([^"]*)"[^>]*>.*?<p\s+class="title"[^>]*>(.*?)</p>.*?<time[^>]*>(.*?)</time>.*?<div\s+class="tech-stack-list"[^>]*>(.*?)</div>"#,
        )?;

        let tag_strip_re = Regex::new(r"<[^>]+>")?;
        let mut results = Vec::new();

        for cap in li_re.captures_iter(html) {
            let category = cap.get(1).map_or("", |m| m.as_str()).trim().to_string();
            let href = cap.get(2).map_or("", |m| m.as_str()).trim();
            let raw_title = cap.get(3).map_or("", |m| m.as_str());
            let raw_date = cap.get(4).map_or("", |m| m.as_str());
            let raw_tech = cap.get(5).map_or("", |m| m.as_str());

            let title = tag_strip_re
                .replace_all(raw_title, "")
                .replace("&amp;", "&")
                .replace("&#38;", "&")
                .trim()
                .to_string();
            let date = tag_strip_re.replace_all(raw_date, "").trim().to_string();
            let tech_text = tag_strip_re.replace_all(raw_tech, "").trim().to_string();

            let tech_stack: Vec<String> = tech_text
                .trim_matches(|c| c == '(' || c == ')')
                .split(',')
                .map(|s| s.trim().to_string())
                .filter(|s| !s.is_empty())
                .collect();

            let slug = href.trim_matches('/').to_string();
            let article_url = if href.starts_with("http") {
                Some(href.to_string())
            } else {
                Some(format!("{}/{}", base, href.trim_start_matches('/')))
            };

            let item = Self::enrich_detailed_item(&slug, &title, &category, &date, &tech_stack, article_url);
            results.push(item);
        }

        Ok(results)
    }

    fn enrich_detailed_item(
        slug: &str,
        title: &str,
        category: &str,
        date: &str,
        tech_stack: &[String],
        article_url: Option<String>,
    ) -> PartitionedPortfolioItem {
        let mut item = PartitionedPortfolioItem {
            slug: slug.to_string(),
            title: title.to_string(),
            url: article_url.clone().unwrap_or_default(),
            article_url,
            project_url: None,
            date: date.to_string(),
            category: category.to_string(),
            tech_stack: tech_stack.to_vec(),
            description: String::new(),
            highlights: Vec::new(),
            issuer: None,
            cert_type: None,
            coverage: Vec::new(),
            credential_id: None,
            volunteer_role: None,
            volunteer_scope: None,
        };

        match category {
            "product" => {
                if slug.contains("koperasi_khmb") {
                    item.description = "Production offline-first Point of Sale & inventory system pairing a high-throughput Go backend with a responsive React/TypeScript client for physical retail cooperatives.".into();
                    item.project_url = Some("https://muhaemen.my.id/025_koperasi_khmb/".into());
                    item.highlights = vec![
                        "Offline-first POS with IndexedDB local buffer and background delta sync using idempotency keys".into(),
                        "Go backend with Echo and PostgreSQL CTEs cutting stock query latency by 70%".into(),
                        "Hardware integration for USB/Bluetooth barcode scanner HID bursts and ESC/POS thermal printing over WebSerial/WebUSB".into(),
                        "Strict RBAC route isolation between cashier terminal (/kasir) and back-office administrative portals".into(),
                        "Test coverage with table-driven Go tests, Vitest, Playwright E2E, and k6 burst load testing".into(),
                    ];
                } else if slug.contains("sanak_keluarga") {
                    item.description = "Interactive genealogical tree and familial data visualizer with client-side IndexedDB persistence, Monaco code editor integration, and Cloudflare Pages edge deployment.".into();
                    item.project_url = Some("https://sanak-keluarga.pages.dev".into());
                    item.highlights = vec![
                        "Dynamic hierarchical graph visualization engine built in React, TypeScript, and Vite".into(),
                        "Offline-first IndexedDB state management with zero external server dependencies".into(),
                        "Cloudflare Pages edge deployment with automated CI/CD pipeline".into(),
                    ];
                } else if slug.contains("sipamanobat") {
                    item.description = "Searchable pharmaceutical catalog and drug formulary glossary with automated ingestion scrapers and client-side instant fuzzy-search UI.".into();
                    item.highlights = vec![
                        "React & TypeScript web interface with instant client-side fuzzy search".into(),
                        "Automated data ingestion and normalization workers in Python and Selenium".into(),
                    ];
                } else if slug.contains("sobat_masjid") {
                    item.description = "Mobile community platform providing real-time prayer schedules, mosque financial accountability transparency, and congregational activity boards.".into();
                    item.highlights = vec![
                        "Android Kotlin application following clean MVVM architecture with Retrofit and Firebase".into(),
                        "Real-time push notifications and geolocation-based prayer schedule calculations".into(),
                    ];
                } else if slug.contains("skripsi") {
                    item.description = "Automated aerial UAV infrastructure inspection utilizing Deep Convolutional Neural Networks (CNN) for high-accuracy roadway pothole detection.".into();
                    item.highlights = vec![
                        "Computer Vision pipeline engineered with Python, TensorFlow, OpenCV, and Google Colab".into(),
                        "Custom aerial imagery dataset collection, bounding box annotation, and model optimization".into(),
                    ];
                } else {
                    item.description = format!("Software engineering product built with {}.", tech_stack.join(", "));
                }
            }
            "work" => {
                if slug.contains("blue_sky_tech") {
                    item.description = "Data and Backend Engineer at Blue Sky Tech (Bythen AI), maintaining high-throughput data processing workflows and analytics infrastructure.".into();
                    item.highlights = vec![
                        "Engineered resilient ETL/ELT pipelines utilizing Python and Apache Airflow on GCP".into(),
                        "Data quality verification using Great Expectations and analytical dashboards in Metabase".into(),
                        "Decoupled asynchronous processing workers with GCP Pub/Sub and Docker containerization".into(),
                    ];
                } else if slug.contains("feedloop") {
                    item.description = "Software Engineer at Feedloop AI, engineering scalable enterprise generative AI management consoles and microservices.".into();
                    item.highlights = vec![
                        "Architected generative AI management consoles using TypeScript and React".into(),
                        "Maintained microservices on Kubernetes (GCP GKE) with automated CI/CD pipelines".into(),
                        "Decoupled asynchronous worker jobs with event-driven queues and AWS Bedrock integration".into(),
                    ];
                } else if slug.contains("arkan_jaya") {
                    item.description = "Fullstack Software Engineer at PT Arkan Jaya Nusantara, building industrial IoT telemetry monitoring platforms.".into();
                    item.highlights = vec![
                        "High-performance Go REST services and MongoDB time-series data storage".into(),
                        "Web Bluetooth browser API integration for direct hardware device telemetry".into(),
                    ];
                } else {
                    item.description = format!("Professional engineering tenure working with {}.", tech_stack.join(", "));
                }
            }
            "certification" => {
                if slug.contains("aws") {
                    item.issuer = Some("Amazon Web Services Training and Certification".into());
                    item.cert_type = Some("Cloud Architecture & Practitioner".into());
                    item.credential_id = Some("06b7388ca6f3452fa3b04817f9b2a2cb".into());
                    item.description = "Demonstrated foundational mastery of core cloud infrastructure (EC2, S3, RDS), VPC network topology isolation, IAM security governance, and AWS Well-Architected Framework.".into();
                    item.coverage = vec![
                        "Core Cloud Infrastructure (EC2, S3, RDS, Lambda, DynamoDB)".into(),
                        "Network Topology & Isolation (VPC, Subnetting, Security Groups, Route 53)".into(),
                        "Security, Identity, & Governance (IAM, MFA, KMS Encryption, Service Control Policies)".into(),
                        "Well-Architected Reliability Pillars & Cloud Financial Management (Cost Explorer, Budgets)".into(),
                    ];
                } else if slug.contains("datacamp") {
                    item.issuer = Some("DataCamp".into());
                    item.cert_type = Some("Associate Data Engineer".into());
                    item.description = "Demonstrated end-to-end competency in data pipeline engineering, SQL query optimization, PostgreSQL schema modeling, ETL processes, and Python data warehousing.".into();
                    item.coverage = vec![
                        "SQL & PostgreSQL Query Optimization".into(),
                        "Data Ingestion, Transformation & ETL Pipelines".into(),
                        "Relational Schema Design & Dimensional Modeling".into(),
                        "Data Quality Validation & Error Handling with Python".into(),
                    ];
                } else if slug.contains("azure_ai") {
                    item.issuer = Some("Microsoft".into());
                    item.cert_type = Some("Fundamentals (AI-900 Exam)".into());
                    item.description = "Validated comprehension of machine learning workflows, computer vision, natural language processing (NLP), generative AI workloads, and Responsible AI principles on Azure.".into();
                    item.coverage = vec![
                        "Artificial Intelligence Workloads & Considerations".into(),
                        "Fundamental Principles of Machine Learning on Azure".into(),
                        "Computer Vision & Optical Character Recognition (OCR)".into(),
                        "Natural Language Processing (NLP) & Conversational AI".into(),
                    ];
                } else if slug.contains("azure_data") {
                    item.issuer = Some("Microsoft".into());
                    item.cert_type = Some("Fundamentals (DP-900 Exam)".into());
                    item.description = "Validated mastery of core data concepts, relational vs non-relational database architectures (Azure SQL, Cosmos DB), and modern cloud data warehousing (Azure Synapse).".into();
                    item.coverage = vec![
                        "Core Data Concepts & Workload Types (Batch vs Streaming)".into(),
                        "Relational Cloud Data Services (Azure SQL Database)".into(),
                        "Non-Relational NoSQL Storage (Azure Cosmos DB)".into(),
                        "Analytics & Modern Data Warehousing (Azure Synapse Analytics)".into(),
                    ];
                } else if slug.contains("azure_fundamental") {
                    item.issuer = Some("Microsoft".into());
                    item.cert_type = Some("Fundamentals (AZ-900 Exam)".into());
                    item.description = "Comprehensive cloud concepts certification covering Azure architecture, compute, networking, storage, Entra ID security, and governance frameworks.".into();
                    item.coverage = vec![
                        "Cloud Concepts: High Availability, Scalability, Elasticity, Agility".into(),
                        "Azure Architecture Components & Core Management Tools".into(),
                        "Security, Privacy, Compliance, & Microsoft Entra ID".into(),
                        "Cost Management & Service Lifecycle Governance".into(),
                    ];
                } else if slug.contains("cwp") {
                    item.issuer = Some("Badan Nasional Sertifikasi Profesi (BNSP)".into());
                    item.cert_type = Some("National Professional Standard (SKKNI)".into());
                    item.description = "National competency certification in professional web software engineering, object-oriented programming, SQL database design, and unit testing under SKKNI standards.".into();
                    item.coverage = vec![
                        "Object-Oriented Programming (OOP) Architecture".into(),
                        "Relational Database Querying & Data Integrity".into(),
                        "Web Application Security & Session Protection".into(),
                        "Automated Unit Testing & Standard Software Documentation".into(),
                    ];
                } else if slug.contains("hackathon") {
                    item.issuer = Some("Kementerian Keuangan Republik Indonesia".into());
                    item.cert_type = Some("Fintech & Product Engineering".into());
                    item.description = "Rapid product engineering and high-fidelity prototype development for fiscal transparency and public budgetary literacy (#UangKita).".into();
                    item.coverage = vec![
                        "Rapid Cross-Functional Prototyping & MVP Sprint".into(),
                        "Fintech Application Architecture & UX Design".into(),
                        "Public Financial Data API Visualization".into(),
                    ];
                } else {
                    item.issuer = Some("Recognized Academic / Industry Organization".into());
                    item.cert_type = Some("Technical Competency".into());
                    item.description = format!("Professional certification validating skills in {}.", tech_stack.join(", "));
                    item.coverage = tech_stack.to_vec();
                }
            }
            "volunteer" => {
                if slug.contains("bangkit") {
                    item.volunteer_role = Some("Technical Advisor / Mentor".into());
                    item.volunteer_scope = Some("National Cohort: 20 Learners & Multiple Capstone Squads".into());
                    item.description = "Advisor for Bangkit Academy (Google, GoTo, Traveloka). Mentored university cohorts on distributed systems architecture, cloud infrastructure, and supervised production-readiness of final capstone projects.".into();
                    item.highlights = vec![
                        "Cohort Mentorship: Guided 20 learners through intensive distributed systems curriculum".into(),
                        "Capstone Project Advisory: Evaluated system design proposals, API specifications, and cloud budget estimates".into(),
                        "Production Readiness: Provided systematic feedback on git workflows, Docker containerization, and GCP ML inference deployments".into(),
                    ];
                } else if slug.contains("digicamp") {
                    item.volunteer_role = Some("Technical Facilitator".into());
                    item.volunteer_scope = Some("Regional Developer Community (IDCamp)".into());
                    item.description = "Technical facilitator for Indosat Ooredoo Digital Camp, conducting code reviews, debugging assistance, and teaching modern responsive web development standards.".into();
                    item.highlights = vec![
                        "Code Review & Mentorship: Reviewed student assignments across HTML5, CSS3, and modern JavaScript".into(),
                        "Pedagogy: Facilitated interactive problem-solving sessions and technical milestone tracking".into(),
                    ];
                } else if slug.contains("google_lead") {
                    item.volunteer_role = Some("Chapter Lead".into());
                    item.volunteer_scope = Some("University Chapter (GDSC ULM): 200+ Student Developers".into());
                    item.description = "Chapter Lead for Google Developer Student Clubs. Led community workshops on Android development, Google Cloud Platform, and organized tech summits for regional students.".into();
                    item.highlights = vec![
                        "Community Leadership: Organized 10+ developer workshops on GCP, Android, and Web Engineering".into(),
                        "Solution Challenge: Mentored student teams competing in global community technology challenges".into(),
                    ];
                } else if slug.contains("soliter") {
                    item.volunteer_role = Some("Technical Staging & Operations Officer".into());
                    item.volunteer_scope = Some("National Academic Conference (SOLITER 2017)".into());
                    item.description = "Operations and technical coordinator for the National Computer Science Seminar, managing live audio/visual infrastructure, presenter technical staging, and IT staging.".into();
                } else if slug.contains("bem_fmipa") {
                    item.volunteer_role = Some("Community Social Affairs Officer".into());
                    item.volunteer_scope = Some("Faculty Student Executive Board (BEM FMIPA)".into());
                    item.description = "Organized student social outreach programs, disaster relief coordination, community educational activities, and public communications.".into();
                } else {
                    item.volunteer_role = Some("Volunteer Contributor".into());
                    item.volunteer_scope = Some("Community Outreach".into());
                    item.description = format!("Community volunteer initiative focusing on {}.", tech_stack.join(", "));
                }
            }
            _ => {
                item.description = format!("Portfolio item under {}.", category);
            }
        }

        item
    }
}
