use crate::agent_bridge::AgyClient;
use super::model::{FormFieldMapping, ParsedJobListing};
use anyhow::{anyhow, Result};
use serde_json::Value;

pub struct GenericAtsExplorer<'a> {
    agent: &'a AgyClient,
}

impl<'a> GenericAtsExplorer<'a> {
    pub fn new(agent: &'a AgyClient) -> Self {
        Self { agent }
    }

    pub async fn parse_job_content(&self, page_url: &str, content_snippet: &str) -> Result<ParsedJobListing> {
        let max_snippet = if content_snippet.len() > 8000 {
            &content_snippet[..8000]
        } else {
            content_snippet
        };

        let prompt = format!(
            r#"You are an automated ATS Job Ingestion Agent. Analyze the webpage content from URL: {}.
Extract the job information and return ONLY a valid JSON object matching this schema:
{{
  "title": "Exact Role Title",
  "company": "Company Name",
  "location": "Job Location or Remote",
  "salary": "Listed compensation or Undisclosed",
  "experience_required": "e.g. 3+ years or Not specified",
  "tech_stack": ["Language1", "Tool1"],
  "responsibilities_summary": "Clean summary of key duties without filler",
  "apply_action_selector": "CSS selector or link to submit/apply"
}}

Content:
"""
{}
""""#,
            page_url, max_snippet
        );

        let result = self.agent.invoke(&prompt, true).await;
        if !result.success {
            return Err(anyhow!(
                "Failed to parse job content via CLI Agent: {}",
                result.error.unwrap_or_default()
            ));
        }

        let json_val = result.data.ok_or_else(|| anyhow!("Empty response from agent"))?;
        let parsed: ParsedJobListing = serde_json::from_value(json_val)?;
        Ok(parsed)
    }

    pub async fn map_application_form(&self, form_html_or_tree: &str) -> Result<Vec<FormFieldMapping>> {
        let max_snippet = if form_html_or_tree.len() > 8000 {
            &form_html_or_tree[..8000]
        } else {
            form_html_or_tree
        };

        let prompt = format!(
            r#"You are an ATS Form Mapper Agent. Below is the simplified HTML or accessibility tree of a job application form.
Candidate Profile:
- Full Name: Miftahul Muhaemen
- Experience: 5 years Software/Data Engineer (Golang, TypeScript, Python, Kubernetes, PostgreSQL)
- Education: Bachelor of Computer Science, ULM, GPA 3.48
- Status: Single, Unemployed (ASAP), Open to all work arrangements, Contract >= 3 months (No internships)
- Location: Indonesia (Remote / Hybrid / On-site)

Map each input field to candidate profile details.
Return ONLY a JSON array of objects:
[
  {{
    "selector": "CSS selector or ID",
    "field_name": "Label or placeholder",
    "field_type": "text | file | select | checkbox | radio",
    "candidate_profile_key": "personal.fullName or custom",
    "proposed_value": "Suggested input"
  }}
]

Form DOM:
"""
{}
""""#,
            max_snippet
        );

        let result = self.agent.invoke(&prompt, true).await;
        if !result.success {
            return Err(anyhow!("Failed to map form via agent: {}", result.error.unwrap_or_default()));
        }

        let json_val = result.data.ok_or_else(|| anyhow!("Empty response from agent"))?;
        let mappings: Vec<FormFieldMapping> = serde_json::from_value(json_val)?;
        Ok(mappings)
    }
}
