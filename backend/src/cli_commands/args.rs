use clap::{Args, Parser, Subcommand};

#[derive(Parser, Debug)]
#[command(
    name = "job-apply-cli",
    version = "1.0.0",
    about = "Native Rust ATS Job Apply Automator & Catch-Up Engine",
    long_about = "High-performance, lightweight native CLI for automated job ingestion, criteria filtering, sub-agent Q&A synthesis, and once-a-day schedule catch-up."
)]
pub struct Cli {
    #[command(subcommand)]
    pub command: Option<Commands>,

    /// Fallback flag for executing schedule catch-up directly
    #[arg(long)]
    pub once: bool,

    /// Force execution even if a run completed today
    #[arg(long)]
    pub force: bool,

    /// Safe preview without final submission
    #[arg(long)]
    pub dry_run: bool,
}

#[derive(Subcommand, Debug)]
pub enum Commands {
    /// Execute manual crawl and application session
    Apply(ApplyArgs),

    /// Run targeted crawler for supported portals (e.g. dealls)
    Crawl(CrawlArgs),

    /// Run the daily scheduler catch-up engine
    Schedule(ScheduleArgs),

    /// Check Antigravity CLI (agy) subagent connectivity & latency
    AgentDiagnose(AgentDiagnoseArgs),

    /// Output current ledger statistics and quota consumption
    Status,

    /// Start embedded Axum web server and serve REST API & static assets
    Server(ServerArgs),

    /// Ingest and parse an unfamiliar job URL with the sub-agent
    Explore(ExploreArgs),

    /// Launch desktop Brave/Chrome browser with remote debugging port 9222
    Browser(BrowserArgs),

    /// Perform Google SSO to authorize Gmail API access
    AuthGmail,

    /// Run stdio MCP server exposing email tools to AI agents
    Mcp,
}

#[derive(Args, Debug)]
pub struct BrowserArgs {
    /// Optional target URL to navigate to upon launch
    #[arg(short, long)]
    pub url: Option<String>,
}

#[derive(Args, Debug)]
pub struct ServerArgs {
    /// Port to listen on (default: 3100)
    #[arg(long, default_value = "3100")]
    pub port: u16,
}

#[derive(Args, Debug)]
pub struct ApplyArgs {
    /// Safe preview & bailout without final submission
    #[arg(long)]
    pub dry_run: bool,

    /// Automatically submit without prompting
    #[arg(long)]
    pub auto_submit: bool,

    /// Specific target portal (e.g. Jobstreet, LinkedIn)
    #[arg(long)]
    pub portal: Option<String>,

    /// Specific job ID to apply for
    #[arg(long)]
    pub job_id: Option<i64>,

    /// Interactive mode: stop right before final submission
    #[arg(long)]
    pub interactive: bool,
}

#[derive(Args, Debug)]
pub struct ScheduleArgs {
    /// Run once for daily catch-up check and exit immediately
    #[arg(long)]
    pub once: bool,

    /// Keep running as a continuous background interval daemon
    #[arg(long)]
    pub daemon: bool,

    /// Force execution even if a run completed earlier today
    #[arg(long)]
    pub force: bool,
}

#[derive(Args, Debug)]
pub struct AgentDiagnoseArgs {
    /// Target model to test (defaults to configured model)
    #[arg(long)]
    pub model: Option<String>,
}

#[derive(Args, Debug)]
pub struct CrawlArgs {
    /// Specific portal to crawl (defaults to dealls)
    #[arg(short, long, default_value = "dealls")]
    pub portal: String,

    /// Maximum pages to traverse (defaults to 5)
    #[arg(long, default_value = "5")]
    pub max_pages: i64,

    /// Maximum age in days for vacancies (defaults to 7)
    #[arg(long, default_value = "7")]
    pub max_age_days: i64,

    /// Optional explicit JWT bearer token (if omitted, extracted from active CDP session)
    #[arg(long)]
    pub token: Option<String>,
}

#[derive(Args, Debug)]
pub struct ExploreArgs {
    /// Target job posting URL to analyze
    #[arg(required = true)]
    pub url: String,
}
