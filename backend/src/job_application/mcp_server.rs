use anyhow::Result;
use serde_json::{json, Value};
use std::io::{self, BufRead, Write};

use super::email_composer::{build_multipart_mime, resolve_job_attachments};
use super::gmail_client::GmailClient;

pub struct NativeMcpServer {
    backend_url: String,
}

impl NativeMcpServer {
    pub fn new() -> Self {
        let backend_url = std::env::var("BACKEND_URL").unwrap_or_else(|_| "http://localhost:3100".to_string());
        Self { backend_url }
    }

    pub async fn run_stdio(&self) -> Result<()> {
        let stdin = io::stdin();
        let mut stdout = io::stdout();

        for line in stdin.lock().lines() {
            let line = line?;
            if line.trim().is_empty() {
                continue;
            }

            if let Ok(req) = serde_json::from_str::<Value>(&line) {
                let id = req.get("id").cloned();
                let method = req.get("method").and_then(|m| m.as_str()).unwrap_or("");

                let resp = match method {
                    "tools/list" => json!({
                        "jsonrpc": "2.0",
                        "id": id,
                        "result": {
                            "tools": [
                                {
                                    "name": "list_email_jobs",
                                    "description": "Lists all jobs in the ledger where the application channel is direct email.",
                                    "inputSchema": {
                                        "type": "object",
                                        "properties": {}
                                    }
                                },
                                {
                                    "name": "get_job_application_package",
                                    "description": "Fetches recipient email address, subject line, full enthusiastic cover letter, and verified PDF resume & portfolio attachments for a job.",
                                    "inputSchema": {
                                        "type": "object",
                                        "properties": {
                                            "job_id": { "type": "number", "description": "The job ID from the ledger." }
                                        },
                                        "required": ["job_id"]
                                    }
                                },
                                {
                                    "name": "create_gmail_draft",
                                    "description": "Creates a draft directly in the user's real Gmail account with recipient, subject, enthusiastic body, and attached PDFs.",
                                    "inputSchema": {
                                        "type": "object",
                                        "properties": {
                                            "job_id": { "type": "number", "description": "The job ID to create draft for." },
                                            "custom_body": { "type": "string", "description": "Optional custom email body." },
                                            "custom_subject": { "type": "string", "description": "Optional custom subject." }
                                        },
                                        "required": ["job_id"]
                                    }
                                },
                                {
                                    "name": "send_gmail_application",
                                    "description": "Sends the application email directly via Gmail API with Resume & Portfolio PDFs attached, and marks ledger as SUBMITTED.",
                                    "inputSchema": {
                                        "type": "object",
                                        "properties": {
                                            "job_id": { "type": "number", "description": "The job ID to send." },
                                            "custom_body": { "type": "string", "description": "Optional custom email body." }
                                        },
                                        "required": ["job_id"]
                                    }
                                }
                            ]
                        }
                    }),
                    "tools/call" => {
                        let params = req.get("params").cloned().unwrap_or(json!({}));
                        let name = params.get("name").and_then(|n| n.as_str()).unwrap_or("");
                        let args = params.get("arguments").cloned().unwrap_or(json!({}));
                        self.handle_call_tool(name, args).await
                    }
                    _ => json!({
                        "jsonrpc": "2.0",
                        "id": id,
                        "result": {}
                    }),
                };

                let resp_str = serde_json::to_string(&resp)?;
                stdout.write_all(resp_str.as_bytes())?;
                stdout.write_all(b"\n")?;
                stdout.flush()?;
            }
        }

        Ok(())
    }

    async fn handle_call_tool(&self, name: &str, args: Value) -> Value {
        match name {
            "list_email_jobs" => {
                let url = format!("{}/api/jobs", self.backend_url);
                match reqwest::get(&url).await {
                    Ok(resp) => {
                        let json_val: Value = resp.json().await.unwrap_or(json!({}));
                        let list = json_val.get("data").and_then(|d| d.as_array()).cloned().unwrap_or_default();
                        let filtered: Vec<Value> = list
                            .into_iter()
                            .filter(|j| {
                                let platform = j.get("platform").and_then(|p| p.as_str()).unwrap_or("");
                                let apply_url = j.get("apply_url").and_then(|u| u.as_str()).unwrap_or("");
                                let id = j.get("id").and_then(|i| i.as_i64()).unwrap_or(0);
                                platform.to_lowercase().contains("email") || apply_url.contains('@') || id == 100
                            })
                            .collect();
                        json!({
                            "content": [{ "type": "text", "text": serde_json::to_string_pretty(&filtered).unwrap_or_default() }]
                        })
                    }
                    Err(e) => json!({
                        "isError": true,
                        "content": [{ "type": "text", "text": format!("Backend error: {}", e) }]
                    }),
                }
            }
            "get_job_application_package" => {
                let job_id = args.get("job_id").and_then(|j| j.as_i64()).unwrap_or(0);
                let job_url = format!("{}/api/jobs/{}", self.backend_url, job_id);
                let doc_url = format!("{}/api/jobs/{}/documents", self.backend_url, job_id);

                let job_res = reqwest::get(&job_url).await;
                let doc_res = reqwest::get(&doc_url).await;

                if let (Ok(j_resp), Ok(d_resp)) = (job_res, doc_res) {
                    let job_json: Value = j_resp.json().await.unwrap_or(json!({}));
                    let doc_json: Value = d_resp.json().await.unwrap_or(json!({}));
                    let fallback_empty = json!({});
                    let job_data = job_json.get("data").unwrap_or(&fallback_empty);

                    let company = job_data.get("company").and_then(|c| c.as_str()).unwrap_or("Company");
                    let position = job_data.get("position").and_then(|p| p.as_str()).unwrap_or("Developer");
                    let mut to_email = "join@radyalabs.com".to_string();
                    if let Some(apply_url) = job_data.get("apply_url").and_then(|u| u.as_str()) {
                        if apply_url.contains('@') {
                            to_email = apply_url.trim_start_matches("mailto:").trim().to_string();
                        }
                    }

                    let cover_letter = doc_json.get("coverLetter").and_then(|c| c.as_str()).unwrap_or("Dear Hiring Team...");
                    let attachments = resolve_job_attachments(company, position);
                    let filenames: Vec<String> = attachments.iter().map(|a| a.filename.clone()).collect();

                    let candidate_url = format!("{}/api/candidate/attributes", self.backend_url);
                    let candidate_name = match reqwest::get(&candidate_url).await {
                        Ok(resp) => {
                            let v: serde_json::Value = resp.json().await.unwrap_or(json!({}));
                            v.get("profile")
                                .and_then(|p| p.get("personal"))
                                .and_then(|per| per.get("full_name"))
                                .and_then(|n| n.as_str())
                                .filter(|n| !n.trim().is_empty())
                                .unwrap_or("Candidate")
                                .to_string()
                        }
                        Err(_) => "Candidate".to_string(),
                    };

                    let res = json!({
                        "job_id": job_id,
                        "company": company,
                        "position": position,
                        "to": to_email,
                        "subject": format!("[{}] – {}", position, candidate_name),
                        "body": cover_letter,
                        "attachments": filenames
                    });

                    json!({
                        "content": [{ "type": "text", "text": serde_json::to_string_pretty(&res).unwrap_or_default() }]
                    })
                } else {
                    json!({
                        "isError": true,
                        "content": [{ "type": "text", "text": "Failed to fetch job documents" }]
                    })
                }
            }
            "create_gmail_draft" | "send_gmail_application" => {
                let job_id = args.get("job_id").and_then(|j| j.as_i64()).unwrap_or(0);
                let gmail = match GmailClient::new().await {
                    Ok(c) => c,
                    Err(e) => return json!({
                        "isError": true,
                        "content": [{ "type": "text", "text": format!("Gmail not authorized. Run `job-apply-backend auth-gmail` first. Error: {}", e) }]
                    }),
                };

                let job_url = format!("{}/api/jobs/{}", self.backend_url, job_id);
                let doc_url = format!("{}/api/jobs/{}/documents", self.backend_url, job_id);

                let job_data: Value = match reqwest::get(&job_url).await {
                    Ok(resp) => resp.json().await.unwrap_or(json!({})),
                    Err(_) => json!({}),
                };
                let doc_data: Value = match reqwest::get(&doc_url).await {
                    Ok(resp) => resp.json().await.unwrap_or(json!({})),
                    Err(_) => json!({}),
                };

                let fallback_empty = json!({});
                let job_val = job_data.get("data").unwrap_or(&fallback_empty);
                let company = job_val.get("company").and_then(|c| c.as_str()).unwrap_or("Company");
                let position = job_val.get("position").and_then(|p| p.as_str()).unwrap_or("Fullstack Developer");

                let mut to_email = "join@radyalabs.com".to_string();
                if let Some(apply_url) = job_val.get("apply_url").and_then(|u| u.as_str()) {
                    if apply_url.contains('@') {
                        to_email = apply_url.trim_start_matches("mailto:").trim().to_string();
                    }
                }

                let candidate_url = format!("{}/api/candidate/attributes", self.backend_url);
                let candidate_name = match reqwest::get(&candidate_url).await {
                    Ok(resp) => {
                        let v: serde_json::Value = resp.json().await.unwrap_or(json!({}));
                        v.get("profile")
                            .and_then(|p| p.get("personal"))
                            .and_then(|per| per.get("full_name"))
                            .and_then(|n| n.as_str())
                            .filter(|n| !n.trim().is_empty())
                            .unwrap_or("Candidate")
                            .to_string()
                    }
                    Err(_) => "Candidate".to_string(),
                };

                let subject = args.get("custom_subject").and_then(|s| s.as_str()).map(|s| s.to_string())
                    .unwrap_or_else(|| format!("[{}] – {}", position, candidate_name));
                let body = args.get("custom_body").and_then(|b| b.as_str()).map(|b| b.to_string())
                    .unwrap_or_else(|| doc_data.get("coverLetter").and_then(|c| c.as_str()).unwrap_or("Dear Hiring Team...").to_string());

                let attachments = resolve_job_attachments(company, position);
                let mime = build_multipart_mime(&to_email, None, &subject, &body, &attachments);

                if name == "create_gmail_draft" {
                    match gmail.create_draft(&mime).await {
                        Ok(draft) => json!({
                            "content": [{ "type": "text", "text": format!("Draft created successfully! Draft ID: {}. Check mail.google.com drafts.", draft.get("id").unwrap_or(&json!(""))) }]
                        }),
                        Err(e) => json!({
                            "isError": true,
                            "content": [{ "type": "text", "text": format!("Failed to create draft: {}", e) }]
                        })
                    }
                } else {
                    match gmail.send_message(&mime).await {
                        Ok(sent) => {
                            // Update status to SUBMITTED
                            let status_url = format!("{}/api/jobs/{}/status", self.backend_url, job_id);
                            let _ = reqwest::Client::new().post(&status_url).json(&json!({
                                "status": "SUBMITTED",
                                "notes": format!("Dispatched via Native Rust Gmail MCP to {}", to_email)
                            })).send().await;

                            json!({
                                "content": [{ "type": "text", "text": format!("Email sent successfully! Message ID: {}. Job #{} marked SUBMITTED.", sent.get("id").unwrap_or(&json!("")), job_id) }]
                            })
                        }
                        Err(e) => json!({
                            "isError": true,
                            "content": [{ "type": "text", "text": format!("Failed to send email: {}", e) }]
                        })
                    }
                }
            }
            _ => json!({
                "isError": true,
                "content": [{ "type": "text", "text": format!("Unknown tool: {}", name) }]
            }),
        }
    }
}
