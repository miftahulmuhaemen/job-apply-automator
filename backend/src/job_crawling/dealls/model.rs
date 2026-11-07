use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeallsJobDoc {
    pub id: String,
    pub slug: String,
    pub role: String,
    pub company: Option<DeallsCompany>,
    #[serde(rename = "publishedAt")]
    pub published_at: Option<String>,
    #[serde(rename = "lastActivelyHiringAt")]
    pub last_actively_hiring_at: Option<String>,
    #[serde(rename = "updatedAtByEmployer")]
    pub updated_at_by_employer: Option<String>,
    #[serde(rename = "workplaceType")]
    pub workplace_type: Option<String>,
    pub city: Option<DeallsCity>,
    #[serde(rename = "salaryRange")]
    pub salary_range: Option<DeallsSalaryRange>,
    #[serde(rename = "salaryType")]
    pub salary_type: Option<String>,
    #[serde(rename = "candidatePreference")]
    pub candidate_preference: Option<DeallsCandidatePreference>,
    #[serde(rename = "jobRoleCategorySlug")]
    pub job_role_category_slug: Option<String>,
    pub skills: Option<Vec<DeallsSkill>>,
    #[serde(rename = "externalPlatformApplyUrl")]
    pub external_platform_apply_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeallsCompany {
    pub id: Option<String>,
    pub name: Option<String>,
    pub slug: Option<String>,
    pub sector: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeallsCity {
    pub id: Option<i64>,
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeallsSalaryRange {
    pub start: Option<i64>,
    pub end: Option<i64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeallsSkill {
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeallsCandidatePreference {
    #[serde(rename = "lastEducations")]
    pub last_educations: Option<Vec<i64>>,
    pub gender: Option<String>,
    pub skills: Option<Vec<DeallsSkillPreference>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeallsSkillPreference {
    pub name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeallsExploreJobResponse {
    pub code: Option<i64>,
    pub data: Option<DeallsExploreJobData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeallsExploreJobData {
    pub docs: Vec<DeallsJobDoc>,
    #[serde(rename = "totalDocs")]
    pub total_docs: Option<i64>,
    #[serde(rename = "totalPages")]
    pub total_pages: Option<i64>,
    pub page: Option<i64>,
}
