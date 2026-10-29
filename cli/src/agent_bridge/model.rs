use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentSettings {
    pub enabled: bool,
    pub model: String,
    pub binary: String,
    pub timeout_seconds: u64,
}

impl Default for AgentSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            model: "gemini-3.8-flash-high".to_string(),
            binary: "/home/sahana/.local/bin/agy".to_string(),
            timeout_seconds: 60,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentModelInfo {
    pub id: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentStatus {
    pub enabled: bool,
    pub available: bool,
    pub binary_path: String,
    pub current_model: String,
    pub timeout_seconds: u64,
    pub active_processes_count: usize,
    pub active_pids: Vec<u32>,
    pub available_models: Vec<AgentModelInfo>,
    pub version: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentExecutionResult {
    pub success: bool,
    pub data: Option<serde_json::Value>,
    pub raw_output: String,
    pub latency_ms: u64,
    pub error: Option<String>,
}
