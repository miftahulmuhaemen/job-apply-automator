import { d1Query } from "../cloudflareClient.js"
import type { TriageJobRecord } from "./jobsLedgerRepo.js"

/* =========================================================
   COMPANIES MASTER TABLE & APPLICATION TRACKING
   ========================================================= */
export interface CompanyRecord {
  id: string
  name: string
  normalized_name: string
  industry: string
  company_size: string
  location: string
  overview: string
  website?: string | null
  headquarters?: string | null
  leaders?: string | null
  hr_contacts?: string | null
  products_summary?: string | null
  applications_count: number
  crawled_count: number
  first_crawled_at: string
  last_applied_at: string | null
  created_at?: string
  updated_at?: string
  cooldown_days?: number
  cooldown_status?: string
  cooldown_days_remaining?: number
  jobs_json?: string
  jobs?: any[]
}

export async function getCompanies(): Promise<CompanyRecord[]> {
  const rows = await d1Query<CompanyRecord>(
    `SELECT
      id, name, normalized_name, industry, company_size, location, overview,
      website, headquarters, leaders, hr_contacts, products_summary,
      applications_count, crawled_count, first_crawled_at, last_applied_at,
      created_at, updated_at, cooldown_days, cooldown_status, cooldown_days_remaining,
      jobs_json
    FROM v_companies_summary
    ORDER BY applications_count DESC, crawled_count DESC`
  )
  return rows.map(r => {
    let jobs: any[] = []
    try {
      if (r.jobs_json) {
        jobs = typeof r.jobs_json === 'string' ? JSON.parse(r.jobs_json) : r.jobs_json
      }
    } catch {}
    return { ...r, jobs }
  })
}

export async function getCompanyJobs(companyName: string): Promise<TriageJobRecord[]> {
  const normalized = companyName.trim().toLowerCase()
  return await d1Query<TriageJobRecord>(`
    SELECT * FROM jobs_ledger 
    WHERE LOWER(company) = ? AND (is_deleted = 0 OR is_deleted IS NULL)
    ORDER BY created_at DESC
  `, [normalized])
}

