import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import puppeteer, { Browser } from 'puppeteer-core'
import candidateProfile from '../../../data/candidateProfile.json' with { type: 'json' }
import { matchAndTailor } from './keywordMatcher.js'
import { generateTailoredNarrativeWithAgent } from '../agent/cliAgent.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const OUTPUT_DIR = path.resolve(__dirname, '../../../output/resumes')
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true })
}

export function generateAtsHtml(
  jobTitle: string,
  jdText: string,
  tailoredSummaryOverride?: string,
  coverLetterOverride?: string
): { html: string; coverLetter: string } {
  const match = matchAndTailor(jobTitle, jdText)
  const p = candidateProfile.personal
  const summary = tailoredSummaryOverride || match.tailoredSummary
  const coverLetter = coverLetterOverride || match.coverLetterParagraphs.join('\n\n')

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${p.fullName} - Resume</title>
  <style>
    @page {
      size: A4;
      margin: 12mm 15mm 12mm 15mm;
    }
    body {
      font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, Arial, sans-serif;
      color: #000000;
      line-height: 1.4;
      font-size: 9.5pt;
      margin: 0;
      padding: 0;
    }
    h1 {
      font-size: 16pt;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin: 0 0 4px 0;
      text-align: center;
    }
    .contact-info {
      text-align: center;
      font-size: 9pt;
      margin-bottom: 12px;
      color: #333333;
    }
    .contact-info a {
      color: #111111;
      text-decoration: none;
    }
    h2 {
      font-size: 10.5pt;
      text-transform: uppercase;
      border-bottom: 1px solid #222222;
      margin: 10px 0 6px 0;
      padding-bottom: 2px;
      letter-spacing: 0.5px;
    }
    .job {
      margin-bottom: 8px;
    }
    .job-header {
      display: flex;
      justify-content: space-between;
      font-weight: bold;
      font-size: 9.5pt;
    }
    .job-sub {
      display: flex;
      justify-content: space-between;
      font-style: italic;
      font-size: 9pt;
      color: #444444;
      margin-bottom: 3px;
    }
    ul {
      margin: 2px 0 6px 18px;
      padding: 0;
    }
    li {
      margin-bottom: 2px;
    }
    .skills-block {
      font-size: 9pt;
      line-height: 1.4;
    }
    .skills-block strong {
      font-size: 9pt;
    }
  </style>
</head>
<body>
  <h1>${p.fullName}</h1>
  <div class="contact-info">
    ${p.location} | ${p.phone} | <a href="mailto:${p.email}">${p.email}</a><br>
    <a href="${p.linkedin}">LinkedIn</a> | <a href="${p.github}">GitHub</a> | <a href="${p.portfolio}">Portfolio</a>
  </div>

  <h2>Professional Summary</h2>
  <p style="margin: 0 0 6px 0; font-size: 9.5pt; text-align: justify;">${summary}</p>

  <h2>Technical Skills</h2>
  <div class="skills-block">
    <strong>Languages:</strong> ${match.tailoredSkills.languages.join(', ')}<br>
    <strong>Backend & Databases:</strong> ${match.tailoredSkills.backend.join(', ')}<br>
    <strong>Cloud, DevOps & Tooling:</strong> ${match.tailoredSkills.infra.join(', ')}
  </div>

  <h2>Work Experience</h2>
  ${match.tailoredHighlights
    .map(
      (job) => `
    <div class="job">
      <div class="job-header">
        <span>${job.company}</span>
        <span>${job.period}</span>
      </div>
      <div class="job-sub">
        <span>${job.role}</span>
        <span>${job.location}</span>
      </div>
      <ul>
        ${job.points.map((pt) => `<li>${pt}</li>`).join('')}
      </ul>
    </div>
  `
    )
    .join('')}

  <h2>Certifications</h2>
  <div class="skills-block">
    ${candidateProfile.certifications.map((c) => `• <strong>${c.name}</strong> - ${c.issuer} (${c.year})`).join('<br>')}
  </div>

  <h2>Education</h2>
  <div class="job">
    <div class="job-header">
      <span>${candidateProfile.education.institution}</span>
      <span>${candidateProfile.education.graduationDate}</span>
    </div>
    <div class="job-sub">
      <span>${candidateProfile.education.degree}</span>
      <span>Indonesia</span>
    </div>
  </div>
</body>
</html>`

  return { html, coverLetter }
}

export async function buildTailoredResumePdf(
  browser: Browser,
  company: string,
  jobTitle: string,
  jdText: string
): Promise<{ pdfPath: string; coverLetter: string }> {
  const { html, coverLetter } = generateAtsHtml(jobTitle, jdText)
  const safeCompany = company.replace(/[^a-zA-Z0-9]/g, '_')
  const safeTitle = jobTitle.replace(/[^a-zA-Z0-9]/g, '_')
  const filename = `${safeCompany}_${safeTitle}_Resume.pdf`
  const pdfPath = path.join(OUTPUT_DIR, filename)

  const page = await browser.newPage()
  try {
    await page.setContent(html, { waitUntil: 'load' })
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        bottom: '10mm',
        left: '12mm',
        right: '12mm'
      }
    })
    console.log(`[Resume Generator] Built ATS tailored resume at: ${pdfPath}`)
    return { pdfPath, coverLetter }
  } finally {
    await page.close()
  }
}

export async function generateJobDocuments(
  company: string,
  jobTitle: string,
  jdText: string,
  techStack?: string[]
): Promise<{ pdfPath: string; filename: string; html: string; coverLetter: string }> {
  let tailoredSummaryOverride: string | undefined
  let coverLetterOverride: string | undefined

  try {
    console.log(`[Resume Generator] Synthesizing role-tailored summary & cover letter via AGY for ${company}...`)
    const agyNarrative = await generateTailoredNarrativeWithAgent(jobTitle, company, jdText, techStack)
    if (agyNarrative?.tailoredSummary && agyNarrative?.coverLetter) {
      tailoredSummaryOverride = agyNarrative.tailoredSummary
      coverLetterOverride = agyNarrative.coverLetter
      console.log(`[Resume Generator] Bespoke AGY narrative successfully synthesized for ${company}.`)
    }
  } catch (err: any) {
    console.warn(`[Resume Generator] AGY narrative fallback: ${err.message}`)
  }

  const { html, coverLetter } = generateAtsHtml(jobTitle, jdText, tailoredSummaryOverride, coverLetterOverride)
  const safeCompany = company.replace(/[^a-zA-Z0-9]/g, '_')
  const safeTitle = jobTitle.replace(/[^a-zA-Z0-9]/g, '_')
  const filename = `${safeCompany}_${safeTitle}_Resume.pdf`
  const pdfPath = path.join(OUTPUT_DIR, filename)

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  })
  try {
    const page = await browser.newPage()
    await page.setContent(html, { waitUntil: 'load' })
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: {
        top: '10mm',
        bottom: '10mm',
        left: '12mm',
        right: '12mm'
      }
    })
    return { pdfPath, filename, html, coverLetter }
  } finally {
    await browser.close()
  }
}
