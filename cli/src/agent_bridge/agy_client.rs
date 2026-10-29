use super::model::{AgentExecutionResult, AgentModelInfo, AgentSettings, AgentStatus};
use super::process_manager::ProcessManager;
use anyhow::{anyhow, Result};
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};
use tokio::time::timeout;

pub struct AgyClient {
    settings: AgentSettings,
    pm: ProcessManager,
}

impl AgyClient {
    pub fn new(settings: AgentSettings, pm: ProcessManager) -> Self {
        Self { settings, pm }
    }

    pub fn check_status(&self) -> AgentStatus {
        let binary_path = &self.settings.binary;
        let mut status = AgentStatus {
            enabled: self.settings.enabled,
            available: false,
            binary_path: binary_path.clone(),
            current_model: self.settings.model.clone(),
            timeout_seconds: self.settings.timeout_seconds,
            active_processes_count: self.pm.get_active_pids().len(),
            active_pids: self.pm.get_active_pids(),
            available_models: vec![
                AgentModelInfo { id: "gemini-3.8-flash-high".into(), name: "Gemini 3.8 Flash (High)".into() },
                AgentModelInfo { id: "gemini-3.8-flash-medium".into(), name: "Gemini 3.8 Flash (Medium)".into() },
                AgentModelInfo { id: "gemini-3.8-flash-low".into(), name: "Gemini 3.8 Flash (Low)".into() },
                AgentModelInfo { id: "claude-sonnet-4-6".into(), name: "Claude Sonnet 4.6 (Thinking)".into() },
                AgentModelInfo { id: "claude-opus-4-6-thinking".into(), name: "Claude Opus 4.6 (Thinking)".into() },
                AgentModelInfo { id: "gpt-oss-120b-medium".into(), name: "GPT-OSS 120B (Medium)".into() },
            ],
            version: None,
            error: None,
        };

        if !Path::new(binary_path).exists() {
            status.error = Some(format!("Binary not found at: {}", binary_path));
            return status;
        }

        match Command::new(binary_path).arg("--version").output() {
            Ok(output) if output.status.success() => {
                let ver_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
                status.version = Some(ver_str);
                status.available = true;
            }
            Ok(output) => {
                let err_str = String::from_utf8_lossy(&output.stderr).trim().to_string();
                status.error = Some(format!("Failed to run agy --version: {}", err_str));
            }
            Err(e) => {
                status.error = Some(format!("Failed to execute binary: {}", e));
            }
        }

        status
    }

    pub async fn invoke(&self, prompt: &str, expect_json: bool) -> AgentExecutionResult {
        if !self.settings.enabled {
            return AgentExecutionResult {
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
        let timeout_secs = self.settings.timeout_seconds;

        let mut cmd = Command::new(binary);
        cmd.arg("-p")
            .arg(prompt)
            .arg("--model")
            .arg(model)
            .arg("--output-format")
            .arg("json")
            .arg("--dangerously-skip-permissions")
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        let mut child = match cmd.spawn() {
            Ok(child) => child,
            Err(e) => {
                return AgentExecutionResult {
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
                    return AgentExecutionResult {
                        success: false,
                        data: None,
                        raw_output: stdout,
                        latency_ms,
                        error: Some(format!("Process exited with status: {}. Stderr: {}", output.status, stderr)),
                    };
                }

                if expect_json {
                    // Try parsing root output JSON or finding embedded JSON
                    if let Ok(root) = serde_json::from_str::<serde_json::Value>(&stdout) {
                        if let Some(inner) = root.get("response").and_then(|r| r.as_str()) {
                            let clean = inner.trim().trim_start_matches("```json").trim_start_matches("```").trim_end_matches("```").trim();
                            if let Ok(inner_json) = serde_json::from_str::<serde_json::Value>(clean) {
                                return AgentExecutionResult {
                                    success: true,
                                    data: Some(inner_json),
                                    raw_output: stdout,
                                    latency_ms,
                                    error: None,
                                };
                            }
                        }
                        return AgentExecutionResult {
                            success: true,
                            data: Some(root),
                            raw_output: stdout,
                            latency_ms,
                            error: None,
                        };
                    }

                    AgentExecutionResult {
                        success: false,
                        data: None,
                        raw_output: stdout,
                        latency_ms,
                        error: Some("Failed to parse JSON response from agent".into()),
                    }
                } else {
                    let text = if let Ok(root) = serde_json::from_str::<serde_json::Value>(&stdout) {
                        root.get("response").and_then(|r| r.as_str()).unwrap_or(&stdout).to_string()
                    } else {
                        stdout.clone()
                    };

                    AgentExecutionResult {
                        success: true,
                        data: Some(serde_json::Value::String(text)),
                        raw_output: stdout,
                        latency_ms,
                        error: None,
                    }
                }
            }
            Ok(Ok(Err(e))) => AgentExecutionResult {
                success: false,
                data: None,
                raw_output: String::new(),
                latency_ms,
                error: Some(format!("Process join error: {}", e)),
            },
            Ok(Err(join_err)) => AgentExecutionResult {
                success: false,
                data: None,
                raw_output: String::new(),
                latency_ms,
                error: Some(format!("Task execution error: {}", join_err)),
            },
            Err(_) => {
                // Timeout exceeded: terminate with SIGTERM -> SIGKILL
                pm.terminate_pid(pid);
                AgentExecutionResult {
                    success: false,
                    data: None,
                    raw_output: String::new(),
                    latency_ms,
                    error: Some(format!("Process timed out after {} seconds", timeout_secs)),
                }
            }
        }
    }
}
