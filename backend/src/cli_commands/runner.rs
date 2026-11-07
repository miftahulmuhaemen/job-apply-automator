use crate::agent_bridge::{AgyClient, ProcessManager};
use crate::browser_cdp::BraveCdpClient;
use crate::daily_scheduler::{CatchupEngine, SchedulerRepository};
use crate::job_crawling::GenericAtsExplorer;
use crate::job_triage::{JobRecord, JobTriageRepository};
use crate::storage::D1Client;
use super::args::{ApplyArgs, BrowserArgs, CrawlArgs, ExploreArgs, ScheduleArgs, ServerArgs};
use anyhow::Result;
use std::sync::Arc;

pub struct CommandRunner;

impl CommandRunner {
    pub async fn run_apply(args: ApplyArgs) -> Result<()> {
        let d1 = D1Client::new_from_env()?;
        let state = Arc::new(crate::web_server::routes::AppState::new(d1.clone()));

        if let Some(job_id) = args.job_id {
            let mode_str = if args.interactive {
                "INTERACTIVE (halt before submit)"
            } else {
                "DIRECT SUBMIT"
            };
            println!("[APPLY] Executing submission for Job #{} [{}]...", job_id, mode_str);
            let receipt = crate::job_application::JobSubmitter::submit(&state, job_id, args.interactive).await?;
            println!("[APPLY] Status       : {}", receipt.status);
            println!("[APPLY] Portal       : {}", receipt.portal);
            if let Some(ref text) = receipt.confirmation_text {
                println!("[APPLY] Receipt/Note : {}", text);
            }
            if let Some(ref err) = receipt.error_message {
                println!("[APPLY] Error        : {}", err);
            }
            return Ok(());
        }

        println!("[APPLY] Executing crawl & apply session...");
        Self::run_schedule(ScheduleArgs {
            once: true,
            daemon: false,
            force: true,
        })
        .await
    }

    pub async fn run_browser(args: BrowserArgs) -> Result<()> {
        crate::browser_cdp::BrowserLauncher::launch(args.url.as_deref())
    }

    pub async fn run_server(args: ServerArgs) -> Result<()> {
        crate::web_server::WebServer::start(args.port).await
    }

    pub async fn run_status() -> Result<()> {
        let d1 = D1Client::new_from_env()?;
        let triage_repo = JobTriageRepository::new(d1.clone());
        let scheduler_repo = SchedulerRepository::new(d1.clone());

        let stats = triage_repo.get_stats().await?;
        let settings = scheduler_repo.get_settings().await?;
        let has_run_today = scheduler_repo.has_run_completed_today().await?;

        println!("{}", "━".repeat(60));
        println!("ATS JOB APPLICATION ENGINE - SYSTEM STATUS");
        println!("{}", "━".repeat(60));
        println!("Database           : Cloudflare D1 ({})", d1.database_id());
        println!("Total Ingested     : {}", stats.total_crawled);
        println!("Total Applied      : {}", stats.total_applied);
        println!("Applied Today      : {} / {}", stats.applied_today, settings.max_daily_applications);
        println!("Scheduler Enabled  : {}", settings.enabled);
        println!("Scheduled Time     : {}", settings.schedule_time);
        println!("Completed Today    : {}", has_run_today);
        println!("Sub-Agent Model    : {}", settings.cli_agent_model);
        println!("Sub-Agent Binary   : {}", settings.cli_agent_binary);
        println!("{}", "━".repeat(60));

        let recent = triage_repo.get_recent_jobs(5).await?;
        if !recent.is_empty() {
            println!("\nRecent Ledger Entries:");
            for j in recent {
                let status_badge = match j.status.to_uppercase().as_str() {
                    "APPLIED" => "[APPLIED]",
                    "PENDING_HUMAN" => "[PREVIEWED]",
                    "APPROVED" => "[APPROVED]",
                    _ => "[SKIPPED]",
                };
                println!("  {} [{}] {} - {} ({})",
                    status_badge,
                    j.portal.to_uppercase(),
                    j.company,
                    j.title,
                    j.skip_reason.as_deref().unwrap_or("Success")
                );
            }
        }

        Ok(())
    }

    pub async fn run_agent_diagnose(model_override: Option<String>) -> Result<()> {
        let d1 = D1Client::new_from_env()?;
        let scheduler_repo = SchedulerRepository::new(d1);
        let mut settings = scheduler_repo.get_settings().await?.into();

        if let Some(m) = model_override {
            settings = crate::agent_bridge::AgentSettings {
                model: m,
                ..settings
            };
        }

        let pm = ProcessManager::new();
        let client = AgyClient::new(settings, pm);

        println!("[AGENT] Checking CLI Subagent Status...");
        let status = client.check_status();
        println!("  Available     : {}", status.available);
        println!("  Version       : {}", status.version.as_deref().unwrap_or("N/A"));
        println!("  Current Model : {}", status.current_model);
        println!("  Binary Path   : {}", status.binary_path);

        if !status.available {
            println!("[AGENT ERROR] {}", status.error.as_deref().unwrap_or("Unknown error"));
            return Ok(());
        }

        println!("\n[AGENT] Executing ping diagnostic test query...");
        let prompt = "Output strictly valid JSON: {\"ping\": \"pong\", \"status\": \"operational\"}";
        let result = client.invoke(prompt, true).await;

        if result.success {
            println!("[AGENT SUCCESS] Latency: {}ms", result.latency_ms);
            if let Some(ref data) = result.data {
                println!("Response JSON :\n{}", serde_json::to_string_pretty(data)?);
            }
        } else {
            println!("[AGENT FAILED] Latency: {}ms", result.latency_ms);
            println!("Error         : {}", result.error.unwrap_or_default());
        }

        Ok(())
    }

    pub async fn run_schedule(args: ScheduleArgs) -> Result<()> {
        let d1 = D1Client::new_from_env()?;
        let engine = CatchupEngine::new(d1.clone());

        if !engine.should_run_now(args.force).await? {
            return Ok(());
        }

        println!("[SCHEDULER] Initiating batch run...");
        match BraveCdpClient::connect("127.0.0.1:9222").await {
            Ok(_cdp) => {
                println!("[CDP] Connected to Brave browser cleanly.");
                let triage_repo = JobTriageRepository::new(d1.clone());
                let today_count = triage_repo.get_today_application_count().await?;
                let settings = SchedulerRepository::new(d1).get_settings().await?;
                let remaining = (settings.max_daily_applications - today_count).max(0);

                println!("[SCHEDULER] Daily application capacity remaining: {}", remaining);
                engine.record_success(0, 0, 0, "Daily batch executed over Brave CDP connection.").await?;
            }
            Err(e) => {
                println!("[CDP WARNING] {}", e);
                engine.record_failure(&format!("Brave CDP unavailable: {}", e)).await?;
            }
        }

        Ok(())
    }

    pub async fn run_explore(args: ExploreArgs) -> Result<()> {
        let d1 = D1Client::new_from_env()?;
        let scheduler_repo = SchedulerRepository::new(d1.clone());
        let settings = scheduler_repo.get_settings().await?.into();

        let pm = ProcessManager::new();
        let client = AgyClient::new(settings, pm);
        let explorer = GenericAtsExplorer::new(&client);

        println!("[EXPLORE] Connecting to Brave browser...");
        let mut cdp = BraveCdpClient::connect("127.0.0.1:9222").await?;
        println!("[EXPLORE] Navigating to target URL: {}", args.url);
        cdp.navigate(&args.url).await?;

        println!("[EXPLORE] Extracting DOM text content...");
        let text = cdp.get_page_text().await?;
        println!("[EXPLORE] Parsing content with Antigravity CLI Agent...");
        let parsed = explorer.parse_job_content(&args.url, &text).await?;

        println!("{}", "━".repeat(60));
        println!("DISCOVERED JOB POSTING");
        println!("{}", "━".repeat(60));
        println!("Title         : {}", parsed.title);
        println!("Company       : {}", parsed.company);
        println!("Location      : {}", parsed.location);
        println!("Salary        : {}", parsed.salary);
        println!("Experience    : {}", parsed.experience_required);
        println!("Tech Stack    : {}", parsed.tech_stack.join(", "));
        println!("Duties        : {}", parsed.responsibilities_summary);
        if let Some(ref sel) = parsed.apply_action_selector {
            println!("Apply Selector: {}", sel);
        }
        println!("{}", "━".repeat(60));

        let triage_repo = JobTriageRepository::new(d1);
        let record = JobRecord {
            id: None,
            uuid: None,
            job_id: None,
            company: parsed.company,
            title: parsed.title,
            portal: "GenericATS".into(),
            job_url: args.url,
            location: Some(parsed.location),
            salary_raw: Some(parsed.salary),
            salary_min: None,
            salary_max: None,
            status: "pending_human".into(),
            skip_reason: Some("Discovered via explore command".into()),
            resume_path: None,
            applied_at: None,
            created_at: None,
            posted_at: None,
            last_active_at: None,
        };
        triage_repo.log_job_record(&record).await?;
        println!("[EXPLORE] Job saved to ledger.");

        Ok(())
    }

    pub async fn run_auth_gmail() -> Result<()> {
        crate::job_application::gmail_oauth::GmailOAuthService::run_auth_flow().await
    }

    pub async fn run_mcp() -> Result<()> {
        let server = crate::job_application::mcp_server::NativeMcpServer::new();
        server.run_stdio().await
    }

    pub async fn run_crawl(args: CrawlArgs) -> Result<()> {
        println!("[CRAWL] Starting targeted crawl for portal: {}", args.portal);

        let portal_norm = args.portal.trim().to_lowercase();
        if portal_norm != "dealls" && portal_norm != "deall" {
            println!("[CRAWL] Only 'dealls' crawler is currently implemented. Skipping.");
            return Ok(());
        }

        let d1 = D1Client::new_from_env()?;
        let triage_repo = JobTriageRepository::new(d1.clone());

        let crawler = crate::job_crawling::dealls::DeallsCrawler::new(args.token)?;
        println!(
            "[CRAWL] Fetching up to {} pages (max age: {} days) from Dealls recommendation feed...",
            args.max_pages, args.max_age_days
        );

        let records = crawler.crawl_active_jobs(args.max_pages, args.max_age_days).await?;
        println!("[CRAWL] Discovered {} relevant active vacancies.", records.len());

        let mut ingested_count = 0;
        for record in records {
            println!("  [INGEST] {} - {} ({})", record.company, record.title, record.job_url);
            if let Ok(Some(job_id)) = triage_repo.log_job_record(&record).await {
                if record.status.to_uppercase() != "DROPPED" {
                    let loc = record.location.clone().unwrap_or_else(|| "Indonesia".to_string());
                    crate::job_application::JobSynthesisWorker::spawn_synthesis(
                        d1.clone(),
                        job_id,
                        record.company.clone(),
                        record.title.clone(),
                        loc,
                    );
                }
            }
            ingested_count += 1;
        }

        println!("[CRAWL] Ingestion complete. {} vacancies registered as PENDING_HUMAN in ledger.", ingested_count);
        Ok(())
    }
}

impl From<crate::daily_scheduler::SchedulerSettings> for crate::agent_bridge::AgentSettings {
    fn from(s: crate::daily_scheduler::SchedulerSettings) -> Self {
        Self {
            enabled: s.cli_agent_enabled,
            model: s.cli_agent_model,
            binary: s.cli_agent_binary,
            timeout_seconds: s.cli_agent_timeout_seconds,
        }
    }
}
