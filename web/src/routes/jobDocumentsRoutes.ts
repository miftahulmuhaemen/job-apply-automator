import http from 'node:http'
import { findJobInLedger } from '../storage/db.js'
import { d1Execute, r2Put } from '../storage/cloudflareClient.js'
import { getR2ObjectBuffer } from '../storage/r2Storage.js'
import { generateJobDocuments } from '../generator/resumeBuilder.js'
import { generateFormFillPreview } from '../generator/formPreview.js'
import { sendJson } from './routeUtils.js'

export async function handleJobDocumentsRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string
): Promise<boolean> {
  const documentsMatch = pathname.match(/^\/api\/jobs\/([^\/]+)\/documents$/)
  if (documentsMatch && req.method === 'GET') {
    const jobId = documentsMatch[1]
    try {
      const job = await findJobInLedger(jobId)
      if (!job) {
        sendJson(res, 404, { success: false, error: 'Job not found' })
        return true
      }
      const safeCompany = job.company.replace(/[^a-zA-Z0-9]/g, '_')
      const safeTitle = job.title.replace(/[^a-zA-Z0-9]/g, '_')
      const filename = job.resume_path && !job.resume_path.includes('/')
        ? job.resume_path
        : `${safeCompany}_${safeTitle}_Resume.pdf`

      let coverLetter = job.cover_letter
      if (!coverLetter) {
        const clKey = `cover_letters/${filename.replace('.pdf', '.txt')}`
        const r2Cover = await getR2ObjectBuffer(clKey)
        if (r2Cover) {
          coverLetter = r2Cover.toString('utf-8')
          await d1Execute('UPDATE jobs_ledger SET cover_letter = ? WHERE id = ?', [coverLetter, job.id])
        }
      }

      if (!coverLetter) {
        const jd = job.requirements_summary || job.full_description || job.tech_stack || ''
        const techStackList = job.tech_stack ? job.tech_stack.split(',').map((s: string) => s.trim()) : undefined
        const docs = await generateJobDocuments(job.company, job.title, jd, techStackList)
        coverLetter = docs.coverLetter
        await d1Execute('UPDATE jobs_ledger SET cover_letter = ?, resume_path = COALESCE(resume_path, ?) WHERE id = ?', [coverLetter, docs.filename, job.id])
        await r2Put(`cover_letters/${docs.filename.replace('.pdf', '.txt')}`, coverLetter, 'text/plain')
      }

      sendJson(res, 200, {
        success: true,
        coverLetter,
        filename: job.resume_path || filename,
        pdfUrl: `/api/jobs/${job.uuid || job.id}/pdf`
      })
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  const formPreviewMatch = pathname.match(/^\/api\/jobs\/([^\/]+)\/form-preview$/)
  if (formPreviewMatch && req.method === 'GET') {
    const jobId = formPreviewMatch[1]
    try {
      const job = await findJobInLedger(jobId)
      if (!job) {
        sendJson(res, 404, { success: false, error: 'Job not found' })
        return true
      }
      const preview = await generateFormFillPreview(job)
      sendJson(res, 200, { success: true, data: preview })
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  const pdfMatch = pathname.match(/^\/api\/jobs\/([^\/]+)\/pdf$/)
  if (pdfMatch && (req.method === 'GET' || req.method === 'HEAD')) {
    const jobId = pdfMatch[1]
    try {
      const job = await findJobInLedger(jobId)
      if (!job) {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Job not found')
        return true
      }
      const safeCompany = job.company.replace(/[^a-zA-Z0-9]/g, '_')
      const safeTitle = job.title.replace(/[^a-zA-Z0-9]/g, '_')
      const filename = job.resume_path && !job.resume_path.includes('/')
        ? job.resume_path
        : `${safeCompany}_${safeTitle}_Resume.pdf`

      let pdfBuffer: Buffer | null = await getR2ObjectBuffer(`resumes/${filename}`)
      if (!pdfBuffer) {
        const jd = job.requirements_summary || job.full_description || job.tech_stack || ''
        const techStackList = job.tech_stack ? job.tech_stack.split(',').map((s: string) => s.trim()) : undefined
        await generateJobDocuments(job.company, job.title, jd, techStackList)
        pdfBuffer = await getR2ObjectBuffer(`resumes/${filename}`)
      }

      if (!pdfBuffer) {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Resume not found')
        return true
      }

      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Length': pdfBuffer.length,
        'Content-Disposition': `inline; filename="${filename}"`
      })
      if (req.method === 'HEAD') {
        res.end()
      } else {
        res.end(pdfBuffer)
      }
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end(`Error serving PDF: ${err.message}`)
    }
    return true
  }

  return false
}
