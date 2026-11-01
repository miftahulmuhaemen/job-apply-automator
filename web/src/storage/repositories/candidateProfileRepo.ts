import { d1Query, d1Execute } from "../cloudflareClient.js"

/* =========================================================
   CANDIDATE ATTRIBUTES MASTER
   ========================================================= */
export interface CandidateAttributeRecord {
  key: string
  category: string
  label: string
  description?: string | null
  value?: string | null
  status: 'RESOLVED' | 'UNRESOLVED' | 'DELEGATED_TO_AGY'
  source_portal?: string | null
  required_by_default?: number
  is_agent_delegated?: number
  updated_at?: string
}

export async function getAllCandidateAttributes(): Promise<CandidateAttributeRecord[]> {
  return await d1Query<CandidateAttributeRecord>(
    `SELECT * FROM candidate_profile_attributes ORDER BY category ASC, key ASC`
  )
}

export async function getCandidateAttribute(key: string): Promise<CandidateAttributeRecord | undefined> {
  const rows = await d1Query<CandidateAttributeRecord>(
    `SELECT * FROM candidate_profile_attributes WHERE key = ?`,
    [key]
  )
  return rows[0]
}

export async function updateCandidateAttribute(key: string, value: string): Promise<boolean> {
  const current = await getCandidateAttribute(key)
  const isDelegated = current?.is_agent_delegated === 1
  const status = isDelegated ? 'DELEGATED_TO_AGY' : (value && value.trim().length > 0) ? 'RESOLVED' : 'UNRESOLVED'
  const res = await d1Execute(
    `UPDATE candidate_profile_attributes SET value = ?, status = ?, updated_at = datetime('now') WHERE key = ?`,
    [value, status, key]
  )
  return res.changes > 0
}

export async function toggleCandidateAttributeDelegation(key: string, delegate: boolean): Promise<boolean> {
  const current = await getCandidateAttribute(key)
  if (!current) return false
  const isDelegatedNum = delegate ? 1 : 0
  const status = delegate ? 'DELEGATED_TO_AGY' : (current.value && current.value.trim().length > 0) ? 'RESOLVED' : 'UNRESOLVED'
  const res = await d1Execute(
    `UPDATE candidate_profile_attributes SET is_agent_delegated = ?, status = ?, updated_at = datetime('now') WHERE key = ?`,
    [isDelegatedNum, status, key]
  )
  return res.changes > 0
}

export async function deleteCandidateAttribute(key: string): Promise<boolean> {
  const res = await d1Execute(
    `DELETE FROM candidate_profile_attributes WHERE key = ?`,
    [key]
  )
  return res.changes > 0
}

export async function upsertCandidateAttribute(attr: Partial<CandidateAttributeRecord> & { key: string; label: string }): Promise<void> {
  const existing = await getCandidateAttribute(attr.key)
  if (existing) {
    if (attr.value !== undefined && attr.value !== null) {
      await updateCandidateAttribute(attr.key, attr.value)
    }
    return
  }
  const category = attr.category || 'custom'
  const isDelegated = attr.is_agent_delegated === 1
  const status = isDelegated ? 'DELEGATED_TO_AGY' : (attr.value && attr.value.trim().length > 0) ? 'RESOLVED' : 'UNRESOLVED'
  const desc = attr.description || null
  const portal = attr.source_portal || 'crawler'
  const req = attr.required_by_default ? 1 : 0
  const delegatedNum = isDelegated ? 1 : 0

  await d1Execute(
    `INSERT INTO candidate_profile_attributes (key, category, label, description, value, status, source_portal, required_by_default, is_agent_delegated, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    [attr.key, category, attr.label, desc, attr.value ?? null, status, portal, req, delegatedNum]
  )
}

/* =========================================================
   CANDIDATE PROFILE MASTER
   ========================================================= */
export interface CandidateProfile {
  personal: {
    fullName: string
    firstName: string
    lastName: string
    email: string
    phone: string
    whatsapp: string
    location: string
    city: string
    province: string
    postalCode: string
    country: string
    portfolio: string
    linkedin: string
    github: string
    noticePeriod: string
    employmentStatus: string
    maritalStatus: string
    workAuthorization: string
    workArrangement: string
    employmentType: string
    previousSalary: string
    expectedSalaryFloor: string
    expectedSalaryTarget: string
    targetHourlyRate: string
  }
  summary: string
  skills: {
    languages: string[]
    backend: string[]
    dataEngineering: string[]
    cloudDevOps: string[]
    noCodeAutomation?: string[]
    [key: string]: string[] | undefined
  }
  experience: Array<{
    company: string
    role: string
    location?: string
    startDate: string
    endDate: string
    highlights: string[]
  }>
  education: {
    institution: string
    degree: string
    gpa: string
    graduationDate: string
    thesis?: string
  }
  certifications: Array<{
    name: string
    issuer: string
    year: number
  }>
}

export async function getCandidateProfileFromDb(): Promise<CandidateProfile> {
  const records = await getAllCandidateAttributes()
  const map = new Map<string, string>()
  for (const r of records) {
    if (r.value !== null && r.value !== undefined) {
      map.set(r.key, r.value)
    }
  }

  const fullName = map.get('full_name') || ''
  const nameParts = fullName.trim().split(/\s+/)
  const firstName = map.get('first_name') || (nameParts[0] || '')
  const lastName = map.get('last_name') || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : firstName)

  // Parse skills
  let skills: CandidateProfile['skills'] = {
    languages: ['Golang', 'TypeScript', 'JavaScript', 'Python', 'Rust', 'PHP', 'SQL'],
    backend: ['Go (net/http, Gin, Fiber, Echo v4)', 'Node.js (NestJS, Express)', 'REST APIs', 'WebSocket', 'Microservices'],
    dataEngineering: ['Apache Airflow', 'Metabase', 'Great Expectations', 'ETL / ELT Pipelines', 'GCP Pub/Sub', 'PostgreSQL', 'MySQL', 'MongoDB', 'Redis', 'Data Warehousing'],
    cloudDevOps: ['Docker', 'Kubernetes (GKE, AKS)', 'AWS (Bedrock, S3, EC2)', 'Google Cloud Platform', 'Microsoft Azure', 'CI/CD (GitHub Actions)'],
    noCodeAutomation: ['n8n Workflow Automation', 'Cursor', 'AI Agent Workflows', 'Qore (Low-code)']
  }

  // Parse experience
  let experience: CandidateProfile['experience'] = [
    {
      company: map.get('experience_company') || 'Blue Sky Tech (Bythen AI)',
      role: map.get('experience_role') || 'Data and Backend Engineer',
      location: 'Remote',
      startDate: map.get('experience_start_date') || '2025-03',
      endDate: map.get('experience_end_date') || '2026-06',
      highlights: [
        'Architected foundational analytical Data Warehouse using star schema, orchestrating scheduled batch pipelines in Python/Airflow to aggregate millions of operational records into Metabase dashboards.',
        'Engineered core Go microservices and event-driven task queue backed by GCP Pub/Sub and webhook callbacks, decoupling long-running GPU generative rendering clusters from API gateways.',
        'Embedded automated data quality assertions with Great Expectations in Airflow DAGs, preventing corrupt schema metrics and upstream pipeline failures.'
      ]
    },
    {
      company: 'Feedloop AI',
      role: 'Software Engineer',
      location: 'Remote',
      startDate: '2022-12',
      endDate: '2024-11',
      highlights: [
        'Engineered an integrated AI legal document analysis platform to parse dense multi-page laws (100+ pages), detect cross-regulatory contradictions, and provide automated compliance insights for new legislation.',
        'Collaborated with the engineering team to administer 3 production Kubernetes clusters across GKE and AKS, conducting daily cluster monitoring, service incident triage, and PostgreSQL database migrations to achieve a 20% reduction in downtime.',
        'Delivered full-stack platforms for 5 enterprise clients using Feedloop proprietary low-code engine (Qore) and Google Cloud Functions, accelerating delivery velocity by 30%.'
      ]
    },
    {
      company: 'PT Arkan Jaya Nusantara',
      role: 'Software Engineer',
      location: 'Indonesia',
      startDate: '2021-01',
      endDate: '2022-11',
      highlights: [
        'Integrated multiple disparate medical peripheral devices (pulse oximeters, blood pressure monitors, single-lead ECG) into a unified continuous vital-sign monitoring platform.',
        'Built an event-driven telemetry ingestion engine in Go and MongoDB time-series storage with automated peripheral reconnection state machines, improving transmission reliability by 25%.',
        'Developed high-performance clinician workstation interfaces in React and TypeScript with canvas-based ECG waveform streaming, and established CI/CD Docker deployment pipelines.'
      ]
    }
  ]
  if (map.has('experience_json')) {
    try {
      experience = JSON.parse(map.get('experience_json')!)
    } catch {}
  }

  // Parse certifications
  let certifications: CandidateProfile['certifications'] = [
    { name: 'AWS Certified Cloud Practitioner', issuer: 'Amazon Web Services', year: 2025 },
    { name: 'Data Engineer Associate', issuer: 'DataCamp', year: 2025 },
    { name: 'Azure AI Fundamentals', issuer: 'Microsoft', year: 2023 },
    { name: 'Azure Data Fundamentals', issuer: 'Microsoft', year: 2023 },
    { name: 'Azure Fundamentals', issuer: 'Microsoft', year: 2023 },
    { name: 'Certified Web Programmer (CWP)', issuer: 'BNSP', year: 2022 }
  ]
  if (map.has('certifications_json')) {
    try {
      certifications = JSON.parse(map.get('certifications_json')!)
    } catch {}
  }

  return {
    personal: {
      fullName,
      firstName,
      lastName,
      email: map.get('email') || '',
      phone: map.get('phone') || '',
      whatsapp: map.get('whatsapp') || map.get('phone') || '',
      location: map.get('location') || '',
      city: map.get('city') || '',
      province: map.get('province') || '',
      postalCode: map.get('postal_code') || '',
      country: map.get('country') || 'Indonesia',
      portfolio: map.get('portfolio') || '',
      linkedin: map.get('linkedin') || '',
      github: map.get('github') || '',
      noticePeriod: map.get('notice_period') || 'Immediately / ASAP',
      employmentStatus: map.get('employment_status') || 'Actively Looking',
      maritalStatus: map.get('marital_status') || 'Single',
      workAuthorization: map.get('work_authorization') || 'Indonesian Citizen (WNI), no visa sponsorship required',
      workArrangement: map.get('work_arrangement') || 'All arrangements acceptable (Remote, Hybrid, On-site / WFO)',
      employmentType: map.get('employment_type') || 'Permanent or Contract (>= 3 months). No internships.',
      previousSalary: map.get('salary_before') || 'Undisclosed',
      expectedSalaryFloor: map.get('salary_expected_floor') || 'IDR 8.000.000 / month',
      expectedSalaryTarget: map.get('salary_expected_target') || 'IDR 10.000.000 - 15.000.000 / month',
      targetHourlyRate: map.get('target_hourly_rate') || '$25 / hour'
    },
    summary: map.get('summary') || 'Results-oriented Software & Data Engineer with 5 years of professional experience across Go backend systems, distributed microservices, ETL pipelines, and cloud infrastructure.',
    skills,
    experience,
    education: {
      institution: map.get('school') || '',
      degree: map.get('degree') || '',
      gpa: map.get('gpa') || '',
      graduationDate: map.get('education_end_date') || '',
      thesis: map.get('thesis') || 'Convolutional Neural Network analysis on aerial imagery'
    },
    certifications
  }
}

