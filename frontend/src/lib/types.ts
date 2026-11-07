export type { JobStatus, TriageDecision, CandidateAttrStatus } from './constants'

export interface JobRecord {
  id: number
  uuid?: string
  portal: string
  title: string
  company: string
  location?: string
  company_size?: string
  industry?: string
  salary_raw?: string
  salary_min?: number
  salary_max?: number
  market_salary_benchmark?: string
  benchmark_source?: string
  experience_req?: string
  tech_stack?: string
  benefits?: string
  company_overview?: string
  requirements_summary?: string
  full_description?: string
  form_schema?: string
  screening_questions?: string
  candidate_answers?: string
  job_url: string
  status: string
  triage_decision?: string
  skip_reason?: string
  resume_path?: string
  cover_letter?: string
  applied_at?: string
  created_at: string
  posted_at?: string
  last_active_at?: string
  histories?: string
  is_deleted?: number
  last_error?: string
  roadblock_url?: string
  roadblock_screenshot?: string
  submission_receipt_url?: string
}

export interface CompanyRecord {
  id: string
  name: string
  normalized_name: string
  industry?: string | null
  company_size?: string | null
  location?: string | null
  overview?: string | null
  website?: string | null
  headquarters?: string | null
  leaders?: string | null
  hr_contacts?: string | null
  applications_count: number
  crawled_count: number
  first_crawled_at: string
  last_applied_at?: string | null
  jobs?: Array<{
    id: number
    title: string
    portal: string
    status: string
    salary_raw?: string
    job_url: string
    created_at: string
  }>
}

export interface DecisionCriteriaRecord {
  id: number
  uuid: string
  category: string
  key: string
  value: string
  description: string
  is_enabled: number
  is_deleted: number
  updated_at: string
}

export interface WebsiteRecord {
  id: string
  name: string
  url: string
  allowed: number
  auth_type: string
  username?: string | null
  credential_note?: string | null
  notes?: string | null
  cooldown_days?: number
  created_at: string
  updated_at: string
}

export interface SystemErrorRecord {
  id: number
  timestamp: string
  category: string
  component: string
  message: string
  details?: string
}

export interface CandidateAttribute {
  id?: number
  key: string
  category: string
  label: string
  description?: string
  value?: string
  source_portal?: string
  status?: string
  is_agent_delegated?: number
}
