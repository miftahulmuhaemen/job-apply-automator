use super::settings::{LlmProviderType, LlmSettings};
use super::types::{LlmDiagnosticResult, LlmExecutionResult};
use crate::agent_bridge::ProcessManager;
use serde_json::Value;
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};
use tokio::time::timeout;

#[derive(Clone)]
pub struct CliEngine {
    settings: LlmSettings,
    pm: ProcessManager,
}

impl CliEngine {
    pub fn new(settings: LlmSettings, pm: ProcessManager) -> Self {
        Self { settings, pm }
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
        if !self.settings.enabled {
            return LlmExecutionResult {
                success: false,
                data: None,
                raw_output: String::new(),
                latency_ms: 0,
                error: Some("CLI Agent is disabled in settings".into()),
            };
        }

        let start_time = Instant::now();
        let binary = &self.settings.binary;
        let model = &self.settings.model;
        let timeout_secs = if self.settings.timeout_seconds == 0 {
            60
        } else {
            self.settings.timeout_seconds
        };

        if !Path::new(binary).exists() {
            return LlmExecutionResult {
                success: false,
                data: None,
                raw_output: String::new(),
                latency_ms: 0,
                error: Some(format!("Binary not found at: {}", binary)),
            };
        }

        let mut cmd = Command::new(binary);

        match self.settings.provider {
            LlmProviderType::CliClaude => {
                cmd.arg("-p")
                    .arg(prompt)
                    .arg("--output-format")
                    .arg("json");
            }
            LlmProviderType::CliCustom => {
                if !self.settings.custom_args.trim().is_empty() {
                    let formatted = self
                        .settings
                        .custom_args
                        .replace("{prompt}", prompt)
                        .replace("{model}", model);
                    for part in formatted.split_whitespace() {
                        cmd.arg(part);
                    }
                } else {
                    cmd.arg("-p").arg(prompt);
                }
            }
            _ => {
                // Default: Antigravity CLI (agy)
                cmd.arg("-p")
                    .arg(prompt)
                    .arg("--model")
                    .arg(model)
                    .arg("--output-format")
                    .arg("json")
                    .arg("--dangerously-skip-permissions");
            }
        }

        cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

        let child = match cmd.spawn() {
            Ok(child) => child,
            Err(e) => {
                return LlmExecutionResult {
                    success: false,
                    data: None,
                    raw_output: String::new(),
                    latency_ms: start_time.elapsed().as_millis() as u64,
                    error: Some(format!("Failed to spawn child process: {}", e)),
                };
            }
        };

        let pid = child.id();
        self.pm.register(pid);

        let pm = self.pm.clone();
        let wait_result = timeout(Duration::from_secs(timeout_secs), async move {
            tokio::task::spawn_blocking(move || child.wait_with_output()).await
        })
        .await;

        self.pm.unregister(pid);
        let latency_ms = start_time.elapsed().as_millis() as u64;

        match wait_result {
            Ok(Ok(Ok(output))) => {
                let stdout = String::from_utf8_lossy(&output.stdout).to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).to_string();

                if !output.status.success() {
                    return LlmExecutionResult {
                        success: false,
                        data: None,
                        raw_output: stdout,
                        latency_ms,
                        error: Some(format!(
                            "Process exited with error ({}): {}",
                            output.status, stderr
                        )),
                    };
                }

                let data = if expect_json {
                    Self::extract_json(&stdout)
                } else {
                    None
                };

                LlmExecutionResult {
                    success: true,
                    data,
                    raw_output: stdout,
                    latency_ms,
                    error: None,
                }
            }
            Ok(Ok(Err(e))) => LlmExecutionResult {
                success: false,
                data: None,
                raw_output: String::new(),
                latency_ms,
                error: Some(format!("Failed to join blocking task: {}", e)),
            },
            Ok(Err(e)) => LlmExecutionResult {
                success: false,
                data: None,
                raw_output: String::new(),
                latency_ms,
                error: Some(format!("Process join error: {}", e)),
            },
            Err(_) => {
                pm.terminate_pid(pid);
                LlmExecutionResult {
                    success: false,
                    data: None,
                    raw_output: String::new(),
                    latency_ms,
                    error: Some(format!("Process execution timed out after {} seconds", timeout_secs)),
                }
            }
        }
    }

    pub async fn ping(&self) -> LlmDiagnosticResult {
        let binary_path = &self.settings.binary;
        let exists = Path::new(binary_path).exists();
        if !exists {
            return LlmDiagnosticResult {
                success: false,
                latency_ms: 0,
                provider: self.settings.provider.as_str().to_string(),
                model: self.settings.model.clone(),
                message: format!("CLI binary not found at {}", binary_path),
                error: Some(format!("File does not exist: {}", binary_path)),
            };
        }

        let start = Instant::now();
        let output = tokio::task::spawn_blocking({
            let bin = binary_path.clone();
            move || Command::new(&bin).arg("--version").output()
        })
        .await;

        let latency_ms = start.elapsed().as_millis() as u64;

        match output {
            Ok(Ok(out)) if out.status.success() => {
                let ver = String::from_utf8_lossy(&out.stdout).trim().to_string();
                LlmDiagnosticResult {
                    success: true,
                    latency_ms,
                    provider: self.settings.provider.as_str().to_string(),
                    model: self.settings.model.clone(),
                    message: format!("Agent CLI responsive ({}): {}", latency_ms, ver),
                    error: None,
                }
            }
            Ok(Ok(out)) => {
                let err = String::from_utf8_lossy(&out.stderr).trim().to_string();
                LlmDiagnosticResult {
                    success: false,
                    latency_ms,
                    provider: self.settings.provider.as_str().to_string(),
                    model: self.settings.model.clone(),
                    message: "Binary returned non-zero exit code".to_string(),
                    error: Some(err),
                }
            }
            Ok(Err(e)) => LlmDiagnosticResult {
                success: false,
                latency_ms,
                provider: self.settings.provider.as_str().to_string(),
                model: self.settings.model.clone(),
                message: "Failed to run binary".to_string(),
                error: Some(e.to_string()),
            },
            Err(e) => LlmDiagnosticResult {
                success: false,
                latency_ms,
                provider: self.settings.provider.as_str().to_string(),
                model: self.settings.model.clone(),
                message: "Execution task failed".to_string(),
                error: Some(e.to_string()),
            },
        }
    }
}
