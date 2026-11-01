import path from 'node:path'
import fs from 'node:fs'
import type { Page } from 'puppeteer-core'
import type { PortalDriver, SubmissionContext, SubmissionReceipt } from '../types.js'
import { setControlValueAndDispatch } from '../formDispatch.js'
import { uploadToR2, captureScreenshotToR2 } from '../../storage/r2Storage.js'
import { getAllCandidateAttributes } from '../../storage/db.js'

export class WorkableDriver implements PortalDriver {
  readonly id = 'workable'
  readonly name = 'Workable'

  canHandle(job: { portal?: string | null; job_url: string }): boolean {
    const p = (job.portal || '').toLowerCase()
    const u = (job.job_url || '').toLowerCase()
    return p.includes('workable') || u.includes('apply.workable.com')
  }

  async submit(page: Page, context: SubmissionContext): Promise<SubmissionReceipt> {
    const { job, candidateProfile, tailoredPdfPath, coverLetterText } = context
    const cleanUrl = job.job_url.replace(/\/$/, '')
    const applyUrl = cleanUrl.endsWith('/apply') ? cleanUrl : `${cleanUrl}/apply/`

    console.log(`[WorkableDriver] Navigating to Workable apply page: ${applyUrl}`)
    await page.goto(applyUrl, { waitUntil: 'networkidle2', timeout: 60000 })

    // Dismiss Cookie Banner if present
    try {
      const cookieBtn = await page.$('button[data-ui="cookie-consent-accept"], button[data-ui="cookie-consent-decline"]')
      if (cookieBtn) {
        console.log('[WorkableDriver] Dismissing cookie consent banner...')
        await cookieBtn.click()
        await new Promise(r => setTimeout(r, 400))
      }
    } catch {}

    // Wait for form inputs to mount
    await page.waitForSelector('input#firstname, input[name="firstname"], form', { timeout: 30000 })

    // Resolve candidate attributes
    const attributes = await getAllCandidateAttributes()
    const attrMap = new Map<string, string>()
    for (const a of attributes) {
      if (a.value && a.value.trim().length > 0) {
        attrMap.set(a.key, a.value.trim())
      }
    }

    const firstName = attrMap.get('first_name') || 'Miftahul'
    const lastName = attrMap.get('last_name') || 'Muhaemen'
    const email = attrMap.get('email') || candidateProfile.personal.email || 'miftahulmuhaemen@gmail.com'
    const rawPhone = attrMap.get('phone') || candidateProfile.personal.phone || '089677176035'
    const phone = rawPhone.replace(/^\+62/, '').replace(/^0/, '').replace(/[^0-9]/g, '')
    const location = attrMap.get('location') || 'Kota Banjarmasin, Kalimantan Selatan'
    const city = attrMap.get('city') || 'Banjarmasin'
    const headline = 'Senior Backend Engineer | Golang & Distributed Systems'

    // 1. Populate Basic Identity Fields
    const fillInput = async (selector: string, val: string) => {
      const el = await page.$(selector)
      if (el) {
        await el.click({ clickCount: 3 })
        await el.type(val, { delay: 10 })
      }
    }

    await fillInput('input#firstname', firstName)
    await fillInput('input#lastname', lastName)
    await fillInput('input#email', email)

    const headlineInput = await page.$('input#headline')
    if (headlineInput) {
      await fillInput('input#headline', headline)
    }

    const phoneInput = await page.$('input#input_phone, input[name="phone"]')
    if (phoneInput) {
      await fillInput('input#input_phone, input[name="phone"]', phone)
    }

    const addressInput = await page.$('input#address, input[name="address"]')
    if (addressInput) {
      await fillInput('input#address, input[name="address"]', location)
    }

    const cityInput = await page.$('input#city, input[name="city"]')
    if (cityInput) {
      await fillInput('input#city, input[name="city"]', city)
    }

    const resolvePath = context.resolveUploadPath || ((p: string) => p)

    // 2. Upload Candidate Photo & Confirm Crop Modal
    try {
      const photoFilename = 'photo.jpg'
      const photoPath = path.resolve(process.cwd(), 'data/assets', photoFilename)
      const photoInput = await page.$('input[type="file"][accept*="image"]')
      if (photoInput && fs.existsSync(photoPath)) {
        const uploadTarget = resolvePath(photoPath)
        console.log(`[WorkableDriver] Uploading candidate photo from: ${uploadTarget}`)
        await photoInput.uploadFile(uploadTarget)
        await new Promise(r => setTimeout(r, 1200))

        const cropBtn = await page.$('button[data-ui="crop-image"]')
        if (cropBtn) {
          console.log('[WorkableDriver] Confirming photo crop modal...')
          await cropBtn.click()
          await new Promise(r => setTimeout(r, 800))
        }
      }
    } catch (e: any) {
      console.warn(`[WorkableDriver] Photo upload note: ${e.message}`)
    }

    // 3. Select Country: Indonesia (Combobox: input_CA_55164_input)
    try {
      console.log('[WorkableDriver] Selecting Country: Indonesia via keyboard focus...')
      const countryInput = await page.$('#input_CA_55164_input')
      if (countryInput) {
        await page.focus('#input_CA_55164_input')
        await page.keyboard.press('ArrowDown')
        await new Promise(r => setTimeout(r, 600))

        await page.evaluate(() => {
          const listbox = document.querySelector('#input_CA_55164_listbox')
          const options = Array.from(listbox?.querySelectorAll('li') || [])
          const indo = options.find(li => (li.innerText || li.textContent || '').trim().toLowerCase() === 'indonesia') as HTMLElement | null
          if (indo) {
            indo.scrollIntoView()
            indo.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
            indo.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
            indo.click()
          }
        })
        await new Promise(r => setTimeout(r, 600))
      }
    } catch (e: any) {
      console.warn(`[WorkableDriver] Country combobox selection: ${e.message}`)
    }

    // 4. Populate Education Section
    try {
      const addEduBtn = await page.$('button[aria-label="Add Education"]')
      if (addEduBtn) {
        console.log('[WorkableDriver] Adding Education section...')
        await addEduBtn.evaluate(b => b.scrollIntoView())
        await addEduBtn.click()
        await new Promise(r => setTimeout(r, 800))

        const edu = candidateProfile.education || {
          institution: 'Universitas Lambung Mangkurat',
          degree: "Bachelor's Degree",
          gpa: '3.62',
          graduationDate: '2020-03-01'
        }

        const schoolInput = await page.$('input#school')
        if (schoolInput) {
          await setControlValueAndDispatch(page, 'input#school', edu.institution || 'Universitas Lambung Mangkurat')
        }
        const degreeInput = await page.$('input#degree')
        if (degreeInput) {
          await setControlValueAndDispatch(page, 'input#degree', edu.degree || "Bachelor's Degree")
        }
        const fieldInput = await page.$('input#field_of_study')
        if (fieldInput) {
          await setControlValueAndDispatch(page, 'input#field_of_study', (edu as any).field || 'Computer Science')
        }

        const saveEduBtn = await page.$('[data-ui="education"] button[data-ui="save-section"]')
        if (saveEduBtn) {
          await saveEduBtn.click()
          await new Promise(r => setTimeout(r, 600))
        }
      }
    } catch (e: any) {
      console.warn(`[WorkableDriver] Education section note: ${e.message}`)
    }

    // 5. Populate Work Experience Section (All experiences from candidate profile)
    try {
      const experiences = candidateProfile.experience || []
      console.log(`[WorkableDriver] Found ${experiences.length} experiences to populate...`)

      for (let i = 0; i < experiences.length; i++) {
        const exp = experiences[i]
        const addExpBtn = await page.$('button[aria-label="Add Experience"]')
        if (!addExpBtn) {
          console.warn(`[WorkableDriver] Add Experience button not found for index ${i}`)
          break
        }

        console.log(`[WorkableDriver] Adding Experience #${i + 1}: ${exp.role} at ${exp.company}...`)
        await addExpBtn.evaluate(b => b.scrollIntoView())
        await addExpBtn.click()
        await new Promise(r => setTimeout(r, 800))

        const titleInput = await page.$('[data-ui="experience"] input#title')
        if (titleInput) {
          await setControlValueAndDispatch(page, '[data-ui="experience"] input#title', exp.role || 'Software Engineer')
        }
        const companyInput = await page.$('[data-ui="experience"] input#company')
        if (companyInput) {
          await setControlValueAndDispatch(page, '[data-ui="experience"] input#company', exp.company || '')
        }

        if (exp.startDate) {
          const parts = exp.startDate.split('-')
          if (parts.length >= 2) {
            const formatted = `${parts[1]}/${parts[0]}`
            await setControlValueAndDispatch(page, '[data-ui="experience"] input[name="start_date"]', formatted)
          }
        }
        if (exp.endDate) {
          const parts = exp.endDate.split('-')
          if (parts.length >= 2) {
            const formatted = `${parts[1]}/${parts[0]}`
            await setControlValueAndDispatch(page, '[data-ui="experience"] input[name="end_date"]', formatted)
          }
        }

        const expSummary = await page.$('[data-ui="experience"] textarea#summary')
        if (expSummary) {
          const expDesc = exp.highlights && exp.highlights.length > 0
            ? exp.highlights.slice(0, 2).join('; ')
            : 'Engineered backend microservices and analytical ingestion pipelines.'
          await setControlValueAndDispatch(page, '[data-ui="experience"] textarea#summary', expDesc)
        }

        const saveExpBtn = await page.$('[data-ui="experience"] button[data-ui="save-section"]')
        if (saveExpBtn) {
          await saveExpBtn.click()
          await new Promise(r => setTimeout(r, 800))
        }
      }
    } catch (e: any) {
      console.warn(`[WorkableDriver] Experience section note: ${e.message}`)
    }

    // 6. Inject Professional Summary
    try {
      const summaryText = candidateProfile.summary ||
        'Results-oriented Software & Data Engineer with 5 years of professional experience across Go backend systems, distributed microservices, ETL pipelines, and cloud infrastructure.'
      const summaryBox = await page.$('div[data-ui="section-fields"] > div > label > div textarea#summary, textarea#summary')
      if (summaryBox) {
        console.log('[WorkableDriver] Injecting professional summary...')
        await setControlValueAndDispatch(page, 'div[data-ui="section-fields"] > div > label > div textarea#summary, textarea#summary', summaryText)
      }
    } catch (e: any) {
      console.warn(`[WorkableDriver] Summary note: ${e.message}`)
    }

    // 7. Upload Tailored Resume PDF (Exclusively targeting resume input, NEVER avatar)
    if (tailoredPdfPath && fs.existsSync(tailoredPdfPath)) {
      const uploadTarget = resolvePath(tailoredPdfPath)
      console.log(`[WorkableDriver] Uploading tailored resume from: ${uploadTarget}`)
      const fileInput = await page.$('input[type="file"][accept*="pdf"], input[type="file"]:not([accept*="image"])')
      if (fileInput) {
        await fileInput.uploadFile(uploadTarget)
        await new Promise(r => setTimeout(r, 3000))
      }
    }

    // 8. Inject Cover Letter Text (Exclusively targeting cover_letter, NEVER summary)
    if (coverLetterText) {
      const coverLetterBox = await page.$('textarea#cover_letter, textarea[name="cover_letter"]')
      if (coverLetterBox) {
        console.log('[WorkableDriver] Injecting tailored cover letter text...')
        await setControlValueAndDispatch(page, 'textarea#cover_letter, textarea[name="cover_letter"]', coverLetterText)
      }
    }

    await new Promise(r => setTimeout(r, 1000))

    // 9. Capture Pre-Submit Filled Form Screenshot directly to Cloudflare R2
    const preSubmitR2Key = `screenshots/submissions/workable_filled_${job.id}.png`
    await captureScreenshotToR2(page, preSubmitR2Key, { fullPage: true }).catch(() => {})

    // Pre-Fill Only Mode: Scroll down to submit controls and return immediately, leaving tab open for user
    if (context.prefillOnly) {
      console.log(`[WorkableDriver] Form pre-filled for Job #${job.id}. Leaving browser open for user submission.`)
      await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })).catch(() => {})
      return {
        success: true,
        portal: this.id,
        status: 'PREFILLED',
        submittedAt: new Date().toISOString(),
        confirmationUrl: page.url(),
        confirmationText: `Application form pre-filled in browser for ${job.company} - ${job.title}. Ready for user submission.`,
        note: 'Pre-filled by automator. Awaiting user Turnstile resolution and manual submit.',
        screenshotPaths: {
          formFilled: preSubmitR2Key,
          confirmed: preSubmitR2Key
        },
        receiptScreenshotPath: preSubmitR2Key
      }
    }

    // 6. Automated Headless Submit Application
    console.log('[WorkableDriver] Clicking submit application...')
    const submitBtn = await page.$('button[data-ui="apply-button"], button[data-ui="submit-application"]')
    if (submitBtn) {
      await submitBtn.click()
    } else {
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'))
        const sub = btns.find(b => (b.textContent || '').toLowerCase().includes('submit'))
        if (sub) sub.click()
      })
    }

    // Wait for in-page SPA confirmation transition, URL navigation, or Turnstile challenge
    await new Promise(r => setTimeout(r, 5000))

    // 7. Audit for Cloudflare Turnstile Bot Protection Gate
    const hasTurnstileGate = await page.evaluate(() => {
      const bodyText = document.body.innerText.toLowerCase()
      const isBlocked = bodyText.includes('verifikasi bahwa anda adalah manusia') || bodyText.includes('verify you are human')
      const btn = document.querySelector('button[data-ui="apply-button"], button[data-ui="submit-application"]')
      const isSubmittingStalled = btn && (btn.textContent || '').toLowerCase().includes('submitting')
      return isBlocked || isSubmittingStalled
    })

    if (hasTurnstileGate) {
      const roadblockR2Key = `screenshots/submissions/job_${job.id}_roadblock.png`
      await captureScreenshotToR2(page, roadblockR2Key, { fullPage: false }).catch(() => {})
      console.warn(`[WorkableDriver] Cloudflare Turnstile human verification gate encountered. Captured roadblock screenshot to R2: ${roadblockR2Key}`)
      throw new Error(`Cloudflare Turnstile verification required to complete submission on Workable (${applyUrl})`)
    }

    // 8. Capture Confirmation Screenshot directly to Cloudflare R2
    const receiptFilename = `workable_receipt_${job.id}_${Date.now()}.png`
    const r2Key = `screenshots/submissions/${receiptFilename}`
    await captureScreenshotToR2(page, r2Key, { fullPage: false }).catch(err => {
      console.warn(`[WorkableDriver] R2 proof sync failed: ${err.message}`)
    })
    console.log(`[WorkableDriver] Saved confirmation receipt directly to R2: ${r2Key}`)

    const finalUrl = page.url()
    return {
      success: true,
      portal: this.id,
      status: 'APPLIED',
      submittedAt: new Date().toISOString(),
      confirmationUrl: finalUrl,
      confirmationText: `Application successfully submitted to Workable (${finalUrl})`,
      note: `Application submitted to Workable. Form filled and dispatched.`,
      screenshotPaths: {
        formFilled: preSubmitR2Key,
        confirmed: r2Key
      },
      receiptScreenshotPath: r2Key,
      r2ScreenshotKey: r2Key
    }
  }
}
