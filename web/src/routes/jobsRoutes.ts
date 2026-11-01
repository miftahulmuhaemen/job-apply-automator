import http from 'node:http'
import path from 'node:path'
import {
  getTriageJobs,
  updateTriageDecision,
  updateJobStatus,
  batchUpdateJobStatus,
  findJobInLedger,
  softDeleteJob
} from '../storage/db.js'
import { submitJobApplication, submitBatchApplications } from '../submission/portalSubmitter.js'
import { generateFormFillPreview } from '../generator/formPreview.js'
import { getR2ObjectBuffer, listR2Objects } from '../storage/r2Storage.js'
import { readJsonBody, sendJson } from './routeUtils.js'

async function findSubmissionScreenshotBuffer(job: any): Promise<{ buffer: Buffer; filename: string } | null> {
  const idStr = String(job.id)
  if (job.roadblock_screenshot && job.roadblock_screenshot.startsWith('screenshots/')) {
    const buf = await getR2ObjectBuffer(job.roadblock_screenshot)
    if (buf) return { buffer: buf, filename: path.basename(job.roadblock_screenshot) }
  }

  const allObjects = await listR2Objects('screenshots/submissions/')
  const keys = allObjects.map(o => o.key)

  const receiptKey = keys.find(k =>
    (k.includes(`receipt_${idStr}_`) || k.includes(`receipt_${idStr}.`) || k.includes(`_receipt_${idStr}`) || k.endsWith(`job_${idStr}_confirmed.png`) || k.includes(`${idStr}_receipt`))
  )
  if (receiptKey) {
    const buf = await getR2ObjectBuffer(receiptKey)
    if (buf) return { buffer: buf, filename: path.basename(receiptKey) }
  }

  const filledKey = keys.find(k => k.includes(`filled_${idStr}`) || k.includes(`${idStr}_filled`))
  if (filledKey) {
    const buf = await getR2ObjectBuffer(filledKey)
    if (buf) return { buffer: buf, filename: path.basename(filledKey) }
  }

  const roadblockKey = keys.find(k => k.includes(`roadblock_${idStr}`) || k.endsWith(`job_${idStr}_roadblock.png`))
  if (roadblockKey) {
    const buf = await getR2ObjectBuffer(roadblockKey)
    if (buf) return { buffer: buf, filename: path.basename(roadblockKey) }
  }

  const anyKey = keys.find(k => k.includes(`_${idStr}_`) || k.includes(`_${idStr}.`))
  if (anyKey) {
    const buf = await getR2ObjectBuffer(anyKey)
    if (buf) return { buffer: buf, filename: path.basename(anyKey) }
  }

  return null
}

export async function handleJobsRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string
): Promise<boolean> {
  if (pathname === '/api/jobs' && req.method === 'GET') {
    try {
      const jobs = await getTriageJobs()
      sendJson(res, 200, { success: true, count: jobs.length, data: jobs })
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  const decisionMatch = pathname.match(/^\/api\/jobs\/([^\/]+)\/decision$/)
  if (decisionMatch && req.method === 'POST') {
    const jobId = decisionMatch[1]
    try {
      const parsed = await readJsonBody(req)
      const decision = parsed.decision === 'KEEP' ? 'KEEP' : 'FILTER_OUT'
      const updated = await updateTriageDecision(jobId, decision)
      sendJson(res, 200, { success: updated, id: jobId, decision })
    } catch (err: any) {
      sendJson(res, 400, { success: false, error: err.message })
    }
    return true
  }

  const statusMatch = pathname.match(/^\/api\/jobs\/([^\/]+)\/status$/)
  if (statusMatch && req.method === 'POST') {
    const jobId = statusMatch[1]
    try {
      const parsed = await readJsonBody(req)
      const newStatus = (parsed.status || 'CRAWLED').toUpperCase()

      let existingJob = null
      if (newStatus === 'APPROVED' || newStatus === 'SUBMITTED' || newStatus === 'APPLIED') {
        existingJob = await findJobInLedger(jobId)
        if (existingJob) {
          const preview = await generateFormFillPreview(existingJob)
          if (preview.isBlocked) {
            sendJson(res, 400, {
              success: false,
              error: `Action Blocked: ${preview.unresolvedRequiredCount} mandatory application field(s) are NOT SPECIFIED in Candidate Profile. Please resolve all required attributes in the Profile table menu before proceeding.`,
              unresolvedKeys: preview.unresolvedKeys
            })
            return true
          }
        }
      }

      const note = parsed.note || `Transitioned to ${newStatus} via action popover`
      const updateResult = await updateJobStatus(jobId, newStatus, note, false, existingJob)
      if (!updateResult.success) {
        sendJson(res, 400, { success: false, error: updateResult.error })
        return true
      }
      sendJson(res, 200, { success: true, id: jobId, status: newStatus })
    } catch (err: any) {
      sendJson(res, 400, { success: false, error: err.message })
    }
    return true
  }

  const submitMatch = pathname.match(/^\/api\/jobs\/([^\/]+)\/submit$/)
  if (submitMatch && req.method === 'POST') {
    const jobId = submitMatch[1]
    try {
      let body: any = {}
      try {
        body = await readJsonBody(req)
      } catch {}
      const interactive = body?.interactive === true

      const job = await findJobInLedger(jobId)
      if (job) {
        const preview = await generateFormFillPreview(job)
        if (preview.isBlocked) {
          sendJson(res, 400, {
            success: false,
            error: `Submission Blocked: ${preview.unresolvedRequiredCount} mandatory application field(s) are NOT SPECIFIED in Candidate Profile. Please resolve all required attributes in the Profile table menu before proceeding.`,
            unresolvedKeys: preview.unresolvedKeys
          })
          return true
        }
      }

      const receipt = await submitJobApplication(jobId, { interactive })
      sendJson(res, 200, {
        success: true,
        id: jobId,
        status: 'APPLIED',
        applied_at: receipt.submittedAt,
        receipt,
        message: receipt.confirmationText
      })
    } catch (err: any) {
      sendJson(res, 400, { success: false, error: err.message })
    }
    return true
  }

  const prefillMatch = pathname.match(/^\/api\/jobs\/([^\/]+)\/prefill$/)
  if (prefillMatch && req.method === 'POST') {
    const jobId = prefillMatch[1]
    try {
      const job = await findJobInLedger(jobId)
      if (!job) {
        sendJson(res, 404, { success: false, error: 'Job not found' })
        return true
      }

      const preview = await generateFormFillPreview(job)
      if (preview.isBlocked) {
        sendJson(res, 400, {
          success: false,
          error: `Pre-fill Blocked: ${preview.unresolvedRequiredCount} mandatory application field(s) are NOT SPECIFIED in Candidate Profile.`,
          unresolvedKeys: preview.unresolvedKeys
        })
        return true
      }

      const receipt = await submitJobApplication(jobId, { prefillOnly: true })
      sendJson(res, 200, {
        success: true,
        id: jobId,
        status: 'PREFILLED',
        message: receipt.confirmationText,
        receipt
      })
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  const markAppliedMatch = pathname.match(/^\/api\/jobs\/([^\/]+)\/mark-applied$/)
  if (markAppliedMatch && req.method === 'POST') {
    const jobId = markAppliedMatch[1]
    try {
      const job = await findJobInLedger(jobId)
      if (!job) {
        sendJson(res, 404, { success: false, error: 'Job not found' })
        return true
      }

      const appliedAt = new Date().toISOString().replace('T', ' ').substring(0, 19)
      const note = 'Application marked as submitted manually by user after pre-fill'
      await updateJobStatus(job.id, 'APPLIED', note, true)

      sendJson(res, 200, {
        success: true,
        id: jobId,
        status: 'APPLIED',
        applied_at: appliedAt,
        message: 'Job marked as submitted manually.'
      })
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  const softDeleteMatch = pathname.match(/^\/api\/jobs\/([^\/]+)\/soft-delete$/)
  if (softDeleteMatch && req.method === 'POST') {
    const jobId = softDeleteMatch[1]
    try {
      const parsed = await readJsonBody(req)
      const reason = parsed.reason || 'User soft-delete from action popover'
      const updated = await softDeleteJob(jobId, reason)
      sendJson(res, 200, { success: updated, id: jobId, action: 'soft-delete' })
    } catch (err: any) {
      sendJson(res, 400, { success: false, error: err.message })
    }
    return true
  }

  if (pathname === '/api/jobs/batch-status' && req.method === 'POST') {
    try {
      const parsed = await readJsonBody(req)
      const { jobIds, status, note } = parsed
      if (!Array.isArray(jobIds) || jobIds.length === 0) {
        sendJson(res, 400, { success: false, error: 'jobIds array is required' })
        return true
      }
      const targetStatus = (status || '').toUpperCase()
      const batchRes = await batchUpdateJobStatus(jobIds, targetStatus, note || `Batch transitioned to ${targetStatus}`)
      sendJson(res, 200, batchRes)
    } catch (err: any) {
      sendJson(res, 400, { success: false, error: err.message })
    }
    return true
  }

  if (pathname === '/api/jobs/batch-submit' && req.method === 'POST') {
    try {
      const parsed = await readJsonBody(req)
      const { jobIds } = parsed
      if (!Array.isArray(jobIds) || jobIds.length === 0) {
        sendJson(res, 400, { success: false, error: 'jobIds array is required' })
        return true
      }
      const results = await submitBatchApplications(jobIds)
      const successCount = results.filter(r => r.success).length
      sendJson(res, 200, { success: true, count: results.length, successCount, results })
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  const receiptShotMatch = pathname.match(/^\/api\/jobs\/([^\/]+)\/receipt-screenshot$/)
  if (receiptShotMatch && (req.method === 'GET' || req.method === 'HEAD')) {
    const jobId = receiptShotMatch[1]
    try {
      const job = await findJobInLedger(jobId)
      if (!job) {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Job not found')
        return true
      }
      const screenshot = await findSubmissionScreenshotBuffer(job)
      if (!screenshot) {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('No submission screenshot available for this job.')
        return true
      }
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': screenshot.buffer.length
      })
      if (req.method === 'HEAD') {
        res.end()
        return true
      }
      res.end(screenshot.buffer)
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end(`Error reading screenshot: ${err.message}`)
    }
    return true
  }

  const roadblockShotMatch = pathname.match(/^\/api\/jobs\/([^\/]+)\/roadblock-screenshot$/)
  if (roadblockShotMatch && (req.method === 'GET' || req.method === 'HEAD')) {
    const jobId = roadblockShotMatch[1]
    try {
      const job = await findJobInLedger(jobId)
      if (!job) {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Job not found')
        return true
      }
      const screenshot = await findSubmissionScreenshotBuffer(job)
      if (!screenshot) {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('No roadblock screenshot available for this job.')
        return true
      }
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Content-Length': screenshot.buffer.length
      })
      if (req.method === 'HEAD') {
        res.end()
        return true
      }
      res.end(screenshot.buffer)
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end(`Error reading roadblock screenshot: ${err.message}`)
    }
    return true
  }

  return false
}
