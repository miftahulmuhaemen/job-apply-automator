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

pub struct GoogleFormDriver;

impl PortalDriver for GoogleFormDriver {
    fn id(&self) -> &str {
        "google_form"
    }

    fn name(&self) -> &str {
        "Google Forms"
    }

    fn can_handle(&self, portal: &str, url: &str) -> bool {
        let p = portal.to_lowercase();
        let u = url.to_lowercase();
        p.contains("google form")
            || p.contains("gform")
            || u.contains("docs.google.com/forms")
            || u.contains("forms.gle")
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
            println!("[GoogleFormDriver] Navigating to Google Form: {}", context.job_url);
            page.goto(&context.job_url).await?;
            sleep(Duration::from_millis(4000)).await;

            let current_url = page.url().await.ok().flatten().unwrap_or_default();
            if current_url.contains("accounts.google.com") {
                println!("[GoogleFormDriver] Form requires Google account authentication. Redirected to Sign-in page.");
                return Ok(SubmissionReceipt {
                    job_id: context.job_id,
                    portal: "Google Forms".into(),
                    status: "PENDING_HUMAN".into(),
                    confirmation_text: Some(
                        "Google Forms requires Google Account Sign-In in headful browser.".into(),
                    ),
                    receipt_screenshot_path: None,
                    roadblock_url: Some(current_url),
                    submitted_at: timestamp,
                    error_message: Some("Authentication Required: Google Account Sign-in".into()),
                });
            }

            // Prepare candidate profile JSON for client-side field matching
            let full_name = &profile.personal.full_name;
            let email = &profile.personal.email;
            let phone = &profile.personal.phone;
            let location = attributes
                .get("location")
                .cloned()
                .unwrap_or_else(|| profile.personal.location.clone());
            let linkedin = attributes
                .get("linkedin")
                .cloned()
                .unwrap_or_else(|| profile.personal.linkedin.clone());
            let github = attributes
                .get("github")
                .cloned()
                .unwrap_or_else(|| profile.personal.github.clone());
            let portfolio = attributes
                .get("portfolio")
                .cloned()
                .unwrap_or_else(|| profile.personal.portfolio.clone());
            let expected_salary = attributes
                .get("salary_expected_floor")
                .cloned()
                .unwrap_or_else(|| "15000000".into());
            let current_salary = attributes
                .get("salary_before")
                .cloned()
                .unwrap_or_else(|| "7000000".into());
            let summary = &profile.summary;

            let fill_gform_script = format!(
                r#"
                (() => {{
                    const candidate = {{
                        full_name: {full_name:?},
                        email: {email:?},
                        phone: {phone:?},
                        location: {location:?},
                        linkedin: {linkedin:?},
                        github: {github:?},
                        portfolio: {portfolio:?},
                        expected_salary: {expected_salary:?},
                        current_salary: {current_salary:?},
                        summary: {summary:?}
                    }};

                    const setVal = (el, val) => {{
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

                    const resolveValueForQuestion = (qText) => {{
                        const q = qText.toLowerCase();
                        if (q.includes('nama') || q.includes('name') || q.includes('full name')) return candidate.full_name;
                        if (q.includes('email') || q.includes('surel')) return candidate.email;
                        if (q.includes('telepon') || q.includes('phone') || q.includes('whatsapp') || q.includes('wa') || q.includes('hp') || q.includes('kontak')) return candidate.phone;
                        if (q.includes('domisili') || q.includes('alamat') || q.includes('lokasi') || q.includes('city') || q.includes('address')) return candidate.location;
                        if (q.includes('linkedin')) return candidate.linkedin;
                        if (q.includes('github')) return candidate.github;
                        if (q.includes('portofolio') || q.includes('portfolio') || q.includes('website')) return candidate.portfolio;
                        if (q.includes('ekspektasi gaji') || q.includes('expected salary')) return candidate.expected_salary;
                        if (q.includes('gaji terakhir') || q.includes('current salary') || q.includes('last salary')) return candidate.current_salary;
                        if (q.includes('tentang anda') || q.includes('ringkasan') || q.includes('summary') || q.includes('tentang diri') || q.includes('perkenalan')) return candidate.summary;
                        if (q.includes('gaji') || q.includes('salary')) return candidate.expected_salary;
                        return null;
                    }};

                    const items = document.querySelectorAll('[role="listitem"]');
                    let filledCount = 0;
                    const unfilled = [];

                    items.forEach((item, index) => {{
                        const titleEl = item.querySelector('[role="heading"], span.M7eMe, .HoDaId, .freebirdFormviewerComponentsQuestionBaseTitle');
                        if (!titleEl) return;
                        const qText = (titleEl.innerText || titleEl.textContent || '').trim();
                        const val = resolveValueForQuestion(qText);
                        if (!val) {{
                            unfilled.push({{ index, question: qText }});
                            return;
                        }}

                        // 1. Short text input
                        const textInput = item.querySelector('input[type="text"]:not([aria-hidden="true"]), input[type="email"], input[type="tel"]');
                        if (textInput) {{
                            setVal(textInput, val);
                            filledCount++;
                            return;
                        }}

                        // 2. Paragraph textarea
                        const textarea = item.querySelector('textarea');
                        if (textarea) {{
                            setVal(textarea, val);
                            filledCount++;
                            return;
                        }}

                        // 3. Radio options
                        const radios = item.querySelectorAll('[role="radio"]');
                        if (radios.length > 0) {{
                            for (const r of radios) {{
                                const label = (r.getAttribute('data-value') || r.innerText || '').toLowerCase();
                                if (label.includes(val.toLowerCase()) || val.toLowerCase().includes(label)) {{
                                    r.click();
                                    filledCount++;
                                    break;
                                }}
                            }}
                        }}
                    }});

                    // Scroll to bottom / submit button area
                    const submitBtn = document.querySelector('[role="button"][jsname="M2Action"], div[role="button"][aria-label*="Kirim"], div[role="button"][aria-label*="Submit"]');
                    if (submitBtn) {{
                        submitBtn.scrollIntoView({{ behavior: 'smooth', block: 'center' }});
                    }}

                    return {{ filledCount, totalQuestions: items.length, unfilled }};
                }})()
                "#,
                full_name = full_name,
                email = email,
                phone = phone,
                location = location,
                linkedin = linkedin,
                github = github,
                portfolio = portfolio,
                expected_salary = expected_salary,
                current_salary = current_salary,
                summary = summary
            );

            let res = page.evaluate(fill_gform_script).await;
            println!("[GoogleFormDriver] Base fill execution result: {:?}", res);

            // Phase 2: Production Semantic Matching via Cloudflare Vectorize for any unfilled questions
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

                            println!("[GoogleFormDriver] Querying Vectorize semantic matcher for screener question: '{}'", q_text);
                            if let Ok(Some(matched)) = crate::job_application::SemanticMatcher::match_question(vector, cand_repo, q_text).await {
                                println!(
                                    "[GoogleFormDriver] Vector match found: '{}' -> '{}' (score: {:.3})",
                                    q_text, matched.title_or_key, matched.score
                                );

                                let fill_idx_js = format!(
                                    r#"
                                    (() => {{
                                        const items = document.querySelectorAll('[role="listitem"]');
                                        const item = items[{idx}];
                                        if (!item) return false;
                                        const setVal = (el, val) => {{
                                            const proto = el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
                                            const nativeSetter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
                                            if (nativeSetter) {{ nativeSetter.call(el, val); }} else {{ el.value = val; }}
                                            el.dispatchEvent(new Event('input', {{ bubbles: true }}));
                                            el.dispatchEvent(new Event('change', {{ bubbles: true }}));
                                        }};
                                        const textarea = item.querySelector('textarea');
                                        if (textarea) {{ setVal(textarea, {answer:?}); return true; }}
                                        const textInput = item.querySelector('input[type="text"]:not([aria-hidden="true"]), input[type="email"], input[type="tel"]');
                                        if (textInput) {{ setVal(textInput, {answer:?}); return true; }}
                                        return false;
                                    }})()
                                    "#,
                                    idx = idx,
                                    answer = matched.answer_text
                                );
                                let _ = page.evaluate(fill_idx_js).await;
                                sleep(Duration::from_millis(300)).await;
                            } else {
                                println!("[GoogleFormDriver] No confident vector match for question: '{}' (score < 0.70)", q_text);
                            }
                        }
                    }
                }
            }
            sleep(Duration::from_millis(1500)).await;

            // Strict governance constraint: NEVER submit when interactive or dry_run, halt right before submit button
            println!("[GoogleFormDriver] Google Form prefilled in visible headful browser session.");
            println!("[GoogleFormDriver] Halted strictly before final submit button per user request.");

            Ok(SubmissionReceipt {
                job_id: context.job_id,
                portal: "Google Forms".into(),
                status: "PREFILLED".into(),
                confirmation_text: Some(
                    "Google Form successfully prefilled in visible Brave session - halted before final submission button.".into(),
                ),
                receipt_screenshot_path: None,
                roadblock_url: None,
                submitted_at: timestamp,
                error_message: None,
            })
        })
    }
}
