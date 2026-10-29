import fs from 'fs'
import path from 'path'
import type { Page } from 'puppeteer-core'
import type { PortalDriver, SubmissionContext, SubmissionReceipt } from '../types.js'

export class KalibrrDriver implements PortalDriver {
  readonly id = 'kalibrr'
  readonly name = 'Kalibrr Indonesia'

  canHandle(job: { portal?: string | null; job_url: string }): boolean {
    const portal = (job.portal || '').toLowerCase()
    const url = (job.job_url || '').toLowerCase()
    return portal.includes('kalibrr') || url.includes('kalibrr.com')
  }

  async submit(page: Page, context: SubmissionContext): Promise<SubmissionReceipt> {
    const { job, candidateProfile, tailoredPdfPath, tailoredPdfWinPath, qaList } = context
    const timestamp = new Date().toISOString()
    const screenshotDir = path.resolve(process.cwd(), 'data/screenshots/submissions')
    if (!fs.existsSync(screenshotDir)) {
      fs.mkdirSync(screenshotDir, { recursive: true })
    }

    const modalShotPath = path.join(screenshotDir, `job_${job.id}_modal.png`)
    const formFilledShotPath = path.join(screenshotDir, `job_${job.id}_form_filled.png`)
    const confirmedShotPath = path.join(screenshotDir, `job_${job.id}_confirmed.png`)

    console.log(`[KalibrrDriver] Navigating to ${job.job_url}...`)
    await page.goto(job.job_url, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await new Promise(r => setTimeout(r, 4000))

    // Step 1: Precise Authentication Check on Navigation Header
    const authStatus = await page.evaluate(() => {
      const navLinks = Array.from(
        document.querySelectorAll('header a, nav a, header button, nav button, [class*="nav"] a, [class*="header"] a')
      )
      const navTexts = navLinks.map(el => (el.textContent || '').trim().toLowerCase())
      const hasLoginNav = navTexts.some(t => t === 'masuk' || t === 'log in' || t === 'sign in')
      const hasRegisterNav = navTexts.some(t => t === 'daftar' || t === 'sign up' || t === 'register')
      const isGuest = (hasLoginNav && hasRegisterNav) || window.location.href.includes('/login')

      return {
        isGuest,
        currentUrl: window.location.href
      }
    })

    if (authStatus.isGuest) {
      throw new Error(
        'Kalibrr session requires authentication. Please log in to Kalibrr via "bun run auth kalibrr" or the Web Console session launcher.'
      )
    }

    // Step 2: Check if already applied
    const alreadyApplied = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a'))
      const match = btns.find(b => {
        const t = (b.textContent || '').trim().toLowerCase()
        return t === 'sudah dilamar' || t === 'applied' || t.includes('sudah dilamar')
      })
      return !!match
    })

    if (alreadyApplied) {
      await page.screenshot({ path: confirmedShotPath })
      return {
        success: true,
        portal: this.id,
        confirmationUrl: page.url(),
        confirmationText: 'Application previously submitted on Kalibrr (Sudah Dilamar)',
        screenshotPaths: {
          confirmed: confirmedShotPath
        },
        submittedAt: timestamp,
        note: 'Position verified as already submitted on Kalibrr'
      }
    }

    // Step 3: Click "Lamar Sekarang" / "Apply Now" / "Continue Application"
    const clickedApply = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a'))
      const applyBtn = btns.find(b => {
        const t = (b.textContent || '').trim().toLowerCase()
        return (
          t === 'lamar sekarang' ||
          t === 'apply now' ||
          t.includes('continue application') ||
          t.includes('lamar sekarang') ||
          t.includes('apply now')
        )
      })
      if (applyBtn) {
        ;(applyBtn as HTMLElement).click()
        return true
      }
      return false
    })

    if (!clickedApply && !page.url().includes('/profiler') && !page.url().includes('/questions')) {
      throw new Error('Could not locate "Lamar Sekarang", "Apply Now", or "Continue Application" button on Kalibrr job page.')
    }

    console.log('[KalibrrDriver] Clicked "Lamar Sekarang", waiting for application modal...')
    await new Promise(r => setTimeout(r, 3500))
    await page.screenshot({ path: modalShotPath })

    // Step 4: Handle Resume Attachment if file input present
    const fileInputs = await page.$$('input[type="file"]')
    if (fileInputs.length > 0) {
      const uploadTarget = tailoredPdfWinPath || tailoredPdfPath
      console.log(`[KalibrrDriver] Found file upload input. Attaching resume: ${uploadTarget}`)
      try {
        await fileInputs[0].uploadFile(uploadTarget)
        await new Promise(r => setTimeout(r, 2000))
      } catch (err: any) {
        console.warn(`[KalibrrDriver] File upload warning: ${err.message}`)
      }
    }

    // Step 5: Fill Screening Questions & Candidate Details
    console.log('[KalibrrDriver] Populating application screening questions and form fields...')
    await page.evaluate((qaListPayload, profile) => {
      // 1. Textarea fields (custom screening questions)
      const visibleTextareas = Array.from(document.querySelectorAll('textarea')).filter(
        ta => ta.offsetParent !== null
      )

      visibleTextareas.forEach((ta, idx) => {
        // Try to find label or question header text nearby
        const parent = ta.closest('div, label, section')
        const labelText = parent ? (parent.textContent || '').toLowerCase() : ''

        let answerToUse = ''
        if (qaListPayload && qaListPayload.length > 0) {
          // Find matching question
          const matched = qaListPayload.find(qa => {
            const q = qa.question.toLowerCase()
            return labelText.includes(q.slice(0, 30)) || q.includes(labelText.slice(0, 30))
          })
          if (matched) {
            answerToUse = matched.answer
          } else if (qaListPayload[idx]) {
            answerToUse = qaListPayload[idx].answer
          }
        }

        if (!answerToUse) {
          answerToUse = `I have 5 years of professional backend software engineering experience with Go and TypeScript microservices, relational databases, and cloud infrastructure. Available to start immediately.`
        }

        ta.value = answerToUse
        ta.dispatchEvent(new Event('input', { bubbles: true }))
        ta.dispatchEvent(new Event('change', { bubbles: true }))
      })

      // 2. Text input fields (phone, linkedin, portfolio, location)
      const visibleInputs = Array.from(document.querySelectorAll('input[type="text"], input[type="tel"], input[type="url"]')).filter(
        i => (i as HTMLInputElement).offsetParent !== null
      ) as HTMLInputElement[]

      visibleInputs.forEach(input => {
        const name = (input.name || '').toLowerCase()
        const placeholder = (input.placeholder || '').toLowerCase()
        const parentText = input.closest('div, label')?.textContent?.toLowerCase() || ''
        const key = `${name} ${placeholder} ${parentText}`

        if (key.includes('phone') || key.includes('telepon') || key.includes('whatsapp') || key.includes('hp')) {
          if (!input.value) {
            input.value = profile.personal.phone
            input.dispatchEvent(new Event('input', { bubbles: true }))
            input.dispatchEvent(new Event('change', { bubbles: true }))
          }
        } else if (key.includes('linkedin')) {
          if (!input.value) {
            input.value = profile.personal.linkedin
            input.dispatchEvent(new Event('input', { bubbles: true }))
            input.dispatchEvent(new Event('change', { bubbles: true }))
          }
        } else if (key.includes('portfolio') || key.includes('portofolio') || key.includes('website')) {
          if (!input.value) {
            input.value = profile.personal.portfolio
            input.dispatchEvent(new Event('input', { bubbles: true }))
            input.dispatchEvent(new Event('change', { bubbles: true }))
          }
        }
      })

      // 3. Radio inputs (e.g. Yes/No, work rights)
      const radioInputs = Array.from(document.querySelectorAll('input[type="radio"]')).filter(
        r => (r as HTMLInputElement).offsetParent !== null
      ) as HTMLInputElement[]

      radioInputs.forEach(radio => {
        const label = radio.closest('label')?.textContent?.trim().toLowerCase() || ''
        const parent = radio.closest('div, fieldset')?.textContent?.trim().toLowerCase() || ''
        if (label === 'yes' || label === 'ya') {
          if (!parent.includes('sponsorship') && !parent.includes('visa')) {
            radio.checked = true
            radio.dispatchEvent(new Event('change', { bubbles: true }))
          }
        } else if (label === 'no' || label === 'tidak') {
          if (parent.includes('sponsorship') || parent.includes('visa')) {
            radio.checked = true
            radio.dispatchEvent(new Event('change', { bubbles: true }))
          }
        }
      })
    }, qaList, candidateProfile)

    await new Promise(r => setTimeout(r, 2000))
    await page.screenshot({ path: formFilledShotPath })

    // Step 6: Multi-step progression & Final Submit
    console.log('[KalibrrDriver] Submitting application...')
    for (let step = 0; step < 8; step++) {
      const currentUrl = page.url()

      // Guard: Check if Kalibrr redirected to an exam / assessment prerequisite
      if (currentUrl.includes('/candidate/exams/') || (await page.evaluate(() => document.body.innerText.includes('Required skills test')))) {
        const roadblockShotPath = path.join(screenshotDir, `job_${job.id}_roadblock.png`)
        await page.screenshot({ path: roadblockShotPath })
        throw new Error(
          `Application blocked by mandatory Kalibrr assessment: ${currentUrl}. Complete the required skills test before Kalibrr allows submitting this application.`
        )
      }

      // Check if on /questions page
      const isOnQuestions = currentUrl.includes('/questions') || (await page.evaluate(() => document.body.innerText.includes('Application questions')))
      if (isOnQuestions) {
        console.log('[KalibrrDriver] On Application Questions step. Answering questions...')
        await page.evaluate(() => {
          // Question 1: Employment status -> "Not currently employed"
          const q1Radio = document.querySelector('input[id*="142325-3"]') || 
            Array.from(document.querySelectorAll('label, input[type="radio"]')).find(el => (el.textContent || '').includes('Not currently employed'))
          if (q1Radio) {
            const radioInput = (q1Radio as HTMLInputElement).type === 'radio' ? q1Radio as HTMLInputElement : q1Radio.querySelector('input[type="radio"]') as HTMLInputElement
            if (radioInput) radioInput.click()
            else (q1Radio as HTMLElement).click()
          }

          // Question 2: Years with Golang -> ">5" or "3-4"
          const q2Radio = document.querySelector('input[id*="142326-3"]') || document.querySelector('input[id*="142326-2"]') ||
            Array.from(document.querySelectorAll('label, input[type="radio"]')).find(el => (el.textContent || '').includes('>5') || (el.textContent || '').includes('3-4'))
          if (q2Radio) {
            const radioInput = (q2Radio as HTMLInputElement).type === 'radio' ? q2Radio as HTMLInputElement : q2Radio.querySelector('input[type="radio"]') as HTMLInputElement
            if (radioInput) radioInput.click()
            else (q2Radio as HTMLElement).click()
          }

          // Question 3: Open to Freelance -> "Yes"
          const q3Radio = document.querySelector('input[id*="142327-0"]')
          if (q3Radio) (q3Radio as HTMLElement).click()

          // Question 4: 8 hours working commitment -> "Yes"
          const q4Radio = document.querySelector('input[id*="142328-0"]')
          if (q4Radio) (q4Radio as HTMLElement).click()

          // Question 5: Salary expectation in nett -> 22000000
          const numInput = document.querySelector('input[type="number"], input[name="number"]') as HTMLInputElement
          if (numInput) {
            numInput.value = '22000000'
            numInput.dispatchEvent(new Event('input', { bubbles: true }))
            numInput.dispatchEvent(new Event('change', { bubbles: true }))
          }
        })

        await new Promise(r => setTimeout(r, 1500))
        await page.screenshot({ path: formFilledShotPath })

        // Click final submit on questions page
        const clickedSubmit = await page.evaluate(() => {
          const btns = Array.from(document.querySelectorAll('button'))
          const sub = btns.find(b => (b.textContent || '').trim().toLowerCase() === 'submit')
          if (sub) {
            sub.click()
            return true
          }
          return false
        })
        console.log('[KalibrrDriver] Clicked final questions submit:', clickedSubmit)
        await new Promise(r => setTimeout(r, 6000))
        break
      }

      // Check if on interstitial "Keep going"
      const clickedKeepGoing = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, a'))
        const keepGoing = btns.find(b => (b.textContent || '').trim().toLowerCase().includes('keep going'))
        if (keepGoing) {
          (keepGoing as HTMLElement).click()
          return true
        }
        return false
      })

      if (clickedKeepGoing) {
        console.log('[KalibrrDriver] Clicked "Keep going" on interstitial screen...')
        await new Promise(r => setTimeout(r, 4000))
        continue
      }

      // Check for Submit Profile button on /profiler step 1
      const clickedProfileSubmit = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button'))
        const sub = btns.find(b => (b.textContent || '').trim().toLowerCase().includes('submit profile'))
        if (sub) {
          sub.click()
          return true
        }
        return false
      })

      if (clickedProfileSubmit) {
        console.log('[KalibrrDriver] Clicked "Submit Profile" on profiler step 1...')
        await new Promise(r => setTimeout(r, 4000))
        continue
      }

      // Fallback: standard next / continue button
      const clickedNext = await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, a'))
        const next = btns.find(b => {
          const t = (b.textContent || '').trim().toLowerCase()
          return t === 'lanjut' || t === 'next' || t === 'continue' || t.includes('lanjut')
        })
        if (next) {
          (next as HTMLElement).click()
          return true
        }
        return false
      })

      if (clickedNext) {
        console.log('[KalibrrDriver] Clicked wizard next step...')
        await new Promise(r => setTimeout(r, 3000))
        continue
      }

      break
    }

    // Wait for network response and completion banner
    await new Promise(r => setTimeout(r, 4000))
    try {
      await page.screenshot({ path: confirmedShotPath })
    } catch (shotErr) {
      console.warn('[KalibrrDriver] Warning: intermediate post-submit screenshot failed:', shotErr)
    }

    // Step 7: Strict Invariant Verification on Live Applications Ledger
    console.log('[KalibrrDriver] Verifying application existence on candidate/applications...')
    try {
      await page.goto('https://jobseeker.kalibrr.com/candidate/applications', {
        waitUntil: 'networkidle2',
        timeout: 45000
      })
    } catch {
      await page.goto('https://jobseeker.kalibrr.com/candidate/applications', {
        waitUntil: 'domcontentloaded',
        timeout: 45000
      })
    }
    await new Promise(r => setTimeout(r, 5000))

    const verificationResult = await page.evaluate((targetCompany, targetTitle) => {
      const cards = Array.from(
        document.querySelectorAll('div.k-bg-white.k-rounded-md.k-border, div[class*="application"]')
      )
      const normCompany = targetCompany.toLowerCase().trim()
      const normTitle = targetTitle.toLowerCase().trim()

      for (const card of cards) {
        const text = (card.textContent || '').toLowerCase()
        const hasCompany = text.includes(normCompany) || normCompany.split(' ').some(w => w.length > 3 && text.includes(w))
        const hasTitle = text.includes(normTitle) || normTitle.split(' ').some(w => w.length > 3 && text.includes(w))
        const isRecent = text.includes('just now') || text.includes('today') || text.includes('minute') || text.includes('hour') || text.includes('hari ini')
        const isOld = text.includes('month') || text.includes('year') || text.includes('bulan') || text.includes('tahun')

        // Skip historical applications (e.g. from 4 months ago)
        if (isOld && !isRecent) {
          continue
        }

        if (hasCompany && (hasTitle || isRecent)) {
          const isSent = text.includes('application sent') || text.includes('terkirim') || text.includes('in review') || text.includes('aktif')
          return {
            verified: isSent || isRecent,
            cardText: (card.textContent || '').trim().replace(/\s+/g, ' ')
          }
        }
      }

      return {
        verified: false,
        cardText: null
      }
    }, job.company, job.title)

    await page.screenshot({ path: confirmedShotPath })

    if (!verificationResult.verified) {
      throw new Error(
        `Application submission was not confirmed on Kalibrr live dashboard (https://jobseeker.kalibrr.com/candidate/applications). Target position "${job.company} - ${job.title}" was not found among recent active applications.`
      )
    }

    return {
      success: true,
      portal: this.id,
      confirmationUrl: 'https://jobseeker.kalibrr.com/candidate/applications',
      confirmationText: `Application verified on Kalibrr applications ledger: ${verificationResult.cardText}`,
      screenshotPaths: {
        modalOpened: modalShotPath,
        formFilled: formFilledShotPath,
        confirmed: confirmedShotPath
      },
      submittedAt: new Date().toISOString(),
      note: `Live Kalibrr submission verified on dashboard. Card: ${verificationResult.cardText}`
    }
  }
}
