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

        let context = SubmissionContext {
            job_id,
            job_url,
            company: job.company.clone(),
            title: job.title.clone(),
            portal: job.portal.clone(),
            interactive,
            resume_pdf_path: job.resume_path.clone(),
        };

        println!("[SUBMITTER] Connecting to browser for Job #{} ({})...", job_id, driver.name());
        let browser = BrowserSession::connect_or_launch().await?;
        let page = browser.new_page("about:blank").await?;

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
