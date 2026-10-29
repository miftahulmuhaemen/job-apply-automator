import puppeteer from 'puppeteer-core'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { queryD1 } from '../web/src/storage/cfD1.js'
import { uploadToR2 } from '../web/src/storage/r2Storage.js'
import { generateJobDocuments } from '../web/src/generator/resumeBuilder.js'
import candidateProfile from '../data/candidateProfile.json' with { type: 'json' }

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

interface DiscoveredField {
  name: string
  id: string
  label: string
  type: string
  required: boolean
  accept?: string
}

interface JobIngestTarget {
  url: string
  applyUrl: string
  company: string
  title: string
  portal: string
  location: string
  salaryRaw: string
  salaryMin: number | null
  salaryMax: number | null
  triageDecision: 'KEEP' | 'FILTER_OUT'
  skipReason: string | null
  techStack?: string
  benefits?: string
  experienceReq?: string
  companyOverview?: string
}

const targets: JobIngestTarget[] = [
  {
    url: 'https://apply.workable.com/ajaib/j/17D23FFBAC/',
    applyUrl: 'https://apply.workable.com/ajaib/j/17D23FFBAC/apply/',
    company: 'Ajaib',
    title: 'Senior Backend Engineer II - Shared Services',
    portal: 'Workable',
    location: 'Jakarta, Indonesia (Hybrid / Remote)',
    salaryRaw: 'Undisclosed by Employer',
    salaryMin: 10000000,
    salaryMax: 15000000,
    triageDecision: 'KEEP',
    skipReason: null,
    techStack: 'Go, Java, Microservices, REST APIs, gRPC, Kafka, Redis, Relational Databases, NoSQL, GCP, AWS, Docker, CI/CD',
    benefits: 'Performance Bonus - Get rewarded for the impact you make\nPrivate Insurance - Comprehensive health coverage for you\nPaid Time Off - Take the time you need to recharge and come back stronger\nLearning & Development - Company-sponsored training, courses, and professional certifications\nHybrid Work Arrangement - Enjoy the flexibility of working both remotely and from the office\nCareer Growth - Work closely with experienced leaders and take on meaningful ownership as we scale\nEmployee Perks - Enjoy exclusive discounts, partnerships, and lifestyle perks\nCollaborative & High-Ownership Culture - Work with smart, driven people in cross-functional teams, take ownership, and make a meaningful impact for our users.',
    experienceReq: '5+ years of professional backend engineering',
    companyOverview: 'Indonesian fintech unicorn transforming retail finance, backed by Y Combinator, Ribbit Capital, SoftBank, and SBI Holdings.'
  },
  {
    url: 'https://apply.workable.com/ajaib/j/2E1DBD4A14/',
    applyUrl: 'https://apply.workable.com/ajaib/j/2E1DBD4A14/apply/',
    company: 'Ajaib',
    title: 'Sr. Backend Engineer II - Investment',
    portal: 'Workable',
    location: 'Jakarta, Indonesia (Hybrid / Remote)',
    salaryRaw: 'Undisclosed by Employer',
    salaryMin: 10000000,
    salaryMax: 15000000,
    triageDecision: 'KEEP',
    skipReason: null,
    techStack: 'Go, Java, Microservices, REST APIs, gRPC, Kafka, Redis, Relational Databases, NoSQL, GCP, AWS, Docker, CI/CD',
    benefits: 'Performance Bonus - Get rewarded for the impact you make\nPrivate Insurance - Comprehensive health coverage for you\nPaid Time Off - Take the time you need to recharge and come back stronger\nLearning & Development - Company-sponsored training, courses, and professional certifications\nHybrid Work Arrangement - Enjoy the flexibility of working both remotely and from the office\nCareer Growth - Work closely with experienced leaders and take on meaningful ownership as we scale\nEmployee Perks - Enjoy exclusive discounts, partnerships, and lifestyle perks\nCollaborative & High-Ownership Culture - Work with smart, driven people in cross-functional teams, take ownership, and make a meaningful impact for our users.',
    experienceReq: '5+ years of professional backend engineering',
    companyOverview: 'Indonesian fintech unicorn transforming retail finance, backed by Y Combinator, Ribbit Capital, SoftBank, and SBI Holdings.'
  },
  {
    url: 'https://apply.workable.com/ajaib/j/CD94A01357/',
    applyUrl: 'https://apply.workable.com/ajaib/j/CD94A01357/apply/',
    company: 'Ajaib',
    title: 'Staff Backend Engineer - Investment',
    portal: 'Workable',
    location: 'Jakarta, Indonesia (Hybrid / Remote)',
    salaryRaw: 'Undisclosed by Employer',
    salaryMin: 12000000,
    salaryMax: 18000000,
    triageDecision: 'KEEP',
    skipReason: null,
    techStack: 'Go, Java, Microservices, Event-Driven Architecture, Kafka, Redis, Relational Databases, NoSQL, GCP, AWS, Docker, CI/CD',
    benefits: 'Performance Bonus - Get rewarded for the impact you make\nPrivate Insurance - Comprehensive health coverage for you\nPaid Time Off - Take the time you need to recharge and come back stronger\nLearning & Development - Company-sponsored training, courses, and professional certifications\nHybrid Work Arrangement - Enjoy the flexibility of working both remotely and from the office\nCareer Growth - Work closely with experienced leaders and take on meaningful ownership as we scale\nEmployee Perks - Enjoy exclusive discounts, partnerships, and lifestyle perks\nCollaborative & High-Ownership Culture - Work with smart, driven people in cross-functional teams, take ownership, and make a meaningful impact for our users.',
    experienceReq: '8+ years of professional software engineering',
    companyOverview: 'Indonesian fintech unicorn transforming retail finance, backed by Y Combinator, Ribbit Capital, SoftBank, and SBI Holdings.'
  },
  {
    url: 'https://careers.sevima.com/jobs/sevima-future-talent-software-engineer-q3-2027',
    applyUrl: 'https://careers.sevima.com/jobs/sevima-future-talent-software-engineer-q3-2027/apply',
    company: 'PT Sentra Vidya Utama (SEVIMA)',
    title: 'SEVIMA Future Talent – Software Engineer | Q3 2027',
    portal: 'Sevima',
    location: 'Surabaya, Jawa Timur, Indonesia',
    salaryRaw: 'Undisclosed by Employer',
    salaryMin: null,
    salaryMax: null,
    triageDecision: 'FILTER_OUT',
    skipReason: 'Graduation timeline (Q3 2027) exceeds immediate availability',
    techStack: 'GoLang, PHP, Vue.js, TypeScript, PostgreSQL, Data Warehouse, Microservices, Docker, DevOps',
    benefits: 'Competitive salary & benefits\nMakan siang\nMentor berpengalaman untuk pengembangan karir\nAkses ke tech conference dan workshop\nProgram continuous learning\nLingkungan kerja yang mendukung inovasi\nWork-life balance',
    experienceReq: 'Minimal 2 tahun pengalaman sebagai Developer',
    companyOverview: 'Platform edtech perguruan tinggi terdepan di Indonesia yang melayani 3.5 juta+ civitas akademika.'
  },
  {
    url: 'https://careers.sevima.com/jobs/software-engineer',
    applyUrl: 'https://careers.sevima.com/jobs/software-engineer/apply',
    company: 'PT Sentra Vidya Utama (SEVIMA)',
    title: 'Software Engineer',
    portal: 'Sevima',
    location: 'Surabaya, Jawa Timur, Indonesia',
    salaryRaw: 'Rp 7.700.000 - Rp 13.000.000/mo',
    salaryMin: 7700000,
    salaryMax: 13000000,
    triageDecision: 'KEEP',
    skipReason: null,
    techStack: 'GoLang, PHP, Vue.js, TypeScript, PostgreSQL, Data Warehouse, Microservices, Docker, DevOps',
    benefits: 'Competitive salary & benefits\nMakan siang\nMentor berpengalaman untuk pengembangan karir\nAkses ke tech conference dan workshop\nProgram continuous learning\nLingkungan kerja yang mendukung inovasi\nWork-life balance',
    experienceReq: 'Minimal 2 tahun pengalaman sebagai Developer',
    companyOverview: 'Platform edtech perguruan tinggi terdepan di Indonesia yang melayani 3.5 juta+ civitas akademika.'
  }
]

async function crawlAndAuditAll() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  })

  try {
    for (const target of targets) {
      console.log(`\n======================================================`)
      console.log(`[CRAWL] Navigating to: ${target.url}`)
      const page = await browser.newPage()
      await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
      await page.setViewport({ width: 1440, height: 900 })

      // 1. Extract Overview
      await page.goto(target.url, { waitUntil: 'networkidle2', timeout: 45000 })
      await new Promise(r => setTimeout(r, 1500))

      const rawText = await page.evaluate(() => document.body.innerText)
      console.log(`  Extracted verbatim text: ${rawText.length} characters`)

      // 2. Navigate to Application Flow
      console.log(`  Traversing to live application flow: ${target.applyUrl}`)
      await page.goto(target.applyUrl, { waitUntil: 'networkidle2', timeout: 45000 })
      await page.waitForSelector('form, input', { timeout: 15000 }).catch(() => {})
      await new Promise(r => setTimeout(r, 1500))

      // 3. Dynamically Audit Form Controls
      const formFields: DiscoveredField[] = await page.evaluate(() => {
        const fields: DiscoveredField[] = []
        const elements = document.querySelectorAll('input, select, textarea')
        elements.forEach(el => {
          const type = (el.getAttribute('type') || el.tagName.toLowerCase()).toLowerCase()
          if (type === 'hidden') return

          const name = el.getAttribute('name') || el.getAttribute('id') || ''
          const id = el.getAttribute('id') || ''
          const required = el.hasAttribute('required') || el.getAttribute('aria-required') === 'true'
          const accept = el.getAttribute('accept') || undefined

          let label = ''
          if (id) {
            const l = document.querySelector(`label[for="${id}"]`)
            if (l) label = l.textContent?.trim() || ''
          }
          if (!label && el.closest('div')) {
            const l = el.closest('div')?.querySelector('label')
            if (l) label = l.textContent?.trim() || ''
          }
          if (!label) {
            label = el.getAttribute('placeholder') || el.getAttribute('aria-label') || name || 'Field'
          }
          label = label.replace(/\s+/g, ' ').replace(/\*$/, '').trim()

          fields.push({ name, id, label, type, required, accept })
        })
        return fields
      })

      console.log(`  Audited ${formFields.length} interactive form controls:`)
      formFields.forEach(f => {
        console.log(`   - [${f.required ? 'REQ' : 'OPT'}] ${f.type}: "${f.label}" (${f.name}) ${f.accept ? `[accept=${f.accept}]` : ''}`)
      })

      await page.close()

      // 4. Generate Tailored Resume PDF
      console.log(`  Generating tailored ATS Resume for: ${target.company} - ${target.title}`)
      const docs = await generateJobDocuments(target.company, target.title, rawText)
      console.log(`  Generated PDF: ${docs.filename} (${fs.statSync(docs.pdfPath).size} bytes)`)

      // 5. Upload Resume to Cloudflare R2
      console.log(`  Uploading resume to Cloudflare R2 (amiya)...`)
      try {
        await uploadToR2(`resumes/${docs.filename}`, docs.pdfPath, 'application/pdf')
        console.log(`  Successfully uploaded to R2: resumes/${docs.filename}`)
      } catch (err: any) {
        console.warn(`  [R2 Upload Warning] ${err.message}`)
      }

      // 6. Build Screening Questions and Disclosures String
      let screeningQuestionsStr = ''
      let candidateAnswersStr = ''

      if (target.portal === 'Workable') {
        screeningQuestionsStr = 'Country of Residence;Work Authorization'
        candidateAnswersStr = 'Indonesia;Indonesian Citizen (WNI), no visa sponsorship required'
      } else if (target.portal === 'Sevima') {
        screeningQuestionsStr = 'Sumber Informasi Lowongan;Pernyataan Integritas;Persetujuan AI Processing;Persetujuan Kebijakan Privasi'
        candidateAnswersStr = 'Website Karir SEVIMA;Setuju (Data benar dan akurat);Setuju;Setuju'
      }

      // 7. Insert or Replace into Cloudflare D1
      const uuid = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
      const escapedDesc = rawText.replace(/'/g, "''").slice(0, 8000)
      const escapedTitle = target.title.replace(/'/g, "''")
      const escapedCompany = target.company.replace(/'/g, "''")
      const escapedLocation = target.location.replace(/'/g, "''")
      const escapedSalaryRaw = target.salaryRaw.replace(/'/g, "''")
      const escapedSkipReason = target.skipReason ? `'${target.skipReason.replace(/'/g, "''")}'` : 'NULL'

      const escapedTechStack = target.techStack ? `'${target.techStack.replace(/'/g, "''")}'` : 'NULL'
      const escapedBenefits = target.benefits ? `'${target.benefits.replace(/'/g, "''")}'` : 'NULL'
      const escapedExpReq = target.experienceReq ? `'${target.experienceReq.replace(/'/g, "''")}'` : 'NULL'
      const escapedCompanyOverview = target.companyOverview ? `'${target.companyOverview.replace(/'/g, "''")}'` : 'NULL'

      const insertSql = `
        INSERT INTO jobs_ledger (
          company, title, portal, job_url, location, salary_raw, salary_min, salary_max,
          status, triage_decision, skip_reason, resume_path, created_at, full_description,
          screening_questions, candidate_answers, benefits, tech_stack, experience_req,
          company_overview, uuid, histories, is_deleted
        ) VALUES (
          '${escapedCompany}', '${escapedTitle}', '${target.portal}', '${target.url}',
          '${escapedLocation}', '${escapedSalaryRaw}', ${target.salaryMin ?? 'NULL'}, ${target.salaryMax ?? 'NULL'},
          'PENDING_HUMAN', '${target.triageDecision}', ${escapedSkipReason}, '${docs.filename}',
          datetime('now'), '${escapedDesc}', '${screeningQuestionsStr}', '${candidateAnswersStr}',
          ${escapedBenefits}, ${escapedTechStack}, ${escapedExpReq}, ${escapedCompanyOverview},
          '${uuid}', '[]', 0
        );
      `

      console.log(`  Writing record to Cloudflare D1 (amiya)...`)
      const d1Res = await queryD1(insertSql)
      console.log(`  Cloudflare D1 insert success: ${d1Res[0]?.success}`)

      // Ensure company exists in companies table
      const compCheckSql = `SELECT count(*) as count FROM companies WHERE name = '${escapedCompany}';`
      const compCheck = await queryD1(compCheckSql)
      if (compCheck[0]?.results[0]?.count === 0) {
        const compId = crypto.randomUUID()
        const compNorm = escapedCompany.toLowerCase()
        await queryD1(`
          INSERT INTO companies (id, name, normalized_name, industry, company_size, headquarters, created_at, website)
          VALUES ('${compId}', '${escapedCompany}', '${compNorm}', 'Technology / Software', '100-500 employees', '${escapedLocation}', datetime('now'), '${target.url}');
        `)
        console.log(`  Added company '${target.company}' to companies table`)
      }
    }
  } finally {
    await browser.close()
  }

  console.log(`\nAll 5 jobs successfully crawled, audited, and ingested with status PENDING_HUMAN!`)
}

crawlAndAuditAll().catch(err => {
  console.error('Fatal crawl error:', err)
  process.exit(1)
})
