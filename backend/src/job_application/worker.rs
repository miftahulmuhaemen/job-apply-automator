use crate::constants::triage_decision;
use crate::job_application::SemanticMatcher;
use crate::storage::candidate::CandidateProfile;
use crate::storage::{CandidateRepository, D1Client, JobsLedgerRepository, VectorClient};
use tokio::task::JoinHandle;

pub struct JobSynthesisWorker;

fn html_escape(input: &str) -> String {
    input
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
}

impl JobSynthesisWorker {
    /// Spawns an asynchronous background task to synthesize tailored application
    /// assets (cover letter, vector match evidence) immediately upon intake.
    pub fn spawn_synthesis(
        d1: D1Client,
        job_id: i64,
        company: String,
        title: String,
        location: String,
    ) -> JoinHandle<()> {
        tokio::spawn(async move {
            let candidate_repo = CandidateRepository::new(d1.clone());
            let ledger_repo = JobsLedgerRepository::new(d1.clone());
            let vector_client = VectorClient::new_from_env().ok();

            let safe_comp = company.replace(|c: char| !c.is_alphanumeric(), "_");
            let safe_title = title.replace(|c: char| !c.is_alphanumeric(), "_");
            let cache_path = std::path::PathBuf::from("data/assets")
                .join(format!("{}_{}_CoverLetter.txt", safe_comp, safe_title));

            let attrs = candidate_repo.get_all_attributes().await.unwrap_or_default();
            let profile = CandidateProfile::from_attributes(&attrs);

            if profile.personal.full_name.trim().is_empty() {
                eprintln!("[JobSynthesisWorker] Candidate profile is uninitialized in database; skipping synthesis for job #{}", job_id);
                return;
            }

            let synthesized_content = if let Some(ref vector) = vector_client {
                let query = format!("{} role at {} {}", title, company, location);
                let top_matches = SemanticMatcher::query_top_matches(
                    vector,
                    &candidate_repo,
                    &query,
                    4,
                )
                .await
                .unwrap_or_default();

                if !top_matches.is_empty() {
                    Some(SemanticMatcher::synthesize_from_matches(
                        &top_matches,
                        &company,
                        &title,
                        &profile,
                    ))
                } else {
                    None
                }
            } else {
                None
            };

            let cover_letter = synthesized_content.unwrap_or_else(|| {
                // Dynamically synthesized without hardcoded company/project strings
                SemanticMatcher::synthesize_from_matches(&[], &company, &title, &profile)
            });

            // Persist to disk cache
            let _ = std::fs::create_dir_all("data/assets");
            let write_ok = std::fs::write(&cache_path, &cover_letter).is_ok();

            // Also compile tailored resume PDF and portfolio PDF dynamically from candidate profile
            let _ = Self::compile_resume_pdf(&company, &title, &profile);
            let _ = Self::compile_portfolio_pdf(&company, &title);

            // Mark job status as READY in ledger
            let decision = if write_ok {
                triage_decision::READY
            } else {
                triage_decision::KEEP
            };

            let _ = ledger_repo.update_triage_decision(job_id, decision, None).await;
        })
    }

    pub fn compile_portfolio_pdf(company: &str, title: &str) -> anyhow::Result<std::path::PathBuf> {
        let safe_comp = company.replace(|c: char| !c.is_alphanumeric(), "_");
        let safe_title = title.replace(|c: char| !c.is_alphanumeric(), "_");
        let assets_dir = std::path::PathBuf::from("data/assets");
        std::fs::create_dir_all(&assets_dir)?;
        let target_pdf = assets_dir.join(format!("{}_{}_Portfolio.pdf", safe_comp, safe_title));
        let src_pdf = assets_dir.join("portfolio.pdf");

        if src_pdf.exists() && !target_pdf.exists() {
            let _ = std::fs::copy(&src_pdf, &target_pdf);
        }
        Ok(target_pdf)
    }

    pub fn compile_resume_pdf(company: &str, title: &str, profile: &CandidateProfile) -> anyhow::Result<std::path::PathBuf> {
        if profile.personal.full_name.trim().is_empty() {
            anyhow::bail!("Candidate profile is uninitialized in database (Cloudflare D1). Cannot generate resume without candidate full_name.");
        }

        let safe_comp = company.replace(|c: char| !c.is_alphanumeric(), "_");
        let safe_title = title.replace(|c: char| !c.is_alphanumeric(), "_");
        let assets_dir = std::path::PathBuf::from("data/assets");
        std::fs::create_dir_all(&assets_dir)?;

        let html_path = assets_dir.join(format!("{}_{}_Resume.html", safe_comp, safe_title));
        let pdf_path = assets_dir.join(format!("{}_{}_Resume.pdf", safe_comp, safe_title));

        let html_content = Self::render_resume_html(company, title, profile)?;
        std::fs::write(&html_path, &html_content)?;

        // Run headless Chrome to convert HTML to PDF without browser header/footer
        let browsers = ["google-chrome", "chromium", "chromium-browser", "brave-browser"];
        let mut compiled = false;
        for browser in &browsers {
            let output = std::process::Command::new(browser)
                .args([
                    "--headless=new",
                    "--no-sandbox",
                    "--disable-gpu",
                    "--no-pdf-header-footer",
                    &format!("--print-to-pdf={}", pdf_path.to_string_lossy()),
                    html_path.to_str().unwrap_or(""),
                ])
                .output();

            if let Ok(out) = output {
                if out.status.success() && pdf_path.exists() {
                    compiled = true;
                    break;
                }
            }
        }

        if compiled {
            Ok(pdf_path)
        } else {
            Err(anyhow::anyhow!("Headless browser PDF compilation failed"))
        }
    }

    pub fn render_resume_html(company: &str, title: &str, profile: &CandidateProfile) -> anyhow::Result<String> {
        if profile.personal.full_name.trim().is_empty() {
            anyhow::bail!("Candidate profile is missing full_name.");
        }

        let title_lower = title.to_lowercase();
        let is_devops = title_lower.contains("devops") || title_lower.contains("infrastructure") || title_lower.contains("platform");
        let is_data = title_lower.contains("data");
        let is_backend = title_lower.contains("backend") || title_lower.contains("back end") || title_lower.contains("back-end");
        let is_frontend = title_lower.contains("front") || title_lower.contains("ui");

        let (headline_role, summary_text, skills_block) = if is_devops {
            (
                "DevOps & Platform Infrastructure Engineer",
                format!(
                    "DevOps & Infrastructure Engineer with 5+ years of software engineering experience administering production Kubernetes clusters, automating resilient CI/CD pipelines, and managing containerized cloud services. Experienced architecting scalable deployment automation, monitoring telemetry, and high-availability cloud infrastructure targeted for {}'s engineering goals.",
                    company
                ),
                r#"<div class="skill-line"><span class="skill-category">Cloud & Infrastructure:</span> Kubernetes, Docker, Linux Administration, Prometheus, Grafana.</div>
<div class="skill-line"><span class="skill-category">CI/CD & Automation:</span> GitHub Actions, Git, Shell Scripting, Automated Testing.</div>
<div class="skill-line"><span class="skill-category">Backend & Languages:</span> Go, Python, SQL, RESTful APIs, Microservices Architecture.</div>
<div class="skill-line"><span class="skill-category">Databases & Storage:</span> PostgreSQL, Redis, MongoDB, Schema Optimization.</div>"#
            )
        } else if is_data {
            (
                "Data & Backend Engineer",
                format!(
                    "Data & Backend Engineer with 5+ years of experience architecting analytical data pipelines, building high-throughput Go backend services, and managing relational and time-series data warehouses. Proven track record optimizing ETL pipelines and event-driven architectures to support {}'s data platform.",
                    company
                ),
                r#"<div class="skill-line"><span class="skill-category">Languages & Pipelines:</span> Go, Python, SQL (PostgreSQL, CTEs), Data Warehousing.</div>
<div class="skill-line"><span class="skill-category">Databases & Message Brokers:</span> PostgreSQL, Redis, MongoDB, GCP Pub/Sub.</div>
<div class="skill-line"><span class="skill-category">Backend Frameworks:</span> Go (Echo, Gin), RESTful APIs, gRPC, Microservices, Node.js.</div>
<div class="skill-line"><span class="skill-category">Cloud, DevOps & QA:</span> Docker, Kubernetes, GitHub Actions, Load Testing.</div>"#
            )
        } else if is_frontend {
            (
                "Frontend Engineer (React & TypeScript)",
                format!(
                    "Frontend Engineer with 5+ years of software engineering experience delivering modern, responsive React/TypeScript user interfaces, offline-first client architecture, and high-performance web applications. Creator of production web platforms pairing responsive client designs with resilient Go and REST backends tailored for {}.",
                    company
                ),
                r#"<div class="skill-line"><span class="skill-category">Frontend & UI/UX:</span> React, TypeScript, Vite, Tailwind CSS, Next.js, IndexedDB, Svelte.</div>
<div class="skill-line"><span class="skill-category">Languages:</span> TypeScript, JavaScript, Go, HTML5, CSS3, SQL, Python.</div>
<div class="skill-line"><span class="skill-category">Backend & APIs:</span> Go (Echo, Gin), RESTful APIs, JWT Authentication, Microservices.</div>
<div class="skill-line"><span class="skill-category">Databases & DevOps:</span> PostgreSQL, Redis, Docker, GitHub Actions, Vitest, Playwright.</div>"#
            )
        } else if is_backend {
            (
                "Senior Backend Engineer (Go & Cloud Infrastructure)",
                format!(
                    "Backend Engineer with 5+ years of professional software engineering experience architecting high-throughput Go microservices, relational query optimizations, and containerized deployments across Kubernetes and Docker. Skilled in event-driven systems, RESTful APIs, and cloud services aligned with {}'s engineering standards.",
                    company
                ),
                r#"<div class="skill-line"><span class="skill-category">Backend & Microservices:</span> Go (Echo, Gin, Chi), RESTful APIs, gRPC, JWT Authentication, Distributed Systems.</div>
<div class="skill-line"><span class="skill-category">Databases & Storage:</span> PostgreSQL (CTEs, indexing), Redis, MongoDB, Schema Design.</div>
<div class="skill-line"><span class="skill-category">Languages:</span> Go, TypeScript, Python, SQL, JavaScript.</div>
<div class="skill-line"><span class="skill-category">Cloud, DevOps & QA:</span> Docker, Kubernetes, GitHub Actions, Load Testing.</div>"#
            )
        } else {
            (
                "Fullstack Developer (Go & React)",
                format!(
                    "Fullstack Developer with 5+ years of software engineering experience delivering responsive web applications, modern React/TypeScript interfaces, and high-throughput Go backend systems. Proven track record architecting event-driven RESTful APIs, distributed microservices, and end-to-end cloud deployments across Kubernetes and Docker for {}.",
                    company
                ),
                r#"<div class="skill-line"><span class="skill-category">Languages:</span> Go, TypeScript, JavaScript, Python, SQL, HTML5, CSS3.</div>
<div class="skill-line"><span class="skill-category">Frontend Engineering:</span> React, Vite, Tailwind CSS, Next.js, IndexedDB, Svelte.</div>
<div class="skill-line"><span class="skill-category">Backend & Microservices:</span> Go (Echo, Gin, Chi), RESTful APIs, gRPC, JWT Authentication.</div>
<div class="skill-line"><span class="skill-category">Databases & Storage:</span> PostgreSQL (CTEs, indexing), Redis, MongoDB.</div>
<div class="skill-line"><span class="skill-category">Cloud, DevOps & QA:</span> Docker, Kubernetes, GitHub Actions, Vitest, Playwright.</div>"#
            )
        };

        // Construct contact items dynamically
        let mut contact_items = Vec::new();
        if !profile.personal.location.is_empty() {
            contact_items.push(format!("<span>{}</span>", html_escape(&profile.personal.location)));
        }
        if !profile.personal.phone.is_empty() {
            contact_items.push(format!("<span>{}</span>", html_escape(&profile.personal.phone)));
        }
        if !profile.personal.email.is_empty() {
            contact_items.push(format!("<span>{}</span>", html_escape(&profile.personal.email)));
        }
        if !profile.personal.linkedin.is_empty() {
            let label = profile.personal.linkedin.trim_start_matches("https://").trim_start_matches("http://").trim_end_matches('/');
            contact_items.push(format!("<a href=\"{}\">{}</a>", html_escape(&profile.personal.linkedin), html_escape(label)));
        }
        if !profile.personal.github.is_empty() {
            let label = profile.personal.github.trim_start_matches("https://").trim_start_matches("http://").trim_end_matches('/');
            contact_items.push(format!("<a href=\"{}\">{}</a>", html_escape(&profile.personal.github), html_escape(label)));
        }
        if !profile.personal.portfolio.is_empty() {
            let label = profile.personal.portfolio.trim_start_matches("https://").trim_start_matches("http://").trim_end_matches('/');
            contact_items.push(format!("<a href=\"{}\">{}</a>", html_escape(&profile.personal.portfolio), html_escape(label)));
        }
        let contact_html = contact_items.join("<span>•</span>");

        // Construct Dynamic Featured Projects
        let mut projects_html = String::new();
        for proj in profile.projects.iter().take(3) {
            let link_or_category = if let Some(ref u) = proj.url {
                let display_url = u.trim_start_matches("https://").trim_start_matches("http://");
                format!("{} | {}", proj.category.as_deref().unwrap_or("Production Project"), display_url)
            } else {
                proj.category.as_deref().unwrap_or("Production Project").to_string()
            };

            let bullet = if !proj.description.is_empty() {
                format!("<li>{}</li>", html_escape(&proj.description))
            } else {
                String::new()
            };

            projects_html.push_str(&format!(
                r#"<div class="experience-item">
      <div class="item-header">
        <div><span class="job-title">{}</span></div>
        <div class="date-location">{}</div>
      </div>
      <ul class="bullets">
        {}
      </ul>
    </div>"#,
                html_escape(&proj.title),
                html_escape(&link_or_category),
                bullet
            ));
        }

        // Construct Dynamic Experience Items
        let mut experience_html = String::new();
        for exp in &profile.experience {
            let loc = exp.location.as_deref().unwrap_or("");
            let date_loc = if !loc.is_empty() {
                format!("{} – {} | {}", exp.start_date, exp.end_date, loc)
            } else {
                format!("{} – {}", exp.start_date, exp.end_date)
            };

            let mut bullets = String::new();
            for hl in &exp.highlights {
                bullets.push_str(&format!("<li>{}</li>\n", html_escape(hl)));
            }

            experience_html.push_str(&format!(
                r#"<div class="experience-item">
      <div class="item-header">
        <div><span class="job-title">{}</span> — <span class="company-name">{}</span></div>
        <div class="date-location">{}</div>
      </div>
      <ul class="bullets">
        {}
      </ul>
    </div>"#,
                html_escape(&exp.role),
                html_escape(&exp.company),
                html_escape(&date_loc),
                bullets
            ));
        }

        // Construct Dynamic Education
        let mut education_html = String::new();
        for edu in &profile.education {
            let dates = match (&edu.start_date, &edu.end_date) {
                (Some(s), Some(e)) => format!("{} – {}", s, e),
                (Some(s), None) => s.clone(),
                (None, Some(e)) => e.clone(),
                (None, None) => String::new(),
            };
            let gpa_str = edu.gpa.as_deref().map(|g| format!("GPA: {}", g)).unwrap_or_default();
            let mut sub_parts = Vec::new();
            if !dates.is_empty() {
                sub_parts.push(dates);
            }
            if !gpa_str.is_empty() {
                sub_parts.push(gpa_str);
            }
            let sub = sub_parts.join(" | ");

            education_html.push_str(&format!(
                r#"<div class="education-item">
      <div><span class="job-title">{} ({})</span> — <span class="company-name">{}</span></div>
      <div class="date-location">{}</div>
    </div>"#,
                html_escape(&edu.degree),
                html_escape(&edu.field),
                html_escape(&edu.institution),
                html_escape(&sub)
            ));
        }

        let full_name_escaped = html_escape(&profile.personal.full_name);
        let title_escaped = html_escape(title);

        Ok(format!(
            r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{full_name_escaped} - {title_escaped} Resume</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Open+Sans:ital,wght@0,400;0,600;0,700;1,400&display=swap');
    @page {{ size: A4; margin: 10mm 14mm; }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
      color: #111111; background: #ffffff; line-height: 1.35; font-size: 9pt;
    }}
    .header {{ text-align: center; margin-bottom: 8px; }}
    .name {{ font-size: 17pt; font-weight: 700; letter-spacing: 0.5px; color: #000000; margin-bottom: 2px; text-transform: uppercase; }}
    .role-title {{ font-size: 10.5pt; font-weight: 600; color: #222222; margin-bottom: 4px; }}
    .contact-info {{ font-size: 8.5pt; color: #333333; display: flex; justify-content: center; flex-wrap: wrap; gap: 10px; }}
    .contact-info a {{ color: #111111; text-decoration: none; }}
    .section {{ margin-top: 8px; }}
    .section-title {{ font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #000000; border-bottom: 1px solid #111111; padding-bottom: 2px; margin-bottom: 5px; }}
    .summary-text {{ font-size: 8.5pt; color: #222222; text-align: justify; line-height: 1.4; }}
    .skills-grid {{ display: flex; flex-direction: column; gap: 2px; }}
    .skill-line {{ font-size: 8.5pt; line-height: 1.35; }}
    .skill-category {{ font-weight: 700; color: #000000; }}
    .experience-item {{ margin-bottom: 6px; }}
    .item-header {{ display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 1px; }}
    .job-title {{ font-size: 9.5pt; font-weight: 700; color: #000000; }}
    .company-name {{ font-weight: 600; color: #222222; }}
    .date-location {{ font-size: 8.5pt; font-style: italic; color: #333333; }}
    ul.bullets {{ list-style-type: disc; padding-left: 15px; margin-top: 1px; }}
    ul.bullets li {{ font-size: 8.5pt; color: #222222; line-height: 1.35; margin-bottom: 1px; }}
    .education-item {{ display: flex; justify-content: space-between; align-items: baseline; }}
  </style>
</head>
<body>
  <div class="header">
    <div class="name">{full_name_escaped}</div>
    <div class="role-title">{headline_role}</div>
    <div class="contact-info">
      {contact_html}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Professional Summary</div>
    <p class="summary-text">{summary_text}</p>
  </div>

  <div class="section">
    <div class="section-title">Technical Skills</div>
    <div class="skills-grid">
      {skills_block}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Featured Production Projects</div>
    {projects_html}
  </div>

  <div class="section">
    <div class="section-title">Professional Experience</div>
    {experience_html}
  </div>

  <div class="section">
    <div class="section-title">Education</div>
    {education_html}
  </div>
</body>
</html>"#
        ))
    }
}
