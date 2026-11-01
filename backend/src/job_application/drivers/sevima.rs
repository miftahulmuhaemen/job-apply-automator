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

pub struct SevimaDriver;

impl PortalDriver for SevimaDriver {
    fn id(&self) -> &str {
        "sevima"
    }

    fn name(&self) -> &str {
        "SEVIMA Career"
    }

    fn can_handle(&self, portal: &str, url: &str) -> bool {
        let p = portal.to_lowercase();
        let u = url.to_lowercase();
        p.contains("sevima") || u.contains("careers.sevima.com")
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
                format!("{}/apply", clean_url)
            };

            println!("[SevimaDriver] Navigating to: {}", apply_url);
            page.goto(&apply_url).await?;
            sleep(Duration::from_millis(3500)).await;

            let full_name = &profile.personal.full_name;
            let email = &profile.personal.email;
            let raw_phone = &profile.personal.phone;
            let phone = if let Some(stripped) = raw_phone.strip_prefix("+62") {
                format!("0{}", stripped)
            } else {
                raw_phone.clone()
            };
            let location = attributes.get("location").cloned().unwrap_or_else(|| profile.personal.location.clone());

            let fill_sevima_expr = format!(
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
                    fill('input#name, input[name="name"]', {name:?});
                    fill('input#email, input[name="email"]', {email:?});
                    fill('input#phone, input[name="phone"]', {phone:?});
                    fill('textarea#address, input#address', {location:?});
                    return true;
                }})()
                "#,
                name = full_name,
                email = email,
                phone = phone,
                location = location
            );
            let _ = page.evaluate(fill_sevima_expr).await;

            if context.interactive {
                println!("[SevimaDriver] Form prefilled in interactive browser session.");
                return Ok(SubmissionReceipt {
                    job_id: context.job_id,
                    portal: "sevima".into(),
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
                    const btn = document.querySelector('button[type="submit"], button.btn-submit');
                    if (btn) { btn.click(); return true; }
                    return false;
                })()
            "#;
            let submitted: bool = page.evaluate(submit_expr).await?.into_value().unwrap_or(false);
            sleep(Duration::from_millis(4000)).await;

            let final_status = if submitted { "APPLIED" } else { "PREFILLED" };

            Ok(SubmissionReceipt {
                job_id: context.job_id,
                portal: "sevima".into(),
                status: final_status.into(),
                confirmation_text: Some("Application submitted via SEVIMA Native Driver".into()),
                receipt_screenshot_path: None,
                roadblock_url: None,
                submitted_at: timestamp,
                error_message: None,
            })
        })
    }
}
