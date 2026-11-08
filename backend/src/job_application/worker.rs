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
            let _ = Self::compile_portfolio_pdf(&company, &title, &profile);

            // Mark job status as READY in ledger
            let decision = if write_ok {
                triage_decision::READY
            } else {
                triage_decision::KEEP
            };

            let _ = ledger_repo.update_triage_decision(job_id, decision, None).await;
        })
    }

    /// Normalizes role titles to strictly represent the role/level without technology parentheticals or location suffixes.
    pub fn sanitize_role_title(title: &str) -> String {
        let mut clean = if let Some(idx) = title.find('(') {
            &title[..idx]
        } else {
            title
        };
        if let Some(idx) = clean.find(" - ") {
            clean = &clean[..idx];
        }
        if let Some(idx) = clean.find(" | ") {
            clean = &clean[..idx];
        }
        let clean = clean.trim();
        let lower = clean.to_lowercase();

        if lower.contains("devops") || lower.contains("infrastructure") || lower.contains("platform") {
            "DevOps Engineer".to_string()
        } else if lower.contains("data engineer") || lower == "data" {
            "Data Engineer".to_string()
        } else if lower.contains("frontend") || lower.contains("front-end") || lower.contains("front end") || lower.contains("ui engineer") {
            if lower.contains("senior") || lower.contains("lead") {
                "Senior Frontend Engineer".to_string()
            } else {
                "Frontend Engineer".to_string()
            }
        } else if lower.contains("backend") || lower.contains("back-end") || lower.contains("back end") {
            if lower.contains("senior") || lower.contains("lead") || lower.contains("staff") {
                "Senior Backend Engineer".to_string()
            } else {
                "Backend Engineer".to_string()
            }
        } else if lower.contains("fullstack") || lower.contains("full-stack") || lower.contains("full stack") {
            if lower.contains("senior") || lower.contains("lead") {
                "Senior Fullstack Developer".to_string()
            } else {
                "Fullstack Developer".to_string()
            }
        } else if lower.contains("software engineer") {
            if lower.contains("senior") || lower.contains("lead") || lower.contains("staff") {
                "Senior Software Engineer".to_string()
            } else {
                "Software Engineer".to_string()
            }
        } else if !clean.is_empty() {
            clean.to_string()
        } else {
            "Fullstack Developer".to_string()
        }
    }

    pub fn render_portfolio_html(_company: &str, title: &str, profile: &CandidateProfile) -> anyhow::Result<String> {
        let headline_role = Self::sanitize_role_title(title);
        let full_name_escaped = html_escape(&profile.personal.full_name);

        let mut contact_items = Vec::new();
        if !profile.personal.location.is_empty() {
            contact_items.push(format!("<span class=\"contact-item\">{}</span>", html_escape(&profile.personal.location)));
        }
        if !profile.personal.phone.is_empty() {
            contact_items.push(format!("<span class=\"contact-item\">{}</span>", html_escape(&profile.personal.phone)));
        }
        if !profile.personal.email.is_empty() {
            contact_items.push(format!("<span class=\"contact-item\">{}</span>", html_escape(&profile.personal.email)));
        }
        if !profile.personal.portfolio.is_empty() {
            let label = profile.personal.portfolio.trim_start_matches("https://").trim_start_matches("http://").trim_end_matches('/');
            contact_items.push(format!("<span class=\"contact-item\"><a href=\"{}\">{}</a></span>", html_escape(&profile.personal.portfolio), html_escape(label)));
        }
        if !profile.personal.github.is_empty() {
            let label = profile.personal.github.trim_start_matches("https://").trim_start_matches("http://").trim_end_matches('/');
            contact_items.push(format!("<span class=\"contact-item\"><a href=\"{}\">{}</a></span>", html_escape(&profile.personal.github), html_escape(label)));
        }
        if !profile.personal.linkedin.is_empty() {
            let label = profile.personal.linkedin.trim_start_matches("https://").trim_start_matches("http://").trim_end_matches('/');
            contact_items.push(format!("<span class=\"contact-item\"><a href=\"{}\">{}</a></span>", html_escape(&profile.personal.linkedin), html_escape(label)));
        }
        let contact_bar = contact_items.join("<span class=\"sep\">|</span>");

        let flagship = profile.projects.first();
        let (flagship_title, flagship_date, flagship_stack, _flagship_desc) = if let Some(p) = flagship {
            (
                p.title.as_str(),
                if p.date.is_empty() { "Oct 2026" } else { p.date.as_str() },
                p.tech_stack.join(", "),
                p.description.as_str()
            )
        } else {
            (
                "Point of Sale & Inventory System (Koperasi KHMB)",
                "Oct 2026",
                "Go, Echo, React, TypeScript, Vite, PostgreSQL, Tailwind CSS, Docker, IndexedDB, WebSerial ESC/POS".to_string(),
                "Production offline-first Point of Sale and inventory platform pairing a high-throughput Go backend with a responsive React/TypeScript client."
            )
        };

        let mut other_projects_html = String::new();
        for p in profile.projects.iter().skip(1).take(2) {
            let stack_str = p.tech_stack.join(", ");
            other_projects_html.push_str(&format!(
                r#"<div class="project-card" style="margin-bottom: 0;">
      <div class="project-header">
        <div class="project-title">{}</div>
        <div class="project-date">{}</div>
      </div>
      <div class="tech-stack-line">
        <strong>Tech Stack:</strong> {}
      </div>
      <p style="font-size: 8pt; color: #27272a; line-height: 1.35;">{}</p>
    </div>"#,
                html_escape(&p.title),
                html_escape(&p.date),
                html_escape(&stack_str),
                html_escape(&p.description)
            ));
        }

        Ok(format!(
            r#"<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>{full_name_escaped} - Engineering Portfolio</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    @page {{ size: A4; margin: 12mm 16mm; }}
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
      color: #18181b; background: #ffffff; line-height: 1.4; font-size: 8.5pt;
    }}
    .header {{ border-bottom: 2px solid #18181b; padding-bottom: 6px; margin-bottom: 8px; }}
    .candidate-name {{ font-size: 16pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #09090b; }}
    .portfolio-tag {{ font-size: 9.5pt; font-weight: 600; color: #3f3f46; margin-top: 2px; }}
    .contact-bar {{ font-size: 8pt; color: #52525b; display: flex; flex-wrap: wrap; gap: 6px 10px; margin-bottom: 12px; line-height: 1.4; }}
    .contact-item {{ white-space: nowrap; }}
    .contact-bar a {{ color: #18181b; text-decoration: none; font-weight: 500; }}
    .sep {{ color: #a1a1aa; }}
    .section-title {{
      font-size: 9.5pt; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;
      color: #09090b; border-bottom: 1px solid #e4e4e7; padding-bottom: 3px; margin-bottom: 8px; margin-top: 10px;
    }}
    .project-card {{ border: 1px solid #e4e4e7; border-radius: 4px; padding: 9px 12px; margin-bottom: 10px; background: #ffffff; }}
    .project-header {{ display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 3px; }}
    .project-title {{ font-size: 9.5pt; font-weight: 700; color: #09090b; }}
    .project-date {{ font-size: 8pt; font-weight: 600; color: #71717a; }}
    .tech-stack-line {{ font-size: 8pt; color: #3f3f46; margin-bottom: 6px; line-height: 1.35; }}
    .tech-stack-line strong {{ color: #09090b; }}
    ul.project-bullets {{ padding-left: 14px; margin: 0; }}
    ul.project-bullets li {{ font-size: 8pt; color: #27272a; line-height: 1.35; margin-bottom: 3px; }}
    ul.project-bullets li strong {{ color: #09090b; }}
    .grid-two {{ display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }}
    .meta-box {{ border: 1px solid #e4e4e7; border-radius: 4px; padding: 8px 10px; background: #ffffff; }}
    .meta-box-title {{ font-size: 8.5pt; font-weight: 700; color: #09090b; margin-bottom: 2px; }}
    .meta-box-sub {{ font-size: 7.5pt; color: #71717a; margin-bottom: 4px; }}
    .meta-box-desc {{ font-size: 7.5pt; color: #3f3f46; line-height: 1.3; }}
  </style>
</head>
<body>
  <div class="header">
    <div class="candidate-name">{full_name_escaped}</div>
    <div class="portfolio-tag">Software Engineering Portfolio • {headline_role}</div>
  </div>

  <div class="contact-bar">
    {contact_bar}
  </div>

  <div class="section-title">Flagship Production System</div>
  <div class="project-card">
    <div class="project-header">
      <div class="project-title">{flagship_title_escaped}</div>
      <div class="project-date">{flagship_date_escaped}</div>
    </div>
    <div class="tech-stack-line">
      <strong>Tech Stack:</strong> {flagship_stack_escaped}
    </div>
    <ul class="project-bullets">
      <li><strong>Offline-First Architecture &amp; State Sync:</strong> Cashier client with IndexedDB local persistence. Local transactions process instantly without network roundtrips; background delta workers flush queued sales batches with idempotency keys, eliminating duplicate deductions during network drops.</li>
      <li><strong>High-Performance Backend Services:</strong> Clean service/repository architecture. Implemented PostgreSQL single-pass Common Table Expressions (CTEs) for daily stock pre-aggregation, slashing query latency on historical reports by over 70%.</li>
      <li><strong>Hardware Integration &amp; Peripherals:</strong> Global keystroke-interception heuristics differentiate human keyboard typing from high-speed USB/Bluetooth barcode scanner HID bursts. Implemented direct ESC/POS thermal printing over WebSerial and WebUSB with zero UI lag.</li>
      <li><strong>Role-Based Access Control (RBAC):</strong> Strict boundary enforcement isolating cashier terminal from back-office management. Wholesale cost margins and audit trails are inaccessible to cashier tokens.</li>
      <li><strong>Testing &amp; Observability:</strong> Table-driven unit tests, frontend hook specs, Playwright E2E validation, and structured error tracking with logging telemetry.</li>
    </ul>
  </div>

  <div class="section-title">Production Web Applications &amp; Distributed Systems</div>
  <div class="grid-two">
    {other_projects_html}
  </div>

  <div class="section-title">Verified Cloud &amp; Engineering Credentials</div>
  <div class="grid-two">
    <div class="meta-box">
      <div class="meta-box-title">AWS Certified Cloud Practitioner</div>
      <div class="meta-box-sub">Amazon Web Services</div>
      <div class="meta-box-desc">Cloud infrastructure design, VPC networking, IAM security policies, and AWS managed container services.</div>
    </div>
    <div class="meta-box">
      <div class="meta-box-title">Associate Data Engineer</div>
      <div class="meta-box-sub">DataCamp</div>
      <div class="meta-box-desc">Production SQL, relational schema normalization, ETL pipeline orchestration, and PostgreSQL performance profiling.</div>
    </div>
  </div>
</body>
</html>"#,
            full_name_escaped = full_name_escaped,
            headline_role = html_escape(&headline_role),
            contact_bar = contact_bar,
            flagship_title_escaped = html_escape(flagship_title),
            flagship_date_escaped = html_escape(flagship_date),
            flagship_stack_escaped = html_escape(&flagship_stack),
            other_projects_html = other_projects_html
        ))
    }

    pub fn compile_portfolio_pdf(company: &str, title: &str, profile: &CandidateProfile) -> anyhow::Result<std::path::PathBuf> {
        let safe_comp = company.replace(|c: char| !c.is_alphanumeric(), "_");
        let safe_title = title.replace(|c: char| !c.is_alphanumeric(), "_");
        let assets_dir = std::path::PathBuf::from("data/assets");
        std::fs::create_dir_all(&assets_dir)?;
        let html_path = assets_dir.join(format!("{}_{}_Portfolio.html", safe_comp, safe_title));
        let target_pdf = assets_dir.join(format!("{}_{}_Portfolio.pdf", safe_comp, safe_title));

        let html_content = Self::render_portfolio_html(company, title, profile)?;
        std::fs::write(&html_path, &html_content)?;

        // Run headless Chrome to convert HTML to PDF
        let browsers = ["google-chrome", "chromium", "chromium-browser", "brave-browser"];
        let mut compiled = false;
        for browser in &browsers {
            let output = std::process::Command::new(browser)
                .args([
                    "--headless=new",
                    "--no-sandbox",
                    "--disable-gpu",
                    "--no-pdf-header-footer",
                    &format!("--print-to-pdf={}", target_pdf.to_string_lossy()),
                    html_path.to_str().unwrap_or(""),
                ])
                .output();

            if let Ok(out) = output {
                if out.status.success() && target_pdf.exists() {
                    compiled = true;
                    break;
                }
            }
        }

        if compiled {
            let canonical_pdf = assets_dir.join("portfolio.pdf");
            let _ = std::fs::copy(&target_pdf, &canonical_pdf);
            Ok(target_pdf)
        } else {
            let src_pdf = assets_dir.join("portfolio.pdf");
            if src_pdf.exists() && !target_pdf.exists() {
                let _ = std::fs::copy(&src_pdf, &target_pdf);
            }
            Ok(target_pdf)
        }
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

        let headline_role = Self::sanitize_role_title(title);
        let title_lower = headline_role.to_lowercase();
        let is_devops = title_lower.contains("devops");
        let is_data = title_lower.contains("data");
        let is_frontend = title_lower.contains("frontend") || title_lower.contains("front");
        let is_backend = title_lower.contains("backend") || title_lower.contains("back");

        let (summary_text, skills_block) = if is_devops {
            (
                format!(
                    "DevOps Engineer with 5+ years of software engineering experience administering cloud infrastructure, automating continuous delivery pipelines, and maintaining containerized deployment platforms. Proven track record standardizing infrastructure automation, implementing monitoring telemetry, and enhancing production resilience aligned with {}'s engineering standards.",
                    company
                ),
                r#"<div class="skill-line"><span class="skill-category">Cloud & Infrastructure:</span> Kubernetes, Docker, Linux Administration, Prometheus, Grafana.</div>
<div class="skill-line"><span class="skill-category">CI/CD & Automation:</span> GitHub Actions, Git, Shell Scripting, Automated Testing Pipelines.</div>
<div class="skill-line"><span class="skill-category">Languages & Storage:</span> Go, Python, SQL, PostgreSQL, Redis.</div>
<div class="skill-line"><span class="skill-category">Architecture & Security:</span> RESTful APIs, Microservices Architecture, Reverse Proxies, SSL/TLS.</div>"#
            )
        } else if is_data {
            (
                format!(
                    "Data Engineer with 5+ years of experience designing scalable data extraction pipelines, analytical ingestion architectures, and structured storage workflows. Proven track record optimizing ETL pipeline throughput, ensuring data integrity, and streamlining reporting workflows aligned with {}'s engineering standards.",
                    company
                ),
                r#"<div class="skill-line"><span class="skill-category">Languages & Pipelines:</span> Python, Go, SQL, Apache Airflow, Data Warehousing.</div>
<div class="skill-line"><span class="skill-category">Databases & Message Brokers:</span> PostgreSQL (CTEs, indexing), Redis, MongoDB, GCP Pub/Sub.</div>
<div class="skill-line"><span class="skill-category">Backend & Microservices:</span> Echo, Gin, RESTful APIs, gRPC, Distributed Systems.</div>
<div class="skill-line"><span class="skill-category">Cloud, DevOps & QA:</span> Docker, Kubernetes, GitHub Actions, Great Expectations, Metabase.</div>"#
            )
        } else if is_frontend {
            (
                format!(
                    "Frontend Engineer with 5+ years of experience engineering accessible, high-performance web applications, client-side state management, and responsive component architectures. Proven track record accelerating page load metrics, integrating complex browser APIs with backend services, and delivering polished user interfaces aligned with {}'s engineering standards.",
                    company
                ),
                r#"<div class="skill-line"><span class="skill-category">Languages:</span> TypeScript, JavaScript, HTML5, CSS3, Go, Python, SQL.</div>
<div class="skill-line"><span class="skill-category">Frontend Architecture:</span> React, Vite, Tailwind CSS, Next.js, IndexedDB, Svelte, WebSerial/WebUSB.</div>
<div class="skill-line"><span class="skill-category">Backend Integration:</span> RESTful APIs, gRPC, WebSocket, JWT Authentication.</div>
<div class="skill-line"><span class="skill-category">Testing & Tooling:</span> Docker, GitHub Actions, Vitest, Playwright, Chrome DevTools.</div>"#
            )
        } else if is_backend {
            (
                format!(
                    "Backend Engineer with 5+ years of professional engineering experience architecting high-throughput microservices, distributed system topologies, and resilient cloud infrastructure. Proven track record designing event-driven pipelines, optimizing transactional database schemas, and maintaining high-availability service reliability aligned with {}'s engineering standards.",
                    company
                ),
                r#"<div class="skill-line"><span class="skill-category">Languages:</span> Go, TypeScript, Python, SQL, JavaScript.</div>
<div class="skill-line"><span class="skill-category">Backend & Microservices:</span> Echo, Gin, Chi, RESTful APIs, gRPC, JWT Authentication, Distributed Systems.</div>
<div class="skill-line"><span class="skill-category">Databases & Storage:</span> PostgreSQL (CTEs, indexing), Redis, MongoDB, Schema Design.</div>
<div class="skill-line"><span class="skill-category">Cloud, DevOps & QA:</span> Docker, Kubernetes, Linux, GitHub Actions, CI/CD, Load Testing.</div>"#
            )
        } else {
            let role_noun = if headline_role.contains("Software Engineer") { "Software Engineer" } else { "Fullstack Developer" };
            (
                format!(
                    "{} with 5+ years of professional engineering experience delivering scalable web architectures, resilient services, and responsive user interfaces. Proven track record designing offline-tolerant state synchronization, optimizing database query pipelines, and deploying distributed containerized applications aligned with {}'s engineering standards.",
                    role_noun, company
                ),
                r#"<div class="skill-line"><span class="skill-category">Languages:</span> Go, TypeScript, JavaScript, Python, SQL, HTML5, CSS3.</div>
<div class="skill-line"><span class="skill-category">Frontend Architecture:</span> React, Vite, Tailwind CSS, Next.js, IndexedDB, Svelte.</div>
<div class="skill-line"><span class="skill-category">Backend & Services:</span> Echo, Gin, Chi, RESTful APIs, gRPC, JWT Authentication, Microservices.</div>
<div class="skill-line"><span class="skill-category">Databases & Storage:</span> PostgreSQL (CTEs, indexing), Redis, MongoDB, Schema Optimization.</div>
<div class="skill-line"><span class="skill-category">DevOps, Cloud & QA:</span> Docker, Kubernetes, Linux, GitHub Actions, CI/CD, Vitest, Playwright, k6.</div>"#
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
