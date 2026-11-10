use super::settings::LlmSettings;
use super::types::{LlmDiagnosticResult, LlmExecutionResult};
use anyhow::{anyhow, Result};
use reqwest::header::{HeaderMap, HeaderName, HeaderValue, CONTENT_TYPE};
use serde_json::{json, Value};
use std::time::{Duration, Instant};

#[derive(Clone)]
pub struct AnthropicCompatibleEngine {
    settings: LlmSettings,
    client: reqwest::Client,
}

impl AnthropicCompatibleEngine {
    pub fn new(settings: LlmSettings) -> Result<Self> {
        let mut headers = HeaderMap::new();
        headers.insert(CONTENT_TYPE, HeaderValue::from_static("application/json"));
        headers.insert(
            HeaderName::from_static("x-api-key"),
            HeaderValue::from_str(settings.api_key.trim())
                .map_err(|e| anyhow!("Invalid Anthropic API key: {}", e))?,
        );
        headers.insert(
            HeaderName::from_static("anthropic-version"),
            HeaderValue::from_static("2023-06-01"),
        );

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
            return "https://api.anthropic.com/v1/messages".to_string();
        }
        let clean = base.trim_end_matches('/');
        if clean.ends_with("/v1/messages") {
            clean.to_string()
        } else if clean.ends_with("/messages") {
            clean.to_string()
        } else {
            format!("{}/v1/messages", clean)
        }
    }

    fn extract_json(raw: &str) -> Option<Value> {
        let trimmed = raw.trim();
        if let Ok(v) = serde_json::from_str::<Value>(trimmed) {
            return Some(v);
        }
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
            "claude-3-7-sonnet-20250219"
        } else {
            self.settings.model.trim()
        };

        let body = json!({
            "model": model,
            "max_tokens": 4096,
            "system": if expect_json {
                "You are an automated extraction assistant. Always respond strictly with valid JSON without preamble or closing remarks."
            } else {
                "You are an automated assistant."
            },
            "messages": [
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            "temperature": self.settings.temperature
        });

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
                    error: Some(format!("Anthropic HTTP request error: {}", e)),
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
                error: Some(format!("Anthropic API error {}: {}", status, text)),
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

        let content = json_val["content"]
            .as_array()
            .and_then(|arr| arr.iter().find(|item| item["type"] == "text"))
            .and_then(|item| item["text"].as_str())
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
                provider: "anthropic_compatible".to_string(),
                model: self.settings.model.clone(),
                message: format!("Anthropic-compatible endpoint active & responsive ({}ms)", latency_ms),
                error: None,
            }
        } else {
            LlmDiagnosticResult {
                success: false,
                latency_ms,
                provider: "anthropic_compatible".to_string(),
                model: self.settings.model.clone(),
                message: "Anthropic-compatible connection test failed".to_string(),
                error: res.error,
            }
        }
    }
}
