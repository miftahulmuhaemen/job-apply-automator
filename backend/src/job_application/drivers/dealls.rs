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

pub struct DeallsDriver;

impl PortalDriver for DeallsDriver {
    fn id(&self) -> &str {
        "dealls"
    }

    fn name(&self) -> &str {
        "Dealls (SejutaCita)"
    }

    fn can_handle(&self, portal: &str, url: &str) -> bool {
        let p = portal.to_lowercase();
        let u = url.to_lowercase();
        p.contains("deall") || u.contains("dealls.com") || u.contains("sejutacita.id")
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
            println!("[DeallsDriver] Navigating to job page: {}", context.job_url);
            page.goto(&context.job_url).await?;
            sleep(Duration::from_millis(4000)).await;

            // 1. Check if already applied
            let check_applied_js = r#"
                (() => {
                    const buttons = Array.from(document.querySelectorAll('button, a'));
                    const isAppliedBtn = buttons.some(b => {
                        const t = (b.textContent || '').trim().toLowerCase();
                        return t.includes('sudah dilamar') || t.includes('telah dilamar') || t.includes('already applied');
                    });
                    if (isAppliedBtn) return true;

                    const bodyText = (document.body ? document.body.innerText : '').toLowerCase();
                    return bodyText.includes('sudah melamar lowongan ini') || bodyText.includes('status lamaran: dikirim');
                })()
            "#;
            let already_applied: bool = page.evaluate(check_applied_js).await?.into_value().unwrap_or(false);
            if already_applied {
                println!("[DeallsDriver] Job #{} is already marked as applied on Dealls.", context.job_id);
                return Ok(SubmissionReceipt {
                    job_id: context.job_id,
                    portal: "Dealls".into(),
                    status: "APPLIED".into(),
                    confirmation_text: Some("Position already submitted on Dealls (Sudah Dilamar)".into()),
                    receipt_screenshot_path: None,
                    roadblock_url: None,
                    submitted_at: timestamp,
                    error_message: None,
                });
            }

            // 2. Click Apply Now / Lamar Sekarang / Lamar Cepat button
            let click_apply_js = r#"
                (() => {
                    const buttons = Array.from(document.querySelectorAll('button, a'));
                    const applyBtn = buttons.find(b => {
                        const t = (b.textContent || '').trim().toLowerCase();
                        return t === 'lamar cepat (tanpa sign up)' 
                            || t === 'lamar cepat'
                            || t === 'lamar sekarang' 
                            || t === 'lamar' 
                            || t === 'apply now';
                    });
                    if (applyBtn) {
                        applyBtn.click();
                        return true;
                    }
                    return false;
                })()
            "#;
            let clicked_apply: bool = page.evaluate(click_apply_js).await?.into_value().unwrap_or(false);
            if clicked_apply {
                println!("[DeallsDriver] Clicked apply button. Waiting for drawer/modal to appear...");
                sleep(Duration::from_millis(3000)).await;
            } else {
                println!("[DeallsDriver] Note: Direct apply button not clicked, checking if application modal is already open...");
            }

            // 3. Locate and attach compiled ATS Resume PDF & Portfolio PDF
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

            let safe_comp = context.company.replace(|c: char| !c.is_alphanumeric(), "_");
            let safe_title = context.title.replace(|c: char| !c.is_alphanumeric(), "_");
            let tailored_resume_name = format!("{}_{}_Resume.pdf", safe_comp, safe_title);
            let tailored_portfolio_name = format!("{}_{}_Portfolio.pdf", safe_comp, safe_title);

            let resume_candidates = [
                context.resume_pdf_path.as_ref().map(PathBuf::from),
                Some(cwd.join("data/assets").join(&tailored_resume_name)),
                Some(PathBuf::from(&home).join(format!(".job_apply_automator/resumes/{}", tailored_resume_name))),
                Some(cwd.join("data/assets/tailored_resume.pdf")),
                Some(PathBuf::from(&home).join(".job_apply_automator/tailored_resume.pdf")),
            ];

            let resume_file = resume_candidates.iter().flatten().find(|p| p.exists());
            if let Some(res_path) = resume_file {
                let abs_resume = res_path.canonicalize().unwrap_or_else(|_| res_path.clone());
                let browser_resume_path = to_browser_path(&abs_resume);
                println!("[DeallsDriver] Resolved tailored ATS Resume PDF: {}", browser_resume_path);

                match page.find_element("input[type='file']").await {
                    Ok(el) => {
                        let params = chromiumoxide::cdp::browser_protocol::dom::SetFileInputFilesParams {
                            files: vec![browser_resume_path.clone()],
                            node_id: Some(el.node_id),
                            backend_node_id: None,
                            object_id: None,
                        };
                        let _ = page.execute(params).await;
                        println!("[DeallsDriver] Successfully attached tailored ATS Resume PDF.");
                        sleep(Duration::from_millis(2500)).await;
                    }
                    Err(e) => println!("[DeallsDriver] Resume file input search note: {}", e),
                }
            } else {
                println!("[DeallsDriver] Warning: No tailored resume PDF found on disk for Job #{}", context.job_id);
            }

            // Also check for portfolio upload input if separate
            let portfolio_candidates = [
                Some(cwd.join("data/assets").join(&tailored_portfolio_name)),
                Some(cwd.join("data/assets/portfolio.pdf")),
                Some(PathBuf::from(&home).join(".job_apply_automator/assets/portfolio.pdf")),
            ];
            let portfolio_file = portfolio_candidates.iter().flatten().find(|p| p.exists());
            if let Some(port_path) = portfolio_file {
                let abs_port = port_path.canonicalize().unwrap_or_else(|_| port_path.clone());
                let browser_port_path = to_browser_path(&abs_port);
                if let Ok(file_inputs) = page.find_elements("input[type='file']").await {
                    if file_inputs.len() > 1 {
                        let second_input = &file_inputs[1];
                        let params = chromiumoxide::cdp::browser_protocol::dom::SetFileInputFilesParams {
                            files: vec![browser_port_path.clone()],
                            node_id: Some(second_input.node_id),
                            backend_node_id: None,
                            object_id: None,
                        };
                        let _ = page.execute(params).await;
                        println!("[DeallsDriver] Attached tailored Portfolio PDF to secondary upload input.");
                    }
                }
            }

            // 4. Fill Candidate Personal Details and Standard Form Inputs
            let full_name = &profile.personal.full_name;
            let email = &profile.personal.email;
            let phone = &profile.personal.phone;
            let location = attributes
                .get("city")
                .or_else(|| attributes.get("location"))
                .cloned()
                .unwrap_or_else(|| profile.personal.location.clone());
            let salary_val = attributes
                .get("salary_expected_floor")
                .cloned()
                .unwrap_or_else(|| "8000000".to_string());
            let yoe_val = "4";
            let gpa_val = attributes
                .get("gpa")
                .cloned()
                .unwrap_or_else(|| "3.48".to_string());
            let availability_date = Utc::now().format("%Y-%m-%d").to_string();

            let fill_form_js = format!(
                r#"
                (() => {{
                    const setVal = (el, val) => {{
                        if (!el || val === undefined || val === null) return;
                        const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
                        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                        if (setter) {{
                            setter.call(el, val);
                        }} else {{
                            el.value = val;
                        }}
                        el.setAttribute('value', val);
                        el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                        el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                        el.dispatchEvent(new Event('blur', {{ bubbles: true }}));
                    }};

                    const fillPhone = (selector, rawVal) => {{
                        if (!rawVal) return;
                        let digits = String(rawVal).replace(/\D/g, '');
                        let base = digits;
                        if (base.startsWith('62')) base = base.substring(2);
                        if (base.startsWith('0')) base = base.substring(1);
                        const withZero = '0' + base;

                        document.querySelectorAll(selector).forEach(el => {{
                            let hasCountryCode = false;
                            let curr = el.parentElement;
                            let depth = 0;
                            while (curr && depth < 3) {{
                                const text = curr.textContent || '';
                                if (text.includes('+62') || text.includes('62')) {{
                                    hasCountryCode = true;
                                    break;
                                }}
                                curr = curr.parentElement;
                                depth++;
                            }}
                            setVal(el, hasCountryCode ? base : withZero);
                        }});
                    }};

                    // Standard identity fields
                    document.querySelectorAll('input[name="name"], input[placeholder*="Nama" i], input[aria-label*="Nama" i]').forEach(el => setVal(el, {name:?}));
                    document.querySelectorAll('input[name="email"], input[type="email"], input[placeholder*="Email" i]').forEach(el => setVal(el, {email:?}));
                    fillPhone('input[name="phone"], input[type="tel"], input[placeholder*="Telepon" i], input[placeholder*="WhatsApp" i], input[placeholder*="Phone" i]', {phone:?});
                    document.querySelectorAll('input[placeholder*="Kota" i], input[placeholder*="Domisili" i], input[placeholder*="Lokasi" i]').forEach(el => setVal(el, {location:?}));

                    // Inspect pre-screening fields
                    const formContainers = Array.from(document.querySelectorAll('div, label, fieldset')).filter(el => {{
                        const text = (el.innerText || '').toLowerCase();
                        return (text.includes('salary') || text.includes('gaji') || text.includes('join') || text.includes('notice') || text.includes('pengalaman') || text.includes('experience') || text.includes('merokok') || text.includes('wfo') || text.includes('ipk') || text.includes('gpa')) && el.querySelector('input, select, textarea');
                    }});

                    document.querySelectorAll('input, select, textarea').forEach(input => {{
                        let labelText = '';
                        let curr = input.parentElement;
                        let depth = 0;
                        while (curr && depth < 4) {{
                            const labelEl = curr.querySelector('label, p, span, h4, h5');
                            if (labelEl && labelEl.innerText.trim()) {{
                                labelText = labelEl.innerText.toLowerCase();
                                break;
                            }}
                            curr = curr.parentElement;
                            depth++;
                        }}
                        const placeholder = (input.placeholder || '').toLowerCase();
                        const combined = (labelText + ' ' + placeholder).toLowerCase();

                        // 1. Expected Salary / Gaji
                        if ((combined.includes('salary') || combined.includes('gaji') || combined.includes('ekspektasi')) && !input.value) {{
                            setVal(input, {salary_val:?});
                        }}

                        // 2. Years of experience / Pengalaman
                        if ((combined.includes('year') || combined.includes('pengalaman') || combined.includes('experience') || combined.includes('tahun')) && !input.value) {{
                            setVal(input, {yoe_val:?});
                        }}

                        // 3. Availability / Start Date
                        if ((combined.includes('availability') || combined.includes('ketersediaan') || combined.includes('join') || combined.includes('bergabung')) && !input.value) {{
                            if (input.type === 'date') {{
                                setVal(input, {availability_date:?});
                            }} else {{
                                setVal(input, 'Immediately / ASAP');
                            }}
                        }}

                        // 4. Notice Period
                        if ((combined.includes('notice') || combined.includes('pemberitahuan') || combined.includes('masa tunggu')) && !input.value) {{
                            setVal(input, '0');
                        }}

                        // 5. GPA / IPK
                        if ((combined.includes('gpa') || combined.includes('ipk')) && !input.value) {{
                            setVal(input, {gpa_val:?});
                        }}
                    }});

                    // 6. Handle Radios & Checkboxes (WFO, Smoking, Layoff)
                    const radioGroups = document.querySelectorAll('div, fieldset');
                    radioGroups.forEach(grp => {{
                        const text = (grp.innerText || '').toLowerCase();
                        if (text.includes('merokok') || text.includes('smoke') || text.includes('phk') || text.includes('layoff')) {{
                            const noBtn = Array.from(grp.querySelectorAll('input[type="radio"], label, button')).find(el => {{
                                const t = (el.innerText || el.value || '').toLowerCase();
                                return t.includes('tidak') || t === 'no';
                            }});
                            if (noBtn) noBtn.click();
                        }}
                        if (text.includes('wfo') || text.includes('on-site') || text.includes('onsite') || text.includes('bersedia')) {{
                            const yesBtn = Array.from(grp.querySelectorAll('input[type="radio"], label, button')).find(el => {{
                                const t = (el.innerText || el.value || '').toLowerCase();
                                return t.includes('ya') || t.includes('bersedia') || t === 'yes';
                            }});
                            if (yesBtn) yesBtn.click();
                        }}
                    }});

                    // Identify any remaining unfilled custom questions for semantic RAG matching
                    const unfilled = [];
                    document.querySelectorAll('textarea, input[type="text"]').forEach((el, idx) => {{
                        if (!el.value.trim()) {{
                            let q = '';
                            let curr = el.parentElement;
                            let depth = 0;
                            while (curr && depth < 4) {{
                                const l = curr.querySelector('label, p, span, h4');
                                if (l && l.innerText.trim()) {{
                                    q = l.innerText.trim();
                                    break;
                                }}
                                curr = curr.parentElement;
                                depth++;
                            }}
                            if (q) {{
                                unfilled.push({{ index: idx, question: q }});
                            }}
                        }}
                    }});

                    return {{ success: true, unfilled }};
                }})()
                "#,
                name = full_name,
                email = email,
                phone = phone,
                location = location,
                salary_val = salary_val,
                yoe_val = yoe_val,
                availability_date = availability_date,
                gpa_val = gpa_val
            );

            let res = page.evaluate(fill_form_js.as_str()).await;
            sleep(Duration::from_millis(800)).await;

            // 5. Semantic Vector Matching for any custom employer screener questions
            if let Ok(eval_val) = res {
                let json_val = eval_val.into_value::<serde_json::Value>().unwrap_or_default();
                if let Some(unfilled_arr) = json_val.get("unfilled").and_then(|u| u.as_array()) {
                    if let (Some(vector), Some(cand_repo)) = (&context.vector_client, &context.candidate_repo) {
                        for item in unfilled_arr {
                            let idx = item.get("index").and_then(|i| i.as_u64()).unwrap_or(0);
                            let q_text = item.get("question").and_then(|q| q.as_str()).unwrap_or("");
                            if q_text.trim().is_empty() {
                                continue;
                            }

                            println!("[DeallsDriver] Querying Vectorize semantic matcher for screener: '{}'", q_text);
                            if let Ok(Some(matched)) = crate::job_application::SemanticMatcher::match_question(vector, cand_repo, q_text).await {
                                println!(
                                    "[DeallsDriver] Semantic match: '{}' -> '{}' (score: {:.3})",
                                    q_text, matched.title_or_key, matched.score
                                );

                                let fill_idx_js = format!(
                                    r#"
                                    (() => {{
                                        const inputs = document.querySelectorAll('textarea, input[type="text"]');
                                        const el = inputs[{idx}];
                                        if (!el) return false;
                                        const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
                                        const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                                        if (setter) {{ setter.call(el, {answer:?}); }} else {{ el.value = {answer:?}; }}
                                        el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                                        el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                                        return true;
                                    }})()
                                    "#,
                                    idx = idx,
                                    answer = matched.answer_text
                                );
                                let _ = page.evaluate(fill_idx_js).await;
                            }
                        }
                    }
                }
            }

            // 6. Highlight Final Submit Button
            let highlight_submit_js = r#"
                (() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const submitBtn = buttons.find(b => {
                        const t = (b.textContent || '').trim().toLowerCase();
                        return t === 'kirim lamaran' 
                            || t === 'kirim' 
                            || t === 'submit' 
                            || t === 'submit application' 
                            || (t.includes('lamar') && !t.includes('batal'));
                    });
                    if (submitBtn) {
                        submitBtn.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        submitBtn.style.outline = '4px solid #10B981';
                        submitBtn.style.boxShadow = '0 0 15px rgba(16, 185, 129, 0.6)';
                        return true;
                    }
                    return false;
                })()
            "#;
            let _ = page.evaluate(highlight_submit_js).await;

            // 7. Interactive inspection vs direct submission
            if context.interactive {
                println!("[DeallsDriver] Application form prefilled in headful browser. Halting for human visual review before final submit.");
                return Ok(SubmissionReceipt {
                    job_id: context.job_id,
                    portal: "Dealls".into(),
                    status: "PREFILLED".into(),
                    confirmation_text: Some("Dealls application modal prefilled and validated for human visual review before submission".into()),
                    receipt_screenshot_path: None,
                    roadblock_url: None,
                    submitted_at: timestamp,
                    error_message: None,
                });
            }

            // Direct submission: click submit button
            let submit_js = r#"
                (() => {
                    const buttons = Array.from(document.querySelectorAll('button'));
                    const submitBtn = buttons.find(b => {
                        const t = (b.textContent || '').trim().toLowerCase();
                        return t === 'kirim lamaran' 
                            || t === 'kirim' 
                            || t === 'submit' 
                            || t === 'submit application' 
                            || (t.includes('lamar') && !t.includes('batal'));
                    });
                    if (submitBtn) {
                        submitBtn.click();
                        return true;
                    }
                    return false;
                })()
            "#;
            let submitted: bool = page.evaluate(submit_js).await?.into_value().unwrap_or(false);
            sleep(Duration::from_millis(4000)).await;

            let final_status = if submitted { "APPLIED" } else { "PREFILLED" };

            Ok(SubmissionReceipt {
                job_id: context.job_id,
                portal: "Dealls".into(),
                status: final_status.into(),
                confirmation_text: Some("Application submitted via Dealls Native Driver".into()),
                receipt_screenshot_path: None,
                roadblock_url: None,
                submitted_at: timestamp,
                error_message: None,
            })
        })
    }
}
