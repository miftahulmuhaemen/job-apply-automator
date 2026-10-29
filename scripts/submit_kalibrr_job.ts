import { spawn, execSync } from 'child_process'
import fs from 'fs'
import path from 'path'
import puppeteer from 'puppeteer-core'

const WIN_USER = 'Makutu'
const BRAVE_SRC_DIR = `/mnt/c/Users/${WIN_USER}/AppData/Local/BraveSoftware/Brave-Browser/User Data`
const TARGET_PROFILE_DIR = `/mnt/c/Users/${WIN_USER}/.job_apply_automator/browser_profile`
const WIN_PROFILE_DIR = `C:/Users/${WIN_USER}/.job_apply_automator/browser_profile`
const RESUME_WIN_PATH = `C:/Users/${WIN_USER}/.job_apply_automator/tailored_resume.pdf`

export async function syncCookiesFromActiveBrave(): Promise<boolean> {
  const srcCookies = path.join(BRAVE_SRC_DIR, 'Default', 'Network', 'Cookies')
  const srcLocalState = path.join(BRAVE_SRC_DIR, 'Local State')
  const dstDir = path.join(TARGET_PROFILE_DIR, 'Default', 'Network')
  const dstCookies = path.join(dstDir, 'Cookies')
  const dstLocalState = path.join(TARGET_PROFILE_DIR, 'Local State')

  fs.mkdirSync(dstDir, { recursive: true })

  try {
    fs.copyFileSync(srcLocalState, dstLocalState)
    fs.copyFileSync(srcCookies, dstCookies)
    console.log('[SYNC] Successfully copied active session cookies to automator profile.')
    return true
  } catch (err: any) {
    if (err.code === 'EBUSY' || err.code === 'EACCES' || err.message?.includes('permission denied')) {
      console.error('[SYNC ERROR] Desktop Brave is currently open and holding an exclusive lock on Cookies.')
      console.error('[SYNC ACTION] Please close the desktop Brave browser window so the session can be copied.')
      return false
    }
    throw err
  }
}

export async function executeKalibrrApply() {
  const synced = await syncCookiesFromActiveBrave()
  if (!synced) {
    process.exit(1)
  }

  // Ensure tailored resume exists on Windows drive
  const localPdf = path.resolve('output/resumes/PT_Bumi_Amartha_Teknologi_Mandiri_Golang_Developer_Resume.pdf')
  const winPdfTarget = `/mnt/c/Users/${WIN_USER}/.job_apply_automator/tailored_resume.pdf`
  if (fs.existsSync(localPdf)) {
    fs.copyFileSync(localPdf, winPdfTarget)
    console.log('[RESUME] Copied tailored resume to:', winPdfTarget)
  }

  // Launch Brave on Windows with CDP on port 9222
  console.log('[BROWSER] Launching Brave with isolated profile and remote debugging...')
  const psCmd = `Start-Process 'C:\\Program Files\\BraveSoftware\\Brave-Browser\\Application\\brave.exe' -ArgumentList '--remote-debugging-port=9222', '--remote-debugging-address=0.0.0.0', '--remote-allow-origins=*', '--user-data-dir=${WIN_PROFILE_DIR}'`
  execSync(`/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -NoProfile -NonInteractive -Command "${psCmd}" < /dev/null`, { stdio: 'ignore' })

  // Connect via Python CDP Proxy on port 9223 -> 127.0.0.1:9222
  let browser: any = null
  let page: any = null

  try {
    console.log('[CDP] Waiting for browser CDP connection...')
    let connected = false
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500))
      try {
        const res = await fetch('http://172.25.192.1:9223/json/version', { signal: AbortSignal.timeout(1000) })
        if (res.ok) {
          connected = true
          break
        }
      } catch {}
    }

    if (!connected) {
      throw new Error('Failed to connect to CDP on port 9223/9222.')
    }

    browser = await puppeteer.connect({
      browserURL: 'http://172.25.192.1:9223',
      defaultViewport: null
    })

    page = await browser.newPage()
    const targetUrl = 'https://www.kalibrr.com/id-ID/c/pt-bumi-amartha-teknologi-mandiri/jobs/274699/golang-developer-9'
    console.log(`[NAVIGATE] Loading target job URL: ${targetUrl}`)
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 45000 })
    await new Promise(r => setTimeout(r, 4000))

    // Check if user is authenticated
    const authState = await page.evaluate(() => {
      const text = document.body.innerText
      const hasMasuk = text.includes('Masuk') && text.includes('Daftar')
      return { hasMasuk, url: window.location.href }
    })

    console.log('[AUTH CHECK]', authState)

    // Click Lamar Sekarang
    const applyBtn = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a'))
      const btn = btns.find(b => (b.textContent || '').trim().toLowerCase().includes('lamar sekarang'))
      if (btn) {
        ;(btn as HTMLElement).click()
        return true
      }
      return false
    })

    console.log(`[ACTION] Clicked "Lamar Sekarang": ${applyBtn}`)
    await new Promise(r => setTimeout(r, 3500))

    // Capture screenshot of application modal
    await page.screenshot({ path: 'data/screenshots/kalibrr_live_modal_opened.png' })
    console.log('[EVIDENCE] Saved data/screenshots/kalibrr_live_modal_opened.png')

    // Inspect inputs and fields inside the modal
    const modalDetails = await page.evaluate(() => {
      const inputs = Array.from(document.querySelectorAll('input, textarea, select')).map(el => {
        const input = el as HTMLInputElement
        return {
          tag: input.tagName,
          type: input.type,
          name: input.name,
          placeholder: input.placeholder,
          visible: input.offsetParent !== null
        }
      }).filter(i => i.visible)

      const buttons = Array.from(document.querySelectorAll('button, a')).filter(b => (b as HTMLElement).offsetParent !== null).map(b => b.textContent?.trim()).filter(Boolean)

      return { inputs, buttons: buttons.slice(0, 20) }
    })

    console.log('[MODAL DETAILS]', JSON.stringify(modalDetails, null, 2))

    // Handle screening questions and file upload if present
    const fileInputs = await page.$$('input[type="file"]')
    if (fileInputs.length > 0) {
      console.log(`[UPLOAD] Found ${fileInputs.length} file input(s). Uploading ${RESUME_WIN_PATH}...`)
      try {
        await fileInputs[0].uploadFile(RESUME_WIN_PATH)
        console.log('[UPLOAD] Attached resume file.')
      } catch (err: any) {
        console.warn('[UPLOAD WARNING]', err.message)
      }
    }

    // Populate textareas with candidate answers
    await page.evaluate(() => {
      const textareas = Array.from(document.querySelectorAll('textarea')).filter(t => t.offsetParent !== null)
      const answers = [
        'In Go, I use Goroutines and buffered channels with worker pool patterns to process concurrent telemetry and batch data asynchronously while bounding resource consumption to prevent memory exhaustion under high traffic.',
        'I have 5 years of professional backend experience building modular RESTful APIs and microservices in both Go and Node.js, designing clean route handlers, input validation, and database transaction controls.',
        'Yes, I am currently unemployed and available to start immediately with zero notice period.'
      ]
      textareas.forEach((ta, idx) => {
        if (answers[idx]) {
          ta.value = answers[idx]
          ta.dispatchEvent(new Event('input', { bubbles: true }))
          ta.dispatchEvent(new Event('change', { bubbles: true }))
        }
      })
    })

    await new Promise(r => setTimeout(r, 2000))
    await page.screenshot({ path: 'data/screenshots/kalibrr_live_form_filled.png' })
    console.log('[EVIDENCE] Saved data/screenshots/kalibrr_live_form_filled.png')

    // Click Submit / Kirim Lamaran
    const submitted = await page.evaluate(() => {
      const btns = Array.from(document.querySelectorAll('button, a')).filter(b => (b as HTMLElement).offsetParent !== null)
      const submitBtn = btns.find(b => {
        const t = (b.textContent || '').trim().toLowerCase()
        return t === 'kirim' || t === 'kirim lamaran' || t === 'submit' || t === 'submit application' || t.includes('kirim')
      })
      if (submitBtn) {
        ;(submitBtn as HTMLElement).click()
        return { clicked: true, text: submitBtn.textContent?.trim() }
      }
      return { clicked: false }
    })

    console.log('[SUBMIT ACTION]', submitted)
    await new Promise(r => setTimeout(r, 5000))

    // Capture final confirmation screen
    await page.screenshot({ path: 'data/screenshots/kalibrr_live_submission_success.png' })
    console.log('[FINAL EVIDENCE] Saved data/screenshots/kalibrr_live_submission_success.png')

    const finalUrl = page.url()
    console.log(`[COMPLETE] Final Kalibrr URL: ${finalUrl}`)

  } finally {
    if (page) {
      try { await page.close() } catch {}
    }
    if (browser) {
      try { await browser.disconnect() } catch {}
    }
    // Terminate automator brave
    try {
      execSync(`/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -NoProfile -NonInteractive -Command "Get-CimInstance Win32_Process -Filter \\"name = 'brave.exe'\\" | Where-Object { \\$_.CommandLine -like '*job_apply_automator*' } | ForEach-Object { Stop-Process -Id \\$_.ProcessId -Force -ErrorAction SilentlyContinue }" < /dev/null`, { stdio: 'ignore' })
    } catch {}
  }
}

if (import.meta.main) {
  executeKalibrrApply()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[FATAL]', err)
      process.exit(1)
    })
}
