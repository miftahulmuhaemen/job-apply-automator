export const JOB_STATUS = {
  PENDING_HUMAN: 'PENDING_HUMAN',
  APPROVED: 'APPROVED',
  APPLIED: 'APPLIED',
  DROPPED: 'DROPPED',
  SUBMITTED_UNVERIFIED: 'SUBMITTED (NOT VERIFY-ABLE)',
} as const;

export type JobStatus = typeof JOB_STATUS[keyof typeof JOB_STATUS];

export const TRIAGE_DECISION = {
  KEEP: 'KEEP',
  FILTER_OUT: 'FILTER_OUT',
  PENDING: 'PENDING',
} as const;

export type TriageDecision = typeof TRIAGE_DECISION[keyof typeof TRIAGE_DECISION];

export const CANDIDATE_ATTR_STATUS = {
  RESOLVED: 'RESOLVED',
  UNRESOLVED: 'UNRESOLVED',
  DELEGATED: 'DELEGATED_TO_AGY',
} as const;

export type CandidateAttrStatus = typeof CANDIDATE_ATTR_STATUS[keyof typeof CANDIDATE_ATTR_STATUS];
