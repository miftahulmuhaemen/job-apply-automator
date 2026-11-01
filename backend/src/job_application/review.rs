use super::model::{ApplicationPayload, SubmissionDecision};
use std::io::{self, Write};

pub struct ReviewInspector;

impl ReviewInspector {
    pub fn prompt_confirmation(payload: &ApplicationPayload, bailout_only: bool) -> SubmissionDecision {
        println!("{}", "━".repeat(70));
        println!("[PRE-SUBMISSION AUDIT & REVIEW GATE]");
        println!("{}", "━".repeat(70));
        println!("Company      : {}", payload.company);
        println!("Role Title   : {}", payload.title);
        println!("Portal       : {}", payload.portal);
        println!("Location     : {}", payload.location.as_deref().unwrap_or("Unspecified"));
        println!("Salary       : {}", payload.salary.as_deref().unwrap_or("Undisclosed"));
        println!("URL          : {}", payload.url);
        if let Some(ref path) = payload.resume_path {
            println!("Attached PDF : {}", path);
        }
        println!("{}", "━".repeat(70));

        if bailout_only {
            println!("[POLICY] Running in Safe Preview mode (--dry-run / --bailout).");
            println!("[DECISION] Automatically bailing out without clicking submit.");
            return SubmissionDecision::Bailout;
        }

        print!("Submit application to {}? (y/N): ", payload.company);
        let _ = io::stdout().flush();

        let mut input = String::new();
        if io::stdin().read_line(&mut input).is_ok() {
            let choice = input.trim().to_lowercase();
            if choice == "y" || choice == "yes" {
                println!("[DECISION] User confirmed. Submitting application.");
                return SubmissionDecision::Submit;
            }
        }

        println!("[DECISION] Application bailed out by user.");
        SubmissionDecision::Bailout
    }
}
