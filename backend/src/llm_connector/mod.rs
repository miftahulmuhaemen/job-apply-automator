pub mod anthropic;
pub mod cli;
pub mod openai;
pub mod settings;
pub mod types;

pub use anthropic::AnthropicCompatibleEngine;
pub use cli::CliEngine;
pub use openai::OpenAiCompatibleEngine;
pub use settings::{LlmProviderType, LlmSettings};
pub use types::{LlmDiagnosticResult, LlmExecutionResult, LlmModelInfo};

use crate::agent_bridge::ProcessManager;

#[derive(Clone)]
pub enum LlmEngineKind {
    OpenAi(OpenAiCompatibleEngine),
    Anthropic(AnthropicCompatibleEngine),
    Cli(CliEngine),
}

#[derive(Clone)]
pub struct LlmConnector {
    settings: LlmSettings,
    engine: LlmEngineKind,
}

impl LlmConnector {
    pub fn new(settings: LlmSettings, pm: ProcessManager) -> Self {
        let engine = match settings.provider {
            LlmProviderType::OpenaiCompatible => {
                match OpenAiCompatibleEngine::new(settings.clone()) {
                    Ok(eng) => LlmEngineKind::OpenAi(eng),
                    Err(_) => LlmEngineKind::Cli(CliEngine::new(settings.clone(), pm)),
                }
            }
            LlmProviderType::AnthropicCompatible => {
                match AnthropicCompatibleEngine::new(settings.clone()) {
                    Ok(eng) => LlmEngineKind::Anthropic(eng),
                    Err(_) => LlmEngineKind::Cli(CliEngine::new(settings.clone(), pm)),
                }
            }
            _ => LlmEngineKind::Cli(CliEngine::new(settings.clone(), pm)),
        };

        Self { settings, engine }
    }

    pub fn settings(&self) -> &LlmSettings {
        &self.settings
    }

    pub async fn complete(&self, prompt: &str, expect_json: bool) -> LlmExecutionResult {
        match &self.engine {
            LlmEngineKind::OpenAi(eng) => eng.complete(prompt, expect_json).await,
            LlmEngineKind::Anthropic(eng) => eng.complete(prompt, expect_json).await,
            LlmEngineKind::Cli(eng) => eng.complete(prompt, expect_json).await,
        }
    }

    pub async fn ping(&self) -> LlmDiagnosticResult {
        match &self.engine {
            LlmEngineKind::OpenAi(eng) => eng.ping().await,
            LlmEngineKind::Anthropic(eng) => eng.ping().await,
            LlmEngineKind::Cli(eng) => eng.ping().await,
        }
    }
}
