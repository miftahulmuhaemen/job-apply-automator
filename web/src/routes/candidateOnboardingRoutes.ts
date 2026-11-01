import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { getAllCandidateAttributes, upsertCandidateAttribute } from '../storage/db.js'
import { extractTextFromPdfBuffer } from '../generator/cvParser.js'
import { parseCandidateResumeWithAgent } from '../agent/cliAgent.js'
import { uploadToR2 } from '../storage/r2Storage.js'
import { readJsonBody, sendJson } from './routeUtils.js'

export async function handleCandidateOnboardingRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string
): Promise<boolean> {
  if (pathname === '/api/candidate/onboarding-status' && req.method === 'GET') {
    try {
      const attributes = await getAllCandidateAttributes()
      const attrMap = new Map<string, string>()
      for (const a of attributes) {
        if (a.value && a.value.trim().length > 0 && a.status === 'RESOLVED') {
          attrMap.set(a.key, a.value)
        }
      }

      const requiredOnboardingKeys = [
        'full_name',
        'email',
        'phone',
        'school',
        'degree',
        'experience_role',
        'experience_company'
      ]

      const missingKeys = requiredOnboardingKeys.filter(k => !attrMap.has(k))
      const isComplete = missingKeys.length === 0

      sendJson(res, 200, {
        success: true,
        isComplete,
        missingKeys,
        totalAttributes: attributes.length,
        resolvedCount: attrMap.size
      })
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  if (pathname === '/api/candidate/parse-resume' && req.method === 'POST') {
    try {
      const chunks: Buffer[] = []
      let totalSize = 0
      const MAX_SIZE = 10 * 1024 * 1024 // 10MB PDF limit

      await new Promise<void>((resolve, reject) => {
        req.on('data', chunk => {
          totalSize += chunk.length
          if (totalSize > MAX_SIZE) {
            reject(new Error('Resume file size exceeds maximum 10MB limit'))
            return
          }
          chunks.push(chunk)
        })
        req.on('end', () => resolve())
        req.on('error', reject)
      })

      const rawBuffer = Buffer.concat(chunks)
      if (rawBuffer.length === 0) {
        sendJson(res, 400, { success: false, error: 'Empty file buffer received' })
        return true
      }

      let pdfBuffer: Buffer = rawBuffer

      const contentTypeHeader = req.headers['content-type'] || ''
      if (contentTypeHeader.includes('multipart/form-data')) {
        const boundaryMatch = contentTypeHeader.match(/boundary=(?:"([^"]+)"|([^;]+))/i)
        if (boundaryMatch) {
          const boundary = boundaryMatch[1] || boundaryMatch[2]
          const headerEndIndex = rawBuffer.indexOf('\r\n\r\n')
          if (headerEndIndex !== -1) {
            const tailIndex = rawBuffer.lastIndexOf(`\r\n--${boundary}`)
            pdfBuffer = tailIndex > headerEndIndex
              ? rawBuffer.subarray(headerEndIndex + 4, tailIndex)
              : rawBuffer.subarray(headerEndIndex + 4)
          }
        }
      }

      if (pdfBuffer.length < 4 || pdfBuffer[0] !== 0x25 || pdfBuffer[1] !== 0x50 || pdfBuffer[2] !== 0x44 || pdfBuffer[3] !== 0x46) {
        sendJson(res, 400, { success: false, error: 'Uploaded file is not a valid PDF document (missing %PDF- header)' })
        return true
      }

      const extractedText = await extractTextFromPdfBuffer(pdfBuffer)
      if (!extractedText || extractedText.length < 30) {
        sendJson(res, 400, { success: false, error: 'Unable to extract legible text from uploaded PDF resume.' })
        return true
      }

      const parsedProfile = await parseCandidateResumeWithAgent(extractedText)
      if (!parsedProfile) {
        sendJson(res, 500, { success: false, error: 'CLI Agent failed to parse structured profile from resume text.' })
        return true
      }

      sendJson(res, 200, {
        success: true,
        rawTextLength: extractedText.length,
        parsed: parsedProfile
      })
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  if (pathname === '/api/candidate/complete-onboarding' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req)
      const { personal, summary, experience, education, photoBase64 } = body

      if (!personal || !personal.fullName || !personal.email) {
        sendJson(res, 400, { success: false, error: 'Missing mandatory candidate personal details (fullName, email)' })
        return true
      }

      await upsertCandidateAttribute({ key: 'full_name', category: 'personal', label: 'Full Legal Name', value: personal.fullName, required_by_default: 1 })
      const nameParts = personal.fullName.trim().split(/\s+/)
      await upsertCandidateAttribute({ key: 'first_name', category: 'personal', label: 'First Name', value: personal.firstName || nameParts[0] || '', required_by_default: 1 })
      await upsertCandidateAttribute({ key: 'last_name', category: 'personal', label: 'Last Name', value: personal.lastName || (nameParts.length > 1 ? nameParts.slice(1).join(' ') : nameParts[0] || ''), required_by_default: 1 })
      await upsertCandidateAttribute({ key: 'email', category: 'personal', label: 'Email Address', value: personal.email, required_by_default: 1 })
      await upsertCandidateAttribute({ key: 'phone', category: 'personal', label: 'Phone Number', value: personal.phone || '', required_by_default: 1 })
      await upsertCandidateAttribute({ key: 'whatsapp', category: 'personal', label: 'WhatsApp Contact', value: personal.whatsapp || personal.phone || '', required_by_default: 0 })
      await upsertCandidateAttribute({ key: 'location', category: 'personal', label: 'Residential Address / Location', value: personal.location || '', required_by_default: 1 })
      await upsertCandidateAttribute({ key: 'city', category: 'personal', label: 'City of Residence', value: personal.city || 'Jakarta', required_by_default: 1 })
      await upsertCandidateAttribute({ key: 'country', category: 'personal', label: 'Country of Residence', value: personal.country || 'Indonesia', required_by_default: 1 })
      await upsertCandidateAttribute({ key: 'portfolio', category: 'personal', label: 'Personal Portfolio Website', value: personal.portfolio || '', required_by_default: 0 })
      await upsertCandidateAttribute({ key: 'linkedin', category: 'personal', label: 'LinkedIn Profile URL', value: personal.linkedin || '', required_by_default: 0 })
      await upsertCandidateAttribute({ key: 'github', category: 'personal', label: 'GitHub Profile URL', value: personal.github || '', required_by_default: 0 })
      await upsertCandidateAttribute({ key: 'marital_status', category: 'personal', label: 'Marital Status', value: personal.maritalStatus || 'Single', required_by_default: 0 })
      await upsertCandidateAttribute({ key: 'notice_period', category: 'skills', label: 'Notice Period', value: personal.noticePeriod || 'Immediately / ASAP', required_by_default: 0 })
      await upsertCandidateAttribute({ key: 'employment_status', category: 'skills', label: 'Employment Status', value: personal.employmentStatus || 'Unemployed / Actively Looking', required_by_default: 0 })
      await upsertCandidateAttribute({ key: 'work_authorization', category: 'personal', label: 'Work Authorization', value: personal.workAuthorization || 'Indonesian Citizen (WNI), no visa sponsorship required', required_by_default: 1 })
      await upsertCandidateAttribute({ key: 'work_arrangement', category: 'skills', label: 'Work Arrangement Preference', value: personal.workArrangement || 'All arrangements acceptable (Remote, Hybrid, On-site / WFO)', required_by_default: 0 })
      await upsertCandidateAttribute({ key: 'summary', category: 'personal', label: 'Professional Summary', value: summary || '', required_by_default: 0 })

      if (personal.previousSalary) {
        await upsertCandidateAttribute({ key: 'salary_before', category: 'compensation', label: 'Previous Monthly Salary', value: personal.previousSalary, required_by_default: 0 })
      }
      if (personal.expectedSalaryFloor) {
        await upsertCandidateAttribute({ key: 'salary_expected_floor', category: 'compensation', label: 'Expected Monthly Salary Floor', value: String(personal.expectedSalaryFloor).replace(/[^0-9]/g, ''), required_by_default: 1 })
      }
      if (personal.expectedSalaryTarget) {
        await upsertCandidateAttribute({ key: 'salary_expected_target', category: 'compensation', label: 'Expected Salary Target', value: personal.expectedSalaryTarget, required_by_default: 0 })
      }
      if (personal.targetHourlyRate) {
        await upsertCandidateAttribute({ key: 'target_hourly_rate', category: 'compensation', label: 'Target Hourly Rate (USD)', value: personal.targetHourlyRate, required_by_default: 0 })
      }

      if (education) {
        await upsertCandidateAttribute({ key: 'school', category: 'education', label: 'University / Higher Institution', value: education.institution || '', required_by_default: 1 })
        await upsertCandidateAttribute({ key: 'degree', category: 'education', label: 'Degree Title', value: education.degree || '', required_by_default: 1 })
        await upsertCandidateAttribute({ key: 'major', category: 'education', label: 'Major / Field of Study', value: education.major || 'Computer Science', required_by_default: 1 })
        if (education.gpa) {
          await upsertCandidateAttribute({ key: 'gpa', category: 'education', label: 'GPA / Nilai IPK', value: String(education.gpa), required_by_default: 0 })
        }
        if (education.graduationDate) {
          await upsertCandidateAttribute({ key: 'education_end_date', category: 'education', label: 'Education: End Date (Graduation)', value: education.graduationDate, required_by_default: 0 })
        }
      }

      if (Array.isArray(experience) && experience.length > 0) {
        const latest = experience[0]
        await upsertCandidateAttribute({ key: 'experience_role', category: 'experience', label: 'Experience: Most Recent Role', value: latest.role || '', required_by_default: 1 })
        await upsertCandidateAttribute({ key: 'experience_company', category: 'experience', label: 'Experience: Most Recent Company', value: latest.company || '', required_by_default: 1 })
        if (latest.startDate) await upsertCandidateAttribute({ key: 'experience_start_date', category: 'experience', label: 'Experience: Start Date', value: latest.startDate, required_by_default: 0 })
        if (latest.endDate) await upsertCandidateAttribute({ key: 'experience_end_date', category: 'experience', label: 'Experience: End Date', value: latest.endDate, required_by_default: 0 })
      }

      await upsertCandidateAttribute({ key: 'resume_document', category: 'documents', label: 'Tailored ATS Resume (PDF)', value: 'candidate_resume.pdf', required_by_default: 1 })
      await upsertCandidateAttribute({ key: 'portfolio_document', category: 'documents', label: 'Portfolio Dossier (PDF)', value: 'candidate_portfolio.pdf', required_by_default: 0 })

      if (photoBase64 && typeof photoBase64 === 'string') {
        const base64Data = photoBase64.replace(/^data:image\/\w+;base64,/, '')
        const photoBuf = Buffer.from(base64Data, 'base64')
        const ASSETS_DIR = path.resolve(process.cwd(), 'data/assets')
        if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true })
        const photoPath = path.join(ASSETS_DIR, 'photo.jpg')
        fs.writeFileSync(photoPath, photoBuf)
        try {
          await uploadToR2('assets/photo.jpg', photoPath, 'image/jpeg')
        } catch {}
        upsertCandidateAttribute({ key: 'photo_document', category: 'documents', label: 'Applicant Portrait Photo', value: 'photo.jpg', required_by_default: 0 })
      }

      sendJson(res, 200, {
        success: true,
        message: 'Candidate profile successfully initialized and synchronized to D1.'
      })
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  return false
}
