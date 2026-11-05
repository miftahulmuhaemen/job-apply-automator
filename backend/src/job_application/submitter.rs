use super::browser::BrowserSession;
use super::drivers::DriverRegistry;
use super::model::{SubmissionContext, SubmissionReceipt};
use crate::storage::candidate::CandidateProfile;
use crate::web_server::routes::AppState;
use anyhow::{anyhow, Result};
use chrono::Utc;
use std::collections::HashMap;

pub struct JobSubmitter;

impl JobSubmitter {
    pub async fn submit(
        state: &AppState,
        job_id: i64,
        interactive: bool,
    ) -> Result<SubmissionReceipt> {
        let job = state
            .jobs
            .find_by_id(&job_id.to_string())
            .await?
            .ok_or_else(|| anyhow!("Job not found in ledger with id: {}", job_id))?;

        let job_url = job.job_url.clone().unwrap_or_default();
        let registry = DriverRegistry::new();
        let driver = registry
            .find_driver(&job.portal, &job_url)
            .ok_or_else(|| anyhow!("No automated submission driver available for portal '{}'", job.portal))?;

        let all_attrs = state.candidate.get_all_attributes().await.unwrap_or_default();
        let mut attr_map = HashMap::new();
        for a in &all_attrs {
            if let Some(val) = &a.value {
                attr_map.insert(a.key.clone(), val.clone());
            }
        }
        let profile = CandidateProfile::from_attributes(&all_attrs);

        // Automatic Detection of Missing Required Candidate Attributes
        let existing_notifs = state.notifications.get_all().await.unwrap_or_default();
        if driver.id() == "breezy" {
            let has_addr = attr_map.get("address").map(|s| !s.trim().is_empty()).unwrap_or(false);
            if !has_addr {
                if !existing_notifs.iter().any(|n| n.candidate_key.as_deref() == Some("address") && n.is_read == 0) {
                    let _ = state.notifications.create(crate::storage::CreateNotificationParams {
                        title: "Missing Field: Complete Address",
                        message: "Kredivo Group (Breezy HR) requires a complete street address on the candidate profile.",
                        notification_type: "FIELD_MISSING",
                        target_job_id: Some(job_id),
                        candidate_key: Some("address"),
                        candidate_label: Some("Complete Address"),
                        candidate_category: Some("personal"),
                    }).await;
                }
                let _ = state.candidate.upsert_attribute(crate::storage::candidate::UpsertAttributeParams {
                    key: "address",
                    category: "personal",
                    label: "Complete Address",
                    description: Some("Complete residential street address for job applications"),
                    value: None,
                    source_portal: Some("breezy"),
                    required_by_default: true,
                    is_delegated: false,
                }).await;
            }

            let has_edu_sum = attr_map.get("education_summary").map(|s| !s.trim().is_empty()).unwrap_or(false);
            if !has_edu_sum {
                if !existing_notifs.iter().any(|n| n.candidate_key.as_deref() == Some("education_summary") && n.is_read == 0) {
                    let _ = state.notifications.create(crate::storage::CreateNotificationParams {
                        title: "Missing Field: Education Summary",
                        message: "Kredivo Group (Breezy HR) requires an education focus & academic summary.",
                        notification_type: "FIELD_MISSING",
                        target_job_id: Some(job_id),
                        candidate_key: Some("education_summary"),
                        candidate_label: Some("Education Summary"),
                        candidate_category: Some("education"),
                    }).await;
                }
                let _ = state.candidate.upsert_attribute(crate::storage::candidate::UpsertAttributeParams {
                    key: "education_summary",
                    category: "education",
                    label: "Education Summary",
                    description: Some("Academic research, field of study focus, and capstone thesis summary"),
                    value: None,
                    source_portal: Some("breezy"),
                    required_by_default: true,
                    is_delegated: false,
                }).await;
            }
        }

        let context = SubmissionContext {
            job_id,
            job_url,
            company: job.company.clone(),
            title: job.title.clone(),
            portal: job.portal.clone(),
            interactive,
            resume_pdf_path: job.resume_path.clone(),
            vector_client: state.vector.as_ref().clone(),
            candidate_repo: Some(state.candidate.clone()),
        };

        println!("[SUBMITTER] Connecting to browser for Job #{} ({})...", job_id, driver.name());
        let browser = BrowserSession::connect_or_launch().await?;
        let pages = browser.pages().await.unwrap_or_default();
        let page = if let Some(first_page) = pages.into_iter().next() {
            first_page
        } else {
            browser.new_page("about:blank").await?
        };

        let receipt_result = driver.submit(&page, &context, &profile, &attr_map).await;

        let timestamp = Utc::now().to_rfc3339();
        let receipt = match receipt_result {
            Ok(mut r) => {
                // Capture receipt screenshot to R2 if possible
                let shot_key = format!("screenshots/submissions/job_{}_receipt.png", job_id);
                if let Ok(bytes) = page.screenshot(chromiumoxide::cdp::browser_protocol::page::CaptureScreenshotParams::default()).await {
                    let _ = state.d1.r2_put(&shot_key, bytes, "image/png").await;
                    r.receipt_screenshot_path = Some(shot_key);
                }

                let note = r.confirmation_text.clone().unwrap_or_else(|| "Submitted via Native Driver".into());
                let _ = state.jobs.update_status(job_id, &r.status, &note, None).await;
                r
            }
            Err(e) => {
                let error_msg = e.to_string();
                let roadblock_key = format!("screenshots/submissions/job_{}_roadblock.png", job_id);
                if let Ok(bytes) = page.screenshot(chromiumoxide::cdp::browser_protocol::page::CaptureScreenshotParams::default()).await {
                    let _ = state.d1.r2_put(&roadblock_key, bytes, "image/png").await;
                }

                let _ = state.jobs.update_status(job_id, "FAILED", &error_msg, None).await;

                SubmissionReceipt {
                    job_id,
                    portal: job.portal.clone(),
                    status: "FAILED".into(),
                    confirmation_text: None,
                    receipt_screenshot_path: None,
                    roadblock_url: Some(page.url().await.ok().flatten().unwrap_or_default()),
                    submitted_at: timestamp,
                    error_message: Some(error_msg),
                }
            }
        };

        Ok(receipt)
    }
}
