import { d1Query, d1Execute } from "../cloudflareClient.js"
import { uuidv7 } from "../../utils/uuidv7.js"

/* =========================================================
   JOBS LEDGER & COOLDOWN / APPLICATION TRACKING
   ========================================================= */
export interface JobRecord {
  jobId?: string
  company: string
  title: string
  portal: string
  jobUrl: string
  location?: string
  salaryRaw?: string
  salaryMin?: number
  salaryMax?: number
  status:
    | 'applied'
    | 'skipped_salary'
    | 'skipped_tech'
    | 'skipped_cooldown'
    | 'skipped_industry'
    | 'failed'
    | 'pending_human'
  skipReason?: string
  resumePath?: string
  appliedAt?: string
  cover_letter?: string | null
}

export async function isCompanyInCooldown(companyName: string, cooldownDays?: number): Promise<boolean> {
  const normalized = companyName.trim().toLowerCase()
  const rows = await d1Query<{ cooldown_status: string }>(
    `SELECT cooldown_status FROM v_companies_summary WHERE normalized_name = ?`,
    [normalized]
  )
  return rows[0]?.cooldown_status === 'COOLDOWN'
}

export async function hasAppliedUrl(jobUrl: string): Promise<boolean> {
  const rows = await d1Query<{ count: number }>(
    `SELECT COUNT(*) as count FROM jobs_ledger WHERE job_url = ? AND UPPER(status) IN ('APPLIED', 'SUBMITTED (NOT VERIFY-ABLE)')`,
    [jobUrl]
  )
  return (rows[0]?.count || 0) > 0
}

export async function logJobRecord(record: JobRecord): Promise<void> {
  const newUuid = uuidv7()
  const initialHistory = JSON.stringify([
    {
      from_status: null,
      to_status: record.status.toUpperCase(),
      timestamp: new Date().toISOString(),
      note: 'Ingested via browser crawler'
    }
  ])
  await d1Execute(`
    INSERT INTO jobs_ledger (
      uuid, job_id, company, title, portal, job_url, location, 
      salary_raw, salary_min, salary_max, status, skip_reason, resume_path, cover_letter, applied_at, histories
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(job_url) DO UPDATE SET
      status = excluded.status,
      skip_reason = excluded.skip_reason,
      applied_at = excluded.applied_at,
      resume_path = excluded.resume_path,
      cover_letter = COALESCE(excluded.cover_letter, jobs_ledger.cover_letter)
  `, [
    newUuid,
    record.jobId || null,
    record.company,
    record.title,
    record.portal,
    record.jobUrl,
    record.location || null,
    record.salaryRaw || null,
    record.salaryMin || null,
    record.salaryMax || null,
    record.status,
    record.skipReason || null,
    record.resumePath || null,
    record.cover_letter || null,
    record.appliedAt || null,
    initialHistory
  ])
}

export async function getTodayApplicationCount(): Promise<number> {
  const today = new Date().toISOString().slice(0, 10)
  const rows = await d1Query<{ count: number }>(`
    SELECT COUNT(*) as count FROM jobs_ledger 
    WHERE UPPER(status) IN ('APPLIED', 'SUBMITTED (NOT VERIFY-ABLE)') AND substr(applied_at, 1, 10) = ?
  `, [today])
  return rows[0]?.count || 0
}

export interface TriageJobRecord {
  id: number
  uuid: string
  company: string
  title: string
  portal: string
  status: string
  location: string
  company_size: string
  industry: string
  salary_raw: string
  market_salary_benchmark: string
  benchmark_source: string
  experience_req: string
  tech_stack: string
  benefits: string
  company_overview: string
  requirements_summary: string
  full_description?: string
  form_schema?: string
  screening_questions: string
  candidate_answers: string
  job_url: string
  triage_decision: 'KEEP' | 'FILTER_OUT' | 'PENDING'
  skip_reason: string
  created_at: string
  applied_at: string | null
  histories: string
  is_deleted: number
  last_error?: string | null
  roadblock_url?: string | null
  roadblock_screenshot?: string | null
  resume_path?: string | null
  cover_letter?: string | null
}

export async function getTriageJobs(includeDeleted = false): Promise<TriageJobRecord[]> {
  const whereClause = includeDeleted ? '' : 'WHERE (is_deleted = 0 OR is_deleted IS NULL)'
  return await d1Query<TriageJobRecord>(`
    SELECT id, COALESCE(uuid, '01930000-0000-7000-8000-' || id) as uuid,
           company, title, COALESCE(portal, 'Jobstreet') as portal,
           COALESCE(UPPER(status), 'CRAWLED') as status, location, company_size, industry,
           salary_raw, salary_min, salary_max, market_salary_benchmark, benchmark_source, experience_req,
           tech_stack, benefits, company_overview, requirements_summary, full_description, form_schema,
           screening_questions, candidate_answers, job_url, triage_decision, skip_reason,
           created_at, applied_at, COALESCE(histories, '[]') as histories,
           COALESCE(is_deleted, 0) as is_deleted,
           last_error, roadblock_url, roadblock_screenshot,
           resume_path, cover_letter
    FROM jobs_ledger
    ${whereClause}
    ORDER BY id ASC
  `)
}

export async function findJobInLedger(idOrUuid: string | number): Promise<any> {
  const numericId = typeof idOrUuid === 'number' ? idOrUuid : parseInt(String(idOrUuid), 10) || -1
  const rows = await d1Query<any>(
    `SELECT * FROM jobs_ledger WHERE id = ? OR uuid = ?`,
    [numericId, String(idOrUuid)]
  )
  return rows[0] || null
}

export const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  CRAWLED: ['APPROVED', 'DROPPED'],
  SKIPPED: ['APPROVED', 'DROPPED'],
  SKIPPED_SALARY: ['APPROVED', 'DROPPED'],
  PENDING_HUMAN: ['APPROVED', 'DROPPED'],
  APPROVED: ['APPLYING', 'DROPPED'],
  APPLYING: ['APPLIED', 'SUBMITTED (NOT VERIFY-ABLE)', 'FAILED'],
  'SUBMITTED (NOT VERIFY-ABLE)': ['INTERVIEW', 'REJECTED', 'DROPPED'],
  FAILED: ['APPLYING', 'DROPPED'],
  APPLIED: ['INTERVIEW', 'REJECTED', 'DROPPED'],
  INTERVIEW: ['OFFER', 'REJECTED', 'DROPPED'],
  OFFER: ['OFFER_ACCEPTED', 'OFFER_DECLINED', 'DROPPED'],
  DROPPED: ['PENDING_HUMAN'],
  REJECTED: [],
  OFFER_ACCEPTED: [],
  OFFER_DECLINED: []
}

export async function updateTriageDecision(id: number | string, decision: 'KEEP' | 'FILTER_OUT'): Promise<boolean> {
  const targetStatus = decision === 'KEEP' ? 'APPROVED' : 'DROPPED'
  const res = await updateJobStatus(id, targetStatus, `Triage updated to ${decision}`)
  return res.success
}

export interface UpdateStatusResult {
  success: boolean
  error?: string
}

export interface UpdateStatusMetadata {
  resumePath?: string | null
  lastError?: string | null
  roadblockUrl?: string | null
  roadblockScreenshot?: string | null
  appliedAt?: string | null
}

export async function updateJobStatus(
  id: number | string, 
  rawStatus: string, 
  note = 'Status updated via action popover',
  isSystemAction = false,
  existingJob?: any | null,
  metadata?: UpdateStatusMetadata
): Promise<UpdateStatusResult> {
  const targetStatus = rawStatus.toUpperCase().trim()
  const job = existingJob || await findJobInLedger(id)
  if (!job) return { success: false, error: 'Job not found' }

  let currentStatus = (job.status || 'CRAWLED').toUpperCase()
  if (currentStatus === 'CRAWLED' || currentStatus === 'SKIPPED_SALARY') {
    if (job.triage_decision === 'KEEP') currentStatus = 'APPROVED'
    else if (job.triage_decision === 'FILTER_OUT') currentStatus = 'DROPPED'
    else currentStatus = 'CRAWLED'
  }

  if (currentStatus === targetStatus && !metadata) {
    return { success: true }
  }

  // Enforce unidirectional workflow transitions
  if (currentStatus !== targetStatus) {
    const validNext = ALLOWED_TRANSITIONS[currentStatus] || []
    if (!validNext.includes(targetStatus)) {
      return { 
        success: false, 
        error: `Invalid transition from ${currentStatus} to ${targetStatus}. Workflow must progress strictly forward.` 
      }
    }

    // Only system actions can move to APPLYING or APPLIED from APPROVED
    if (targetStatus === 'APPLYING' && !isSystemAction) {
      return {
        success: false,
        error: 'Cannot manually set status to APPLYING. Use Run & Submit Application action.'
      }
    }

    if (currentStatus === 'APPLYING' && !isSystemAction) {
      return {
        success: false,
        error: 'Job application is actively submitting. Status is locked.'
      }
    }
  }

  let historyList: any[] = []
  try {
    historyList = JSON.parse(job.histories || '[]')
  } catch {}

  historyList.push({
    from_status: currentStatus,
    to_status: targetStatus,
    timestamp: new Date().toISOString(),
    note
  })

  let triageDecision = job.triage_decision || 'PENDING'
  if (targetStatus === 'APPROVED') triageDecision = 'KEEP'
  else if (targetStatus === 'DROPPED') triageDecision = 'FILTER_OUT'

  const appliedAtVal = (targetStatus === 'APPLIED' || targetStatus === 'SUBMITTED (NOT VERIFY-ABLE)')
    ? (metadata?.appliedAt || new Date().toISOString())
    : null

  await d1Execute(`
    UPDATE jobs_ledger 
    SET status = ?,
        triage_decision = ?,
        applied_at = COALESCE(?, applied_at),
        resume_path = COALESCE(?, resume_path),
        last_error = ?,
        roadblock_url = ?,
        roadblock_screenshot = ?,
        histories = ?,
        updated_at = datetime('now')
    WHERE id = ?
  `, [
    targetStatus,
    triageDecision,
    appliedAtVal,
    metadata?.resumePath ?? null,
    metadata?.lastError ?? null,
    metadata?.roadblockUrl ?? null,
    metadata?.roadblockScreenshot ?? null,
    JSON.stringify(historyList),
    job.id
  ])

  return { success: true }
}

export async function batchUpdateJobStatus(
  ids: (number | string)[],
  rawStatus: string,
  note = 'Batch transitioned status'
): Promise<{ success: boolean; count: number; results: Array<{ id: number | string; success: boolean; error?: string }> }> {
  if (ids.length === 0) return { success: true, count: 0, results: [] }
  const targetStatus = rawStatus.toUpperCase().trim()

  const placeholders = ids.map(() => '?').join(', ')
  const jobs = await d1Query<TriageJobRecord>(
    `SELECT id, uuid, status, triage_decision, histories FROM jobs_ledger WHERE id IN (${placeholders}) OR uuid IN (${placeholders})`,
    [...ids, ...ids]
  )
  const jobMap = new Map<string, TriageJobRecord>()
  for (const j of jobs) {
    jobMap.set(String(j.id), j)
    if (j.uuid) jobMap.set(j.uuid, j)
  }

  const results: Array<{ id: number | string; success: boolean; error?: string }> = []
  const validUpdates: Array<{ id: number | string; triageDecision: string; histories: string }> = []

  for (const id of ids) {
    const job = jobMap.get(String(id))
    if (!job) {
      results.push({ id, success: false, error: 'Job not found' })
      continue
    }

    let currentStatus = (job.status || 'CRAWLED').toUpperCase()
    if (currentStatus === 'CRAWLED' || currentStatus === 'SKIPPED_SALARY') {
      if (job.triage_decision === 'KEEP') currentStatus = 'APPROVED'
      else if (job.triage_decision === 'FILTER_OUT') currentStatus = 'DROPPED'
      else currentStatus = 'CRAWLED'
    }

    if (currentStatus === targetStatus) {
      results.push({ id, success: true })
      continue
    }

    const validNext = ALLOWED_TRANSITIONS[currentStatus] || []
    if (!validNext.includes(targetStatus)) {
      results.push({ id, success: false, error: `Invalid transition from ${currentStatus} to ${targetStatus}` })
      continue
    }

    let historyList: any[] = []
    try {
      historyList = JSON.parse(job.histories || '[]')
    } catch {}

    historyList.push({
      from_status: currentStatus,
      to_status: targetStatus,
      timestamp: new Date().toISOString(),
      note
    })

    let triageDecision = job.triage_decision || 'PENDING'
    if (targetStatus === 'APPROVED') triageDecision = 'KEEP'
    else if (targetStatus === 'DROPPED') triageDecision = 'FILTER_OUT'

    validUpdates.push({
      id: job.id,
      triageDecision,
      histories: JSON.stringify(historyList)
    })
    results.push({ id, success: true })
  }

  if (validUpdates.length > 0) {
    const defaultDecision = validUpdates[0].triageDecision
    const allSameDecision = validUpdates.every(u => u.triageDecision === defaultDecision)
    if (allSameDecision) {
      const updateIds = validUpdates.map(u => u.id)
      const updatePlaceholders = updateIds.map(() => '?').join(', ')
      await d1Execute(
        `UPDATE jobs_ledger
         SET status = ?, triage_decision = ?, updated_at = datetime('now')
         WHERE id IN (${updatePlaceholders})`,
        [targetStatus, defaultDecision, ...updateIds]
      )
    } else {
      await Promise.all(validUpdates.map(u =>
        d1Execute(
          `UPDATE jobs_ledger SET status = ?, triage_decision = ?, histories = ?, updated_at = datetime('now') WHERE id = ?`,
          [targetStatus, u.triageDecision, u.histories, u.id]
        )
      ))
    }
  }

  return { success: true, count: results.length, results }
}

export async function softDeleteJob(id: number | string, reason = 'User triage soft-delete'): Promise<boolean> {
  const job = await findJobInLedger(id)
  if (!job) return false

  let historyList: any[] = []
  try {
    historyList = JSON.parse(job.histories || '[]')
  } catch {}

  historyList.push({
    from_status: job.status,
    to_status: 'SOFT_DELETED',
    timestamp: new Date().toISOString(),
    note: reason
  })

  const res = await d1Execute(`
    UPDATE jobs_ledger 
    SET is_deleted = 1, deleted_at = datetime('now'), status = 'DROPPED', triage_decision = 'FILTER_OUT', histories = ?, updated_at = datetime('now')
    WHERE id = ?
  `, [JSON.stringify(historyList), job.id])
  return res.changes > 0
}

