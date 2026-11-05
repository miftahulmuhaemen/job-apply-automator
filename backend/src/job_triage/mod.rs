pub mod model;
pub mod repository;
pub mod semantic_scorer;

pub use model::JobRecord;
pub use repository::JobTriageRepository;
pub use semantic_scorer::{SemanticTriageScorer, TriageScoreResult};

