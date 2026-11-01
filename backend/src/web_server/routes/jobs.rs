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

    let company = job.as_ref().map(|j| j.company.as_str()).unwrap_or("Employer");
    let title = job.as_ref().map(|j| j.title.as_str()).unwrap_or("Software Engineer");
    let p = &profile.personal;

    let fields = vec![
        json!({ "key": "full_name", "label": "Full Legal Name", "value": p.full_name, "required": true, "status": "RESOLVED", "source": "candidate_profile" }),
        json!({ "key": "email", "label": "Email Address", "value": p.email, "required": true, "status": "RESOLVED", "source": "candidate_profile" }),
        json!({ "key": "phone", "label": "Phone / WhatsApp", "value": p.phone, "required": true, "status": "RESOLVED", "source": "candidate_profile" }),
        json!({ "key": "location", "label": "Residential Location", "value": p.location, "required": true, "status": "RESOLVED", "source": "candidate_profile" }),
        json!({ "key": "linkedin", "label": "LinkedIn Profile", "value": p.linkedin, "required": false, "status": "RESOLVED", "source": "candidate_profile" }),
        json!({ "key": "github", "label": "GitHub Profile", "value": p.github, "required": false, "status": "RESOLVED", "source": "candidate_profile" }),
        json!({ "key": "portfolio", "label": "Portfolio URL", "value": p.portfolio, "required": false, "status": "RESOLVED", "source": "candidate_profile" }),
    ];

    let groups = vec![
        json!({ "groupName": "1. Standard Identity Application Fields", "fields": fields }),
        json!({
            "groupName": "2. Role & Compensation Alignment",
            "fields": [
                { "key": "target_role", "label": "Target Role", "value": title, "required": true, "status": "RESOLVED", "source": "portal_custom" },
                { "key": "target_company", "label": "Company", "value": company, "required": true, "status": "RESOLVED", "source": "portal_custom" },
                { "key": "salary_bid", "label": "Expected Monthly Salary", "value": "IDR 10.000.000 - 15.000.000 / month", "required": false, "status": "RESOLVED", "source": "calculated_bid" }
            ]
        })
    ];

    Json(json!({
        "success": true,
        "data": {
            "isBlocked": false,
            "unresolvedRequiredCount": 0,
            "unresolvedKeys": [],
            "expectedSalaryBid": {
                "specificFormatted": "IDR 12.500.000",
                "monthlyFormatted": "IDR 10.000.000 - 15.000.000 / month",
                "basis": "Profile Ledger Attributes"
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
    let safe_comp = company.replace(|c: char| !c.is_alphanumeric(), "_");
    let safe_title = title.replace(|c: char| !c.is_alphanumeric(), "_");
    let filename = format!("{}_{}_Resume.pdf", safe_comp, safe_title);

    let cover_letter = format!(
        "Dear Hiring Team at {},\n\nI am writing to express my strong interest in the {} position. With 5 years of professional engineering experience across backend systems, distributed architectures, and cloud services, I look forward to contributing to your team's mission.\n\nSincerely,\nCandidate",
        company, title
    );

    Json(json!({
        "success": true,
        "coverLetter": cover_letter,
        "filename": filename,
        "pdfUrl": format!("/api/jobs/{}/pdf", id)
    }))
}

pub async fn get_job_pdf(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let job = state.jobs.find_by_id(&id).await.ok().flatten();
    let resume_key = job.as_ref().and_then(|j| j.resume_path.clone()).unwrap_or_else(|| format!("resumes/job_{}_resume.pdf", id));

    if let Ok(Some(bytes)) = state.d1.r2_get(&resume_key).await {
        return Response::builder()
            .status(StatusCode::OK)
            .header(header::CONTENT_TYPE, "application/pdf")
            .header(header::CONTENT_DISPOSITION, "inline")
            .body(Body::from(bytes))
            .unwrap();
    }

    Response::builder()
        .status(StatusCode::NOT_FOUND)
        .header(header::CONTENT_TYPE, "text/plain")
        .body(Body::from("Resume PDF not found"))
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

pub async fn submit_job(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i64>,
) -> impl IntoResponse {
    let _ = state.jobs.update_status(id, "APPLYING", "Application initiated via Web Console", None).await;

    let state_clone = (*state).clone();
    tokio::task::spawn(async move {
        if let Err(e) = crate::job_application::JobSubmitter::submit(&state_clone, id, false).await {
            eprintln!("[SUBMIT ERROR] Failed to submit Job #{}: {}", id, e);
        }
    });

    Json(json!({
        "success": true,
        "status": "APPLYING",
        "message": format!("Application initiated for Job #{}", id)
    }))
}
