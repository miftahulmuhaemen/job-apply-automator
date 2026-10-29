use super::model::PortalEvaluation;

pub struct CandidatePreferences {
    pub min_salary: i64,
    pub cooldown_days: i64,
    pub max_posting_age_days: i64,
    pub blacklisted_tech: Vec<&'static str>,
    pub blacklisted_seniority: Vec<&'static str>,
    pub blacklisted_industries: Vec<&'static str>,
}

impl Default for CandidatePreferences {
    fn default() -> Self {
        Self {
            min_salary: 10_000_000,
            cooldown_days: 30,
            max_posting_age_days: 7,
            blacklisted_tech: vec![
                "php", "laravel", "codeigniter", "wordpress", "drupal", "magento",
                ".net", "c#", "asp.net", "cobol", "fortran", "angularjs", "flash"
            ],
            blacklisted_seniority: vec![
                "vp", "vice president", "director", "head of", "principal", "chief"
            ],
            blacklisted_industries: vec![
                "gambling", "crypto casino", "judol", "slot", "poker", "betting"
            ],
        }
    }
}

impl CandidatePreferences {
    pub fn evaluate(&self, title: &str, company: &str, body_text: &str) -> PortalEvaluation {
        let lower_title = title.to_lowercase();
        let lower_company = company.to_lowercase();
        let lower_body = body_text.to_lowercase();

        // 1. Blacklisted tech
        for tech in &self.blacklisted_tech {
            if lower_title.contains(tech) || lower_body.contains(tech) {
                return PortalEvaluation {
                    allowed: false,
                    skip_reason: Some(format!("Contains blacklisted technology: {}", tech)),
                };
            }
        }

        // 2. Blacklisted industries
        for ind in &self.blacklisted_industries {
            if lower_company.contains(ind) || lower_body.contains(ind) {
                return PortalEvaluation {
                    allowed: false,
                    skip_reason: Some(format!("Blacklisted industry keyword: {}", ind)),
                };
            }
        }

        // 3. Blacklisted seniority
        for sen in &self.blacklisted_seniority {
            if lower_title.contains(sen) {
                return PortalEvaluation {
                    allowed: false,
                    skip_reason: Some(format!("Seniority ceiling exceeded: {}", sen)),
                };
            }
        }

        PortalEvaluation {
            allowed: true,
            skip_reason: None,
        }
    }
}
