pub mod job_status {
    pub const PENDING_HUMAN: &str = "PENDING_HUMAN";
    pub const APPROVED: &str = "APPROVED";
    pub const APPLIED: &str = "APPLIED";
    pub const DROPPED: &str = "DROPPED";
    pub const SUBMITTED_UNVERIFIED: &str = "SUBMITTED (NOT VERIFY-ABLE)";
}

pub mod triage_decision {
    pub const KEEP: &str = "KEEP";
    pub const FILTER_OUT: &str = "FILTER_OUT";
    pub const PENDING: &str = "PENDING";
}

pub mod candidate_attr_status {
    pub const RESOLVED: &str = "RESOLVED";
    pub const UNRESOLVED: &str = "UNRESOLVED";
    pub const DELEGATED: &str = "DELEGATED_TO_AGY";
}
