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

    /// Run the daily scheduler catch-up engine
    Schedule(ScheduleArgs),

    /// Check Antigravity CLI (agy) subagent connectivity & latency
    AgentDiagnose(AgentDiagnoseArgs),

    /// Output current ledger statistics and quota consumption
    Status,

    /// Ingest and parse an unfamiliar job URL with the sub-agent
    Explore(ExploreArgs),
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
pub struct ExploreArgs {
    /// Target job posting URL to analyze
    #[arg(required = true)]
    pub url: String,
}
