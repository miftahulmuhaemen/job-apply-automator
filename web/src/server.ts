import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  db,
  getTriageJobs,
  updateTriageDecision,
  updateJobStatus,
  softDeleteJob,
  getApprovedShortlist,
  getPersonalizationRules,
  addPersonalizationRule,
  updatePersonalizationRule,
  deletePersonalizationRule,
  togglePersonalizationRule,
  softDeletePersonalizationRule,
  restorePersonalizationRule,
  getSchedulerSettings,
  updateSchedulerSettings,
  getRecordedScheduleRuns,
  getCompanies,
  getCompanyJobs,
  getWebsites,
  addWebsite,
  updateWebsite,
  deleteWebsite,
  toggleWebsiteAllowed,
  getCliAgentSettings,
  updateCliAgentSettings,
  getAllCandidateAttributes,
  updateCandidateAttribute,
  upsertCandidateAttribute,
  hydrateFromD1
} from './storage/db.js'
import { checkPortalSessions, launchPortalAuth } from '../../scripts/auth.js'
import { generateJobDocuments } from './generator/resumeBuilder.js'
import { generateFormFillPreview } from './generator/formPreview.js'
import { buildCandidatePortfolioPdf } from './generator/portfolioBuilder.js'
import { checkCliAgentStatus, invokeCliAgent } from './agent/cliAgent.js'
import { submitJobApplication, submitBatchApplications } from './submission/portalSubmitter.js'
import { driverRegistry } from './submission/driverRegistry.js'
import {
  getSystemErrors,
  resolveSystemError,
  clearResolvedErrors,
  getUnresolvedErrorCount,
  logSystemError
} from './storage/errorLogger.js'
import { D1_DATABASE_ID, D1_DATABASE_NAME, queryD1 } from './storage/cfD1.js'
import { R2_BUCKET_NAME, listR2Objects, getR2ObjectBuffer, uploadToR2 } from './storage/r2Storage.js'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PUBLIC_DIR = path.join(__dirname, '..', 'public')
const RUST_CLI_PATH = path.resolve(__dirname, '../../cli/target/release/job-apply-cli')

async function triggerRustScheduleRun(force = false): Promise<{ success: boolean; output: string }> {
  try {
    const args = ['schedule', '--once']
    if (force) args.push('--force')
    const { stdout, stderr } = await execFileAsync(RUST_CLI_PATH, args, { timeout: 300000 })
    return { success: true, output: (stdout + '\n' + stderr).trim() }
  } catch (err: any) {
    return { success: false, output: err.message }
  }
}

function startDailySchedulerDaemon() {
  console.log('[SCHEDULER] Daily scheduler daemon initialized (invoking Native Rust CLI)...')
  triggerRustScheduleRun(false).catch(err => {
    console.warn('[SCHEDULER] Startup catch-up trigger error:', err.message)
  })

  setInterval(() => {
    triggerRustScheduleRun(false).catch(() => {})
  }, 60000)
}

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3100

function readJsonBody(req: http.IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', chunk => { body += chunk })
    req.on('end', () => {
      if (!body.trim()) return resolve({})
      try {
        resolve(JSON.parse(body))
      } catch (err) {
        reject(err)
      }
    })
    req.on('error', reject)
  })
}

function findJobInLedger(identifier: string) {
  const numericId = (identifier.includes('-') ? identifier.split('-').pop() : identifier) || identifier
  return db.prepare('SELECT * FROM jobs_ledger WHERE id = ? OR uuid = ?').get(numericId, identifier) as any
}

export function startWebServer(port: number = PORT): http.Server {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const pathname = url.pathname

    // Enable CORS for local dev
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    // Helper for JSON responses
    const sendJson = (statusCode: number, data: any) => {
      res.writeHead(statusCode, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(data))
    }

    /* ---------------------------------------------------------
       JOBS API ROUTES
       --------------------------------------------------------- */
    if (pathname === '/api/jobs' && req.method === 'GET') {
      try {
        const jobs = getTriageJobs()
        sendJson(200, { success: true, count: jobs.length, data: jobs })
      } catch (err: any) {
        sendJson(500, { success: false, error: err.message })
      }
      return
    }


    const decisionMatch = pathname.match(/^\/api\/jobs\/([^\/]+)\/decision$/)
    if (decisionMatch && req.method === 'POST') {
      const jobId = decisionMatch[1]
      try {
        const parsed = await readJsonBody(req)
        const decision = parsed.decision === 'KEEP' ? 'KEEP' : 'FILTER_OUT'
        const updated = updateTriageDecision(jobId, decision)
        sendJson(200, { success: updated, id: jobId, decision })
      } catch (err: any) {
        sendJson(400, { success: false, error: err.message })
      }
      return
    }

    const statusMatch = pathname.match(/^\/api\/jobs\/([^\/]+)\/status$/)
    if (statusMatch && req.method === 'POST') {
      const jobId = statusMatch[1]
      try {
        const parsed = await readJsonBody(req)
        const newStatus = (parsed.status || 'CRAWLED').toUpperCase()

        // Strict Gate Invariant: Block promotion to APPROVED or SUBMITTED if required fields are NOT SPECIFIED
        if (newStatus === 'APPROVED' || newStatus === 'SUBMITTED' || newStatus === 'APPLIED') {
          const job = findJobInLedger(jobId)
          if (job) {
            const preview = generateFormFillPreview(job)
            if (preview.isBlocked) {
              sendJson(400, {
                success: false,
                error: `Action Blocked: ${preview.unresolvedRequiredCount} mandatory application field(s) are NOT SPECIFIED in Candidate Profile. Please resolve all required attributes in the Profile table menu before proceeding.`,
                unresolvedKeys: preview.unresolvedKeys
              })
              return
            }
          }
        }

        const note = parsed.note || `Transitioned to ${newStatus} via action popover`
        const res = updateJobStatus(jobId, newStatus, note, false)
        if (!res.success) {
          sendJson(400, { success: false, error: res.error })
          return
        }
        sendJson(200, { success: true, id: jobId, status: newStatus })
      } catch (err: any) {
        sendJson(400, { success: false, error: err.message })
      }
      return
    }

    const submitMatch = pathname.match(/^\/api\/jobs\/([^\/]+)\/submit$/)
    if (submitMatch && req.method === 'POST') {
      const jobId = submitMatch[1]
      try {
        // Strict Gate Invariant: Block submission if required fields are NOT SPECIFIED
        const job = findJobInLedger(jobId)
        if (job) {
          const preview = generateFormFillPreview(job)
          if (preview.isBlocked) {
            sendJson(400, {
              success: false,
              error: `Submission Blocked: ${preview.unresolvedRequiredCount} mandatory application field(s) are NOT SPECIFIED in Candidate Profile. Please resolve all required attributes in the Profile table menu before proceeding.`,
              unresolvedKeys: preview.unresolvedKeys
            })
            return
          }
        }

        const receipt = await submitJobApplication(jobId)
        sendJson(200, {
          success: true,
          id: jobId,
          status: 'APPLIED',
          applied_at: receipt.submittedAt,
          receipt,
          message: receipt.confirmationText
        })
      } catch (err: any) {
        sendJson(400, { success: false, error: err.message })
      }
      return
    }

    const softDeleteMatch = pathname.match(/^\/api\/jobs\/([^\/]+)\/soft-delete$/)
    if (softDeleteMatch && req.method === 'POST') {
      const jobId = softDeleteMatch[1]
      try {
        const parsed = await readJsonBody(req)
        const reason = parsed.reason || 'User soft-delete from action popover'
        const updated = softDeleteJob(jobId, reason)
        sendJson(200, { success: updated, id: jobId, action: 'soft-delete' })
      } catch (err: any) {
        sendJson(400, { success: false, error: err.message })
      }
      return
    }

    if (pathname === '/api/system/hydrate' && req.method === 'POST') {
      try {
        hydrateFromD1()
        sendJson(200, { success: true, message: 'Hydrated in-memory store from Cloudflare D1 amiya.' })
      } catch (err: any) {
        sendJson(500, { success: false, error: err.message })
      }
      return
    }

    if (pathname === '/api/jobs/batch-status' && req.method === 'POST') {
      try {
        const parsed = await readJsonBody(req)
        const { jobIds, status, note } = parsed
        if (!Array.isArray(jobIds) || jobIds.length === 0) {
          sendJson(400, { success: false, error: 'jobIds array is required' })
          return
        }
        const targetStatus = (status || '').toUpperCase()
        const results = []
        for (const id of jobIds) {
          const res = updateJobStatus(id, targetStatus, note || `Batch transitioned to ${targetStatus}`, false)
          results.push({ id, success: res.success, error: res.error })
        }
        sendJson(200, { success: true, count: results.length, results })
      } catch (err: any) {
        sendJson(400, { success: false, error: err.message })
      }
      return
    }

    if (pathname === '/api/jobs/batch-submit' && req.method === 'POST') {
      try {
        const parsed = await readJsonBody(req)
        const { jobIds } = parsed
        if (!Array.isArray(jobIds) || jobIds.length === 0) {
          sendJson(400, { success: false, error: 'jobIds array is required' })
          return
        }
        const results = await submitBatchApplications(jobIds)
        const successCount = results.filter(r => r.success).length
        sendJson(200, { success: true, count: results.length, successCount, results })
      } catch (err: any) {
        sendJson(500, { success: false, error: err.message })
      }
      return
    }

    const receiptShotMatch = pathname.match(/^\/api\/jobs\/([^\/]+)\/receipt-screenshot$/)
    if (receiptShotMatch && req.method === 'GET') {
      const jobId = receiptShotMatch[1]
      try {
        const job = findJobInLedger(jobId)
        if (!job) {
          res.writeHead(404, { 'Content-Type': 'text/plain' })
          res.end('Job not found')
          return
        }
        const screenshotPath = path.resolve(process.cwd(), `data/screenshots/submissions/job_${job.id}_confirmed.png`)
        if (!fs.existsSync(screenshotPath)) {
          res.writeHead(404, { 'Content-Type': 'text/plain' })
          res.end('No submission screenshot available for this job.')
          return
        }
        const stat = fs.statSync(screenshotPath)
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Content-Length': stat.size
        })
        fs.createReadStream(screenshotPath).pipe(res)
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end(`Error reading screenshot: ${err.message}`)
      }
      return
    }

    const roadblockShotMatch = pathname.match(/^\/api\/jobs\/([^\/]+)\/roadblock-screenshot$/)
    if (roadblockShotMatch && req.method === 'GET') {
      const jobId = roadblockShotMatch[1]
      try {
        const job = findJobInLedger(jobId)
        if (!job) {
          res.writeHead(404, { 'Content-Type': 'text/plain' })
          res.end('Job not found')
          return
        }
        let screenshotPath = path.resolve(process.cwd(), `data/screenshots/submissions/job_${job.id}_roadblock.png`)
        if (!fs.existsSync(screenshotPath)) {
          screenshotPath = path.resolve(process.cwd(), `data/screenshots/submissions/job_${job.id}_confirmed.png`)
        }
        if (!fs.existsSync(screenshotPath)) {
          res.writeHead(404, { 'Content-Type': 'text/plain' })
          res.end('No roadblock screenshot available for this job.')
          return
        }
        const stat = fs.statSync(screenshotPath)
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Content-Length': stat.size
        })
        fs.createReadStream(screenshotPath).pipe(res)
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end(`Error reading roadblock screenshot: ${err.message}`)
      }
      return
    }

    if (pathname === '/api/submission/drivers' && req.method === 'GET') {
      sendJson(200, {
        success: true,
        drivers: driverRegistry.getSupportedDrivers()
      })
      return
    }

    /* ---------------------------------------------------------
       TAILORED RESUME & COVER LETTER API ROUTES
       --------------------------------------------------------- */
    const documentsMatch = pathname.match(/^\/api\/jobs\/([^\/]+)\/documents$/)
    if (documentsMatch && req.method === 'GET') {
      const jobId = documentsMatch[1]
      try {
        const job = findJobInLedger(jobId)
        if (!job) {
          sendJson(404, { success: false, error: 'Job not found' })
          return
        }
        const jd = job.requirements_summary || job.full_description || job.tech_stack || ''
        const techStackList = job.tech_stack ? job.tech_stack.split(',').map((s: string) => s.trim()) : undefined
        const docs = await generateJobDocuments(job.company, job.title, jd, techStackList)
        sendJson(200, {
          success: true,
          coverLetter: docs.coverLetter,
          resumeHtml: docs.html,
          filename: docs.filename,
          pdfUrl: `/api/jobs/${job.uuid || job.id}/pdf`
        })
      } catch (err: any) {
        sendJson(500, { success: false, error: err.message })
      }
      return
    }

    const formPreviewMatch = pathname.match(/^\/api\/jobs\/([^\/]+)\/form-preview$/)
    if (formPreviewMatch && req.method === 'GET') {
      const jobId = formPreviewMatch[1]
      try {
        const job = findJobInLedger(jobId)
        if (!job) {
          sendJson(404, { success: false, error: 'Job not found' })
          return
        }
        const preview = generateFormFillPreview(job)
        sendJson(200, { success: true, data: preview })
      } catch (err: any) {
        sendJson(500, { success: false, error: err.message })
      }
      return
    }


    const pdfMatch = pathname.match(/^\/api\/jobs\/([^\/]+)\/pdf$/)
    if (pdfMatch && req.method === 'GET') {
      const jobId = pdfMatch[1]
      try {
        const job = findJobInLedger(jobId)
        if (!job) {
          res.writeHead(404, { 'Content-Type': 'text/plain' })
          res.end('Job not found')
          return
        }
        const safeCompany = job.company.replace(/[^a-zA-Z0-9]/g, '_')
        const safeTitle = job.title.replace(/[^a-zA-Z0-9]/g, '_')
        const filename = `${safeCompany}_${safeTitle}_Resume.pdf`
        const OUTPUT_DIR = path.resolve(__dirname, '../../output/resumes')
        const pdfPath = path.join(OUTPUT_DIR, filename)

        let pdfBuffer: Buffer | null = null
        if (fs.existsSync(pdfPath)) {
          pdfBuffer = fs.readFileSync(pdfPath)
        } else {
          pdfBuffer = await getR2ObjectBuffer(`resumes/${filename}`)
          if (!pdfBuffer) {
            const jd = job.requirements_summary || job.full_description || job.tech_stack || ''
            const techStackList = job.tech_stack ? job.tech_stack.split(',').map((s: string) => s.trim()) : undefined
            await generateJobDocuments(job.company, job.title, jd, techStackList)
            if (fs.existsSync(pdfPath)) {
              pdfBuffer = fs.readFileSync(pdfPath)
            }
          }
        }

        if (!pdfBuffer) {
          res.writeHead(404, { 'Content-Type': 'text/plain' })
          res.end('Resume not found')
          return
        }

        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Length': pdfBuffer.length,
          'Content-Disposition': `inline; filename="${filename}"`
        })
        res.end(pdfBuffer)
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end(`Error generating PDF: ${err.message}`)
      }
      return
    }

    /* ---------------------------------------------------------
       CANDIDATE ASSET ROUTES (Photo & Portfolio)
       --------------------------------------------------------- */
    if (pathname === '/api/candidate/portfolio' && (req.method === 'GET' || req.method === 'HEAD')) {
      try {
        const ASSETS_DIR = path.resolve(__dirname, '../../data/assets')
        const assetPath = path.join(ASSETS_DIR, 'portfolio.pdf')
        let pdfBuffer: Buffer | null = null

        if (fs.existsSync(assetPath)) {
          pdfBuffer = fs.readFileSync(assetPath)
        } else {
          pdfBuffer = await getR2ObjectBuffer('assets/portfolio.pdf')
          if (!pdfBuffer) {
            const buildRes = await buildCandidatePortfolioPdf()
            if (fs.existsSync(buildRes.pdfPath)) {
              pdfBuffer = fs.readFileSync(buildRes.pdfPath)
            }
          }
        }

        if (!pdfBuffer) {
          res.writeHead(404, { 'Content-Type': 'text/plain' })
          res.end('Portfolio not found')
          return
        }

        res.writeHead(200, {
          'Content-Type': 'application/pdf',
          'Content-Length': pdfBuffer.length,
          'Content-Disposition': 'inline; filename="Miftahul_Muhaemen_Portfolio.pdf"'
        })
        res.end(pdfBuffer)
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end(`Error retrieving portfolio: ${err.message}`)
      }
      return
    }

    if (pathname === '/api/candidate/portfolio/generate' && req.method === 'POST') {
      try {
        const resData = await buildCandidatePortfolioPdf()
        sendJson(200, {
          success: true,
          filename: resData.filename,
          filesize: resData.filesize,
          message: 'Authentic portfolio PDF successfully generated and synced to Cloudflare R2'
        })
      } catch (err: any) {
        sendJson(500, { success: false, error: err.message })
      }
      return
    }

    if (pathname === '/api/candidate/photo' && (req.method === 'GET' || req.method === 'HEAD')) {
      try {
        const ASSETS_DIR = path.resolve(__dirname, '../../data/assets')
        const photoCandidates = ['photo.jpg', 'photo.jpeg', 'photo.png']
        let photoPath: string | null = null
        let photoExt = 'jpeg'

        for (const candidate of photoCandidates) {
          const candidatePath = path.join(ASSETS_DIR, candidate)
          if (fs.existsSync(candidatePath)) {
            photoPath = candidatePath
            photoExt = candidate.endsWith('.png') ? 'png' : 'jpeg'
            break
          }
        }

        let photoBuffer: Buffer | null = null
        if (photoPath) {
          photoBuffer = fs.readFileSync(photoPath)
        } else {
          photoBuffer = await getR2ObjectBuffer('assets/photo.jpg')
          if (photoBuffer) photoExt = 'jpeg'
          else {
            photoBuffer = await getR2ObjectBuffer('assets/photo.png')
            if (photoBuffer) photoExt = 'png'
          }
        }

        if (!photoBuffer) {
          res.writeHead(404, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'Candidate photo not found. Please upload via console.' }))
          return
        }

        res.writeHead(200, {
          'Content-Type': `image/${photoExt}`,
          'Content-Length': photoBuffer.length,
          'Cache-Control': 'no-cache'
        })
        res.end(photoBuffer)
      } catch (err: any) {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end(`Error retrieving candidate photo: ${err.message}`)
      }
      return
    }

    if (pathname === '/api/candidate/photo' && req.method === 'POST') {
      try {
        const chunks: Buffer[] = []
        let totalSize = 0
        const MAX_SIZE = 4 * 1024 * 1024 // 4MB SEVIMA limit

        await new Promise<void>((resolve, reject) => {
          req.on('data', chunk => {
            totalSize += chunk.length
            if (totalSize > MAX_SIZE) {
              reject(new Error('Photo file size exceeds maximum 4MB limit'))
              return
            }
            chunks.push(chunk)
          })
          req.on('end', () => resolve())
          req.on('error', reject)
        })

        const rawBuffer = Buffer.concat(chunks)
        if (rawBuffer.length === 0) {
          sendJson(400, { success: false, error: 'Empty file buffer received' })
          return
        }

        let ext = 'jpg'
        let mime = 'image/jpeg'
        let targetBuffer: Buffer = rawBuffer

        // Direct image magic byte validation
        if (rawBuffer.length >= 4 && rawBuffer[0] === 0x89 && rawBuffer[1] === 0x50 && rawBuffer[2] === 0x4e && rawBuffer[3] === 0x47) {
          ext = 'png'
          mime = 'image/png'
        } else if (rawBuffer.length >= 3 && rawBuffer[0] === 0xff && rawBuffer[1] === 0xd8 && rawBuffer[2] === 0xff) {
          ext = 'jpg'
          mime = 'image/jpeg'
        } else {
          // Check if multipart form-data
          const contentTypeHeader = req.headers['content-type'] || ''
          if (contentTypeHeader.includes('multipart/form-data')) {
            const boundaryMatch = contentTypeHeader.match(/boundary=(?:"([^"]+)"|([^;]+))/i)
            if (boundaryMatch) {
              const boundary = boundaryMatch[1] || boundaryMatch[2]
              const headerEndIndex = rawBuffer.indexOf('\r\n\r\n')
              if (headerEndIndex !== -1) {
                const tailIndex = rawBuffer.lastIndexOf(`\r\n--${boundary}`)
                const fileBody = tailIndex > headerEndIndex
                  ? rawBuffer.subarray(headerEndIndex + 4, tailIndex)
                  : rawBuffer.subarray(headerEndIndex + 4)

                if (fileBody.length >= 4 && fileBody[0] === 0x89 && fileBody[1] === 0x50 && fileBody[2] === 0x4e && fileBody[3] === 0x47) {
                  ext = 'png'
                  mime = 'image/png'
                  targetBuffer = fileBody
                } else if (fileBody.length >= 3 && fileBody[0] === 0xff && fileBody[1] === 0xd8 && fileBody[2] === 0xff) {
                  ext = 'jpg'
                  mime = 'image/jpeg'
                  targetBuffer = fileBody
                } else {
                  sendJson(400, { success: false, error: 'Uploaded file is not a valid JPEG or PNG image' })
                  return
                }
              }
            }
          } else {
            sendJson(400, { success: false, error: 'Uploaded file must be a valid JPEG or PNG image (max 4MB)' })
            return
          }
        }

        const ASSETS_DIR = path.resolve(__dirname, '../../data/assets')
        if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true })
        const targetPath = path.join(ASSETS_DIR, `photo.${ext}`)
        fs.writeFileSync(targetPath, targetBuffer)

        // Upload to Cloudflare R2
        try {
          await uploadToR2(`assets/photo.${ext}`, targetPath, mime)
        } catch (r2Err: any) {
          console.warn('[R2 Sync Warning]', r2Err.message)
        }

        // Update candidate profile attributes ledger
        try {
          updateCandidateAttribute('photo_document', `photo.${ext}`)
        } catch (dbErr: any) {
          console.warn('[DB Attribute Sync Warning]', dbErr.message)
        }

        sendJson(200, {
          success: true,
          filename: `photo.${ext}`,
          size: targetBuffer.length,
          message: `Candidate photo uploaded successfully (${Math.round(targetBuffer.length / 1024)} KB) and synced to R2`
        })
      } catch (err: any) {
        sendJson(500, { success: false, error: err.message })
      }
      return
    }

    /* ---------------------------------------------------------
       CANDIDATE ATTRIBUTES & PROFILE LEDGER API ROUTES
       --------------------------------------------------------- */
    if (pathname === '/api/candidate/attributes' && req.method === 'GET') {
      try {
        const attributes = getAllCandidateAttributes()
        sendJson(200, { success: true, count: attributes.length, data: attributes })
      } catch (err: any) {
        sendJson(500, { success: false, error: err.message })
      }
      return
    }

    const attributeUpdateMatch = pathname.match(/^\/api\/candidate\/attributes\/([^\/]+)$/)
    if (attributeUpdateMatch && (req.method === 'PUT' || req.method === 'POST')) {
      const key = decodeURIComponent(attributeUpdateMatch[1])
      try {
        const parsed = await readJsonBody(req)
        const val = parsed.value ?? ''
        const updated = updateCandidateAttribute(key, val)
        sendJson(200, { success: updated, key, value: val })
      } catch (err: any) {
        sendJson(400, { success: false, error: err.message })
      }
      return
    }

    if (pathname === '/api/candidate/attributes' && req.method === 'POST') {
      try {
        const parsed = await readJsonBody(req)
        upsertCandidateAttribute({
          key: parsed.key,
          label: parsed.label || parsed.key,
          description: parsed.description || null,
          category: parsed.category || 'custom',
          value: parsed.value || null,
          source_portal: parsed.source_portal || 'manual',
          required_by_default: parsed.required ? 1 : 0
        })
        sendJson(201, { success: true, key: parsed.key })
      } catch (err: any) {
        sendJson(400, { success: false, error: err.message })
      }
      return
    }

    /* ---------------------------------------------------------
       COMPANIES MASTER API ROUTES
       --------------------------------------------------------- */
    if (pathname === '/api/companies' && req.method === 'GET') {
      try {
        const companies = getCompanies()
        sendJson(200, { success: true, count: companies.length, data: companies })
      } catch (err: any) {
        sendJson(500, { success: false, error: err.message })
      }
      return
    }


    const companyJobsMatch = pathname.match(/^\/api\/companies\/([^\/]+)\/jobs$/)
    if (companyJobsMatch && req.method === 'GET') {
      const companyName = decodeURIComponent(companyJobsMatch[1])
      try {
        const jobs = getCompanyJobs(companyName)
        sendJson(200, { success: true, company: companyName, count: jobs.length, data: jobs })
      } catch (err: any) {
        sendJson(500, { success: false, error: err.message })
      }
      return
    }


    /* ---------------------------------------------------------
       WEBSITES MASTER API ROUTES
       --------------------------------------------------------- */
    if (pathname === '/api/websites' && req.method === 'GET') {
      try {
        const websites = getWebsites()
        sendJson(200, { success: true, count: websites.length, data: websites })
      } catch (err: any) {
        sendJson(500, { success: false, error: err.message })
      }
      return
    }

    if (pathname === '/api/websites/session-status' && req.method === 'GET') {
      try {
        const statuses = checkPortalSessions()
        sendJson(200, { success: true, data: statuses })
      } catch (err: any) {
        sendJson(500, { success: false, error: err.message })
      }
      return
    }

    const websiteAuthMatch = pathname.match(/^\/api\/websites\/([^\/]+)\/authenticate$/)
    if (websiteAuthMatch && req.method === 'POST') {
      const siteId = websiteAuthMatch[1]
      try {
        const websites = getWebsites()
        const site = websites.find(w => w.id === siteId)
        if (!site) {
          sendJson(404, { success: false, error: 'Website not found' })
          return
        }

        const combined = `${site.url} ${site.name}`.toLowerCase()
        let portalKey = 'kalibrr'
        if (combined.includes('kalibrr')) portalKey = 'kalibrr'
        else if (combined.includes('glints')) portalKey = 'glints'
        else if (combined.includes('jobstreet') || combined.includes('seek')) portalKey = 'jobstreet'
        else if (combined.includes('linkedin')) portalKey = 'linkedin'

        const result = launchPortalAuth(portalKey)
        sendJson(200, { success: true, portalKey, result })
      } catch (err: any) {
        sendJson(500, { success: false, error: err.message })
      }
      return
    }

    const websiteCheckMatch = pathname.match(/^\/api\/websites\/([^\/]+)\/check-session$/)
    if (websiteCheckMatch && req.method === 'POST') {
      const siteId = websiteCheckMatch[1]
      try {
        const websites = getWebsites()
        const site = websites.find(w => w.id === siteId)
        if (!site) {
          sendJson(404, { success: false, error: 'Website not found' })
          return
        }

        const combined = `${site.url} ${site.name}`.toLowerCase()
        let portalKey = 'kalibrr'
        if (combined.includes('kalibrr')) portalKey = 'kalibrr'
        else if (combined.includes('glints')) portalKey = 'glints'
        else if (combined.includes('jobstreet') || combined.includes('seek')) portalKey = 'jobstreet'
        else if (combined.includes('linkedin')) portalKey = 'linkedin'

        const statuses = checkPortalSessions()
        sendJson(200, { success: true, portalKey, status: statuses[portalKey] || 'REQUIRES_LOGIN' })
      } catch (err: any) {
        sendJson(500, { success: false, error: err.message })
      }
      return
    }


    if (pathname === '/api/websites' && req.method === 'POST') {
      try {
        const body = await readJsonBody(req)
        const site = addWebsite({
          name: body.name,
          url: body.url,
          allowed: Boolean(body.allowed),
          auth_type: body.auth_type,
          username: body.username,
          credential_note: body.credential_note,
          notes: body.notes
        })
        sendJson(201, { success: true, data: site })
      } catch (err: any) {
        sendJson(400, { success: false, error: err.message })
      }
      return
    }

    const websiteToggleMatch = pathname.match(/^\/api\/websites\/([^\/]+)\/toggle$/)
    if (websiteToggleMatch && req.method === 'POST') {
      const siteId = websiteToggleMatch[1]
      try {
        const updated = toggleWebsiteAllowed(siteId)
        sendJson(200, { success: updated, id: siteId })
      } catch (err: any) {
        sendJson(400, { success: false, error: err.message })
      }
      return
    }

    const websiteItemMatch = pathname.match(/^\/api\/websites\/([^\/]+)$/)
    if (websiteItemMatch && req.method === 'POST') {
      const siteId = websiteItemMatch[1]
      try {
        const body = await readJsonBody(req)
        const updated = updateWebsite(siteId, body)
        sendJson(200, { success: updated, id: siteId })
      } catch (err: any) {
        sendJson(400, { success: false, error: err.message })
      }
      return
    }

    if (websiteItemMatch && req.method === 'DELETE') {
      const siteId = websiteItemMatch[1]
      try {
        const deleted = deleteWebsite(siteId)
        sendJson(200, { success: deleted, id: siteId })
      } catch (err: any) {
        sendJson(400, { success: false, error: err.message })
      }
      return
    }

    /* ---------------------------------------------------------
       DYNAMIC PERSONALIZATION RULES API ROUTES
       --------------------------------------------------------- */
    if (pathname === '/api/personalization' && req.method === 'GET') {
      try {
        const includeDeleted = url.searchParams.get('include_deleted') === '1'
        const rules = getPersonalizationRules(includeDeleted)
        sendJson(200, { success: true, count: rules.length, data: rules })
      } catch (err: any) {
        sendJson(500, { success: false, error: err.message })
      }
      return
    }


    if (pathname === '/api/personalization' && req.method === 'POST') {
      try {
        const body = await readJsonBody(req)
        if (!body.category || !body.key || !body.value) {
          sendJson(400, { success: false, error: 'Category, key, and value are required.' })
          return
        }
        const newRule = addPersonalizationRule(body.category, body.key, body.value, body.description || '')
        sendJson(201, { success: true, data: newRule })
      } catch (err: any) {
        sendJson(400, { success: false, error: err.message })
      }
      return
    }

    const toggleRuleMatch = pathname.match(/^\/api\/personalization\/([^\/]+)\/toggle$/)
    if (toggleRuleMatch && req.method === 'POST') {
      const ruleId = toggleRuleMatch[1]
      try {
        const toggled = togglePersonalizationRule(ruleId)
        sendJson(200, { success: toggled, id: ruleId })
      } catch (err: any) {
        sendJson(400, { success: false, error: err.message })
      }
      return
    }

    const restoreRuleMatch = pathname.match(/^\/api\/personalization\/([^\/]+)\/restore$/)
    if (restoreRuleMatch && req.method === 'POST') {
      const ruleId = restoreRuleMatch[1]
      try {
        const restored = restorePersonalizationRule(ruleId)
        sendJson(200, { success: restored, id: ruleId })
      } catch (err: any) {
        sendJson(400, { success: false, error: err.message })
      }
      return
    }

    const ruleItemMatch = pathname.match(/^\/api\/personalization\/([^\/]+)$/)
    if (ruleItemMatch && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
      const ruleId = ruleItemMatch[1]
      try {
        const parsed = await readJsonBody(req)
        const updated = updatePersonalizationRule(ruleId, {
          category: parsed.category,
          key: parsed.key,
          value: parsed.value,
          description: parsed.description
        })
        sendJson(200, { success: updated, id: ruleId })
      } catch (err: any) {
        sendJson(400, { success: false, error: err.message })
      }
      return
    }

    if (ruleItemMatch && req.method === 'DELETE') {
      const ruleId = ruleItemMatch[1]
      try {
        const deleted = softDeletePersonalizationRule(ruleId)
        sendJson(200, { success: deleted, id: ruleId })
      } catch (err: any) {
        sendJson(400, { success: false, error: err.message })
      }
      return
    }

    /* ---------------------------------------------------------
       DAILY SCHEDULER SETTINGS & BATCH RUNS API ROUTES
       --------------------------------------------------------- */
    if (pathname === '/api/scheduler' && req.method === 'GET') {
      try {
        const settings = getSchedulerSettings()
        sendJson(200, { success: true, data: settings })
      } catch (err: any) {
        sendJson(500, { success: false, error: err.message })
      }
      return
    }


    if (pathname === '/api/scheduler' && req.method === 'POST') {
      try {
        const parsed = await readJsonBody(req)
        const updated = updateSchedulerSettings({
          enabled: Boolean(parsed.enabled),
          schedule_time: parsed.schedule_time || '09:00',
          max_daily_applications: parseInt(parsed.max_daily_applications, 10) || 10,
          portals: parsed.portals || 'Jobstreet,LinkedIn'
        })
        sendJson(200, { success: updated })
      } catch (err: any) {
        sendJson(400, { success: false, error: err.message })
      }
      return
    }

    if (pathname === '/api/scheduler/runs' && req.method === 'GET') {
      try {
        const runs = getRecordedScheduleRuns()
        sendJson(200, { success: true, count: runs.length, data: runs })
      } catch (err: any) {
        sendJson(500, { success: false, error: err.message })
      }
      return
    }


    if (pathname === '/api/scheduler/trigger' && req.method === 'POST') {
      try {
        const body = await readJsonBody(req).catch(() => ({}))
        const result = await triggerRustScheduleRun(Boolean(body?.force))
        sendJson(200, { success: result.success, data: { message: result.output } })
      } catch (err: any) {
        sendJson(500, { success: false, error: err.message })
      }
      return
    }


    /* ---------------------------------------------------------
       CLI AGENT (AGY) CONFIGURATION & DIAGNOSTICS ROUTES
       --------------------------------------------------------- */
    if (pathname === '/api/agent/status' && req.method === 'GET') {
      try {
        const status = await checkCliAgentStatus()
        sendJson(200, { success: true, data: status })
      } catch (err: any) {
        sendJson(500, { success: false, error: err.message })
      }
      return
    }


    if (pathname === '/api/agent/settings' && req.method === 'POST') {
      try {
        const body = await readJsonBody(req)
        const updated = updateCliAgentSettings(body)
        const status = await checkCliAgentStatus()
        sendJson(200, { success: updated, data: status })
      } catch (err: any) {
        sendJson(400, { success: false, error: err.message })
      }
      return
    }

    if (pathname === '/api/agent/diagnose' && req.method === 'POST') {
      try {
        const testPrompt = `Diagnostic check from Job Apply Automator Web Console at ${new Date().toISOString()}. Output strictly JSON: {"ping": "pong", "status": "operational"}`
        const result = await invokeCliAgent(testPrompt, { expectJson: true, timeoutSeconds: 30 })
        sendJson(200, result)
      } catch (err: any) {
        sendJson(500, { success: false, error: err.message })
      }
      return
    }


    if (pathname === '/api/export' && req.method === 'GET') {
      try {
        const shortlist = getApprovedShortlist()
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Content-Disposition': 'attachment; filename="approved_jobs_shortlist.json"'
        })
        res.end(JSON.stringify(shortlist, null, 2))
      } catch (err: any) {
        sendJson(500, { success: false, error: err.message })
      }
      return
    }


    if (pathname === '/api/system/status' && req.method === 'GET') {
      try {
        const dbPath = path.resolve(__dirname, '../../data/amiya.db')
        let dbSizeBytes = 0
        if (fs.existsSync(dbPath)) {
          dbSizeBytes = fs.statSync(dbPath).size
        }
        const jobsCount = (db.prepare('SELECT COUNT(*) as count FROM jobs_ledger WHERE is_deleted = 0').get() as any)?.count || 0
        const rulesCount = (db.prepare('SELECT COUNT(*) as count FROM personalization_rules WHERE is_deleted = 0').get() as any)?.count || 0
        const companiesCount = (db.prepare('SELECT COUNT(*) as count FROM companies').get() as any)?.count || 0
        const runsCount = (db.prepare('SELECT COUNT(*) as count FROM daily_runs').get() as any)?.count || 0
        const websitesCount = (db.prepare('SELECT COUNT(*) as count FROM websites_master').get() as any)?.count || 0

        sendJson(200, {
          success: true,
          data: {
            db_path: 'Cloudflare D1 (amiya)',
            db_size_bytes: 0,
            journal_mode: 'In-Memory / Cloudflare D1',
            jobs_count: jobsCount,
            rules_count: rulesCount,
            companies_count: companiesCount,
            runs_count: runsCount,
            websites_count: websitesCount,
            d1_database_id: D1_DATABASE_ID,
            d1_database_name: D1_DATABASE_NAME,
            r2_bucket_name: R2_BUCKET_NAME,
            cf_region: 'APAC',
            uptime_seconds: Math.floor(process.uptime()),
            node_env: process.env.NODE_ENV || 'production'
          }
        })
      } catch (err: any) {
        sendJson(500, { success: false, error: err.message })
      }
      return
    }

    if (pathname === '/api/system/cloudflare' && req.method === 'GET') {
      try {
        const d1CountRes = await queryD1('SELECT count(*) as count FROM jobs_ledger WHERE is_deleted = 0;')
        const d1Jobs = d1CountRes[0]?.results[0]?.count ?? 0
        const r2Objects = await listR2Objects()
        sendJson(200, {
          success: true,
          data: {
            d1: {
              database_id: D1_DATABASE_ID,
              database_name: D1_DATABASE_NAME,
              region: 'APAC',
              jobs_count: d1Jobs,
              status: 'CONNECTED'
            },
            r2: {
              bucket_name: R2_BUCKET_NAME,
              region: 'APAC',
              total_objects: r2Objects.length,
              status: 'CONNECTED'
            }
          }
        })
      } catch (err: any) {
        sendJson(500, { success: false, error: err.message })
      }
      return
    }

    if (pathname === '/api/system/database' && req.method === 'POST') {
      try {
        const body = await readJsonBody(req)
        const newPath = body.path || 'data/amiya.db'
        sendJson(200, { success: true, active_database: newPath })
      } catch (err: any) {
        sendJson(400, { success: false, error: err.message })
      }
      return
    }

    /* ---------------------------------------------------------
       SYSTEM ERRORS & OBSERVABILITY API ROUTES
       --------------------------------------------------------- */
    if (pathname === '/api/errors' && req.method === 'GET') {
      try {
        const resolvedParam = url.searchParams.get('resolved')
        const categoryParam = url.searchParams.get('category') || undefined
        const severityParam = url.searchParams.get('severity') || undefined
        const limitParam = parseInt(url.searchParams.get('limit') || '100', 10)

        const resolved = resolvedParam !== null ? parseInt(resolvedParam, 10) : undefined
        const errors = getSystemErrors({
          resolved,
          category: categoryParam,
          severity: severityParam,
          limit: limitParam
        })
        const unresolvedCount = getUnresolvedErrorCount()

        sendJson(200, {
          success: true,
          count: errors.length,
          unresolvedCount,
          data: errors
        })
      } catch (err: any) {
        sendJson(500, { success: false, error: err.message })
      }
      return
    }

    const resolveErrorMatch = pathname.match(/^\/api\/errors\/([^\/]+)\/resolve$/)
    if (resolveErrorMatch && req.method === 'POST') {
      const errId = resolveErrorMatch[1]
      try {
        const resolved = resolveSystemError(errId)
        const unresolvedCount = getUnresolvedErrorCount()
        sendJson(200, { success: resolved, id: errId, unresolvedCount })
      } catch (err: any) {
        sendJson(500, { success: false, error: err.message })
      }
      return
    }

    if (pathname === '/api/errors/clear-resolved' && req.method === 'POST') {
      try {
        const cleared = clearResolvedErrors()
        const unresolvedCount = getUnresolvedErrorCount()
        sendJson(200, { success: true, cleared, unresolvedCount })
      } catch (err: any) {
        sendJson(500, { success: false, error: err.message })
      }
      return
    }

    if (pathname === '/api/errors/test' && req.method === 'POST') {
      try {
        const body = await readJsonBody(req)
        const id = logSystemError(
          body.category || 'BROWSER_CDP',
          body.component || 'TestEndpoint',
          body.message || 'Synthetic test error generated from Web Console',
          body.details || { env: process.env.NODE_ENV, platform: process.platform },
          body.severity || 'ERROR'
        )
        const unresolvedCount = getUnresolvedErrorCount()
        sendJson(200, { success: true, id, unresolvedCount })
      } catch (err: any) {
        sendJson(500, { success: false, error: err.message })
      }
      return
    }


    // Static Assets
    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname)
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(PUBLIC_DIR, 'index.html')
    }

    const ext = path.extname(filePath)
    const contentTypes: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8'
    }

    try {
      const content = fs.readFileSync(filePath)
      res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' })
      res.end(content)
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not Found')
    }
  })

  server.listen(port, '0.0.0.0', () => {
    console.log(`[WEB] Triage Web Console running at http://localhost:${port}`)
    startDailySchedulerDaemon()
  })

  return server
}

if (process.argv[1] && process.argv[1].includes('server')) {
  startWebServer()
}
