use anyhow::{anyhow, Result};
use base64::Engine;
use std::fs;
use std::path::{Path, PathBuf};

pub struct EmailAttachment {
    pub filename: String,
    pub content: Vec<u8>,
    pub content_type: String,
}

pub fn build_multipart_mime(
    to: &str,
    from: Option<&str>,
    subject: &str,
    body: &str,
    attachments: &[EmailAttachment],
) -> String {
    let boundary = format!("__boundary_job_apply_{}__", chrono::Utc::now().timestamp_millis());
    let mut lines = Vec::new();

    lines.push(format!("To: {}", to));
    if let Some(f) = from {
        lines.push(format!("From: {}", f));
    }
    let encoded_subject = base64::engine::general_purpose::STANDARD.encode(subject.as_bytes());
    lines.push(format!("Subject: =?UTF-8?B?{}?=", encoded_subject));
    lines.push("MIME-Version: 1.0".to_string());
    lines.push(format!("Content-Type: multipart/mixed; boundary=\"{}\"", boundary));
    lines.push("".to_string());

    // Body part
    lines.push(format!("--{}", boundary));
    lines.push("Content-Type: text/plain; charset=\"UTF-8\"".to_string());
    lines.push("Content-Transfer-Encoding: base64".to_string());
    lines.push("".to_string());
    lines.push(base64::engine::general_purpose::STANDARD.encode(body.as_bytes()));
    lines.push("".to_string());

    // Attachment parts
    for att in attachments {
        lines.push(format!("--{}", boundary));
        lines.push(format!("Content-Type: {}; name=\"{}\"", att.content_type, att.filename));
        lines.push("Content-Transfer-Encoding: base64".to_string());
        lines.push(format!("Content-Disposition: attachment; filename=\"{}\"", att.filename));
        lines.push("".to_string());
        lines.push(base64::engine::general_purpose::STANDARD.encode(&att.content));
        lines.push("".to_string());
    }

    lines.push(format!("--{}--", boundary));
    lines.join("\r\n")
}

pub fn resolve_job_attachments(company: &str, position: &str) -> Vec<EmailAttachment> {
    let mut attachments = Vec::new();
    let safe_company: String = company.chars().map(|c| if c.is_alphanumeric() { c } else { '_' }).collect();
    let safe_role: String = position.chars().map(|c| if c.is_alphanumeric() { c } else { '_' }).collect();

    let base_resumes_dir = std::env::var("JOB_APPLY_DATA_DIR")
        .map(PathBuf::from)
        .or_else(|_| std::env::var("HOME").map(|h| PathBuf::from(h).join(".job_apply_automator")))
        .unwrap_or_else(|_| PathBuf::from(".job_apply_automator"))
        .join("resumes");

    // Resume PDF candidates
    let resume_candidates = [
        base_resumes_dir.join(format!("{}_{}_Resume.pdf", safe_company, safe_role)),
        PathBuf::from("data/assets").join(format!("{}_{}_Resume.pdf", safe_company, safe_role)),
        base_resumes_dir.join("Radya_Labs_Fullstack_Developer_Resume.pdf"),
        PathBuf::from("data/assets").join("Radya_Labs_Fullstack_Developer_Resume.pdf"),
    ];

    for path in &resume_candidates {
        if path.exists() {
            if let Ok(bytes) = fs::read(path) {
                let filename = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                attachments.push(EmailAttachment {
                    filename,
                    content: bytes,
                    content_type: "application/pdf".to_string(),
                });
                break;
            }
        }
    }

    // Portfolio PDF candidates
    let portfolio_candidates = [
        base_resumes_dir.join(format!("{}_{}_Portfolio.pdf", safe_company, safe_role)),
        PathBuf::from("data/assets").join(format!("{}_{}_Portfolio.pdf", safe_company, safe_role)),
        base_resumes_dir.join("Radya_Labs_Fullstack_Developer_Portfolio.pdf"),
        PathBuf::from("data/assets").join("Radya_Labs_Fullstack_Developer_Portfolio.pdf"),
    ];

    for path in &portfolio_candidates {
        if path.exists() {
            if let Ok(bytes) = fs::read(path) {
                let filename = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                attachments.push(EmailAttachment {
                    filename,
                    content: bytes,
                    content_type: "application/pdf".to_string(),
                });
                break;
            }
        }
    }

    attachments
}
