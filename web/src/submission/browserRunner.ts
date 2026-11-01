import fs from 'fs'
import path from 'path'
import { spawn, execSync, type ChildProcess } from 'child_process'
import puppeteer, { type Browser, type Page } from 'puppeteer-core'
import { detectBrowser, resolveProfileDir, getProfilePaths } from '../browser/auth.js'
import { logSystemError } from '../storage/errorLogger.js'

export interface BrowserSession {
  browser: Browser
  page: Page
  isWindows: boolean
  resolveUploadPath: (localFilePath: string) => string
}

export interface BrowserOptions {
  interactive?: boolean
  headless?: boolean
  preferWindows?: boolean
  keepOpen?: boolean
}

export async function withSubmissionBrowser<T>(
  action: (session: BrowserSession) => Promise<T>,
  options?: BrowserOptions
): Promise<T> {
  const isInteractive = options?.interactive === true
  const preferWindows = options?.preferWindows ?? false
  const browserInfo = detectBrowser(preferWindows)
  const profileDir = resolveProfileDir(browserInfo.isWindowsExe)
  const paths = getProfilePaths()

  let spawnedProcess: ChildProcess | null = null
  let browser: Browser | null = null
  let page: Page | null = null

  const protocolTimeout = isInteractive ? 300000 : 60000

  try {
    if (browserInfo.isWindowsExe) {
      // Spawn Windows browser with isolated automator profile and remote debugging
      const args = [
        `--user-data-dir=${profileDir}`,
        '--profile-directory=Default',
        '--disable-profile-picker',
        '--disable-blink-features=AutomationControlled',
        '--remote-debugging-port=9222',
        '--remote-debugging-address=0.0.0.0',
        '--remote-allow-origins=*',
        '--no-first-run',
        '--no-default-browser-check'
      ]

      spawnedProcess = spawn(browserInfo.path, args, {
        detached: true,
        stdio: 'ignore'
      })
      spawnedProcess.unref()

      // Poll CDP endpoint on local and WSL gateway addresses (including port 9223 proxy)
      const candidateEndpoints = [
        'http://172.25.192.1:9223',
        'http://127.0.0.1:9223',
        'http://localhost:9223',
        'http://172.25.192.1:9222',
        'http://127.0.0.1:9222',
        'http://localhost:9222'
      ]
      let cdpUrl = ''
      for (let attempt = 0; attempt < 25; attempt++) {
        await new Promise(r => setTimeout(r, 600))
        for (const endpoint of candidateEndpoints) {
          try {
            const res = await fetch(`${endpoint}/json/version`, {
              signal: AbortSignal.timeout(1000)
            })
            if (res.ok) {
              cdpUrl = endpoint
              break
            }
          } catch {}
        }
        if (cdpUrl) break
      }

      if (!cdpUrl) {
        throw new Error('Failed to connect to browser CDP on port 9223/9222 after launch.')
      }

      browser = await puppeteer.connect({
        browserURL: cdpUrl,
        defaultViewport: { width: 1280, height: 900 },
        protocolTimeout
      })
    } else {
      // Native Linux launch
      const isHeadless = !isInteractive && process.env.HEADED !== 'true'
      browser = await puppeteer.launch({
        executablePath: browserInfo.path,
        headless: isHeadless,
        ignoreDefaultArgs: ['--enable-automation'],
        protocolTimeout,
        env: {
          ...process.env,
          DISPLAY: process.env.DISPLAY || ':0'
        },
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--window-size=1280,900'
        ]
      })
    }

    const pages = await browser.pages()
    page = pages.length > 0 ? pages[0] : await browser.newPage()
    await page.setViewport({ width: 1280, height: 900 })

    const resolveUploadPath = (localFilePath: string): string => {
      if (!browserInfo.isWindowsExe) {
        return path.resolve(localFilePath)
      }
      const filename = path.basename(localFilePath)
      const targetWsl = path.join(paths.wslPath, filename)
      const targetWin = `${paths.winPath}/${filename}`
      fs.copyFileSync(localFilePath, targetWsl)
      return targetWin
    }

    return await action({
      browser,
      page,
      isWindows: browserInfo.isWindowsExe,
      resolveUploadPath
    })
  } catch (err: any) {
    await logSystemError(
      'BROWSER_CDP',
      'browserRunner',
      `Browser session failed: ${err.message}`,
      { stack: err.stack, browserPath: browserInfo.path, profileDir, isWindows: browserInfo.isWindowsExe },
      'CRITICAL'
    )
    throw err
  } finally {
    if (options?.keepOpen) {
      // In keepOpen mode: disconnect CDP cleanly without closing page or terminating browser process
      if (browser) {
        try {
          browser.disconnect()
        } catch {}
      }
    } else {
      // Standard automated teardown: close page, close browser, and clean up spawned process
      if (page) {
        try {
          await Promise.race([
            page.close({ runBeforeUnload: false }),
            new Promise(r => setTimeout(r, 2000))
          ])
        } catch {}
      }
      if (browser) {
        try {
          if (browserInfo.isWindowsExe) {
            browser.disconnect()
          } else {
            await Promise.race([
              browser.close(),
              new Promise(r => setTimeout(r, 3000))
            ])
          }
        } catch {}
      }

      // Process termination: strictly target only automator profile instances
      if (browserInfo.isWindowsExe) {
        try {
          const psCommand = `Get-CimInstance Win32_Process -Filter "name = 'brave.exe' or name = 'chrome.exe'" | Where-Object { $_.CommandLine -like '*job_apply_automator*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }`
          execSync(
            `/mnt/c/Windows/System32/WindowsPowerShell/v1.0/powershell.exe -NoProfile -NonInteractive -Command "${psCommand}" < /dev/null`,
            { stdio: 'ignore', timeout: 5000 }
          )
        } catch {}
      } else if (spawnedProcess && spawnedProcess.pid) {
        try {
          process.kill(spawnedProcess.pid, 'SIGTERM')
        } catch {}
      }
    }
  }
}
