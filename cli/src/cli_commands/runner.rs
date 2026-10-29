use crate::agent_bridge::{AgyClient, ProcessManager};
use crate::browser_cdp::BraveCdpClient;
use crate::daily_scheduler::{CatchupEngine, SchedulerRepository};
use crate::job_crawling::GenericAtsExplorer;
use crate::job_triage::{JobRecord, JobTriageRepository};
use crate::storage::DbPool;
use super::args::{ApplyArgs, Commands, ExploreArgs, ScheduleArgs};
use anyhow::Result;

pub struct CommandRunner;

impl CommandRunner {
    pub async fn run_status() -> Result<()> {
        let conn = DbPool::open()?;
        let triage_repo = JobTriageRepository::new(&conn);
        let scheduler_repo = SchedulerRepository::new(&conn);

        let stats = triage_repo.get_stats()?;
        let settings = scheduler_repo.get_settings()?;
        let has_run_today = scheduler_repo.has_run_completed_today()?;

        println!("{}", "━".repeat(60));
        println!("ATS JOB APPLICATION ENGINE - SYSTEM STATUS");
        println!("{}", "━".repeat(60));
        println!("Database           : {}", DbPool::get_db_path().display());
        println!("Total Ingested     : {}", stats.total_crawled);
        println!("Total Applied      : {}", stats.total_applied);
        println!("Applied Today      : {} / {}", stats.applied_today, settings.max_daily_applications);
        println!("Scheduler Enabled  : {}", settings.enabled);
        println!("Scheduled Time     : {}", settings.schedule_time);
        println!("Completed Today    : {}", has_run_today);
        println!("Sub-Agent Model    : {}", settings.cli_agent_model);
        println!("Sub-Agent Binary   : {}", settings.cli_agent_binary);
        println!("{}", "━".repeat(60));

        let recent = triage_repo.get_recent_jobs(5)?;
        if !recent.is_empty() {
            println!("\nRecent Ledger Entries:");
            for j in recent {
                let status_badge = match j.status.as_str() {
                    "applied" => "[APPLIED]",
                    "pending_human" => "[PREVIEWED]",
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
        let conn = DbPool::open()?;
        let scheduler_repo = SchedulerRepository::new(&conn);
        let mut settings = scheduler_repo.get_settings()?.into();

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
        let conn = DbPool::open()?;
        let engine = CatchupEngine::new(&conn);

        if !engine.should_run_now(args.force)? {
            return Ok(());
        }

        println!("[SCHEDULER] Initiating batch run...");
        // Check Brave connection
        match BraveCdpClient::connect("127.0.0.1:9222").await {
            Ok(_cdp) => {
                println!("[CDP] Connected to Brave browser cleanly.");
                let triage_repo = JobTriageRepository::new(&conn);
                let today_count = triage_repo.get_today_application_count()?;
                let settings = SchedulerRepository::new(&conn).get_settings()?;
                let remaining = (settings.max_daily_applications - today_count).max(0);

                println!("[SCHEDULER] Daily application capacity remaining: {}", remaining);
                engine.record_success(0, 0, 0, "Daily batch executed over Brave CDP connection.")?;
            }
            Err(e) => {
                println!("[CDP WARNING] {}", e);
                engine.record_failure(&format!("Brave CDP unavailable: {}", e))?;
            }
        }

        Ok(())
    }

    pub async fn run_explore(args: ExploreArgs) -> Result<()> {
        let conn = DbPool::open()?;
        let scheduler_repo = SchedulerRepository::new(&conn);
        let settings = scheduler_repo.get_settings()?.into();

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

        // Save into ledger
        let triage_repo = JobTriageRepository::new(&conn);
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
        };
        triage_repo.log_job_record(&record)?;
        println!("[EXPLORE] Job saved to ledger (data/amiya.db).");

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
