use super::AppState;
use axum::{
    body::Body,
    extract::{Path, Query, State},
    http::{header, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use serde::Deserialize;
use serde_json::json;
use std::sync::Arc;

#[derive(Deserialize)]
pub struct JobsFilterQuery {
    pub status: Option<String>,
    pub portal: Option<String>,
    pub search: Option<String>,
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

pub async fn get_jobs(
    State(state): State<Arc<AppState>>,
    Query(query): Query<JobsFilterQuery>,
) -> impl IntoResponse {
    let status_filter = query.status.as_deref().unwrap_or("ALL");
    let portal_filter = query.portal.as_deref().unwrap_or("ALL");
    let search = query.search.as_deref().unwrap_or("").trim();
    let limit = query.limit.unwrap_or(50).max(1);
    let page = query.page.unwrap_or(1).max(1);
    let offset = (page - 1) * limit;

    let (records, total) = state
        .jobs
        .query_jobs(status_filter, portal_filter, search, limit, offset)
        .await
        .unwrap_or_else(|e| {
            eprintln!("[ERROR] Failed to query jobs: {:?}", e);
            (Vec::new(), 0)
        });

    Json(json!({
        "success": true,
        "data": records,
        "total": total,
    }))
}

#[derive(Deserialize)]
pub struct UpdateJobStatusPayload {
    pub status: String,
    pub note: Option<String>,
}

pub async fn update_job_status(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Json(payload): Json<UpdateJobStatusPayload>,
) -> impl IntoResponse {
    let note = payload.note.as_deref().unwrap_or("Status updated via Web Console");
    let res = state.jobs.update_status(id, &payload.status, note, None).await;
    match res {
        Ok(_) => Json(json!({ "success": true })),
        Err(e) => Json(json!({ "success": false, "error": e.to_string() })),
    }
}

#[derive(Deserialize)]
pub struct BatchUpdateStatusPayload {
    pub ids: Vec<i64>,
    pub status: String,
    pub note: Option<String>,
}

pub async fn batch_update_job_status(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<BatchUpdateStatusPayload>,
) -> impl IntoResponse {
    let res = state.jobs.batch_update_status(&payload.ids, &payload.status).await;
    match res {
        Ok(count) => Json(json!({ "success": true, "updatedCount": count })),
        Err(e) => Json(json!({ "success": false, "error": e.to_string() })),
    }
}

pub async fn get_job_form_preview(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let job = state.jobs.find_by_id(&id).await.ok().flatten();
    let attrs = state.candidate.get_all_attributes().await.unwrap_or_default();
    let profile = crate::storage::candidate::CandidateProfile::from_attributes(&attrs);
    let attr_map = &profile.attributes_map;

    let company = job.as_ref().map(|j| j.company.as_str()).unwrap_or("Employer");
    let title = job.as_ref().map(|j| j.title.as_str()).unwrap_or("Software Engineer");
    let portal = job.as_ref().map(|j| j.portal.as_str()).unwrap_or("generic");
    let location = job.as_ref().and_then(|j| j.location.as_deref()).unwrap_or("Indonesia");
    let salary_raw = job.as_ref().and_then(|j| j.salary_raw.as_deref()).unwrap_or("");
    let salary_min = job.as_ref().and_then(|j| j.salary_min);
    let salary_max = job.as_ref().and_then(|j| j.salary_max);

    // Calculate dynamic salary bid
    let loc_lower = location.to_lowercase();
    let raw_lower = salary_raw.to_lowercase();
    let (monthly_fmt, specific_fmt, min_bid, max_bid, specific_bid, bid_basis, bid_strategy) = if loc_lower.contains("surabaya")
        || loc_lower.contains("jawa timur")
        || raw_lower.contains("7.700.000")
        || raw_lower.contains("7.000.000")
    {
        (
            "Rp 8.000.000 / month (Bruto)",
            "Rp 8.000.000",
            8_000_000i64,
            10_000_000i64,
            8_000_000i64,
            "Regional / Surabaya Target (Floor: IDR 7M/mo, Target: IDR 8M-12M/mo)",
            "Concrete integer bid matching form requirement (within published compensation range)",
        )
    } else if loc_lower.contains("jakarta")
        || loc_lower.contains("remote")
        || loc_lower.contains("hybrid")
        || loc_lower.contains("indonesia")
    {
        (
            "IDR 10.000.000 - 15.000.000 / month",
            "IDR 10.000.000",
            10_000_000i64,
            15_000_000i64,
            10_000_000i64,
            "Jakarta Base (Floor: IDR 8M/mo, Target: IDR 10M-15M/mo)",
            "Standard Jakarta target for 5 years engineering experience",
        )
    } else if let Some(min) = salary_min {
        let bid = min.max(8_000_000);
        (
            "Direct Employer Match",
            "Employer Match",
            min,
            salary_max.unwrap_or(min * 3 / 2),
            bid,
            "Employer Range Match",
            "Bidding directly within employer published compensation range",
        )
    } else {
        (
            "IDR 10.000.000 / month",
            "IDR 10.000.000",
            8_000_000i64,
            12_000_000i64,
            10_000_000i64,
            "National Baseline (Floor: IDR 8M/mo Jakarta, IDR 7M/mo Regional)",
            "Negotiable based on scope, technical stack, and work arrangement",
        )
    };

    let p = &profile.personal;
    let headline = attr_map
        .get("headline")
        .cloned()
        .unwrap_or_else(|| "Senior Backend Engineer | Golang & Distributed Systems".to_string());

    // 1. Standard Identity Application Fields
    let mut identity_fields = vec![
        json!({ "key": "full_name", "label": "Full Legal Name", "value": p.full_name, "required": true, "status": "RESOLVED", "source": "candidate_profile", "description": "Candidate official legal full name" }),
        json!({ "key": "email", "label": "Email Address", "value": p.email, "required": true, "status": "RESOLVED", "source": "candidate_profile", "description": "Primary contact email" }),
        json!({ "key": "phone", "label": "Phone Number", "value": p.phone, "required": true, "status": "RESOLVED", "source": "candidate_profile", "description": "Primary phone / WhatsApp number" }),
        json!({ "key": "location", "label": "Residential Location", "value": p.location, "required": true, "status": "RESOLVED", "source": "candidate_profile", "description": "Residential location" }),
        json!({ "key": "headline", "label": "Professional Headline", "value": headline, "required": false, "status": "RESOLVED", "source": "candidate_profile", "description": "Professional engineering headline" }),
    ];
    if !p.linkedin.is_empty() {
        identity_fields.push(json!({ "key": "linkedin", "label": "LinkedIn Profile", "value": p.linkedin, "required": false, "status": "RESOLVED", "source": "candidate_profile" }));
    }
    if !p.github.is_empty() {
        identity_fields.push(json!({ "key": "github", "label": "GitHub Profile", "value": p.github, "required": false, "status": "RESOLVED", "source": "candidate_profile" }));
    }
    if !p.portfolio.is_empty() {
        identity_fields.push(json!({ "key": "portfolio", "label": "Portfolio URL", "value": p.portfolio, "required": false, "status": "RESOLVED", "source": "candidate_profile" }));
    }

    let mut groups = Vec::new();
    groups.push(json!({
        "groupName": "1. Standard Identity Application Fields",
        "fields": identity_fields
    }));

    // 2. Each Experience as its OWN separate accordion item [1/3, 2/3, 3/3]
    let total_exp = profile.experience.len();
    for (i, exp) in profile.experience.iter().enumerate() {
        let idx = i + 1;
        let is_latest = if idx == 1 { " - Latest" } else { "" };
        let group_title = format!("Experience [{}/{}{}]: {} at {}", idx, total_exp, is_latest, exp.role, exp.company);

        let exp_fields = vec![
            json!({
                "key": format!("experience_{}_role", idx),
                "label": "Role / Title",
                "value": exp.role,
                "required": idx == 1,
                "source": "candidate_profile",
                "status": "RESOLVED",
                "description": format!("Job title held at {}", exp.company)
            }),
            json!({
                "key": format!("experience_{}_company", idx),
                "label": "Employer Company",
                "value": exp.company,
                "required": idx == 1,
                "source": "candidate_profile",
                "status": "RESOLVED",
                "description": format!("Employer organization ({})", exp.location.as_deref().unwrap_or("Indonesia"))
            }),
            json!({
                "key": format!("experience_{}_period", idx),
                "label": "Employment Period",
                "value": format!("{} – {}", exp.start_date, exp.end_date),
                "required": false,
                "source": "candidate_profile",
                "status": "RESOLVED",
                "description": format!("Employment duration at {}", exp.company)
            }),
            json!({
                "key": format!("experience_{}_industry", idx),
                "label": "Industry",
                "value": exp.industry.as_deref().unwrap_or("Technology / Software"),
                "required": false,
                "source": "candidate_profile",
                "status": "RESOLVED"
            }),
            json!({
                "key": format!("experience_{}_summary", idx),
                "label": "Summary & Key Responsibilities",
                "value": exp.highlights.join(" "),
                "required": false,
                "source": "candidate_profile",
                "status": "RESOLVED",
                "description": format!("Engineering accomplishments at {}", exp.company)
            }),
            json!({
                "key": format!("experience_{}_current", idx),
                "label": "Currently Employed Here",
                "value": if idx == 1 { "No (Unemployed / Actively Looking)" } else { "No" },
                "required": false,
                "source": "candidate_profile",
                "status": "RESOLVED"
            }),
        ];

        groups.push(json!({
            "groupName": group_title,
            "fields": exp_fields
        }));
    }

    // 3. Education Accordion
    let total_edu = profile.education.len();
    for (i, edu) in profile.education.iter().enumerate() {
        let idx = i + 1;
        let group_title = format!("Education [{}/{}]: {} - {}", idx, total_edu, edu.degree, edu.institution);
        let edu_fields = vec![
            json!({
                "key": format!("education_{}_degree", idx),
                "label": "Degree & Major",
                "value": format!("{} in {}", edu.degree, edu.field),
                "required": false,
                "source": "candidate_profile",
                "status": "RESOLVED",
                "description": "Academic credentials"
            }),
            json!({
                "key": format!("education_{}_institution", idx),
                "label": "Institution",
                "value": edu.institution,
                "required": false,
                "source": "candidate_profile",
                "status": "RESOLVED",
                "description": "Graduating university or college"
            }),
            json!({
                "key": format!("education_{}_period", idx),
                "label": "Graduation Period / GPA",
                "value": format!("{} – {} (GPA: {})", edu.start_date.as_deref().unwrap_or("2015-08"), edu.end_date.as_deref().unwrap_or("2020-03"), edu.gpa.as_deref().unwrap_or("3.62")),
                "required": false,
                "source": "candidate_profile",
                "status": "RESOLVED",
                "description": "Academic completion date and cumulative GPA"
            }),
        ];

        groups.push(json!({
            "groupName": group_title,
            "fields": edu_fields
        }));
    }

    // 4. Screening, Compensation & Consents
    let screening_fields = vec![
        json!({
            "key": "salary_bid",
            "label": "Calculated Monthly Salary Bid",
            "value": monthly_fmt,
            "required": true,
            "source": "calculated_bid",
            "status": "RESOLVED",
            "description": bid_basis
        }),
        json!({
            "key": "country",
            "label": "Country / Work Authorization",
            "value": "Indonesia (Indonesian Citizen / WNI, No Visa Sponsorship Required)",
            "required": true,
            "source": "candidate_profile",
            "status": "RESOLVED",
            "description": "Right to work in Indonesia"
        }),
        json!({
            "key": "work_type",
            "label": "Work Arrangement Preference",
            "value": "Remote / Hybrid / On-site",
            "required": false,
            "source": "candidate_profile",
            "status": "RESOLVED",
            "description": "All employment arrangements acceptable"
        }),
        json!({
            "key": "notice_period",
            "label": "Notice Period / Availability",
            "value": "Immediately / ASAP",
            "required": false,
            "source": "candidate_profile",
            "status": "RESOLVED",
            "description": "Candidate availability for immediate onboarding"
        }),
    ];
    groups.push(json!({
        "groupName": "Screening, Compensation & Consents",
        "fields": screening_fields
    }));

    // 5. Attached Documents & Tailored Assets
    let safe_comp = company.replace(|c: char| !c.is_alphanumeric(), "_");
    let safe_title = title.replace(|c: char| !c.is_alphanumeric(), "_");
    let resume_filename = format!("{}_{}_Resume.pdf", safe_comp, safe_title);
    let doc_fields = vec![
        json!({
            "key": "applicant_photo",
            "label": "Applicant Photo",
            "value": "photo.jpg (Available in data/assets)",
            "required": false,
            "source": "document",
            "status": "RESOLVED",
            "description": "Recent professional applicant portrait file"
        }),
        json!({
            "key": "curriculum_vitae",
            "label": "Tailored ATS Resume (PDF)",
            "value": format!("{} (Tailored ATS Resume Ready)", resume_filename),
            "required": true,
            "source": "document",
            "status": "RESOLVED",
            "description": "Tailored resume generated for this specific position"
        }),
    ];
    groups.push(json!({
        "groupName": "Attached Documents & Portfolio",
        "fields": doc_fields
    }));

    Json(json!({
        "success": true,
        "data": {
            "jobId": id,
            "company": company,
            "title": title,
            "portal": portal,
            "location": location,
            "isBlocked": false,
            "unresolvedRequiredCount": 0,
            "unresolvedKeys": [],
            "expectedSalaryBid": {
                "specificFormatted": specific_fmt,
                "monthlyFormatted": monthly_fmt,
                "minimum": min_bid,
                "maximum": max_bid,
                "specificBidAmount": specific_bid,
                "currency": "IDR",
                "basis": bid_basis,
                "strategy": bid_strategy
            },
            "groups": groups
        }
    }))
}

pub async fn get_job_documents(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let job = state.jobs.find_by_id(&id).await.ok().flatten();
    let company = job.as_ref().map(|j| j.company.as_str()).unwrap_or("Company");
    let title = job.as_ref().map(|j| j.title.as_str()).unwrap_or("Role");
    let location = job.as_ref().and_then(|j| j.location.as_deref()).unwrap_or("Indonesia");
    let safe_comp = company.replace(|c: char| !c.is_alphanumeric(), "_");
    let safe_title = title.replace(|c: char| !c.is_alphanumeric(), "_");
    let filename = format!("{}_{}_Resume.pdf", safe_comp, safe_title);
    let text_filename = format!("{}_{}_Resume.txt", safe_comp, safe_title);

    let home_dir = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let local_candidates = [
        std::path::PathBuf::from("data/assets").join(&text_filename),
        std::path::PathBuf::from("data/assets").join(format!("{}_{}_CoverLetter.txt", safe_comp, safe_title)),
        std::path::PathBuf::from(&home_dir).join(".job_apply_automator").join("resumes").join(&text_filename),
    ];

    let mut found_cover_letter: Option<String> = None;
    for path in &local_candidates {
        if path.exists() {
            if let Ok(content) = std::fs::read_to_string(path) {
                if !content.trim().is_empty() {
                    found_cover_letter = Some(content);
                    break;
                }
            }
        }
    }

    if found_cover_letter.is_none() {
        if let Ok(entries) = std::fs::read_dir("data/assets") {
            let comp_clean = company.to_lowercase().replace(|c: char| !c.is_alphanumeric(), "");
            for entry in entries.flatten() {
                let name = entry.file_name().to_string_lossy().to_string();
                let name_clean = name.to_lowercase().replace(|c: char| !c.is_alphanumeric(), "");
                if name.ends_with(".txt") && name_clean.contains(&comp_clean) {
                    if let Ok(content) = std::fs::read_to_string(entry.path()) {
                        if !content.trim().is_empty() {
                            found_cover_letter = Some(content);
                            break;
                        }
                    }
                }
            }
        }
    }

    let (matched_evidence, top_score) = if let Some(vector) = state.vector.as_ref().as_ref() {
        let query = format!("{} role at {} {}", title, company, location);
        let top_matches = crate::job_application::SemanticMatcher::query_top_matches(
            vector,
            &state.candidate,
            &query,
            4,
        )
        .await
        .unwrap_or_default();

        let score = top_matches.first().map(|m| m.score).unwrap_or(0.0);
        let evidence_json: Vec<serde_json::Value> = top_matches
            .iter()
            .map(|m| {
                let first_line = m.answer_text.lines().next().unwrap_or("").to_string();
                let mut demo_url = None;
                for line in m.answer_text.lines() {
                    if line.contains("Project Demo: ") {
                        demo_url = Some(line.replace("Project Demo: ", "").trim().to_string());
                    }
                }
                json!({
                    "id": m.matched_id,
                    "title": m.title_or_key,
                    "type": m.match_type,
                    "score": (m.score * 100.0).round() / 100.0,
                    "scorePercent": format!("{:.0}%", m.score * 100.0),
                    "summary": first_line,
                    "demoUrl": demo_url
                })
            })
            .collect();
        (evidence_json, score)
    } else {
        (Vec::new(), 0.0)
    };

    let cover_letter = match found_cover_letter {
        Some(cl) => cl,
        None => {
            let attrs = state.candidate.get_all_attributes().await.unwrap_or_default();
            let profile = crate::storage::candidate::CandidateProfile::from_attributes(&attrs);

            let synthesized_rag = if let Some(vector) = state.vector.as_ref().as_ref() {
                crate::job_application::SemanticMatcher::synthesize_tailored_cover_letter(
                    vector,
                    &state.candidate,
                    company,
                    title,
                    location,
                    &profile,
                )
                .await
                .ok()
            } else {
                None
            };

            if let Some(cl) = synthesized_rag {
                cl
            } else {
                let name = &profile.personal.full_name;
                let email = &profile.personal.email;
                let phone = &profile.personal.phone;
                let portfolio = &profile.personal.portfolio;
                let is_fullstack = title.to_lowercase().contains("fullstack")
                    || title.to_lowercase().contains("full stack")
                    || title.to_lowercase().contains("frontend");

                if is_fullstack {
                    format!(
                        "Dear Hiring Team at {},\n\nI am writing to express my strong enthusiasm for the {} position. With over 5 years of software engineering experience developing high-performance backend systems in Golang and interactive frontends in React.js and TypeScript, I am excited about the opportunity to contribute to your engineering squads.\n\nAs showcased on my portfolio ({}), my latest flagship production project is the Point of Sale & Inventory System for Koperasi KHMB—an offline-first retail platform pairing a high-throughput Go REST backend with a responsive React/TypeScript frontend (Vite, IndexedDB delta sync, Tailwind CSS) over PostgreSQL. Additionally, across software engineering roles at Feedloop AI and PT Arkan Jaya Nusantara, I have designed scalable web architectures, built resilient REST APIs, and managed containerized cloud deployments.\n\nI am available to join immediately (ASAP notice period) and look forward to discussing how my fullstack engineering skills can support {}'s product goals.\n\nSincerely,\n{}\n{} | {} | {}",
                        company, title, portfolio, company, name, email, phone, portfolio
                    )
                } else {
                    format!(
                        "Dear Hiring Team at {},\n\nI am writing to express my strong interest in the {} position. With over 5 years of professional software engineering experience across Go backend systems, distributed microservices, and cloud infrastructure, I look forward to contributing to your team's mission.\n\nIn my recent engineering roles at Blue Sky Tech (Bythen AI) and Astro Technologies, I architected event-driven microservices, optimized high-throughput PostgreSQL and Redis architectures, and administered production Kubernetes clusters. Furthermore, my recent fullstack systems on my portfolio ({}) demonstrate my ability to deliver robust end-to-end solutions from system design to production scale.\n\nI am available immediately and look forward to the opportunity to discuss my qualifications.\n\nSincerely,\n{}\n{} | {} | {}",
                        company, title, portfolio, name, email, phone, portfolio
                    )
                }
            }
        }
    };

    Json(json!({
        "success": true,
        "coverLetter": cover_letter,
        "filename": filename,
        "pdfUrl": format!("/api/jobs/{}/pdf", id),
        "matchedEvidence": matched_evidence,
        "matchScore": top_score,
        "matchScorePercent": format!("{:.0}%", top_score * 100.0)
    }))
}

pub async fn get_job_pdf(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let job = state.jobs.find_by_id(&id).await.ok().flatten();
    let company = job.as_ref().map(|j| j.company.as_str()).unwrap_or("Company");
    let title = job.as_ref().map(|j| j.title.as_str()).unwrap_or("Role");
    let safe_comp = company.replace(|c: char| !c.is_alphanumeric(), "_");
    let safe_title = title.replace(|c: char| !c.is_alphanumeric(), "_");
    let filename = format!("{}_{}_Resume.pdf", safe_comp, safe_title);

    let home_dir = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let local_paths = [
        std::path::PathBuf::from("data/assets").join(&filename),
        std::path::PathBuf::from(&home_dir).join(".job_apply_automator").join("resumes").join(&filename),
    ];

    // 1. Try local disk first for immediate speed and reliability
    for p in &local_paths {
        if p.exists() {
            if let Ok(bytes) = std::fs::read(p) {
                return Response::builder()
                    .status(StatusCode::OK)
                    .header(header::CONTENT_TYPE, "application/pdf")
                    .header(header::CONTENT_DISPOSITION, format!("inline; filename=\"{}\"", filename))
                    .body(Body::from(bytes))
                    .unwrap();
            }
        }
    }

    // 2. Fall back to R2 cloud storage
    let resume_key = job.as_ref().and_then(|j| j.resume_path.clone()).unwrap_or_else(|| format!("resumes/{}", filename));
    if let Ok(Some(bytes)) = state.d1.r2_get(&resume_key).await {
        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "application/pdf")
            .header(header::CONTENT_DISPOSITION, format!("inline; filename=\"{}\"", filename))
            .body(Body::from(bytes))
            .unwrap();
    }

    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .header(header::CONTENT_TYPE, "text/plain")
        .body(Body::from("Resume PDF not found"))
        .unwrap()
}

pub async fn get_job_portfolio_pdf(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let job = state.jobs.find_by_id(&id).await.ok().flatten();
    let company = job.as_ref().map(|j| j.company.as_str()).unwrap_or("Company");
    let title = job.as_ref().map(|j| j.title.as_str()).unwrap_or("Role");
    let safe_comp = company.replace(|c: char| !c.is_alphanumeric(), "_");
    let safe_title = title.replace(|c: char| !c.is_alphanumeric(), "_");
    let filename = format!("{}_{}_Portfolio.pdf", safe_comp, safe_title);

    let home_dir = std::env::var("HOME").unwrap_or_else(|_| ".".to_string());
    let local_paths = [
        std::path::PathBuf::from("data/assets").join(&filename),
        std::path::PathBuf::from(&home_dir).join(".job_apply_automator").join("resumes").join(&filename),
        std::path::PathBuf::from("data/assets/portfolio.pdf"),
        std::path::PathBuf::from(&home_dir).join(".job_apply_automator").join("assets/portfolio.pdf"),
    ];

    for p in &local_paths {
        if p.exists() {
            if let Ok(bytes) = std::fs::read(p) {
                return Response::builder()
                    .status(StatusCode::OK)
                    .header(header::CONTENT_TYPE, "application/pdf")
                    .header(header::CONTENT_DISPOSITION, format!("inline; filename=\"{}\"", filename))
                    .body(Body::from(bytes))
                    .unwrap();
            }
        }
    }

    let r2_key = format!("tailored_portfolios/{}", filename);
    if let Ok(Some(bytes)) = state.d1.r2_get(&r2_key).await {
        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "application/pdf")
            .header(header::CONTENT_DISPOSITION, format!("inline; filename=\"{}\"", filename))
            .body(Body::from(bytes))
            .unwrap();
    }

    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .header(header::CONTENT_TYPE, "text/plain")
        .body(Body::from("Tailored Portfolio PDF not found"))
        .unwrap()
}

pub async fn get_job_roadblock_screenshot(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let shot_key = format!("screenshots/submissions/job_{}_roadblock.png", id);
    if let Ok(Some(bytes)) = state.d1.r2_get(&shot_key).await {
        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "image/png")
            .body(Body::from(bytes))
            .unwrap();
    }

    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .body(Body::from("Screenshot not found"))
        .unwrap()
}

#[derive(Deserialize, Default)]
pub struct SubmitJobQuery {
    pub interactive: Option<bool>,
}

pub async fn submit_job(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Query(query): Query<SubmitJobQuery>,
) -> impl IntoResponse {
    let is_interactive = query.interactive.unwrap_or(false);
    let note = if is_interactive {
        "Application prefilled interactively via Web Console"
    } else {
        "Application initiated via Web Console"
    };
    let _ = state.jobs.update_status(id, "APPLYING", note, None).await;

    let state_clone = (*state).clone();
    tokio::task::spawn(async move {
        if let Err(e) = crate::job_application::JobSubmitter::submit(&state_clone, id, is_interactive).await {
            eprintln!("[SUBMIT ERROR] Failed to submit Job #{}: {}", id, e);
        }
    });

    Json(json!({
        "success": true,
        "status": "APPLYING",
        "interactive": is_interactive,
        "message": format!("Application initiated for Job #{}", id)
    }))
}

#[derive(Deserialize)]
pub struct SendJobEmailPayload {
    pub to_email: String,
    pub subject: String,
    pub body: String,
    pub mode: Option<String>, // "send" | "draft"
}

pub async fn send_job_email(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
    Json(payload): Json<SendJobEmailPayload>,
) -> impl IntoResponse {
    use crate::job_application::email_composer::{build_multipart_mime, resolve_job_attachments};
    use crate::job_application::gmail_client::GmailClient;

    let job = match state.jobs.find_by_id(&id.to_string()).await.ok().flatten() {
        Some(j) => j,
        None => {
            return Json(json!({
                "success": false,
                "error": format!("Job #{} not found", id)
            }));
        }
    };

    let gmail = match GmailClient::new().await {
        Ok(c) => c,
        Err(e) => {
            return Json(json!({
                "success": false,
                "error": format!("Gmail client not authorized. Run `job-apply-backend auth-gmail` first. Error: {}", e)
            }));
        }
    };

    let company = &job.company;
    let title = &job.title;
    let attachments = resolve_job_attachments(company, title);

    let mime = build_multipart_mime(&payload.to_email, None, &payload.subject, &payload.body, &attachments);

    let mode = payload.mode.as_deref().unwrap_or("send");
    if mode == "draft" {
        match gmail.create_draft(&mime).await {
            Ok(draft) => {
                let draft_id = draft.get("id").and_then(|v| v.as_str()).unwrap_or("");
                let note = format!("Gmail application draft created (ID: {}) for {}", draft_id, payload.to_email);
                let _ = state.jobs.update_status(id, "DRAFTED", &note, None).await;
                Json(json!({
                    "success": true,
                    "mode": "draft",
                    "draft_id": draft_id,
                    "message": format!("Gmail draft created successfully for {}", payload.to_email)
                }))
            }
            Err(e) => Json(json!({
                "success": false,
                "error": format!("Failed to create draft: {}", e)
            })),
        }
    } else {
        match gmail.send_message(&mime).await {
            Ok(sent) => {
                let msg_id = sent.get("id").and_then(|v| v.as_str()).unwrap_or("");
                let note = format!("Application email sent via Gmail API (Message ID: {}) to {}", msg_id, payload.to_email);
                let _ = state.jobs.update_status(id, "APPLIED", &note, None).await;
                Json(json!({
                    "success": true,
                    "mode": "send",
                    "message_id": msg_id,
                    "message": format!("Application email sent successfully to {}", payload.to_email)
                }))
            }
            Err(e) => Json(json!({
                "success": false,
                "error": format!("Failed to send email via Gmail API: {}", e)
            })),
        }
    }
}

