use super::settings::LlmSettings;
use super::types::{LlmDiagnosticResult, LlmExecutionResult};
use anyhow::{anyhow, Result};
use reqwest::header::{HeaderMap, HeaderValue, AUTHORIZATION, CONTENT_TYPE};
use serde_json::{json, Value};
use std::time::{Duration, Instant};

#[derive(Clone)]
pub struct OpenAiCompatibleEngine {
    settings: LlmSettings,
    client: reqwest::Client,
}

impl OpenAiCompatibleEngine {
    pub fn new(settings: LlmSettings) -> Result<Self> {
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        if !settings.api_key.trim().is_empty() {
            let auth_val = format!("Bearer {}", settings.api_key.trim());
            headers.insert(
                AUTHORIZATION,
                HeaderValue::from_str(&auth_val).map_err(|e| anyhow!("Invalid API key: {}", e))?,
            );
        }

        let timeout_secs = if settings.timeout_seconds == 0 {
            60
        } else {
            settings.timeout_seconds
        };

        let client = reqwest::Client::builder()
            .default_headers(headers)
            .timeout(Duration::from_secs(timeout_secs))
            .build()?;

        Ok(Self { settings, client })
    }

    fn endpoint_url(&self) -> String {
        let base = self.settings.base_url.trim();
        if base.is_empty() {
            return "https://api.openai.com/v1/chat/completions".to_string();
        }
        let clean = base.trim_end_matches('/');
        if clean.ends_with("/chat/completions") {
            clean.to_string()
        } else if clean.ends_with("/v1") {
            format!("{}/chat/completions", clean)
        } else {
            format!("{}/chat/completions", clean)
        }
    }

    fn extract_json(raw: &str) -> Option<Value> {
        let trimmed = raw.trim();
        if let Ok(v) = serde_json::from_str::<Value>(trimmed) {
            return Some(v);
        }
        // Check for markdown code fences ```json ... ```
        if let Some(start) = trimmed.find("```") {
            let rest = &trimmed[start + 3..];
            let after_lang = if rest.starts_with("json") {
                &rest[4..]
            } else {
                rest
            };
            if let Some(end) = after_lang.find("```") {
                let inner = after_lang[..end].trim();
                if let Ok(v) = serde_json::from_str::<Value>(inner) {
                    return Some(v);
                }
            }
        }
        // Fallback: search for first '{' and last '}'
        if let (Some(s), Some(e)) = (trimmed.find('{'), trimmed.rfind('}')) {
            if s < e {
                let slice = &trimmed[s..=e];
                if let Ok(v) = serde_json::from_str::<Value>(slice) {
                    return Some(v);
                }
            }
        }
        None
    }

    pub async fn complete(&self, prompt: &str, expect_json: bool) -> LlmExecutionResult {
        let start = Instant::now();
        let url = self.endpoint_url();
        let model = if self.settings.model.trim().is_empty() {
            "gpt-4o-mini"
        } else {
            self.settings.model.trim()
        };

        let mut body = json!({
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": if expect_json {
                        "You are an automated extraction assistant. Always respond strictly with valid JSON."
                    } else {
                        "You are an automated assistant."
                    }
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": self.settings.temperature
        });

        if expect_json {
            body["response_format"] = json!({ "type": "json_object" });
        }

        let resp_result = self.client.post(&url).json(&body).send().await;
        let latency_ms = start.elapsed().as_millis() as u64;

        let resp = match resp_result {
            Ok(r) => r,
            Err(e) => {
                return LlmExecutionResult {
                    success: false,
                    data: None,
                    raw_output: String::new(),
                    latency_ms,
                    error: Some(format!("HTTP request error: {}", e)),
                };
            }
        };

        let status = resp.status();
        let text = match resp.text().await {
            Ok(t) => t,
            Err(e) => {
                return LlmExecutionResult {
                    success: false,
                    data: None,
                    raw_output: String::new(),
                    latency_ms,
                    error: Some(format!("Failed to read response body: {}", e)),
                };
            }
        };

        if !status.is_success() {
            return LlmExecutionResult {
                success: false,
                data: None,
                raw_output: text.clone(),
                latency_ms,
                error: Some(format!("OpenAI API error {}: {}", status, text)),
            };
        }

        let json_val: Value = match serde_json::from_str(&text) {
            Ok(v) => v,
            Err(e) => {
                return LlmExecutionResult {
                    success: false,
                    data: None,
                    raw_output: text,
                    latency_ms,
                    error: Some(format!("Failed to parse response JSON envelope: {}", e)),
                };
            }
        };

        let content = json_val["choices"][0]["message"]["content"]
            .as_str()
            .unwrap_or("")
            .to_string();

        let data = if expect_json {
            Self::extract_json(&content)
        } else {
            None
        };

        LlmExecutionResult {
            success: true,
            data,
            raw_output: content,
            latency_ms,
            error: None,
        }
    }

    pub async fn ping(&self) -> LlmDiagnosticResult {
        let start = Instant::now();
        let res = self.complete("Reply with 'pong' in JSON format: {\"status\": \"pong\"}", true).await;
        let latency_ms = start.elapsed().as_millis() as u64;

        if res.success {
            LlmDiagnosticResult {
                success: true,
                latency_ms,
                provider: "openai_compatible".to_string(),
                model: self.settings.model.clone(),
                message: format!("OpenAI-compatible endpoint active & responsive ({}ms)", latency_ms),
                error: None,
            }
        } else {
            LlmDiagnosticResult {
                success: false,
                latency_ms,
                provider: "openai_compatible".to_string(),
                model: self.settings.model.clone(),
                message: "OpenAI-compatible connection test failed".to_string(),
                error: res.error,
            }
        }
    }
}
