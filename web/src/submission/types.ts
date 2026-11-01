import type { Page, Browser } from 'puppeteer-core'
import type { CandidateProfile } from '../storage/db.js'

export type { CandidateProfile }

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
  cover_letter?: string | null
  uuid?: string | null
  histories?: string | null
}

export interface SubmissionContext {
  job: JobRecord
  candidateProfile: CandidateProfile
  tailoredPdfPath: string
  tailoredPdfWinPath?: string
  resolveUploadPath?: (filePath: string) => string
  coverLetterText: string
  qaList: Array<{ question: string; answer: string }>
  interactive?: boolean
  prefillOnly?: boolean
}

export interface SubmissionReceipt {
  success: boolean
  portal: string
  status?: 'APPLIED' | 'SUBMITTED (NOT VERIFY-ABLE)' | 'PREFILLED'
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
  receiptScreenshotPath?: string
  r2ScreenshotKey?: string
}

export interface PortalDriver {
  readonly id: string
  readonly name: string
  canHandle(job: { portal?: string | null; job_url: string }): boolean
  submit(page: Page, context: SubmissionContext): Promise<SubmissionReceipt>
}
