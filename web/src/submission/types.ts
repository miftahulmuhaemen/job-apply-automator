import type { Page, Browser } from 'puppeteer-core'

export interface CandidateProfile {
  personal: {
    fullName: string
    email: string
    phone: string
    whatsapp: string
    location: string
    portfolio: string
    linkedin: string
    github: string
    noticePeriod: string
    employmentStatus: string
    maritalStatus: string
    workAuthorization: string
    workArrangement: string
    employmentType: string
  }
  summary: string
  skills: Record<string, string[]>
  experience: Array<{
    company: string
    role: string
    location: string
    startDate: string
    endDate: string
    highlights: string[]
  }>
}

export interface JobRecord {
  id: number
  job_id?: string | null
  company: string
  title: string
  portal?: string | null
  job_url: string
  location?: string | null
  status: string
  triage_decision?: string | null
  requirements_summary?: string | null
  full_description?: string | null
  tech_stack?: string | null
  screening_questions?: string | null
  candidate_answers?: string | null
  resume_path?: string | null
  uuid?: string | null
  histories?: string | null
}

export interface SubmissionContext {
  job: JobRecord
  candidateProfile: CandidateProfile
  tailoredPdfPath: string
  tailoredPdfWinPath?: string
  coverLetterText: string
  qaList: Array<{ question: string; answer: string }>
}

export interface SubmissionReceipt {
  success: boolean
  portal: string
  status?: 'APPLIED' | 'SUBMITTED (NOT VERIFY-ABLE)'
  confirmationUrl: string
  confirmationText: string
  screenshotPaths: {
    initialPage?: string
    modalOpened?: string
    formFilled?: string
    confirmed: string
  }
  submittedAt: string
  note: string
  error?: string
}

export interface PortalDriver {
  readonly id: string
  readonly name: string
  canHandle(job: { portal?: string | null; job_url: string }): boolean
  submit(page: Page, context: SubmissionContext): Promise<SubmissionReceipt>
}
