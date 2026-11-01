import fs from 'fs'
import path from 'path'
import os from 'os'
import { findJobInLedger, updateJobStatus, getCandidateProfileFromDb } from '../storage/db.js'
import { d1Execute } from '../storage/cloudflareClient.js'
import { logSystemError } from '../storage/errorLogger.js'
import { generateJobDocuments } from '../generator/resumeBuilder.js'
import { getR2ObjectBuffer } from '../storage/r2Storage.js'
import { driverRegistry } from './driverRegistry.js'
import { withSubmissionBrowser } from './browserRunner.js'
import type { JobRecord, CandidateProfile, SubmissionReceipt } from './types.js'

export interface SubmitJobOptions {
  interactive?: boolean
  prefillOnly?: boolean
}

export async function submitJobApplication(
  jobId: number | string,
  options?: SubmitJobOptions
): Promise<SubmissionReceipt> {
  const job = (await findJobInLedger(jobId)) as JobRecord | null
  if (!job) {
    throw new Error(`Job #${jobId} not found in database.`)
  }

  let currentStatus = (job.status || 'CRAWLED').toUpperCase()
  if (currentStatus === 'CRAWLED' && job.triage_decision === 'KEEP') {
    currentStatus = 'APPROVED'
  }

  if (currentStatus !== 'APPROVED' && currentStatus !== 'FAILED' && currentStatus !== 'APPLYING') {
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
  await updateJobStatus(job.id, 'APPLYING', `Automated submission dispatched via ${driver.name}`, true)

  try {
    // 3. Resolve tailored resume & cover letter (cached in R2 first, fallback to generate)
    let pdfPath: string = ''
    let coverLetterText: string = job.cover_letter || ''
    const safeCompany = job.company.replace(/[^a-zA-Z0-9]/g, '_')
    const safeTitle = job.title.replace(/[^a-zA-Z0-9]/g, '_')
    const filename = job.resume_path && !job.resume_path.includes('/')
      ? job.resume_path
      : `${safeCompany}_${safeTitle}_Resume.pdf`
    const tmpPdfPath = path.join(os.tmpdir(), path.basename(filename))

    let pdfBuf = await getR2ObjectBuffer(`resumes/${filename}`)
    if (!pdfBuf || !coverLetterText) {
      const jd = job.requirements_summary || job.full_description || job.tech_stack || ''
      const docs = await generateJobDocuments(job.company, job.title, jd)
      coverLetterText = docs.coverLetter
      pdfBuf = await getR2ObjectBuffer(`resumes/${docs.filename}`)
      await d1Execute('UPDATE jobs_ledger SET cover_letter = ?, resume_path = ? WHERE id = ?', [coverLetterText, docs.filename, job.id])
    }

    if (pdfBuf) {
      fs.writeFileSync(tmpPdfPath, pdfBuf)
      pdfPath = tmpPdfPath
    }

    // 4. Parse candidate Q&A
    const questions = (job.screening_questions || '').split(' ; ').map(s => s.trim()).filter(Boolean)
    const answers = (job.candidate_answers || '').split(' ; ').map(s => s.trim()).filter(Boolean)
    const qaList = questions.map((q, idx) => ({
      question: q,
      answer: answers[idx] || ''
    }))

    const candidateProfile = await getCandidateProfileFromDb()

    // 5. Execute submission or pre-fill in isolated browser session
    let receipt: SubmissionReceipt
    try {
      receipt = await withSubmissionBrowser(
        async session => {
          const tailoredPdfWinPath = session.isWindows
            ? session.resolveUploadPath(pdfPath)
            : undefined

          return await driver.submit(session.page, {
            job,
            candidateProfile,
            tailoredPdfPath: pdfPath,
            tailoredPdfWinPath,
            resolveUploadPath: session.resolveUploadPath,
            coverLetterText,
            qaList,
            interactive: options?.interactive === true,
            prefillOnly: options?.prefillOnly === true
          })
        },
        {
          interactive: options?.interactive || options?.prefillOnly,
          keepOpen: options?.prefillOnly === true
        }
      )
    } finally {
      if (tmpPdfPath && fs.existsSync(tmpPdfPath)) {
        try { fs.unlinkSync(tmpPdfPath) } catch {}
      }
    }

    // 6. Persist receipt to jobs_ledger
    if (receipt.status !== 'PREFILLED') {
      const targetStatus = receipt.status || 'APPLIED'
      const appliedNote = `Application submitted to ${driver.name}. Receipt: ${receipt.confirmationText}`
      await updateJobStatus(job.id, targetStatus, appliedNote, true)

      // Save resume path and clear error state
      try {
        await d1Execute(`
          UPDATE jobs_ledger 
          SET resume_path = ?, applied_at = COALESCE(applied_at, ?), last_error = NULL, roadblock_url = NULL, roadblock_screenshot = NULL
          WHERE id = ?
        `, [pdfPath, receipt.submittedAt, job.id])
      } catch (e: any) {
        console.warn('[portalSubmitter] Could not update resume_path:', e.message)
      }
    } else {
      // In pre-fill mode: record the resume path and clear stale last_error, but do NOT prematurely mark APPLIED
      try {
        await d1Execute(`
          UPDATE jobs_ledger
          SET resume_path = ?, last_error = NULL
          WHERE id = ?
        `, [pdfPath, job.id])
      } catch {}
    }

    return receipt
  } catch (err: any) {
    const urlMatch = err.message.match(/https?:\/\/[^\s"'<>]+/)
    const roadblockUrl = urlMatch ? urlMatch[0] : null
    const roadblockShotKey = `screenshots/submissions/job_${job.id}_roadblock.png`

    try {
      await updateJobStatus(job.id, 'FAILED', `Application submission failed: ${err.message}`, true)
      await d1Execute(`
        UPDATE jobs_ledger
        SET last_error = ?, roadblock_url = ?, roadblock_screenshot = ?
        WHERE id = ?
      `, [err.message, roadblockUrl, roadblockShotKey, job.id])
    } catch {}

    await logSystemError(
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
