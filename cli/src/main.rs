mod agent_bridge;
mod browser_cdp;
mod cli_commands;
mod daily_scheduler;
mod job_application;
mod job_crawling;
mod job_triage;
mod screening_qa;
mod storage;

use anyhow::Result;
use clap::Parser;
use cli_commands::{Cli, CommandRunner, Commands};

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Direct fallback flags (--once, --status, etc.)
    if cli.once {
        return CommandRunner::run_schedule(cli_commands::args::ScheduleArgs {
            once: true,
            daemon: false,
            force: cli.force,
        })
        .await;
    }

    match cli.command {
        Some(Commands::Status) => CommandRunner::run_status().await?,
        Some(Commands::AgentDiagnose(args)) => {
            CommandRunner::run_agent_diagnose(args.model).await?
        }
        Some(Commands::Schedule(args)) => CommandRunner::run_schedule(args).await?,
        Some(Commands::Explore(args)) => CommandRunner::run_explore(args).await?,
        Some(Commands::Apply(_args)) => {
            // Apply subcommand logic
            println!("[APPLY] Executing crawl & apply session...");
            CommandRunner::run_schedule(cli_commands::args::ScheduleArgs {
                once: true,
                daemon: false,
                force: cli.force,
            })
            .await?;
        }
        None => {
            // Default action if no subcommand is given: output status
            CommandRunner::run_status().await?;
        }
    }

    Ok(())
}
