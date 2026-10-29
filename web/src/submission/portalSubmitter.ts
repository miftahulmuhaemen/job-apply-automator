import fs from 'fs'
import path from 'path'
import { db, updateJobStatus } from '../storage/db.js'
import { logSystemError } from '../storage/errorLogger.js'
import { generateJobDocuments } from '../generator/resumeBuilder.js'
import { driverRegistry } from './driverRegistry.js'
import { withSubmissionBrowser } from './browserRunner.js'
import type { JobRecord, CandidateProfile, SubmissionReceipt } from './types.js'

function loadCandidateProfile(): CandidateProfile {
  const profilePath = path.resolve(process.cwd(), 'data/candidateProfile.json')
  const raw = fs.readFileSync(profilePath, 'utf8')
  return JSON.parse(raw) as CandidateProfile
}

export async function submitJobApplication(jobId: number | string): Promise<SubmissionReceipt> {
  const job = db.prepare('SELECT * FROM jobs_ledger WHERE id = ? OR uuid = ?').get(jobId, jobId) as JobRecord | undefined
  if (!job) {
    throw new Error(`Job #${jobId} not found in database.`)
  }

  let currentStatus = (job.status || 'CRAWLED').toUpperCase()
  if (currentStatus === 'CRAWLED' && job.triage_decision === 'KEEP') {
    currentStatus = 'APPROVED'
  }

  if (currentStatus !== 'APPROVED' && currentStatus !== 'FAILED') {
    throw new Error(
      `Cannot submit application. Job status is ${currentStatus}; job must first be APPROVED before submission.`
    )
  }

  // 1. Locate portal driver
  const driver = driverRegistry.findDriverForJob(job)
  if (!driver) {
    const supported = driverRegistry.getSupportedDrivers().map(d => d.name).join(', ')
    throw new Error(
      `Automated submission is not supported yet for portal "${job.portal || 'Unknown'}". Supported portals: ${supported}.`
    )
  }

  // 2. Transition status to APPLYING (system locked state)
  updateJobStatus(job.id, 'APPLYING', `Automated submission dispatched via ${driver.name}`, true)

  try {
    // 3. Generate tailored resume & cover letter
    const jd = job.requirements_summary || job.full_description || job.tech_stack || ''
    const docs = await generateJobDocuments(job.company, job.title, jd)

    // 4. Parse candidate Q&A
    const questions = (job.screening_questions || '').split(' ; ').map(s => s.trim()).filter(Boolean)
    const answers = (job.candidate_answers || '').split(' ; ').map(s => s.trim()).filter(Boolean)
    const qaList = questions.map((q, idx) => ({
      question: q,
      answer: answers[idx] || ''
    }))

    const candidateProfile = loadCandidateProfile()

    // 5. Execute live submission in isolated browser session
    const receipt = await withSubmissionBrowser(async session => {
      const tailoredPdfWinPath = session.isWindows
        ? session.resolveUploadPath(docs.pdfPath)
        : undefined

      return await driver.submit(session.page, {
        job,
        candidateProfile,
        tailoredPdfPath: docs.pdfPath,
        tailoredPdfWinPath,
        coverLetterText: docs.coverLetter,
        qaList
      })
    })

    // 6. Persist receipt to jobs_ledger
    const targetStatus = receipt.status || 'APPLIED'
    const appliedNote = `Application submitted to ${driver.name}. Receipt: ${receipt.confirmationText}`
    updateJobStatus(job.id, targetStatus, appliedNote, true)

    // Save resume path and clear error state
    try {
      db.prepare(`
        UPDATE jobs_ledger 
        SET resume_path = ?, applied_at = COALESCE(applied_at, ?), last_error = NULL, roadblock_url = NULL, roadblock_screenshot = NULL
        WHERE id = ?
      `).run(docs.pdfPath, receipt.submittedAt, job.id)
    } catch (e: any) {
      console.warn('[portalSubmitter] Could not update resume_path:', e.message)
    }

    return receipt
  } catch (err: any) {
    const urlMatch = err.message.match(/https?:\/\/[^\s"'<>]+/)
    const roadblockUrl = urlMatch ? urlMatch[0] : null
    const roadblockShotPath = path.resolve(process.cwd(), `data/screenshots/submissions/job_${job.id}_roadblock.png`)
    const hasRoadblockShot = fs.existsSync(roadblockShotPath) ? roadblockShotPath : null

    try {
      updateJobStatus(job.id, 'FAILED', `Application submission failed: ${err.message}`, true)
      db.prepare(`
        UPDATE jobs_ledger
        SET last_error = ?, roadblock_url = ?, roadblock_screenshot = ?
        WHERE id = ?
      `).run(err.message, roadblockUrl, hasRoadblockShot, job.id)
    } catch {}

    logSystemError(
      'SUBMISSION',
      'portalSubmitter',
      `Submission failed for Job #${job.id} (${job.company} - ${job.title}): ${err.message}`,
      { jobId: job.id, company: job.company, portal: job.portal, error: err.message, roadblockUrl },
      'ERROR'
    )

    throw err
  }
}

export interface BatchSubmissionItemResult {
  id: number | string
  success: boolean
  receipt?: SubmissionReceipt
  error?: string
}

export async function submitBatchApplications(
  jobIds: Array<number | string>,
  cooldownMs = 4000
): Promise<BatchSubmissionItemResult[]> {
  const results: BatchSubmissionItemResult[] = []

  for (let i = 0; i < jobIds.length; i++) {
    const jobId = jobIds[i]
    try {
      const receipt = await submitJobApplication(jobId)
      results.push({ id: jobId, success: true, receipt })
    } catch (err: any) {
      results.push({ id: jobId, success: false, error: err.message })
    }

    // Cooling interval between portal submissions
    if (i < jobIds.length - 1 && cooldownMs > 0) {
      await new Promise(r => setTimeout(r, cooldownMs))
    }
  }

  return results
}
