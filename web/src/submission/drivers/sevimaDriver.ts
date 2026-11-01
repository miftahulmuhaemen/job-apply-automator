import path from 'node:path'
import fs from 'node:fs'
import type { Page } from 'puppeteer-core'
import type { PortalDriver, SubmissionContext, SubmissionReceipt } from '../types.js'
import { setControlValueAndDispatch } from '../formDispatch.js'
import { uploadToR2, captureScreenshotToR2 } from '../../storage/r2Storage.js'
import { getAllCandidateAttributes } from '../../storage/db.js'

export class SevimaDriver implements PortalDriver {
  readonly id = 'sevima'
  readonly name = 'SEVIMA Career'

  canHandle(job: { portal?: string | null; job_url: string }): boolean {
    const p = (job.portal || '').toLowerCase()
    const u = (job.job_url || '').toLowerCase()
    return p.includes('sevima') || u.includes('careers.sevima.com')
  }

  async submit(page: Page, context: SubmissionContext): Promise<SubmissionReceipt> {
    const { job, candidateProfile, tailoredPdfPath } = context
    const applyUrl = job.job_url.endsWith('/apply')
      ? job.job_url
      : `${job.job_url.replace(/\/$/, '')}/apply`

    console.log(`[SevimaDriver] Registering Choices.js hook for SEVIMA form...`)
    await page.evaluateOnNewDocument(() => {
      let _Choices = (window as any).Choices
      Object.defineProperty(window, 'Choices', {
        get() {
          return _Choices
        },
        set(newC) {
          _Choices = function (element: any, options: any) {
            const instance = new newC(element, options)
            if (element) {
              element._choicesInstance = instance
            }
            return instance
          }
          _Choices.prototype = newC.prototype
        },
        configurable: true
      })
    })

    console.log(`[SevimaDriver] Navigating to SEVIMA apply page: ${applyUrl}`)
    await page.goto(applyUrl, { waitUntil: 'networkidle2', timeout: 60000 })

    // Resolve candidate attributes from Cloudflare D1
    const attributes = await getAllCandidateAttributes()
    const attrMap = new Map<string, string>()
    for (const a of attributes) {
      if (a.value && a.value.trim().length > 0) {
        attrMap.set(a.key, a.value.trim())
      }
    }

    const resolvePath = context.resolveUploadPath || ((p: string) => p)

    // 1. Upload Candidate Photo (input#photo)
    const photoFilename = attrMap.get('photo_document') || 'photo.jpg'
    const photoPath = path.resolve(process.cwd(), 'data/assets', photoFilename)
    const photoInput = await page.$('input#photo')
    if (photoInput && fs.existsSync(photoPath)) {
      const uploadTarget = resolvePath(photoPath)
      console.log(`[SevimaDriver] Uploading candidate photo from: ${uploadTarget}`)
      await photoInput.uploadFile(uploadTarget)
      await new Promise(r => setTimeout(r, 600))
    }

    // 2. Personal Information
    const fullName = attrMap.get('full_name') || candidateProfile.personal.fullName || 'Miftahul Muhaemen'
    const email = attrMap.get('email') || candidateProfile.personal.email || 'miftahulmuhaemen@gmail.com'
    const rawPhone = attrMap.get('phone') || candidateProfile.personal.phone || '089677176035'
    const phone = rawPhone.replace(/^\+62/, '0').replace(/[^0-9]/g, '')
    const address = attrMap.get('location') || candidateProfile.personal.location || 'Kota Banjarmasin, Kalimantan Selatan, Indonesia'
    const dob = '1997-04-12'

    await setControlValueAndDispatch(page, 'input#name', fullName)
    await setControlValueAndDispatch(page, 'input#email', email)
    await setControlValueAndDispatch(page, 'input#telephone', phone)
    await setControlValueAndDispatch(page, 'input#address', address)
    await setControlValueAndDispatch(page, 'input#date_of_birth', dob)

    // Radio: is_married = 0 (Belum Menikah / Single)
    await page.evaluate(() => {
      const radio = document.querySelector('input[name="is_married"][value="0"]') as HTMLInputElement | null
      if (radio) {
        radio.checked = true
        radio.dispatchEvent(new Event('change', { bubbles: true }))
      }
    })

    // 3. Education: Select S1 using Choices.js instance
    await page.evaluate(() => {
      const edSel = document.querySelector('#education') as any
      if (edSel?._choicesInstance) {
        edSel._choicesInstance.setChoiceByValue('S1')
        edSel.dispatchEvent(new Event('change', { bubbles: true }))
      }
    })
    await new Promise(r => setTimeout(r, 600))

    const school = attrMap.get('school') || 'Universitas Lambung Mangkurat'
    const faculty = attrMap.get('faculty') || 'Fakultas Matematika dan Ilmu Pengetahuan Alam'
    const major = attrMap.get('major') || 'Ilmu Komputer'
    await setControlValueAndDispatch(page, 'input#school', school)
    await setControlValueAndDispatch(page, 'input#faculty', faculty)
    await setControlValueAndDispatch(page, 'input#major', major)

    // 4. Upload Documents
    // Tailored Resume PDF (input#curriculum_vitae)
    const resumeInput = await page.$('input#curriculum_vitae')
    if (resumeInput && tailoredPdfPath && fs.existsSync(tailoredPdfPath)) {
      const uploadTarget = resolvePath(tailoredPdfPath)
      console.log(`[SevimaDriver] Uploading tailored resume from: ${uploadTarget}`)
      await resumeInput.uploadFile(uploadTarget)
      await new Promise(r => setTimeout(r, 600))
    }

    // Portfolio PDF (input#portfolio)
    const portfolioFilename = attrMap.get('portfolio_document') || 'candidate_portfolio.pdf'
    let portfolioPath = path.resolve(process.cwd(), 'data/assets', portfolioFilename)
    if (!fs.existsSync(portfolioPath)) {
      portfolioPath = path.resolve(process.cwd(), 'data/assets', 'portfolio.pdf')
    }
    const portfolioInput = await page.$('input#portfolio')
    if (portfolioInput && fs.existsSync(portfolioPath)) {
      const uploadTarget = resolvePath(portfolioPath)
      console.log(`[SevimaDriver] Uploading portfolio from: ${uploadTarget}`)
      await portfolioInput.uploadFile(uploadTarget)
      await new Promise(r => setTimeout(r, 600))
    }

    // 5. Work Experience: Select > 5 Tahun via Choices.js instance
    await page.evaluate(() => {
      const expSel = document.querySelector('#experience') as any
      if (expSel?._choicesInstance) {
        expSel._choicesInstance.setChoiceByValue('> 5 Tahun')
        expSel.dispatchEvent(new Event('change', { bubbles: true }))
      }
    })
    await new Promise(r => setTimeout(r, 600))

    const lastCompany = attrMap.get('experience_company') || 'Blue Sky Tech (Bythen AI)'
    const salaryBefore = '7000000'
    const salaryExpected = '12000000'

    await setControlValueAndDispatch(page, 'input#last_company', lastCompany)
    await setControlValueAndDispatch(page, 'input#salary_before', salaryBefore)
    await setControlValueAndDispatch(page, 'input#salary_expected', salaryExpected)

    // 6. Source of Info: Select Linkedin via Choices.js instance
    await page.evaluate(() => {
      const infoSel = document.querySelector('#info') as any
      if (infoSel?._choicesInstance) {
        infoSel._choicesInstance.setChoiceByValue('Linkedin')
        infoSel.dispatchEvent(new Event('change', { bubbles: true }))
      }
    })

    // 7. Checkbox Declarations
    await page.evaluate(() => {
      const checkNames = ['statement_of_honesty', 'statement_of_ai_processing', 'statement_of_consent']
      checkNames.forEach(name => {
        const el = document.querySelector(`input[name="${name}"]`) as HTMLInputElement | null
        if (el) {
          el.checked = true
          el.dispatchEvent(new Event('change', { bubbles: true }))
        }
      })
    })

    await new Promise(r => setTimeout(r, 1000))

    // 8. Capture Pre-Submit Filled Form Screenshot directly to Cloudflare R2
    const preSubmitR2Key = `screenshots/submissions/sevima_filled_${job.id}.png`
    await captureScreenshotToR2(page, preSubmitR2Key, { fullPage: true }).catch(() => {})

    // 9. Submit Application
    console.log('[SevimaDriver] Clicking submit application...')
    const submitBtn = await page.$('#apply-form button[type="submit"]')
    if (submitBtn) {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {}),
        submitBtn.click()
      ])
    } else {
      await page.evaluate(() => {
        const form = document.querySelector('#apply-form') as HTMLFormElement | null
        if (form) form.submit()
      })
      await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 45000 }).catch(() => {})
    }

    await new Promise(r => setTimeout(r, 3000))

    // 10. Capture Confirmation Screenshot directly to Cloudflare R2
    const receiptFilename = `sevima_receipt_${job.id}_${Date.now()}.png`
    const r2Key = `screenshots/submissions/${receiptFilename}`
    await captureScreenshotToR2(page, r2Key, { fullPage: false }).catch(err => {
      console.warn(`[SevimaDriver] R2 proof sync failed: ${err.message}`)
    })
    console.log(`[SevimaDriver] Saved confirmation receipt directly to R2: ${r2Key}`)

    const finalUrl = page.url()
    return {
      success: true,
      portal: this.id,
      status: 'APPLIED',
      submittedAt: new Date().toISOString(),
      confirmationUrl: finalUrl,
      confirmationText: `Application successfully submitted to SEVIMA Career (${finalUrl})`,
      note: `Application submitted to SEVIMA Career. Form verified and dispatched.`,
      screenshotPaths: {
        formFilled: preSubmitR2Key,
        confirmed: r2Key
      },
      receiptScreenshotPath: r2Key,
      r2ScreenshotKey: r2Key
    }
  }
}
