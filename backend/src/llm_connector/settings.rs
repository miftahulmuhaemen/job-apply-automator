use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LlmProviderType {
    CliAgy,
    CliClaude,
    CliCustom,
    OpenaiCompatible,
    AnthropicCompatible,
}

impl Default for LlmProviderType {
    fn default() -> Self {
        Self::CliAgy
    }
}

impl LlmProviderType {
    pub fn as_str(&self) -> &'static str {
        match self {
            Self::CliAgy => "cli_agy",
            Self::CliClaude => "cli_claude",
            Self::CliCustom => "cli_custom",
            Self::OpenaiCompatible => "openai_compatible",
            Self::AnthropicCompatible => "anthropic_compatible",
        }
    }

    pub fn from_str_loose(s: &str) -> Self {
        match s.trim().to_lowercase().as_str() {
            "cli_claude" | "claude_cli" | "claude_code" => Self::CliClaude,
            "cli_custom" | "custom_cli" => Self::CliCustom,
            "openai" | "openai_compatible" | "openrouter" | "ollama" | "deepseek" => {
                Self::OpenaiCompatible
            }
            "anthropic" | "anthropic_compatible" | "claude_api" => Self::AnthropicCompatible,
            _ => Self::CliAgy,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LlmSettings {
    pub enabled: bool,
    pub provider: LlmProviderType,
    pub base_url: String,
    pub api_key: String,
    pub model: String,
    pub binary: String,
    pub custom_args: String,
    pub timeout_seconds: u64,
    pub temperature: f32,
}

impl Default for LlmSettings {
    fn default() -> Self {
        Self {
            enabled: true,
            provider: LlmProviderType::CliAgy,
            base_url: String::new(),
            api_key: String::new(),
            model: "gemini-3.8-flash-high".to_string(),
            binary: "/home/sahana/.local/bin/agy".to_string(),
            custom_args: String::new(),
            timeout_seconds: 60,
            temperature: 0.2,
        }
    }
}
