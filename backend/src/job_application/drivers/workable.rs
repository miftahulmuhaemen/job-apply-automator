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

            // Wait for form inputs to mount
            sleep(Duration::from_millis(1500)).await;

            // Resolve name components & candidate fields
            let full_name = &profile.personal.full_name;
            let parts: Vec<&str> = full_name.split_whitespace().collect();
            let first_name = parts.first().copied().unwrap_or("Candidate");
            let last_name = if parts.len() > 1 {
                parts[1..].join(" ")
            } else {
                "Engineer".to_string()
            };

            let email = &profile.personal.email;
            let phone = &profile.personal.phone;
            let location = attributes
                .get("location")
                .cloned()
                .unwrap_or_else(|| profile.personal.location.clone());
            let headline = attributes
                .get("headline")
                .cloned()
                .unwrap_or_else(|| "Senior Backend Engineer | Golang & Distributed Systems".to_string());
            let summary_text = &profile.summary;

            // 1. Fill basic identity inputs (React controlled native setters)
            let fill_workable_identity_expr = format!(
                r#"
                (() => {{
                    const fill = (selector, val) => {{
                        const el = document.querySelector(selector);
                        if (!el || !val) return;
                        const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
                        const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                        if (nativeSetter) {{
                            nativeSetter.call(el, val);
                        }} else {{
                            el.value = val;
                        }}
                        el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                        el.dispatchEvent(new Event('change', {{ bubbles: true }}));
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

                            if (!hasCountryCode && el.previousElementSibling) {{
                                if (el.previousElementSibling.textContent.includes('62')) {{
                                    hasCountryCode = true;
                                }}
                            }}

                            const finalVal = hasCountryCode ? base : withZero;
                            const proto = window.HTMLInputElement.prototype;
                            const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                            if (nativeSetter) {{
                                nativeSetter.call(el, finalVal);
                            }} else {{
                                el.value = finalVal;
                            }}
                            el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                            el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        }});
                    }};

                    fill('input#firstname, input[name="firstname"]', {first_name:?});
                    fill('input#lastname, input[name="lastname"]', {last_name:?});
                    fill('input#email, input[name="email"]', {email:?});
                    fill('input#headline, input[name="headline"]', {headline:?});
                    fillPhone('input#input_phone, input[name="phone"], input[name*="phone"], input[name*="contact"]', {phone:?});
                    fill('input#address, input[name="address"]', {location:?});
                    return true;
                }})()
                "#,
                first_name = first_name,
                last_name = last_name,
                email = email,
                headline = headline,
                phone = phone,
                location = location
            );
            let _ = page.evaluate(fill_workable_identity_expr).await;
            sleep(Duration::from_millis(500)).await;

            // 2. Select Country: Indonesia (Combobox)
            let select_country_expr = r#"
                (() => {
                    const selectWorkableCombobox = (triggerSelector, optionText) => {
                        const trigger = document.querySelector(triggerSelector);
                        if (!trigger) return false;
                        trigger.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        trigger.click();
                        const listboxId = trigger.getAttribute('aria-controls') || trigger.getAttribute('aria-owns');
                        const listbox = listboxId ? document.querySelector('#' + listboxId) : document.querySelector('ul[role="listbox"]');
                        if (listbox) {
                            const options = Array.from(listbox.querySelectorAll('li[role="option"], li'));
                            const match = options.find(o => (o.innerText || o.textContent || '').trim().toLowerCase().includes(optionText.toLowerCase()));
                            if (match) {
                                match.scrollIntoView();
                                match.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
                                match.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
                                match.click();
                                return true;
                            }
                        }
                        return false;
                    };

                    return selectWorkableCombobox('#input_CA_55164_input, input[id*="CA_55164"], [data-ui*="CA_55164"] input', 'Indonesia');
                })()
            "#;
            let _ = page.evaluate(select_country_expr).await;
            sleep(Duration::from_millis(500)).await;

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

            // 3. Upload Candidate Photo (Exclusively targeting accept*="image", NEVER uploading resume to photo)
            let photo_candidates = [
                PathBuf::from("/mnt/c/Users/Makutu/.job_apply_automator/assets/photo.jpg"),
                PathBuf::from(&home).join(".job_apply_automator/assets/photo.jpg"),
                cwd.join("data/assets/photo.jpg"),
            ];
            if let Some(photo_path) = photo_candidates.iter().find(|p| p.exists()) {
                let abs_photo = photo_path.canonicalize().unwrap_or_else(|_| photo_path.clone());
                let file_path = to_browser_path(&abs_photo);
                match page.find_element("input[type='file'][accept*='image']").await {
                    Ok(el) => {
                        let params = chromiumoxide::cdp::browser_protocol::dom::SetFileInputFilesParams {
                            files: vec![file_path.clone()],
                            node_id: Some(el.node_id),
                            backend_node_id: None,
                            object_id: None,
                        };
                        let _ = page.execute(params).await;
                        println!("[WorkableDriver] Attached candidate photo: {}", file_path);
                        sleep(Duration::from_millis(1200)).await;

                        // Click crop confirmation button if modal appears
                        let crop_expr = r#"
                            (() => {
                                const btn = document.querySelector('button[data-ui="crop-image"]');
                                if (btn) { btn.click(); return true; }
                                return false;
                            })()
                        "#;
                        let _ = page.evaluate(crop_expr).await;
                        sleep(Duration::from_millis(600)).await;
                    }
                    Err(e) => println!("[WorkableDriver] Photo input search result (optional): {}", e),
                }
            }

            // 4. Populate Education Section
            let add_edu_js = r#"
                (() => {
                    const btn = document.querySelector('button[aria-label="Add Education"]');
                    if (btn) {
                        btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        btn.click();
                        return true;
                    }
                    return false;
                })()
            "#;
            if let Ok(clicked) = page.evaluate(add_edu_js).await {
                if clicked.into_value::<bool>().unwrap_or(false) {
                    sleep(Duration::from_millis(800)).await;
                    let edu = profile.education.first();
                    let school = edu.map(|e| e.institution.as_str()).unwrap_or("Universitas Lambung Mangkurat");
                    let degree = edu.map(|e| e.degree.as_str()).unwrap_or("Bachelor's Degree in Computer Science");
                    let field = edu.map(|e| e.field.as_str()).unwrap_or("Computer Science");

                    let fill_edu_js = format!(
                        r#"
                        (() => {{
                            const setVal = (selector, val) => {{
                                const el = document.querySelector(selector);
                                if (!el || !val) return;
                                const proto = window.HTMLInputElement.prototype;
                                const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                                if (nativeSetter) {{ nativeSetter.call(el, val); }} else {{ el.value = val; }}
                                el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                                el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                            }};
                            setVal('[data-ui="education"] input#school, input#school', {school:?});
                            setVal('[data-ui="education"] input#degree, input#degree', {degree:?});
                            setVal('[data-ui="education"] input#field_of_study, input#field_of_study', {field:?});

                            const saveBtn = document.querySelector('[data-ui="education"] button[data-ui="save-section"], button[data-ui="save-section"]');
                            if (saveBtn) saveBtn.click();
                            return true;
                        }})()
                        "#,
                        school = school,
                        degree = degree,
                        field = field
                    );
                    let _ = page.evaluate(fill_edu_js).await;
                    sleep(Duration::from_millis(800)).await;
                    println!("[WorkableDriver] Filled Education: {} - {}", school, degree);
                }
            }

            // 5. Populate Work Experience Loop (For all 3 candidate experiences)
            for (idx, exp) in profile.experience.iter().enumerate() {
                let add_exp_js = r#"
                    (() => {
                        const btn = document.querySelector('button[aria-label="Add Experience"]');
                        if (btn) {
                            btn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            btn.click();
                            return true;
                        }
                        return false;
                    })()
                "#;
                if let Ok(clicked) = page.evaluate(add_exp_js).await {
                    if clicked.into_value::<bool>().unwrap_or(false) {
                        sleep(Duration::from_millis(800)).await;

                        let format_date = |d: &str| -> String {
                            let parts: Vec<&str> = d.split('-').collect();
                            if parts.len() >= 2 {
                                format!("{}/{}", parts[1], parts[0])
                            } else {
                                d.to_string()
                            }
                        };
                        let start_date = format_date(&exp.start_date);
                        let end_date = format_date(&exp.end_date);
                        let summary_desc = if !exp.highlights.is_empty() {
                            exp.highlights.join("; ")
                        } else {
                            "Engineered backend microservices and analytical ingestion pipelines.".to_string()
                        };

                        let fill_exp_js = format!(
                            r#"
                            (() => {{
                                const setVal = (selector, val) => {{
                                    const el = document.querySelector(selector);
                                    if (!el || !val) return;
                                    const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
                                    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                                    if (nativeSetter) {{ nativeSetter.call(el, val); }} else {{ el.value = val; }}
                                    el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                                    el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                                }};

                                setVal('[data-ui="experience"] input#title', {title:?});
                                setVal('[data-ui="experience"] input#company', {company:?});
                                setVal('[data-ui="experience"] input[name="start_date"]', {start_date:?});
                                setVal('[data-ui="experience"] input[name="end_date"]', {end_date:?});
                                setVal('[data-ui="experience"] textarea#summary', {summary_desc:?});

                                const saveBtn = document.querySelector('[data-ui="experience"] button[data-ui="save-section"], button[data-ui="save-section"]');
                                if (saveBtn) saveBtn.click();
                                return true;
                            }})()
                            "#,
                            title = exp.role,
                            company = exp.company,
                            start_date = start_date,
                            end_date = end_date,
                            summary_desc = summary_desc
                        );
                        let _ = page.evaluate(fill_exp_js).await;
                        sleep(Duration::from_millis(800)).await;
                        println!("[WorkableDriver] Filled Experience [{}/{}]: {} at {}", idx + 1, profile.experience.len(), exp.role, exp.company);
                    } else {
                        println!("[WorkableDriver] Add Experience button not found for experience #{}", idx + 1);
                        break;
                    }
                }
            }

            // 6. Inject Professional Summary
            let fill_summary_js = format!(
                r#"
                (() => {{
                    const el = document.querySelector('div[data-ui="section-fields"] > div > label > div textarea#summary, textarea#summary');
                    if (!el) return false;
                    const proto = window.HTMLTextAreaElement.prototype;
                    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                    if (nativeSetter) {{ nativeSetter.call(el, {summary_text:?}); }} else {{ el.value = {summary_text:?}; }}
                    el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    return true;
                }})()
                "#,
                summary_text = summary_text
            );
            let _ = page.evaluate(fill_summary_js).await;
            sleep(Duration::from_millis(500)).await;

            // 7. Attach Candidate Resume PDF (Targeting accept*="pdf", NEVER avatar)
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
                match page.find_element("input[type='file'][accept*='pdf'], input[data-ui='resume'], input[type='file']:not([accept*='image'])").await {
                    Ok(el) => {
                        let params = chromiumoxide::cdp::browser_protocol::dom::SetFileInputFilesParams {
                            files: vec![file_path.clone()],
                            node_id: Some(el.node_id),
                            backend_node_id: None,
                            object_id: None,
                        };
                        let _ = page.execute(params).await;
                        println!("[WorkableDriver] Attached candidate tailored resume PDF: {}", file_path);
                    }
                    Err(e) => println!("[WorkableDriver] Resume element search result: {}", e),
                }
                sleep(Duration::from_millis(800)).await;
            }

            // 8. Inject Cover Letter Text if present
            let cover_letter_text = format!(
                "Dear Hiring Team at {},\n\nI am writing to express my strong enthusiasm for the {} role. With over 5 years of engineering experience architecting scalable backend microservices, distributed data pipelines, and high-performance cloud infrastructure, I am confident in my ability to immediately add value to your engineering team.\n\nSincerely,\n{}",
                context.company, context.title, profile.personal.full_name
            );
            let fill_cover_letter_js = format!(
                r#"
                (() => {{
                    const el = document.querySelector('textarea#cover_letter, textarea[name="cover_letter"]');
                    if (!el) return false;
                    const proto = window.HTMLTextAreaElement.prototype;
                    const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                    if (nativeSetter) {{ nativeSetter.call(el, {cover_letter_text:?}); }} else {{ el.value = {cover_letter_text:?}; }}
                    el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                    el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                    return true;
                }})()
                "#,
                cover_letter_text = cover_letter_text
            );
            let _ = page.evaluate(fill_cover_letter_js).await;
            sleep(Duration::from_millis(500)).await;

            // Scroll down into view of submit button
            let scroll_expr = r#"
                (() => {
                    const submitBtn = document.querySelector('button[data-ui="submit-application"], button[data-ui="apply-button"], button[type="submit"]');
                    if (submitBtn) {
                        submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                    return true;
                })()
            "#;
            let _ = page.evaluate(scroll_expr).await;
            sleep(Duration::from_millis(1000)).await;

            if context.interactive {
                println!("[WorkableDriver] Form successfully prefilled in visible headful browser session.");
                println!("[WorkableDriver] Application halted right before the submit button for human visual inspection.");
                return Ok(SubmissionReceipt {
                    job_id: context.job_id,
                    portal: "workable".into(),
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
                    const btn = document.querySelector('button[data-ui="submit-application"], button[data-ui="apply-button"], button[type="submit"]');
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
