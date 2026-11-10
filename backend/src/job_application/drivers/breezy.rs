use super::PortalDriver;
use crate::job_application::model::{SubmissionContext, SubmissionReceipt};
use crate::storage::candidate::CandidateProfile;
use anyhow::Result;
use chrono::Utc;
use chromiumoxide::Page;
use std::collections::HashMap;
use std::future::Future;
use std::path::{Path, PathBuf};
use std::pin::Pin;
use tokio::time::{sleep, Duration};

pub struct BreezyDriver;

fn to_iso_date(raw: &str, default_val: &str) -> String {
    let trimmed = raw.trim();
    if trimmed.is_empty() {
        return default_val.to_string();
    }
    if trimmed.contains('/') {
        let parts: Vec<&str> = trimmed.split('/').collect();
        if parts.len() == 2 {
            let m: u32 = parts[0].parse().unwrap_or(1);
            let y: i32 = parts[1].parse().unwrap_or(2015);
            return format!("{:04}-{:02}-01", y, m);
        }
    }
    if trimmed.contains('-') {
        let parts: Vec<&str> = trimmed.split('-').collect();
        if parts.len() == 2 {
            let y: i32 = parts[0].parse().unwrap_or(2015);
            let m: u32 = parts[1].parse().unwrap_or(1);
            return format!("{:04}-{:02}-01", y, m);
        }
        if parts.len() == 3 {
            return trimmed.to_string();
        }
    }
    default_val.to_string()
}

impl PortalDriver for BreezyDriver {
    fn id(&self) -> &str {
        "breezy"
    }

    fn name(&self) -> &str {
        "Breezy HR"
    }

    fn can_handle(&self, portal: &str, url: &str) -> bool {
        let p = portal.to_lowercase();
        let u = url.to_lowercase();
        p.contains("breezy") || u.contains("breezy.hr")
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

            println!("[BreezyDriver] Navigating to apply page: {}", apply_url);
            page.goto(&apply_url).await?;
            sleep(Duration::from_millis(4000)).await;

            // Wait for form to mount
            let wait_form_js = r#"
                (() => {
                    return !!document.querySelector('form, input[name="cName"], #react-root');
                })()
            "#;
            let _ = page.evaluate(wait_form_js).await;

            // Candidate Personal Attributes
            let full_name = &profile.personal.full_name;
            let email = &profile.personal.email;
            let phone = &profile.personal.phone;
            let location = attributes
                .get("location")
                .cloned()
                .unwrap_or_else(|| profile.personal.location.clone());
            let summary_text = &profile.summary;

            // Address: specific street address or fallback to candidate location
            let address_val = attributes
                .get("address")
                .filter(|s| !s.trim().is_empty())
                .cloned()
                .unwrap_or_else(|| location.clone());

            // Candidate Education Attributes
            let edu = profile.education.first();
            let school = edu.map(|e| e.institution.as_str()).unwrap_or("");
            let field_of_study = edu.map(|e| e.field.as_str()).unwrap_or("");
            let raw_start = edu.and_then(|e| e.start_date.as_deref()).unwrap_or("");
            let raw_end = edu.and_then(|e| e.end_date.as_deref()).unwrap_or("");
            let start_date = to_iso_date(raw_start, "");
            let end_date = to_iso_date(raw_end, "");

            let edu_summary = attributes
                .get("education_summary")
                .filter(|s| !s.trim().is_empty())
                .cloned()
                .unwrap_or_default();

            // 1. Fill React / AngularJS Controlled Inputs
            let fill_inputs_js = format!(
                r#"
                (() => {{
                    const fill = (selector, val) => {{
                        if (!val) return;
                        const els = document.querySelectorAll(selector);
                        els.forEach(el => {{
                            const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
                            const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                            if (nativeSetter) {{
                                nativeSetter.call(el, val);
                            }} else {{
                                el.value = val;
                            }}
                            el.setAttribute('value', val);
                            el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                            el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                            el.dispatchEvent(new Event('blur', {{ bubbles: true }}));

                            // AngularJS 1.x ngModel / Scope synchronization
                            try {{
                                if (window.angular) {{
                                    const ngEl = window.angular.element(el);
                                    const ngModel = ngEl.controller('ngModel');
                                    if (ngModel) {{
                                        ngModel.$setViewValue(val);
                                        ngModel.$render();
                                    }}
                                    const scope = ngEl.scope();
                                    if (scope && !scope.$$phase) {{
                                        scope.$apply();
                                    }}
                                }}
                            }} catch (e) {{}}
                        }});
                    }};

                    // Full Name
                    fill('input[name="cName"], input#cName, input[placeholder*="Name" i]', {full_name:?});

                    // Email Address
                    fill('input[name="cEmail"], input#cEmail, input[type="email"]', {email:?});

                    // Phone Number
                    fill('input[name="cPhoneNumber"], input#cPhoneNumber, input[type="tel"]', {phone:?});

                    // Address (matches input#fullAddress and placeholder="Address")
                    fill('input#fullAddress, input[name="cAddress"], input[placeholder="Address"], input[placeholder="Street Address"], input[ng-model*="candidate.address" i]', {address_val:?});

                    // Education School
                    fill('input[ng-model*="candidateSchool.school_name" i], input[placeholder*="School" i], input[name*="school" i]', {school:?});

                    // Education Field of Study
                    fill('input[ng-model*="candidateSchool.field_of_study" i], input[placeholder*="Field" i], input[name*="field" i]', {field_of_study:?});

                    // Education Start Date (HTML5 date input: YYYY-MM-DD)
                    fill('input[type="date"][ng-model*="candidateSchool.date_start" i], input[type="date"][name*="date_start" i], input[type="date"][placeholder*="Start" i]', {start_date:?});

                    // Education End Date (HTML5 date input: YYYY-MM-DD)
                    fill('input[type="date"][ng-model*="candidateSchool.date_end" i], input[type="date"][name*="date_end" i], input[type="date"][placeholder*="End" i]', {end_date:?});

                    // Education Summary (strictly target candidateSchool / education section)
                    fill('textarea[ng-model*="candidateSchool.summary" i], div[ng-repeat*="candidateSchool" i] textarea, div[ng-repeat*="School" i] textarea', {edu_summary:?});

                    // General Summary
                    fill('textarea[name="cSummary"], textarea#cSummary, textarea[placeholder*="Summary" i]:not([ng-model*="candidateSchool"]):not([ng-model*="candidatePosition"])', {summary_text:?});

                    return true;
                }})()
                "#,
                full_name = full_name,
                email = email,
                phone = phone,
                address_val = address_val,
                school = school,
                field_of_study = field_of_study,
                start_date = start_date,
                end_date = end_date,
                edu_summary = edu_summary,
                summary_text = summary_text
            );
            let _ = page.evaluate(fill_inputs_js.as_str()).await;
            sleep(Duration::from_millis(600)).await;

            // Paths and helper
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

            // 2. Attach Candidate Tailored ATS Resume PDF
            let resume_name = context.resume_pdf_path.as_deref().unwrap_or("tailored_resume.pdf");
            let clean_resume_name = PathBuf::from(resume_name).file_name().unwrap_or_default().to_string_lossy().to_string();
            let resume_candidates = [
                PathBuf::from(format!("/mnt/c/Users/Makutu/.job_apply_automator/resumes/{}", clean_resume_name)),
                PathBuf::from("/mnt/c/Users/Makutu/.job_apply_automator/tailored_resume.pdf"),
                PathBuf::from(&home).join(format!(".job_apply_automator/resumes/{}", clean_resume_name)),
                PathBuf::from(&home).join(".job_apply_automator/tailored_resume.pdf"),
                cwd.join(format!("data/assets/{}", clean_resume_name)),
                cwd.join("data/assets/tailored_resume.pdf"),
            ];
            if let Some(resume_path) = resume_candidates.iter().find(|p| p.exists()) {
                let abs_resume = resume_path.canonicalize().unwrap_or_else(|_| resume_path.clone());
                let file_path = to_browser_path(&abs_resume);
                match page.find_element("input[type='file'][name*='Resume' i], input[type='file'][name*='cResume' i], input[type='file'][accept*='pdf'], input[type='file']").await {
                    Ok(el) => {
                        let params = chromiumoxide::cdp::browser_protocol::dom::SetFileInputFilesParams {
                            files: vec![file_path.clone()],
                            node_id: Some(el.node_id),
                            backend_node_id: None,
                            object_id: None,
                        };
                        let _ = page.execute(params).await;
                        println!("[BreezyDriver] Attached candidate tailored resume: {}", file_path);
                    }
                    Err(e) => println!("[BreezyDriver] Resume element search note: {}", e),
                }
                // Sleep to allow Breezy HR client-side resume parser to settle, then re-apply fields
                sleep(Duration::from_millis(3500)).await;
                let _ = page.evaluate(fill_inputs_js.as_str()).await;
            }

            // 3. Inject Cover Letter Text (load tailored from disk or synthesize dynamically with Vectorize RAG)
            let safe_comp = context.company.replace(|c: char| !c.is_alphanumeric(), "_");
            let safe_title = context.title.replace(|c: char| !c.is_alphanumeric(), "_");
            let cl_path = std::path::PathBuf::from("data/assets").join(format!("{}_{}_CoverLetter.txt", safe_comp, safe_title));
            let cover_letter_text = if cl_path.exists() {
                std::fs::read_to_string(&cl_path)?
            } else if let (Some(vector), Some(cand_repo)) = (&context.vector_client, &context.candidate_repo) {
                crate::job_application::SemanticMatcher::synthesize_tailored_cover_letter(
                    vector,
                    cand_repo,
                    &context.company,
                    &context.title,
                    "Indonesia",
                    profile,
                ).await?
            } else {
                anyhow::bail!("Submission Blocked: Tailored cover letter for {} has not been synthesized.", context.company);
            };
            let fill_cover_letter_js = format!(
                r#"
                (() => {{
                    const el = document.querySelector('textarea[name="cCoverLetter"], textarea#cCoverLetter, textarea[placeholder*="Cover" i]');\n                    if (!el) return false;\n                    const proto = window.HTMLTextAreaElement.prototype;\n                    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;\n                    if (nativeSetter) {{ nativeSetter.call(el, {cover_letter_text:?}); }} else {{ el.value = {cover_letter_text:?}; }}\n                    el.dispatchEvent(new Event('input', {{ bubbles: true }}));\n                    el.dispatchEvent(new Event('change', {{ bubbles: true }}));\n                    return true;\n                }})()\n                "#,
                cover_letter_text = cover_letter_text
            );
            let _ = page.evaluate(fill_cover_letter_js).await;
            sleep(Duration::from_millis(500)).await;

            // 4. Ensure Education Summary and Address are firmly synchronized
            let enforce_edu_js = format!(
                r#"
                (() => {{
                    const el = document.querySelector('textarea[ng-model*="candidateSchool.summary" i], div[ng-repeat*="School" i] textarea');
                    if (el) {{
                        const proto = window.HTMLTextAreaElement.prototype;
                        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                        if (nativeSetter) {{ nativeSetter.call(el, {edu_summary:?}); }} else {{ el.value = {edu_summary:?}; }}
                        el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                        el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        if (window.angular) {{
                            try {{
                                const ngEl = window.angular.element(el);
                                const ngModel = ngEl.controller('ngModel');
                                if (ngModel) {{
                                    ngModel.$setViewValue({edu_summary:?});
                                    ngModel.$render();
                                }}
                                const scope = ngEl.scope();
                                if (scope && !scope.$$phase) scope.$apply();
                            }} catch(e) {{}}
                        }}
                    }}
                    return true;
                }})()
                "#,
                edu_summary = edu_summary
            );
            let _ = page.evaluate(enforce_edu_js.as_str()).await;
            sleep(Duration::from_millis(400)).await;

            // 4. Scroll to Submit Button
            let scroll_expr = r#"
                (() => {
                    const submitBtn = document.querySelector('button[type="submit"], input[type="submit"], button.button.apply');
                    if (submitBtn) {
                        submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                    return true;
                })()
            "#;
            let _ = page.evaluate(scroll_expr).await;
            sleep(Duration::from_millis(800)).await;

            // Interactive Mode: Strictly halt directly before submitting
            if context.interactive {
                println!("[BreezyDriver] Form successfully prefilled in visible headful browser session.");
                println!("[BreezyDriver] Application halted right before the submit button for human visual inspection.");
                return Ok(SubmissionReceipt {
                    job_id: context.job_id,
                    portal: "breezy".into(),
                    status: "PREFILLED".into(),
                    confirmation_text: Some("Form prefilled in headful browser session for human review - stopped before submit button".into()),
                    receipt_screenshot_path: None,
                    roadblock_url: None,
                    submitted_at: timestamp,
                    error_message: None,
                });
            }

            // Headless Direct Submission: Click submit button
            let submit_expr = r#"
                (() => {
                    const btn = document.querySelector('button[type="submit"], input[type="submit"], button.button.apply');
                    if (btn) { btn.click(); return true; }
                    return false;
                })()
            "#;
            let submitted: bool = page.evaluate(submit_expr).await?.into_value().unwrap_or(false);
            sleep(Duration::from_millis(4000)).await;

            let final_status = if submitted { "APPLIED" } else { "PREFILLED" };

            Ok(SubmissionReceipt {
                job_id: context.job_id,
                portal: "breezy".into(),
                status: final_status.into(),
                confirmation_text: Some("Application submitted via Breezy HR Native Driver".into()),
                receipt_screenshot_path: None,
                roadblock_url: None,
                submitted_at: timestamp,
                error_message: None,
            })
        })
    }
}
