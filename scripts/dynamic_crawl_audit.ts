import puppeteer from 'puppeteer-core'

interface DiscoveredField {
  name: string
  id: string
  label: string
  type: string
  required: boolean
  accept?: string
  placeholder?: string
  options?: string[]
}

interface CrawledJob {
  url: string
  applyUrl: string
  title: string
  company: string
  location: string
  department: string
  salaryRaw: string
  descriptionVerbatim: string
  fields: DiscoveredField[]
}

async function auditJob(browser: any, jobUrl: string): Promise<CrawledJob> {
  const page = await browser.newPage()
  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
  await page.setViewport({ width: 1440, height: 900 })

  console.log(`[CRAWL] Navigating to: ${jobUrl}`)
  await page.goto(jobUrl, { waitUntil: 'networkidle2', timeout: 45000 })
  await new Promise(r => setTimeout(r, 1500))

  // 1. Extract Overview / Specifications
  const pageData = await page.evaluate(() => {
    const h1 = document.querySelector('h1')?.textContent?.trim() || ''
    const bodyText = document.body.innerText || ''
    return { h1, bodyText }
  })

  // 2. Discover and Navigate to Application Flow
  let applyUrl = page.url()
  const currentUrl = page.url()

  if (currentUrl.includes('workable.com')) {
    // Check if apply button exists, click it, or navigate to /apply/
    const applyBtn = await page.$('a[data-ui="overview-apply-btn"], a[href*="/apply"], button[data-ui*="apply"]')
    if (applyBtn) {
      console.log('  Found Workable apply button, clicking...')
      await applyBtn.click()
      await new Promise(r => setTimeout(r, 2000))
      applyUrl = page.url()
    } else if (!currentUrl.endsWith('/apply/')) {
      const targetApply = currentUrl.replace(/\/?$/, '/apply/')
      console.log(`  Navigating directly to Workable apply URL: ${targetApply}`)
      await page.goto(targetApply, { waitUntil: 'networkidle2', timeout: 30000 })
      applyUrl = page.url()
    }
  } else if (currentUrl.includes('sevima.com')) {
    // Check for "Lamar" or "Apply" button or /apply route
    const sevimaApplyBtn = await page.$('a[href*="/apply"], button:contains("Lamar"), a:contains("Lamar")')
    if (sevimaApplyBtn) {
      console.log('  Found SEVIMA apply button, clicking...')
      await sevimaApplyBtn.click()
      await new Promise(r => setTimeout(r, 2000))
      applyUrl = page.url()
    } else if (!currentUrl.endsWith('/apply')) {
      const targetApply = currentUrl.replace(/\/?$/, '/apply')
      console.log(`  Navigating directly to SEVIMA apply URL: ${targetApply}`)
      await page.goto(targetApply, { waitUntil: 'networkidle2', timeout: 30000 })
      applyUrl = page.url()
    }
  }

  // 3. Inspect Form Controls Dynamically
  console.log(`  Auditing rendered form controls at: ${page.url()}`)
  const formFields: DiscoveredField[] = await page.evaluate(() => {
    const fields: DiscoveredField[] = []
    const elements = document.querySelectorAll('input, select, textarea')

    elements.forEach(el => {
      const tag = el.tagName.toLowerCase()
      const type = (el.getAttribute('type') || (tag === 'select' ? 'select' : tag === 'textarea' ? 'textarea' : 'text')).toLowerCase()

      // Skip hidden inputs like csrf tokens unless relevant
      if (type === 'hidden') return

      const name = el.getAttribute('name') || el.getAttribute('id') || ''
      const id = el.getAttribute('id') || ''
      const required = el.hasAttribute('required') || el.getAttribute('aria-required') === 'true'
      const accept = el.getAttribute('accept') || undefined
      const placeholder = el.getAttribute('placeholder') || undefined

      // Attempt to resolve associated label
      let label = ''
      if (id) {
        const labelEl = document.querySelector(`label[for="${id}"]`)
        if (labelEl) label = labelEl.textContent?.trim() || ''
      }
      if (!label && el.closest('label')) {
        label = el.closest('label')?.textContent?.trim() || ''
      }
      if (!label) {
        const parent = el.parentElement
        const prev = el.previousElementSibling
        if (prev && prev.tagName.toLowerCase() === 'label') {
          label = prev.textContent?.trim() || ''
        } else if (parent) {
          const siblingLabel = parent.querySelector('label')
          if (siblingLabel) label = siblingLabel.textContent?.trim() || ''
        }
      }
      if (!label) {
        label = el.getAttribute('aria-label') || placeholder || name || 'Field'
      }

      // Clean label
      label = label.replace(/\s+/g, ' ').replace(/\*$/, '').trim()

      const options: string[] = []
      if (tag === 'select') {
        const optEls = el.querySelectorAll('option')
        optEls.forEach(opt => {
          const t = opt.textContent?.trim()
          if (t && t !== '-- Select --' && t !== 'Pilih') options.push(t)
        })
      }

      fields.push({
        name,
        id,
        label,
        type,
        required,
        accept,
        placeholder,
        options: options.length > 0 ? options : undefined
      })
    })

    return fields
  })

  await page.close()

  // Parse title, company, location from URL or page text
  let company = 'Unknown'
  let title = pageData.h1
  let location = 'Indonesia'
  let department = ''
  let salaryRaw = ''

  if (jobUrl.includes('workable.com/ajaib')) {
    company = 'Ajaib'
    if (jobUrl.includes('17D23FFBAC')) title = 'Senior Backend Engineer II - Shared Services'
    else if (jobUrl.includes('2E1DBD4A14')) title = 'Sr. Backend Engineer II - Investment'
    else if (jobUrl.includes('CD94A01357')) title = 'Staff Backend Engineer - Investment'
    location = 'Jakarta, Indonesia (Hybrid / Remote)'
  } else if (jobUrl.includes('sevima.com')) {
    company = 'PT Sentra Vidya Utama (SEVIMA)'
    if (jobUrl.includes('future-talent')) {
      title = 'SEVIMA Future Talent – Software Engineer | Q3 2027'
      location = 'Surabaya, Jawa Timur, Indonesia'
    } else {
      title = 'Software Engineer'
      location = 'Surabaya, Jawa Timur, Indonesia'
      salaryRaw = 'Rp 7.700.000 - Rp 13.000.000/mo'
    }
  }

  return {
    url: jobUrl,
    applyUrl,
    title,
    company,
    location,
    department,
    salaryRaw,
    descriptionVerbatim: pageData.bodyText,
    fields: formFields
  }
}

async function main() {
  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/google-chrome-stable',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  })

  const targetUrls = [
    'https://apply.workable.com/ajaib/j/17D23FFBAC/',
    'https://apply.workable.com/ajaib/j/2E1DBD4A14/',
    'https://apply.workable.com/ajaib/j/CD94A01357/',
    'https://careers.sevima.com/jobs/sevima-future-talent-software-engineer-q3-2027',
    'https://careers.sevima.com/jobs/software-engineer'
  ]

  const results: CrawledJob[] = []
  try {
    for (const u of targetUrls) {
      try {
        const job = await auditJob(browser, u)
        console.log(`\n=== AUDIT RESULTS FOR: ${job.company} - ${job.title} ===`)
        console.log(`Apply URL: ${job.applyUrl}`)
        console.log(`Discovered Form Controls (${job.fields.length}):`)
        job.fields.forEach(f => {
          console.log(` - [${f.required ? 'REQUIRED' : 'OPTIONAL'}] ${f.type.toUpperCase()}: name="${f.name}" label="${f.label}" ${f.accept ? `accept="${f.accept}"` : ''}`)
        })
        results.push(job)
      } catch (err: any) {
        console.error(`Failed to audit ${u}:`, err.message)
      }
    }
  } finally {
    await browser.close()
  }

  console.log(`\nSuccessfully audited ${results.length} of ${targetUrls.length} jobs.`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
