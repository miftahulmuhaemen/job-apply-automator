use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmModelInfo {
    pub id: String,
    pub name: String,
    pub provider: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmDiagnosticResult {
    pub success: bool,
    pub latency_ms: u64,
    pub provider: String,
    pub model: String,
    pub message: String,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmExecutionResult {
    pub success: bool,
    pub data: Option<serde_json::Value>,
    pub raw_output: String,
    pub latency_ms: u64,
    pub error: Option<String>,
}
