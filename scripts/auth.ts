import fs from 'fs'
import path from 'path'
import { spawn, execSync } from 'child_process'
import { Database } from 'bun:sqlite'

export interface PortalConfig {
  id: string
  name: string
  url: string
  loginUrl: string
  domains: string[]
  essentialCookies: string[]
}

export const PORTALS: Record<string, PortalConfig> = {
  kalibrr: {
    id: 'kalibrr',
    name: 'Kalibrr Indonesia',
    url: 'https://www.kalibrr.com',
    loginUrl: 'https://www.kalibrr.com/login?locale=id_ID',
    domains: ['kalibrr.com', '.kalibrr.com'],
    essentialCookies: ['sessionid', 'cf_clearance', 'user', 'k_token', 'remember_token', 'token', 'auth', 'kb']
  },
  glints: {
    id: 'glints',
    name: 'Glints Indonesia',
    url: 'https://glints.com',
    loginUrl: 'https://glints.com/id/login',
    domains: ['glints.com', '.glints.com'],
    essentialCookies: ['glints_token', 'accesstoken', 'connect.sid', 'token', 'session', 'user', 'glr', 'auth']
  },
  jobstreet: {
    id: 'jobstreet',
    name: 'Jobstreet Indonesia',
    url: 'https://www.jobstreet.co.id',
    loginUrl: 'https://www.jobstreet.co.id',
    domains: ['jobstreet.com', '.jobstreet.com', 'jobstreet.co.id', '.jobstreet.co.id', 'seek.com', '.seek.com'],
    essentialCookies: [
      'jobseekersessionid',
      'appsession',
      'auth0',
      'sol_id',
      'seek_user',
      'jobstreet_session',
      'jobstreettoken',
      'identitytoken',
      'token',
      'session'
    ]
  },
  linkedin: {
    id: 'linkedin',
    name: 'LinkedIn Indonesia',
    url: 'https://www.linkedin.com',
    loginUrl: 'https://www.linkedin.com/login',
    domains: ['linkedin.com', '.linkedin.com'],
    essentialCookies: ['li_at', 'JSESSIONID']
  }
}

/**
 * Determine local Windows NTFS and WSL paths for the browser profile.
 * Windows Chromium CANNOT use UNC paths (\\wsl.localhost\...) as user-data-dir
 * because SQLite database locking fails over network shares.
 */
export function getProfilePaths(): { winPath: string; wslPath: string } {
  const cUsers = '/mnt/c/Users'
  if (fs.existsSync(cUsers)) {
    try {
      const candidates = fs.readdirSync(cUsers).filter(u => 
        !['Default', 'Public', 'All Users', 'Default User', 'desktop.ini', 'WsiAccount'].includes(u) &&
        !u.startsWith('.')
      )
      if (candidates.length > 0) {
        const winUser = candidates[0]
        const wslPath = `/mnt/c/Users/${winUser}/.job_apply_automator/browser_profile`
        const winPath = `C:/Users/${winUser}/.job_apply_automator/browser_profile`
        if (!fs.existsSync(wslPath)) {
          fs.mkdirSync(wslPath, { recursive: true })
        }
        return { winPath, wslPath }
      }
    } catch {
      // Fallback below
    }
  }

  // Native Linux fallback
  const localDir = path.resolve(process.cwd(), 'data/browser_profile')
  if (!fs.existsSync(localDir)) {
    fs.mkdirSync(localDir, { recursive: true })
  }
  return { winPath: localDir, wslPath: localDir }
}

export const CANONICAL_PROFILE_DIR = getProfilePaths().wslPath

/**
 * Detect available browser executable on host or WSL2
 */
export function detectBrowser(): { path: string; isWindowsExe: boolean } {
  const windowsBrave = '/mnt/c/Program Files/BraveSoftware/Brave-Browser/Application/brave.exe'
  const windowsChrome = '/mnt/c/Program Files/Google/Chrome/Application/chrome.exe'
  const linuxChrome = '/usr/bin/google-chrome'

  if (fs.existsSync(windowsBrave)) {
    return { path: windowsBrave, isWindowsExe: true }
  }
  if (fs.existsSync(windowsChrome)) {
    return { path: windowsChrome, isWindowsExe: true }
  }
  if (fs.existsSync(linuxChrome)) {
    return { path: linuxChrome, isWindowsExe: false }
  }

  throw new Error('No supported browser (Brave or Google Chrome) found on system.')
}

/**
 * Resolve user-data-dir parameter based on execution environment
 */
export function resolveProfileDir(isWindowsExe: boolean): string {
  const paths = getProfilePaths()
  return isWindowsExe ? paths.winPath : paths.wslPath
}

/**
 * Launch desktop browser to authenticate a specific portal
 */
export function launchPortalAuth(portalKey: string): { success: boolean; browser: string; profileDir: string; url: string } {
  const normalizedKey = portalKey.toLowerCase().trim()
  const portal = PORTALS[normalizedKey]

  if (!portal) {
    throw new Error(`Unknown portal "${portalKey}". Supported portals: ${Object.keys(PORTALS).join(', ')}`)
  }

  const browser = detectBrowser()
  const profileDir = resolveProfileDir(browser.isWindowsExe)

  const args = [
    `--user-data-dir=${profileDir}`,
    '--profile-directory=Default',
    '--disable-profile-picker',
    '--no-first-run',
    '--no-default-browser-check',
    portal.loginUrl
  ]

  const child = spawn(browser.path, args, {
    detached: true,
    stdio: 'ignore'
  })
  child.unref()

  return {
    success: true,
    browser: browser.path,
    profileDir,
    url: portal.loginUrl
  }
}

/**
 * Inspect session health for all or specific portals in profile directory
 */
export function checkPortalSessions(): Record<string, 'AUTHENTICATED' | 'REQUIRES_LOGIN' | 'BROWSER_OPEN_LOCKED'> {
  const results: Record<string, 'AUTHENTICATED' | 'REQUIRES_LOGIN' | 'BROWSER_OPEN_LOCKED'> = {}

  // Initialize all to REQUIRES_LOGIN
  for (const key of Object.keys(PORTALS)) {
    results[key] = 'REQUIRES_LOGIN'
  }

  const paths = getProfilePaths()
  const cookieDbPaths = [
    path.join(paths.wslPath, 'Default', 'Network', 'Cookies'),
    path.join(paths.wslPath, 'Default', 'Cookies')
  ]

  let cookieDbFile: string | null = null
  for (const p of cookieDbPaths) {
    if (fs.existsSync(p)) {
      cookieDbFile = p
      break
    }
  }

  if (!cookieDbFile) {
    return results
  }

  const tmpId = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
  const tmpDbFile = `/tmp/cookies_inspect_${tmpId}.db`
  let targetDbFile = cookieDbFile

  try {
    fs.copyFileSync(cookieDbFile, tmpDbFile)
    if (fs.existsSync(`${cookieDbFile}-wal`)) {
      try { fs.copyFileSync(`${cookieDbFile}-wal`, `${tmpDbFile}-wal`) } catch {}
    }
    if (fs.existsSync(`${cookieDbFile}-shm`)) {
      try { fs.copyFileSync(`${cookieDbFile}-shm`, `${tmpDbFile}-shm`) } catch {}
    }
    targetDbFile = tmpDbFile
  } catch {
    targetDbFile = cookieDbFile
  }

  let db: Database | null = null
  try {
    db = new Database(targetDbFile, { readonly: true })
    const nowEpochMicro = BigInt(Date.now()) * 1000n + 11644473600000000n // Chromium epoch offset

    for (const [key, portal] of Object.entries(PORTALS)) {
      let isAuthenticated = false

      for (const domain of portal.domains) {
        const query = db.query(`
          SELECT name, host_key, expires_utc 
          FROM cookies 
          WHERE host_key LIKE ?
        `)
        const rows = query.all(`%${domain}`) as Array<{ name: string; host_key: string; expires_utc: number }>

        if (rows && rows.length > 0) {
          // Check if essential cookie exists and is unexpired
          const matchingEssential = rows.some(r => {
            const matchesName = portal.essentialCookies.some(c => r.name.toLowerCase().includes(c.toLowerCase()))
            const unexpired = r.expires_utc === 0 || BigInt(r.expires_utc) > nowEpochMicro
            return matchesName && unexpired
          })

          if (matchingEssential) {
            isAuthenticated = true
            break
          }
        }
      }

      results[key] = isAuthenticated ? 'AUTHENTICATED' : 'REQUIRES_LOGIN'
    }
  } catch (err: any) {
    if (err?.code === 'SQLITE_CANTOPEN' || err?.message?.includes('permission denied')) {
      for (const key of Object.keys(PORTALS)) {
        results[key] = 'BROWSER_OPEN_LOCKED'
      }
    } else {
      console.warn('Cookie inspection warning:', err)
    }
  } finally {
    if (db) {
      try { db.close() } catch {}
    }
    if (targetDbFile === tmpDbFile) {
      try { fs.unlinkSync(tmpDbFile) } catch {}
      try { fs.unlinkSync(`${tmpDbFile}-wal`) } catch {}
      try { fs.unlinkSync(`${tmpDbFile}-shm`) } catch {}
    }
  }

  return results
}

// CLI Execution entry point
if (import.meta.main) {
  const args = process.argv.slice(2)
  if (args.includes('--check')) {
    const status = checkPortalSessions()
    console.log(JSON.stringify(status, null, 2))
    process.exit(0)
  }

  const portalArg = args[0]
  if (!portalArg) {
    console.log('Usage: bun run scripts/auth.ts <portal>')
    console.log(`Available portals: ${Object.keys(PORTALS).join(', ')}`)
    console.log('Or check sessions: bun run scripts/auth.ts --check')
    process.exit(1)
  }

  try {
    const res = launchPortalAuth(portalArg)
    console.log(`Launched ${res.browser} for ${portalArg}`)
    console.log(`Profile: ${res.profileDir}`)
    console.log(`URL: ${res.url}`)
    process.exit(0)
  } catch (err: any) {
    console.error(`Error: ${err.message}`)
    process.exit(1)
  }
}
