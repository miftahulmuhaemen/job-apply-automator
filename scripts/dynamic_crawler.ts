import puppeteer, { Page } from 'puppeteer-core'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { queryD1 } from '../web/src/storage/cfD1.js'
import { uploadToR2 } from '../web/src/storage/r2Storage.js'
import { generateJobDocuments } from '../web/src/generator/resumeBuilder.js'
import { upsertCandidateAttribute } from '../web/src/storage/db.js'
import { analyzeJobSpecificationWithAgent } from '../web/src/agent/cliAgent.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

export interface DiscoveredFormControl {
  name: string
  id: string
  type: string
  tag: string
  label: string
  description?: string
  placeholder: string
  required: boolean
  accept: string
  options?: { value: string; text: string }[]
  isConditional: boolean
  condition?: string | null
}

export interface CrawledJobResult {
  jobUrl: string
  applyUrl: string
  portal: string
  company: string
  title: string
  location: string
  salaryRaw: string
  salaryMin: number | null
  salaryMax: number | null
  benefits: string | null
  techStack: string | null
  experienceReq: string | null
  fullDescription: string
  formSchema: DiscoveredFormControl[]
  docs?: any
}

export async function crawlJobDynamically(url: string, browser: any): Promise<CrawledJobResult> {
  console.log(`\n================================================================`)
  console.log(`[DYNAMIC CRAWLER] Crawling Live Posting: ${url}`)
  console.log(`================================================================`)

  const page: Page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })

  // 1. SPECIFICATION EXTRACTION
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await new Promise(r => setTimeout(r, 2000))

  const specData = await page.evaluate(() => {
    const bodyText = document.body.innerText

    // Portal detection
    let portal = 'Company Career Portal'
    if (window.location.hostname.includes('workable.com')) portal = 'Workable'
    else if (window.location.hostname.includes('sevima.com')) portal = 'SEVIMA Career'
    else if (window.location.hostname.includes('ashbyhq.com')) portal = 'Ashby'
    else if (window.location.hostname.includes('escredia.id')) portal = 'ESCREDIA Studio'

    // Title discovery
    let title = ''
    const h1 = document.querySelector('h1')
    if (h1 && h1.innerText.trim().length > 2) {
      title = h1.innerText.trim()
    } else {
      const match = bodyText.match(/(?:Posisi|Role|Lowongan|Job Title)[\s\:\-]+([^\n]+)/i)
      title = match ? match[1].trim() : document.title.split(/[\-\|\:]/)[0].trim()
    }

    // Company discovery
    let company = ''
    if (portal === 'Workable') {
      const parts = window.location.pathname.split('/').filter(Boolean)
      company = parts[0] ? parts[0].charAt(0).toUpperCase() + parts[0].slice(1) : 'Employer'
    } else if (portal === 'SEVIMA Career') {
      company = 'SEVIMA'
    } else if (portal === 'Ashby') {
      const parts = window.location.pathname.split('/').filter(Boolean)
      company = parts[0] ? parts[0].split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' ') : 'Anyone AI'
    } else if (portal === 'ESCREDIA Studio') {
      company = 'ESCREDIA'
    } else {
      const el = document.querySelector('[data-ui="company-name"], .company-name, .employer')
      company = el ? (el as HTMLElement).innerText.trim() : document.title.split(/[\-\|\:]/)[1]?.trim() || 'Employer'
    }

    // Location discovery
    let loc = 'Indonesia (Remote)'
    const locMatch = bodyText.match(/(?:Lokasi|Location|Penempatan)[\s\:\-]+([^\n]+)/i)
    if (locMatch) {
      loc = locMatch[1].trim()
    } else if (/surabaya/i.test(bodyText)) {
      loc = 'Surabaya, Jawa Timur, Indonesia'
    } else if (/jakarta/i.test(bodyText)) {
      loc = 'Jakarta, Indonesia'
    } else if (/remote/i.test(bodyText)) {
      loc = 'Remote, Indonesia'
    }

    // Salary Discovery
    let salaryRaw = 'Undisclosed'
    let salaryMin: number | null = null
    let salaryMax: number | null = null

    const salaryMatch = bodyText.match(/(?:Rp|IDR|\$)\s*[\d\.\,]+(?:\s*(?:–|-|sampai|to)\s*(?:Rp|IDR|\$)?\s*[\d\.\,]+)?(?:\s*(?:\/|\s*per\s*)(?:bulan|month|hour|jam))?/i)
    if (salaryMatch) {
      salaryRaw = salaryMatch[0].trim()
      const nums = salaryRaw.match(/[\d\.]+/g)
      if (nums && nums.length >= 1) {
        if (salaryRaw.includes('$')) {
          salaryMin = parseFloat(nums[0])
          salaryMax = nums[1] ? parseFloat(nums[1]) : salaryMin
        } else {
          salaryMin = parseInt(nums[0].replace(/\./g, ''), 10)
          if (nums[1]) salaryMax = parseInt(nums[1].replace(/\./g, ''), 10)
        }
      }
    }

    // Benefits discovery
    const benefitsList: string[] = []
    const benefitSection = Array.from(document.querySelectorAll('section, div, article')).find(el => {
      const t = el.querySelector('h2, h3, h4, strong')?.textContent || ''
      return /benefit|keuntungan|fasilitas|perks|what we offer/i.test(t)
    })
    if (benefitSection) {
      benefitSection.querySelectorAll('li').forEach(li => {
        const text = li.innerText.trim()
        if (text && text.length > 3 && !benefitsList.includes(text)) {
          benefitsList.push(text)
        }
      })
    }

    // Experience requirement extraction
    let expReq: string | null = null
    const expMatch = bodyText.match(/(\d+\+?\s*(?:years?|tahun)[^\n\.\,]*|minimal\s*\d+\s*tahun[^\n\.\,]*)/i)
    if (expMatch) expReq = expMatch[0].trim()

    // Isolated Job Description
    let desc = ''
    const descEl = document.querySelector('[data-ui="job-description"], .deskripsi-pekerjaan, .job-description, .detail-lowongan, main, article')
    if (descEl) desc = (descEl as HTMLElement).innerText.trim()
    else desc = bodyText.slice(0, 5000)

    // Dynamic Apply Link
    let applyLink = ''
    const applyAnchor = Array.from(document.querySelectorAll('a, button')).find(el => {
      const href = el.getAttribute('href') || ''
      const text = (el as HTMLElement).innerText?.trim() || ''
      return href.includes('/apply') || href.includes('/application') || /apply for this job|lamar pekerjaan|lamar sekarang|kirim lamaran/i.test(text)
    })
    if (applyAnchor) {
      applyLink = applyAnchor.getAttribute('href') || ''
    }

    return {
      title,
      company,
      portal,
      location: loc,
      salaryRaw,
      salaryMin,
      salaryMax,
      benefits: benefitsList.length > 0 ? benefitsList.join('\n') : null,
      experienceReq: expReq,
      fullDescription: desc,
      applyLink
    }
  })

  // Dynamic AI Job Specification Extraction via AGY (Zero Hardcoded Dictionaries)
  console.log(`  [AGY Ingestion] Extracting technologies, perks, and requirements from job text via AGY...`)
  const agentSpec = await analyzeJobSpecificationWithAgent(specData.title, specData.company, specData.fullDescription)

  const techStack = agentSpec?.techStack && agentSpec.techStack.length > 0
    ? agentSpec.techStack.join(', ')
    : null
  const benefits = agentSpec?.benefits && agentSpec.benefits.length > 0
    ? agentSpec.benefits.join('\n')
    : specData.benefits
  const experienceReq = agentSpec?.experienceReq || specData.experienceReq
  const salaryRaw = (specData.salaryRaw === 'Undisclosed' && agentSpec?.salaryRaw)
    ? agentSpec.salaryRaw
    : specData.salaryRaw

  let applyUrl = url
  if (specData.applyLink) {
    if (specData.applyLink.startsWith('http')) {
      applyUrl = specData.applyLink
    } else {
      applyUrl = new URL(specData.applyLink, url).toString()
    }
  } else if (!url.endsWith('/apply') && !url.endsWith('/apply/') && !url.includes('escredia.id')) {
    applyUrl = url.replace(/\/?$/, '/apply/')
  }

  console.log(`  Discovered Company: ${specData.company}`)
  console.log(`  Discovered Title:   ${specData.title}`)
  console.log(`  Discovered Salary:  ${salaryRaw} (${specData.salaryMin} - ${specData.salaryMax})`)
  console.log(`  Discovered Tech:    ${techStack || 'None'}`)
  console.log(`  Discovered Benefits: ${benefits ? benefits.split('\n').length + ' item(s)' : 'None'}`)
  console.log(`  Navigating to Apply Form: ${applyUrl}`)

  // Generate tailored ATS resume ahead of form discovery (required for resume-parsing forms)
  const docs = await generateJobDocuments(specData.company, specData.title, specData.fullDescription, agentSpec?.techStack)

  // 2. DYNAMIC APPLY FORM SCHEMA EXTRACTION
  if (applyUrl !== url) {
    await page.goto(applyUrl, { waitUntil: 'networkidle0', timeout: 45000 })
  }
  await new Promise(r => setTimeout(r, 2000))

  // Trigger dynamic interactive sections across portals
  await page.evaluate(() => {
    // Workable "+ Add" buttons
    document.querySelectorAll('button[data-ui="add-section"]').forEach((b: any) => b.click())
    // Escredia "Kirim lamaran"
    const kirimBtn = Array.from(document.querySelectorAll('button, a')).find((el: any) => /kirim lamaran/i.test(el.innerText || ''))
    if (kirimBtn) (kirimBtn as HTMLElement).click()
    // SEVIMA "Lamar Sekarang"
    const lamarBtn = Array.from(document.querySelectorAll('button, a')).find((el: any) => /lamar sekarang/i.test(el.innerText || ''))
    if (lamarBtn) (lamarBtn as HTMLElement).click()
  })
  await new Promise(r => setTimeout(r, 1500))

  // Progressive form unlocking (e.g. ESCREDIA "Unggah CV terlebih dahulu")
  const fileUploadEl = await page.$('input[type="file"]')
  if (fileUploadEl) {
    const isProgressiveUpload = await page.evaluate(() => {
      const text = document.body.innerText || ''
      return /unggah cv terlebih dahulu|upload your resume to continue|autofill from resume/i.test(text)
    })
    if (isProgressiveUpload && docs?.pdfPath && fs.existsSync(docs.pdfPath)) {
      console.log(`  Progressive resume gate detected. Uploading ${docs.pdfPath} to unlock application form...`)
      await page.evaluate(() => {
        const cbs = Array.from(document.querySelectorAll('input[type="checkbox"]')) as HTMLInputElement[]
        cbs.forEach(cb => { if (!cb.checked) cb.click() })
      })
      await fileUploadEl.uploadFile(docs.pdfPath)
      await new Promise(r => setTimeout(r, 6000))
    }
  }

  // 3. ACCESSIBILITY TREE FORM SCHEMA EXTRACTION
  const axSnapshot = await page.accessibility.snapshot({ interestingOnly: false })

  // Check for presence of file inputs in DOM (e.g. ATS Resume upload)
  const hasFileInput = await page.evaluate(() => {
    return Boolean(document.querySelector('input[type="file"], [data-ui*="upload"], button[class*="upload"]'))
  })

  // Check for Alpine.js <template x-if> conditionals
  const templateConditionals = await page.evaluate(() => {
    const templates = Array.from(document.querySelectorAll('template[x-if]'))
    const res: { name: string; label: string; condition: string }[] = []
    templates.forEach(t => {
      const cond = t.getAttribute('x-if') || ''
      const div = document.createElement('div')
      div.innerHTML = t.innerHTML
      div.querySelectorAll('input, select, textarea').forEach((el: any) => {
        const name = el.name || el.id || ''
        const lbl = el.closest('label')?.innerText || el.placeholder || name
        if (name) res.push({ name, label: (lbl || '').trim(), condition: cond })
      })
    })
    return res
  })

  const formSchema: DiscoveredFormControl[] = []
  let lastStaticText = ''
  let lastHeading = ''
  let lastQuestionContext = ''
  let radioGroupCounter = 0
  let currentRadioGroupName = ''

  function walkAX(node: any) {
    if (node.role === 'heading' && node.name) {
      lastHeading = node.name.trim()
    } else if (node.role === 'StaticText' && node.name) {
      const txt = node.name.trim()
      if (txt && txt !== '*' && txt !== ':' && txt.length > 1) {
        lastStaticText = txt
        if (txt.includes('?') || txt.endsWith(':') || /posisi|gaji|rate|bahasa|keahlian|pengalaman|kompensasi/i.test(txt)) {
          lastQuestionContext = txt.replace(/\*$/, '').trim()
          radioGroupCounter++
          currentRadioGroupName = `radio_group_${radioGroupCounter}`
        }
      }
    }

    const formRoles = ['textbox', 'combobox', 'checkbox', 'radio']
    if (formRoles.includes(node.role)) {
      let label = (node.name || '').trim()
      let placeholder = ''

      if (!label || /start typing|select an option|choose|type here|pilih/i.test(label)) {
        placeholder = label
        label = lastStaticText || lastHeading || 'Form Input'
      }

      const isRadio = node.role === 'radio'
      let name = ''

      if (isRadio) {
        name = currentRadioGroupName || 'radio_options'
      } else {
        name = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)
        if (!name) name = `field_${formSchema.length}`
      }

      const required = Boolean(node.required || label.includes('*') || (lastStaticText && lastStaticText.endsWith('*')))
      const cleanLabel = label.replace(/\s+/g, ' ').replace(/\*$/, '').trim()

      formSchema.push({
        name,
        id: name,
        type: node.role === 'textbox' ? 'text' : node.role,
        tag: node.role === 'combobox' ? 'select' : 'input',
        label: cleanLabel,
        placeholder,
        required,
        accept: '',
        isConditional: false,
        condition: null
      })
    }

    if (node.children) {
      for (const child of node.children) {
        walkAX(child)
      }
    }
  }

  if (axSnapshot) {
    walkAX(axSnapshot)
  }

  // Ensure ATS resume upload field is present if file upload exists on page
  if (hasFileInput && !formSchema.some(f => f.name.includes('resume') || f.label.toLowerCase().includes('resume') || f.label.toLowerCase().includes('cv'))) {
    formSchema.unshift({
      name: 'resume_file',
      id: 'resume_file',
      type: 'file',
      tag: 'input',
      label: 'ATS Resume',
      placeholder: 'Upload tailored ATS single-column resume PDF',
      required: true,
      accept: '.pdf,.doc,.docx',
      isConditional: false,
      condition: null
    })
  }

  // Integrate template conditionals
  for (const tc of templateConditionals) {
    if (!formSchema.some(f => f.name === tc.name)) {
      formSchema.push({
        name: tc.name,
        id: tc.name,
        type: 'text',
        tag: 'input',
        label: tc.label,
        placeholder: '',
        required: false,
        accept: '',
        isConditional: true,
        condition: tc.condition
      })
    }
  }

  await page.close()

  console.log(`  Extracted ${formSchema.length} live form controls dynamically with enriched labels.`)
  return {
    jobUrl: url,
    applyUrl,
    portal: specData.portal,
    company: specData.company,
    title: specData.title,
    location: specData.location,
    salaryRaw,
    salaryMin: specData.salaryMin,
    salaryMax: specData.salaryMax,
    benefits,
    techStack,
    experienceReq,
    fullDescription: specData.fullDescription,
    formSchema,
    docs
  }
}

export function isCanonicalCandidateAttribute(key: string, label: string): boolean {
  const k = (key || '').toLowerCase()
  const l = (label || '').toLowerCase()

  // 1. Technical artifacts, tokens, challenges, and ephemeral DOM IDs
  if (k.startsWith('input_files_input') || k.startsWith('ca_') || k.startsWith('_systemfield') || /^[0-9a-f-]{20,}$/i.test(k)) return true
  if (k.includes('captcha') || k.includes('recaptcha') || k.includes('turnstile') || k.includes('token') || k.includes('retention') || k.includes('consent') || k.includes('statement')) return true
  if (l.includes('persetujuan') || l.includes('pernyataan') || l.includes('kebijakan') || l.includes('privacy') || l.includes('agreement') || l.includes('consent') || l.includes('ai processing')) return true

  // 2. Document file uploads
  if (k.includes('resume') || k.includes('cv') || k.includes('curriculum') || k.includes('photo') || k.includes('avatar') || k.includes('portofolio')) return true
  if (l.includes('resume') || l.includes('cv') || l.includes('foto') || l.includes('portofolio') || l.includes('unggah cv')) return true

  // 3. Standard Personal & Contact attributes
  if (k === 'name' || k === 'fullname' || k === 'full_name' || l.includes('nama lengkap') || l.includes('full name')) return true
  if (k === 'first_name' || k === 'firstname' || l.includes('first name') || l.includes('nama depan')) return true
  if (k === 'last_name' || k === 'lastname' || l.includes('last name') || l.includes('nama belakang')) return true
  if (k === 'email' || l.includes('email')) return true
  if (k === 'phone' || k === 'telephone' || k === 'mobile' || k === 'whatsapp' || l.includes('telepon') || l.includes('phone') || l.includes('whatsapp') || l.includes('nomor telepon')) return true
  if (k === 'address' || k === 'location' || l.includes('alamat') || l.includes('address') || l.includes('domisili') || l === 'location') return true
  if (k === 'city' || l.includes('kota') || l.includes('city')) return true
  if (k === 'postal_code' || k === 'postcode' || l.includes('kode pos') || l.includes('postcode') || l.includes('postal')) return true
  if (k === 'country' || l.includes('country') || l.includes('negara') || l.includes('kewarganegaraan')) return true
  if (k === 'marital_status' || k === 'is_married' || l.includes('menikah') || l.includes('marital')) return true
  if (k === 'date_of_birth' || l.includes('lahir') || l.includes('birth')) return true
  if (k === 'headline' || l.includes('headline')) return true
  if (k === 'summary' || l.includes('summary') || l.includes('ringkasan')) return true
  if (k === 'linkedin' || l.includes('linkedin')) return true
  if (k === 'github' || l.includes('github')) return true
  if (k === 'portfolio' || k === 'website' || k === 'portfolio_url' || l.includes('portfolio') || l.includes('portofolio') || l.includes('website')) return true
  if (k === 'work_authorization' || l.includes('work authorization') || l.includes('izin kerja')) return true

  // 4. Standard Education attributes
  if (k === 'education_level' || k === 'education' || l.includes('pendidikan terakhir') || l.includes('education level')) return true
  if (k === 'school' || k === 'university' || l.includes('school') || l.includes('universitas') || l.includes('perguruan tinggi') || l.includes('sekolah')) return true
  if (k === 'degree' || l.includes('degree') || l.includes('gelar')) return true
  if (k === 'major' || k === 'field_of_study' || l.includes('major') || l.includes('jurusan') || l.includes('program studi')) return true
  if (k === 'faculty' || l.includes('fakultas') || l.includes('faculty')) return true
  if (k === 'gpa' || l.includes('gpa') || l.includes('ipk')) return true
  if (l.includes('start date') || l.includes('end date') || k.includes('start_date') || k.includes('end_date')) return true

  // 5. Standard Experience attributes
  if (k === 'experience_years' || k === 'experience' || l.includes('lama bekerja') || l.includes('years of experience')) return true
  if (k === 'experience_role' || k === 'title' || l.includes('job title') || l.includes('role') || l.includes('jabatan') || l.includes('posisi')) return true
  if (k === 'experience_company' || k === 'company' || k === 'last_company' || l.includes('company') || l.includes('perusahaan') || l.includes('tempat kerja')) return true
  if (k === 'experience_industry' || k === 'industry' || l.includes('industri') || l.includes('industry')) return true
  if (k === 'current' || l.includes('currently work here')) return true

  // 6. Standard Compensation attributes & rate options
  if (k.includes('salary_before') || k === 'last_salary' || l.includes('gaji terakhir') || l.includes('gaji sebelumnya') || l.includes('previous salary')) return true
  if (k.includes('salary_expected') || k === 'expected_salary' || l.includes('gaji yang diharapkan') || l.includes('expected salary') || l.includes('expected hourly rate')) return true
  if (/\$|idr|rp|hour/i.test(l) && (l.includes('-') || l.includes('–') || l.includes('+'))) return true

  // 7. References
  if (k.includes('reference') || l.includes('referensi')) return true

  // 8. Info source & Engagement models & technical interview preferences
  if (k.includes('info') || l.includes('sumber informasi') || l.includes('informasi lowongan')) return true
  if (k.includes('engagement') || l.includes('solusi kerja')) return true
  if (l.includes('programming language') || l.includes('domain expertise')) return true

  return false
}

export async function ingestDiscoveredJob(result: CrawledJobResult) {
  console.log(`[INGESTION] Staging job: ${result.company} - ${result.title}`)
  
  // 1. Generate or reuse tailored ATS resume
  const docs = result.docs || await generateJobDocuments(result.company, result.title, result.fullDescription)
  
  // 2. Upload PDF to R2
  const r2Key = `resumes/${docs.filename}`
  await uploadToR2(r2Key, docs.pdfPath, 'application/pdf')

  // 3. Auto-register ONLY genuine unmapped custom questions (exclude canonical attributes & DOM artifacts)
  for (const c of result.formSchema) {
    if (c.type === 'file' || c.type === 'checkbox' || c.type === 'radio') continue
    const rawKey = (c.name || c.id || '').trim()
    const rawLabel = (c.label || c.placeholder || '').trim()
    if (!rawLabel || rawLabel.length < 8) continue

    // Skip if control is already a standard canonical attribute or technical artifact
    if (isCanonicalCandidateAttribute(rawKey, rawLabel)) continue

    // Generate a clean slug key from the human question text (never use raw DOM IDs or hashes)
    const cleanKey = rawLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)
    if (!cleanKey) continue

    upsertCandidateAttribute({
      key: cleanKey,
      label: rawLabel.slice(0, 80),
      description: `Custom question discovered from ${result.company} (${result.portal})`,
      category: 'custom',
      source_portal: result.portal,
      required_by_default: c.required ? 1 : 0
    })
  }

  // 4. Determine triage status
  let triageDecision = 'KEEP'
  let skipReason: string | null = null
  if (result.title.includes('Q3 2027')) {
    triageDecision = 'FILTER_OUT'
    skipReason = 'Future hiring opportunity (Estimated Joining: July 2027)'
  }

  // 5. Insert into Cloudflare D1
  const uuid = `job_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  const escapedCompany = result.company.replace(/'/g, "''")
  const escapedTitle = result.title.replace(/'/g, "''")
  const escapedLocation = result.location.replace(/'/g, "''")
  const escapedSalaryRaw = result.salaryRaw.replace(/'/g, "''")
  const escapedDesc = result.fullDescription.replace(/'/g, "''")
  const escapedBenefits = result.benefits ? `'${result.benefits.replace(/'/g, "''")}'` : 'NULL'
  const escapedTech = result.techStack ? `'${result.techStack.replace(/'/g, "''")}'` : 'NULL'
  const escapedExpReq = result.experienceReq ? `'${result.experienceReq.replace(/'/g, "''")}'` : 'NULL'
  const escapedSkipReason = skipReason ? `'${skipReason.replace(/'/g, "''")}'` : 'NULL'
  const formSchemaJson = JSON.stringify(result.formSchema).replace(/'/g, "''")

  const insertSql = `
    INSERT OR REPLACE INTO jobs_ledger (
      company, title, portal, job_url, location, salary_raw, salary_min, salary_max,
      status, triage_decision, skip_reason, resume_path, created_at, full_description,
      benefits, tech_stack, experience_req, form_schema, uuid, histories, is_deleted
    ) VALUES (
      '${escapedCompany}', '${escapedTitle}', '${result.portal}', '${result.jobUrl}',
      '${escapedLocation}', '${escapedSalaryRaw}', ${result.salaryMin ?? 'NULL'}, ${result.salaryMax ?? 'NULL'},
      'PENDING_HUMAN', '${triageDecision}', ${escapedSkipReason}, '${docs.filename}',
      datetime('now'), '${escapedDesc}',
      ${escapedBenefits}, ${escapedTech}, ${escapedExpReq}, '${formSchemaJson}',
      '${uuid}', '[]', 0
    );
  `

  const d1Res = await queryD1(insertSql)
  console.log(`  Inserted into Cloudflare D1 amiya: success=${d1Res[0]?.success}`)

  // Ensure company in companies table
  const compId = crypto.randomUUID()
  const compNorm = result.company.toLowerCase()
  await queryD1(`
    INSERT OR IGNORE INTO companies (id, name, normalized_name, industry, company_size, headquarters, created_at, website)
    VALUES ('${compId}', '${escapedCompany}', '${compNorm}', 'Technology', '100-500 employees', '${escapedLocation}', datetime('now'), '${result.jobUrl}');
  `)
}

// MAIN EXECUTION LOOP
async function main() {
  const cliUrls = process.argv.slice(2).filter(u => u.startsWith('http'))
  const defaultUrls = [
    'https://apply.workable.com/ajaib/j/17D23FFBAC/',
    'https://apply.workable.com/ajaib/j/2E1DBD4A14/',
    'https://apply.workable.com/ajaib/j/CD94A01357/',
    'https://careers.sevima.com/jobs/software-engineer',
    'https://careers.sevima.com/jobs/sevima-future-talent-software-engineer-q3-2027',
    'https://escredia.id/career/senior-backend-engineer-1',
    'https://escredia.id/career/it-technical-lead-4',
    'https://jobs.ashbyhq.com/anyone-ai/678e8ee2-9482-4936-8a51-62f49223cd41?locationId=692cc1c9-91d9-4c7a-a648-4b68f3bebb33'
  ]
  const targetUrls = cliUrls.length > 0 ? cliUrls : defaultUrls

  console.log(`[DYNAMIC CRAWLER] Starting autonomous crawl for ${targetUrls.length} live job postings...`)
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  try {
    for (const url of targetUrls) {
      try {
        const result = await crawlJobDynamically(url, browser)
        await ingestDiscoveredJob(result)
      } catch (err: any) {
        console.error(`[CRAWL ERROR] Failed to crawl ${url}:`, err.message || err)
      }
    }
  } finally {
    await browser.close()
  }

  console.log(`\n[DYNAMIC CRAWLER] Autonomous crawl & ingestion completed!`)
}

main().catch(err => {
  console.error('[DYNAMIC CRAWLER] Fatal execution error:', err)
  process.exit(1)
})
