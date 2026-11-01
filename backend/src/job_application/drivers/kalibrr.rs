use super::PortalDriver;
use crate::job_application::model::{SubmissionContext, SubmissionReceipt};
use crate::storage::candidate::CandidateProfile;
use anyhow::{anyhow, Result};
use chrono::Utc;
use chromiumoxide::Page;
use std::collections::HashMap;
use std::future::Future;
use std::pin::Pin;
use tokio::time::{sleep, Duration};

pub struct KalibrrDriver;

impl PortalDriver for KalibrrDriver {
    fn id(&self) -> &str {
        "kalibrr"
    }

    fn name(&self) -> &str {
        "Kalibrr Indonesia"
    }

    fn can_handle(&self, portal: &str, url: &str) -> bool {
        let p = portal.to_lowercase();
        let u = url.to_lowercase();
        p.contains("kalibrr") || u.contains("kalibrr.com")
    }

    fn submit<'a>(
        &'a self,
        page: &'a Page,
        context: &'a SubmissionContext,
        profile: &'a CandidateProfile,
        _attributes: &'a HashMap<String, String>,
    ) -> Pin<Box<dyn Future<Output = Result<SubmissionReceipt>> + Send + 'a>> {
        Box::pin(async move {
            let timestamp = Utc::now().to_rfc3339();
            println!("[KalibrrDriver] Navigating to: {}", context.job_url);
            page.goto(&context.job_url).await?;
            sleep(Duration::from_millis(3500)).await;

            // 1. Check Authentication on Navigation Header
            let is_guest_expr = r#"
                (() => {
                    const navLinks = Array.from(document.querySelectorAll('header a, nav a, header button, nav button'));
                    const navTexts = navLinks.map(el => (el.textContent || '').trim().toLowerCase());
                    const hasLogin = navTexts.some(t => t === 'masuk' || t === 'log in' || t === 'sign in');
                    const hasRegister = navTexts.some(t => t === 'daftar' || t === 'sign up' || t === 'register');
                    return (hasLogin && hasRegister) || window.location.href.includes('/login');
                })()
            "#;
            let is_guest: bool = page.evaluate(is_guest_expr).await?.into_value().unwrap_or(false);
            if is_guest {
                return Err(anyhow!("Kalibrr requires authentication. Please launch browser via 'job-apply-backend browser' and log in to Kalibrr."));
            }

            // 2. Check if already applied
            let already_applied_expr = r#"
                (() => {
                    const btns = Array.from(document.querySelectorAll('button, a'));
                    return btns.some(b => {
                        const t = (b.textContent || '').trim().toLowerCase();
                        return t === 'sudah dilamar' || t === 'applied' || t.includes('sudah dilamar');
                    });
                })()
            "#;
            let already_applied: bool = page.evaluate(already_applied_expr).await?.into_value().unwrap_or(false);
            if already_applied {
                return Ok(SubmissionReceipt {
                    job_id: context.job_id,
                    portal: "kalibrr".into(),
                    status: "APPLIED".into(),
                    confirmation_text: Some("Position already submitted on Kalibrr (Sudah Dilamar)".into()),
                    receipt_screenshot_path: None,
                    roadblock_url: None,
                    submitted_at: timestamp,
                    error_message: None,
                });
            }

            // 3. Click Apply Now / Lamar Sekarang
            let click_apply_expr = r#"
                (() => {
                    const btns = Array.from(document.querySelectorAll('button, a'));
                    const applyBtn = btns.find(b => {
                        const t = (b.textContent || '').trim().toLowerCase();
                        return t === 'lamar sekarang' || t === 'apply now' || t.includes('continue application') || t.includes('lamar sekarang');
                    });
                    if (applyBtn) {
                        applyBtn.click();
                        return true;
                    }
                    return false;
                })()
            "#;
            let clicked_apply: bool = page.evaluate(click_apply_expr).await?.into_value().unwrap_or(false);
            if !clicked_apply {
                println!("[KalibrrDriver] Warning: could not find explicit Apply button, checking if already on apply form...");
            }

            sleep(Duration::from_millis(3000)).await;

            // 4. Fill Application Details
            let full_name = &profile.personal.full_name;
            let email = &profile.personal.email;
            let phone = &profile.personal.phone;

            let fill_form_expr = format!(
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
                    fill('input[name="name"], input#name', {name:?});
                    fill('input[name="email"], input#email', {email:?});
                    fill('input[name="phone"], input#phone', {phone:?});
                    return true;
                }})()
                "#,
                name = full_name,
                email = email,
                phone = phone
            );
            let _ = page.evaluate(fill_form_expr).await;

            // In interactive/prefilled mode, halt before clicking final submit
            if context.interactive {
                println!("[KalibrrDriver] Form prefilled in interactive session.");
                return Ok(SubmissionReceipt {
                    job_id: context.job_id,
                    portal: "kalibrr".into(),
                    status: "PREFILLED".into(),
                    confirmation_text: Some("Form prefilled in interactive browser session for human review".into()),
                    receipt_screenshot_path: None,
                    roadblock_url: None,
                    submitted_at: timestamp,
                    error_message: None,
                });
            }

            // Direct submission mode: click Submit button
            let submit_btn_expr = r#"
                (() => {
                    const btns = Array.from(document.querySelectorAll('button'));
                    const submitBtn = btns.find(b => {
                        const t = (b.textContent || '').trim().toLowerCase();
                        return t === 'kirim lamaran' || t === 'submit application' || t === 'kirim';
                    });
                    if (submitBtn) {
                        submitBtn.click();
                        return true;
                    }
                    return false;
                })()
            "#;
            let submitted: bool = page.evaluate(submit_btn_expr).await?.into_value().unwrap_or(false);
            sleep(Duration::from_millis(4000)).await;

            let final_status = if submitted { "APPLIED" } else { "PREFILLED" };

            Ok(SubmissionReceipt {
                job_id: context.job_id,
                portal: "kalibrr".into(),
                status: final_status.into(),
                confirmation_text: Some("Application successfully submitted via Kalibrr Native Driver".into()),
                receipt_screenshot_path: None,
                roadblock_url: None,
                submitted_at: timestamp,
                error_message: None,
            })
        })
    }
}
