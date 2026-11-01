use super::PortalDriver;
use crate::job_application::model::{SubmissionContext, SubmissionReceipt};
use crate::storage::candidate::CandidateProfile;
use anyhow::Result;
use chrono::Utc;
use chromiumoxide::Page;
use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use tokio::time::{sleep, Duration};

pub struct WorkableDriver;

impl PortalDriver for WorkableDriver {
    fn id(&self) -> &str {
        "workable"
    }

    fn name(&self) -> &str {
        "Workable"
    }

    fn can_handle(&self, portal: &str, url: &str) -> bool {
        let p = portal.to_lowercase();
        let u = url.to_lowercase();
        p.contains("workable") || u.contains("apply.workable.com")
    }

    fn submit<'a>(
        &'a self,
        page: &'a Page,
        context: &'a SubmissionContext,
        profile: &'a CandidateProfile,
        attributes: &'a HashMap<String, String>,
    ) -> Pin<Box<dyn Future<Output = Result<SubmissionReceipt>> + Send + 'a>> {
        Box::pin(async move {
            let timestamp = Utc::now().to_rfc3339();
            let clean_url = context.job_url.trim_end_matches('/');
            let apply_url = if clean_url.ends_with("/apply") {
                clean_url.to_string()
            } else {
                format!("{}/apply/", clean_url)
            };

            println!("[WorkableDriver] Navigating to: {}", apply_url);
            page.goto(&apply_url).await?;
            sleep(Duration::from_millis(3500)).await;

            // Dismiss cookie consent banner if present
            let dismiss_cookie_expr = r#"
                (() => {
                    const btn = document.querySelector('button[data-ui="cookie-consent-accept"], button[data-ui="cookie-consent-decline"]');
                    if (btn) { btn.click(); return true; }
                    return false;
                })()
            "#;
            let _ = page.evaluate(dismiss_cookie_expr).await;

            // Resolve name components
            let full_name = &profile.personal.full_name;
            let parts: Vec<&str> = full_name.split_whitespace().collect();
            let first_name = parts.first().copied().unwrap_or("Candidate");
            let last_name = if parts.len() > 1 { parts[1..].join(" ") } else { "Engineer".to_string() };

            let email = &profile.personal.email;
            let phone = &profile.personal.phone;
            let location = attributes.get("location").cloned().unwrap_or_else(|| profile.personal.location.clone());

            let fill_workable_expr = format!(
                r#"
                (() => {{
                    const fill = (selector, val) => {{
                        const el = document.querySelector(selector);
                        if (el) {{
                            el.value = val;
                            el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                            el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        }}
                    }};
                    fill('input#firstname, input[name="firstname"]', {first_name:?});
                    fill('input#lastname, input[name="lastname"]', {last_name:?});
                    fill('input#email, input[name="email"]', {email:?});
                    fill('input#input_phone, input[name="phone"]', {phone:?});
                    fill('input#address, input[name="address"]', {location:?});
                    return true;
                }})()
                "#,
                first_name = first_name,
                last_name = last_name,
                email = email,
                phone = phone,
                location = location
            );
            let _ = page.evaluate(fill_workable_expr).await;

            if context.interactive {
                println!("[WorkableDriver] Form prefilled in interactive browser session.");
                return Ok(SubmissionReceipt {
                    job_id: context.job_id,
                    portal: "workable".into(),
                    status: "PREFILLED".into(),
                    confirmation_text: Some("Form prefilled in interactive browser session for human review".into()),
                    receipt_screenshot_path: None,
                    roadblock_url: None,
                    submitted_at: timestamp,
                    error_message: None,
                });
            }

            // Direct submission: click submit button
            let submit_expr = r#"
                (() => {
                    const btn = document.querySelector('button[data-ui="submit-application"], button[type="submit"]');
                    if (btn) { btn.click(); return true; }
                    return false;
                })()
            "#;
            let submitted: bool = page.evaluate(submit_expr).await?.into_value().unwrap_or(false);
            sleep(Duration::from_millis(4000)).await;

            let final_status = if submitted { "APPLIED" } else { "PREFILLED" };

            Ok(SubmissionReceipt {
                job_id: context.job_id,
                portal: "workable".into(),
                status: final_status.into(),
                confirmation_text: Some("Application submitted via Workable Native Driver".into()),
                receipt_screenshot_path: None,
                roadblock_url: None,
                submitted_at: timestamp,
                error_message: None,
            })
        })
    }
}
