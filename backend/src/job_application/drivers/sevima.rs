use super::PortalDriver;
use crate::job_application::model::{SubmissionContext, SubmissionReceipt};
use crate::storage::candidate::CandidateProfile;
use anyhow::Result;
use chrono::Utc;
use chromiumoxide::cdp::browser_protocol::dom::SetFileInputFilesParams;
use chromiumoxide::Page;
use std::collections::HashMap;
use std::future::Future;
use std::path::{Path, PathBuf};
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

            // 1. Personal & Profile Information Form Prefill
            let full_name = &profile.personal.full_name;
            let email = &profile.personal.email;
            let phone = &profile.personal.phone;
            let location = attributes.get("location").cloned().unwrap_or_else(|| profile.personal.location.clone());
            let dob = attributes.get("date_of_birth").map(|d| {
                if d.contains('/') {
                    let parts: Vec<&str> = d.split('/').collect();
                    if parts.len() == 3 {
                        format!("{}-{}-{}", parts[2], parts[1], parts[0])
                    } else {
                        d.clone()
                    }
                } else {
                    d.clone()
                }
            }).unwrap_or_default();

            let school = attributes.get("school").cloned().or_else(|| profile.education.first().map(|e| e.institution.clone())).unwrap_or_default();
            let faculty = attributes.get("faculty").cloned().unwrap_or_default();
            let major = attributes.get("major").or_else(|| attributes.get("field_of_study")).cloned().or_else(|| profile.education.first().map(|e| e.field.clone())).unwrap_or_default();
            let last_company = attributes.get("experience_company").cloned().or_else(|| profile.experience.first().map(|e| e.company.clone())).unwrap_or_default();
            let salary_before = attributes.get("salary_before").map(|s| s.chars().filter(|c| c.is_ascii_digit()).collect::<String>()).filter(|s| !s.is_empty()).unwrap_or_else(|| "7000000".into());
            let salary_before_type = attributes.get("salary_before_type").cloned().unwrap_or_else(|| "nett".into());
            let salary_expected = attributes.get("salary_expected_floor").cloned().unwrap_or_else(|| "8000000".into());
            let salary_expected_type = attributes.get("salary_expected_type").cloned().unwrap_or_else(|| "nett".into());

            let fill_sevima_expr = format!(
                r#"
                (() => {{
                    const fill = (selector, val) => {{
                        const el = document.querySelector(selector);
                        if (el && val) {{
                            el.value = val;
                            el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                            el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        }}
                    }};

                    const fillPhone = (selector, rawVal) => {{
                        if (!rawVal) return;
                        let digits = String(rawVal).replace(/\D/g, '');
                        let base = digits;
                        if (base.startsWith('62')) {{
                            base = base.substring(2);
                        }}
                        if (base.startsWith('0')) {{
                            base = base.substring(1);
                        }}
                        const withZero = '0' + base;

                        const inputs = document.querySelectorAll(selector);
                        inputs.forEach(el => {{
                            let hasCountryCode = false;
                            // 1. Inspect parent containers (up to 4 levels)
                            let curr = el.parentElement;
                            let depth = 0;
                            while (curr && depth < 4) {{
                                const text = curr.textContent || '';
                                if (text.includes('+62') || text.includes('+ 62') || text.includes('(+62)')) {{
                                    hasCountryCode = true;
                                    break;
                                }}
                                const prefixEl = curr.querySelector('.form-control__text, .input-group-text, .country-code, .flag, [data-prefix], [class*="prefix"], [class*="country"]');
                                if (prefixEl && prefixEl.textContent.includes('62')) {{
                                    hasCountryCode = true;
                                    break;
                                }}
                                curr = curr.parentElement;
                                depth++;
                            }}

                            // 2. Inspect adjacent siblings
                            if (!hasCountryCode && el.previousElementSibling) {{
                                if (el.previousElementSibling.textContent.includes('62')) {{
                                    hasCountryCode = true;
                                }}
                            }}

                            // Country code prefix in UI -> use number without leading 0.
                            // No country code prefix -> use domestic format with leading 0.
                            const finalVal = hasCountryCode ? base : withZero;
                            el.value = finalVal;
                            el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                            el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        }});
                    }};

                    const selectChoices = (selId, val) => {{
                        const sel = document.querySelector(selId);
                        if (!sel) return;
                        const container = sel.closest('.choices');
                        const inner = container ? container.querySelector('.choices__inner') : null;
                        if (inner) inner.click();
                        const choice = container ? container.querySelector(`[data-value="${{val}}"]`) : null;
                        if (choice) {{
                            choice.dispatchEvent(new MouseEvent('mousedown', {{ bubbles: true }}));
                            choice.click();
                        }}
                        sel.value = val;
                        sel.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    }};

                    fill('input#name, input[name="name"]', {name:?});
                    fill('input#email, input[name="email"]', {email:?});
                    fillPhone('input#telephone, input#phone, input[name="telephone"], input[name="phone"], input#reference_contact, input[name="reference_contact"]', {phone:?});
                    fill('textarea#address, input#address, input[name="address"]', {location:?});
                    fill('input#date_of_birth, input[name="date_of_birth"]', {dob:?});

                    // Radio: Single / Belum Menikah
                    const radio = document.querySelector('input[name="is_married"][value="0"], #not_married');
                    if (radio) {{
                        radio.checked = true;
                        radio.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    }}

                    // Choices.js dropdowns (triggers Alpine conditional rendering)
                    selectChoices('#education', 'S1');
                    selectChoices('#experience', '> 5 Tahun');
                    selectChoices('#info', 'Linkedin');

                    return true;
                }})()
                "#,
                name = full_name,
                email = email,
                phone = phone,
                location = location,
                dob = dob,
            );
            let _ = page.evaluate(fill_sevima_expr).await;
            sleep(Duration::from_millis(1000)).await;

            let fill_conditional_expr = format!(
                r#"
                (() => {{
                    const fill = (selector, val) => {{
                        const el = document.querySelector(selector);
                        if (el && val) {{
                            el.value = val;
                            el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                            el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        }}
                    }};

                    const selectChoices = (selId, val) => {{
                        const sel = document.querySelector(selId);
                        if (!sel) return;
                        const container = sel.closest('.choices');
                        const inner = container ? container.querySelector('.choices__inner') : null;
                        if (inner) inner.click();
                        const choice = container ? container.querySelector(`[data-value="${{val}}"]`) : null;
                        if (choice) {{
                            choice.dispatchEvent(new MouseEvent('mousedown', {{ bubbles: true }}));
                            choice.click();
                        }}
                        sel.value = val;
                        sel.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    }};

                    const fillOrSelect = (selector, val) => {{
                        const el = document.querySelector(selector);
                        if (!el || !val) return;
                        if (el.tagName === 'SELECT' || el.closest('.choices')) {{
                            selectChoices(selector, val);
                        }} else {{
                            fill(selector, val);
                        }}
                    }};

                    fill('input#school, input[name="school"]', {school:?});
                    fill('input#faculty, input[name="faculty"]', {faculty:?});
                    fill('input#major, input[name="major"]', {major:?});
                    fill('input#last_company, input[name="last_company"]', {last_company:?});
                    fill('input#salary_before, input[name="salary_before"]', {salary_before:?});
                    fillOrSelect('#salary_before_type, [name="salary_before_type"]', {salary_before_type:?});
                    fill('input#salary_expected, input[name="salary_expected"]', {salary_expected:?});
                    fillOrSelect('input#salary_expected_type, [name="salary_expected_type"]', {salary_expected_type:?});

                    // Declarations
                    const checkNames = ['statement_of_honesty', 'statement_of_ai_processing', 'statement_of_consent'];
                    checkNames.forEach(name => {{
                        const el = document.querySelector(`input[name="${{name}}"], input#${{name}}`);
                        if (el) {{
                            el.checked = true;
                            el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        }}
                    }});

                    return true;
                }})()
                "#,
                school = school,
                faculty = faculty,
                major = major,
                last_company = last_company,
                salary_before = salary_before,
                salary_before_type = salary_before_type,
                salary_expected = salary_expected,
                salary_expected_type = salary_expected_type,
            );
            let _ = page.evaluate(fill_conditional_expr).await;
            sleep(Duration::from_millis(500)).await;

            // 2. Attach Candidate Documents & Files
            let home = std::env::var("HOME").unwrap_or_else(|_| ".".into());
            let cwd = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));

            let to_browser_path = |p: &Path| -> String {
                let s = p.to_string_lossy().to_string();
                if s.starts_with("/mnt/c/") {
                    format!(r"C:\{}", s[7..].replace('/', "\\"))
                } else {
                    s
                }
            };

            // Photo
            let photo_candidates = [
                PathBuf::from("/mnt/c/Users/Makutu/.job_apply_automator/assets/photo.jpg"),
                PathBuf::from(&home).join(".job_apply_automator/assets/photo.jpg"),
                cwd.join("data/assets/photo.jpg"),
            ];
            if let Some(photo_path) = photo_candidates.iter().find(|p| p.exists()) {
                let abs_photo = photo_path.canonicalize().unwrap_or_else(|_| photo_path.clone());
                let file_path = to_browser_path(&abs_photo);
                match page.find_element("input#photo, input[name='photo']").await {
                    Ok(el) => {
                        let params = SetFileInputFilesParams {
                            files: vec![file_path.clone()],
                            node_id: Some(el.node_id),
                            backend_node_id: None,
                            object_id: None,
                        };
                        let _ = page.execute(params).await;
                        println!("[SevimaDriver] Attached candidate photo: {}", file_path);
                    }
                    Err(e) => println!("[SevimaDriver] Photo element search result: {}", e),
                }
                sleep(Duration::from_millis(500)).await;
            }

            // Resume PDF
            let resume_name = context.resume_pdf_path.as_deref().unwrap_or("SEVIMA_SEVIMA_Future_Talent___Software_Engineer___Q3_2027_Resume.pdf");
            let clean_resume_name = PathBuf::from(resume_name).file_name().unwrap_or_default().to_string_lossy().to_string();
            let resume_candidates = [
                PathBuf::from(format!("/mnt/c/Users/Makutu/.job_apply_automator/resumes/{}", clean_resume_name)),
                PathBuf::from(&home).join(format!(".job_apply_automator/resumes/{}", clean_resume_name)),
                PathBuf::from(&home).join(".job_apply_automator/resumes/SEVIMA_Future_Talent_Resume.pdf"),
                cwd.join(format!("data/assets/{}", clean_resume_name)),
                cwd.join("data/assets/SEVIMA_SEVIMA_Future_Talent___Software_Engineer___Q3_2027_Resume.pdf"),
            ];
            if let Some(resume_path) = resume_candidates.iter().find(|p| p.exists()) {
                let abs_resume = resume_path.canonicalize().unwrap_or_else(|_| resume_path.clone());
                let file_path = to_browser_path(&abs_resume);
                match page.find_element("input#curriculum_vitae, input[name='curriculum_vitae']").await {
                    Ok(el) => {
                        let params = SetFileInputFilesParams {
                            files: vec![file_path.clone()],
                            node_id: Some(el.node_id),
                            backend_node_id: None,
                            object_id: None,
                        };
                        let _ = page.execute(params).await;
                        println!("[SevimaDriver] Attached candidate resume: {}", file_path);
                    }
                    Err(e) => println!("[SevimaDriver] Resume element search result: {}", e),
                }
                sleep(Duration::from_millis(500)).await;
            }

            // Portfolio PDF
            let portfolio_candidates = [
                PathBuf::from("/mnt/c/Users/Makutu/.job_apply_automator/assets/portfolio.pdf"),
                PathBuf::from(&home).join(".job_apply_automator/assets/portfolio.pdf"),
                cwd.join("data/assets/portfolio.pdf"),
            ];
            if let Some(portfolio_path) = portfolio_candidates.iter().find(|p| p.exists()) {
                let abs_portfolio = portfolio_path.canonicalize().unwrap_or_else(|_| portfolio_path.clone());
                let file_path = to_browser_path(&abs_portfolio);
                match page.find_element("input#portfolio, input[name='portfolio']").await {
                    Ok(el) => {
                        let params = SetFileInputFilesParams {
                            files: vec![file_path.clone()],
                            node_id: Some(el.node_id),
                            backend_node_id: None,
                            object_id: None,
                        };
                        let _ = page.execute(params).await;
                        println!("[SevimaDriver] Attached candidate portfolio: {}", file_path);
                    }
                    Err(e) => println!("[SevimaDriver] Portfolio element search result: {}", e),
                }
                sleep(Duration::from_millis(500)).await;
            }

            // Scroll down into view of submit button
            let scroll_expr = r#"
                (() => {
                    const submitBtn = document.querySelector('button[type="submit"], button.btn_primary, button.btn-submit, #apply-form button');
                    if (submitBtn) {
                        submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                    return true;
                })()
            "#;
            let _ = page.evaluate(scroll_expr).await;
            sleep(Duration::from_millis(1000)).await;

            if context.interactive {
                println!("[SevimaDriver] Form successfully prefilled in visible headful browser session.");
                println!("[SevimaDriver] Application halted right before the submit button for human visual inspection.");
                return Ok(SubmissionReceipt {
                    job_id: context.job_id,
                    portal: "sevima".into(),
                    status: "PREFILLED".into(),
                    confirmation_text: Some("Form prefilled in headful browser session for human review - stopped before submit button".into()),
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
