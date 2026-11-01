import http from 'node:http'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import {
  getSchedulerSettings,
  updateSchedulerSettings,
  getRecordedScheduleRuns,
  getCliAgentSettings,
  updateCliAgentSettings,
  getApprovedShortlist,
  getSystemStats
} from '../storage/db.js'
import { CLOUDFLARE_ACCOUNT_ID, getCloudflareToken } from '../storage/cloudflareClient.js'
import { D1_DATABASE_ID, D1_DATABASE_NAME, queryD1 } from '../storage/cfD1.js'
import { R2_BUCKET_NAME, listR2Objects } from '../storage/r2Storage.js'
import { checkCliAgentStatus, invokeCliAgent } from '../agent/cliAgent.js'
import {
  getSystemErrors,
  resolveSystemError,
  clearResolvedErrors,
  getUnresolvedErrorCount,
  logSystemError
} from '../storage/errorLogger.js'
import { readJsonBody, sendJson } from './routeUtils.js'

const execFileAsync = promisify(execFile)
const RUST_CLI_PATH = path.resolve(process.cwd(), 'cli/target/release/job-apply-cli')

let storageStatusCache: { data: any; timestamp: number } | null = null
const STORAGE_CACHE_TTL_MS = 60_000 // 60-second in-memory cache

export async function triggerRustScheduleRun(force = false): Promise<{ success: boolean; output: string }> {
  try {
    const args = ['schedule', '--once']
    if (force) args.push('--force')
    const { stdout, stderr } = await execFileAsync(RUST_CLI_PATH, args, { timeout: 300000 })
    return { success: true, output: (stdout + '\n' + stderr).trim() }
  } catch (err: any) {
    return { success: false, output: err.message }
  }
}

export async function handleSystemRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  url: URL
): Promise<boolean> {
  if (pathname === '/api/scheduler' && req.method === 'GET') {
    try {
      const settings = await getSchedulerSettings()
      sendJson(res, 200, { success: true, data: settings })
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  if (pathname === '/api/scheduler' && req.method === 'POST') {
    try {
      const parsed = await readJsonBody(req)
      const parsedLimit = parseInt(parsed.max_daily_applications, 10)
      const maxApps = !isNaN(parsedLimit) ? parsedLimit : 20
      const updated = await updateSchedulerSettings({
        enabled: Boolean(parsed.enabled),
        schedule_time: parsed.schedule_time || '08:30',
        max_daily_applications: maxApps,
        portals: parsed.portals || 'Jobstreet,LinkedIn'
      })
      sendJson(res, 200, { success: updated })
    } catch (err: any) {
      sendJson(res, 400, { success: false, error: err.message })
    }
    return true
  }

  if (pathname === '/api/scheduler/runs' && req.method === 'GET') {
    try {
      const runs = await getRecordedScheduleRuns()
      sendJson(res, 200, { success: true, count: runs.length, data: runs })
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  if (pathname === '/api/storage/status' && req.method === 'GET') {
    try {
      const isFresh = url.searchParams.get('fresh') === 'true'
      if (!isFresh && storageStatusCache && (Date.now() - storageStatusCache.timestamp < STORAGE_CACHE_TTL_MS)) {
        sendJson(res, 200, storageStatusCache.data)
        return true
      }

      const token = getCloudflareToken()
      let d1Data: any = null
      try {
        const d1Res = await fetch(`https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (d1Res.ok) {
          const json: any = await d1Res.json()
          if (json.success && json.result) {
            d1Data = json.result
          }
        }
      } catch (d1Err: any) {
        console.warn(`[Storage Status] Failed to query D1 database metadata: ${d1Err.message}`)
      }

      const r2Objects = await listR2Objects()
      let totalR2Bytes = 0
      const categories: Record<string, { count: number; bytes: number }> = {
        resumes: { count: 0, bytes: 0 },
        screenshots: { count: 0, bytes: 0 },
        assets: { count: 0, bytes: 0 },
        cover_letters: { count: 0, bytes: 0 },
        other: { count: 0, bytes: 0 }
      }

      for (const obj of r2Objects) {
        const sz = Number(obj.size || 0)
        totalR2Bytes += sz
        const k = (obj.key || '').toLowerCase()
        if (k.startsWith('resumes/')) {
          categories.resumes.count++
          categories.resumes.bytes += sz
        } else if (k.startsWith('screenshots/') || k.includes('receipt') || k.includes('.png')) {
          categories.screenshots.count++
          categories.screenshots.bytes += sz
        } else if (k.startsWith('assets/')) {
          categories.assets.count++
          categories.assets.bytes += sz
        } else if (k.startsWith('cover_letters/')) {
          categories.cover_letters.count++
          categories.cover_letters.bytes += sz
        } else {
          categories.other.count++
          categories.other.bytes += sz
        }
      }

      const formatBytes = (bytes: number) => {
        if (bytes === 0) return '0 B'
        const k = 1024
        const sizes = ['B', 'KB', 'MB', 'GB']
        const i = Math.floor(Math.log(bytes) / Math.log(k))
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
      }

      const payload = {
        success: true,
        timestamp: new Date().toISOString(),
        d1: {
          database: D1_DATABASE_NAME,
          id: D1_DATABASE_ID,
          region: d1Data?.running_in_region || 'APAC',
          file_size_bytes: d1Data?.file_size || 0,
          file_size_formatted: formatBytes(d1Data?.file_size || 0),
          num_tables: d1Data?.num_tables || 0,
          version: d1Data?.version || 'production'
        },
        r2: {
          bucket: R2_BUCKET_NAME,
          object_count: r2Objects.length,
          total_bytes: totalR2Bytes,
          total_formatted: formatBytes(totalR2Bytes),
          categories: {
            resumes: { count: categories.resumes.count, formatted: formatBytes(categories.resumes.bytes) },
            screenshots: { count: categories.screenshots.count, formatted: formatBytes(categories.screenshots.bytes) },
            assets: { count: categories.assets.count, formatted: formatBytes(categories.assets.bytes) },
            cover_letters: { count: categories.cover_letters.count, formatted: formatBytes(categories.cover_letters.bytes) }
          }
        }
      }

      storageStatusCache = { data: payload, timestamp: Date.now() }
      sendJson(res, 200, payload)
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  if (pathname === '/api/scheduler/trigger' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req).catch(() => ({}))
      const result = await triggerRustScheduleRun(Boolean(body?.force))
      sendJson(res, 200, { success: result.success, data: { message: result.output } })
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  if (pathname === '/api/agent/status' && req.method === 'GET') {
    try {
      const status = await checkCliAgentStatus()
      sendJson(res, 200, { success: true, data: status })
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  if (pathname === '/api/agent/settings' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req)
      const updated = await updateCliAgentSettings(body)
      const status = await checkCliAgentStatus()
      sendJson(res, 200, { success: updated, data: status })
    } catch (err: any) {
      sendJson(res, 400, { success: false, error: err.message })
    }
    return true
  }

  if (pathname === '/api/agent/diagnose' && req.method === 'POST') {
    try {
      const testPrompt = 'Respond strictly with the word pong.'
      const result = await invokeCliAgent(testPrompt, { expectJson: false, timeoutSeconds: 45 })
      sendJson(res, 200, result)
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  if (pathname === '/api/export' && req.method === 'GET') {
    try {
      const shortlist = await getApprovedShortlist()
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Content-Disposition': 'attachment; filename="approved_jobs_shortlist.json"'
      })
      res.end(JSON.stringify(shortlist, null, 2))
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  if ((pathname === '/api/system/status' || pathname === '/api/health') && req.method === 'GET') {
    try {
      const stats = await getSystemStats()
      sendJson(res, 200, {
        success: true,
        data: {
          db_path: 'Cloudflare D1 (amiya)',
          db_size_bytes: 0,
          journal_mode: 'Cloudflare D1 Native',
          jobs_count: stats.jobsCount,
          rules_count: stats.rulesCount,
          companies_count: stats.companiesCount,
          runs_count: stats.runsCount,
          websites_count: stats.websitesCount,
          d1_database_id: D1_DATABASE_ID,
          d1_database_name: D1_DATABASE_NAME,
          r2_bucket_name: R2_BUCKET_NAME,
          cf_region: 'APAC',
          uptime_seconds: Math.floor(process.uptime()),
          node_env: process.env.NODE_ENV || 'production'
        }
      })
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  if (pathname === '/api/system/cloudflare' && req.method === 'GET') {
    try {
      const d1CountRes = await queryD1('SELECT count(*) as count FROM jobs_ledger WHERE is_deleted = 0;')
      const d1Jobs = d1CountRes[0]?.results[0]?.count ?? 0
      const r2Objects = await listR2Objects()
      sendJson(res, 200, {
        success: true,
        data: {
          d1: {
            database_id: D1_DATABASE_ID,
            database_name: D1_DATABASE_NAME,
            region: 'APAC',
            jobs_count: d1Jobs,
            status: 'CONNECTED'
          },
          r2: {
            bucket_name: R2_BUCKET_NAME,
            region: 'APAC',
            total_objects: r2Objects.length,
            status: 'CONNECTED'
          }
        }
      })
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  if (pathname === '/api/system/database' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req)
      const newPath = body.path || 'data/amiya.db'
      sendJson(res, 200, { success: true, active_database: newPath })
    } catch (err: any) {
      sendJson(res, 400, { success: false, error: err.message })
    }
    return true
  }

  if (pathname === '/api/errors' && req.method === 'GET') {
    try {
      const resolvedParam = url.searchParams.get('resolved')
      const categoryParam = url.searchParams.get('category') || undefined
      const severityParam = url.searchParams.get('severity') || undefined
      const limitParam = parseInt(url.searchParams.get('limit') || '100', 10)

      const resolved = resolvedParam !== null ? parseInt(resolvedParam, 10) : undefined
      const errors = await getSystemErrors({
        resolved,
        category: categoryParam,
        severity: severityParam,
        limit: limitParam
      })
      const unresolvedCount = await getUnresolvedErrorCount()

      sendJson(res, 200, {
        success: true,
        count: errors.length,
        unresolvedCount,
        data: errors
      })
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  const resolveErrorMatch = pathname.match(/^\/api\/errors\/([^\/]+)\/resolve$/)
  if (resolveErrorMatch && req.method === 'POST') {
    const errId = resolveErrorMatch[1]
    try {
      const resolved = await resolveSystemError(errId)
      const unresolvedCount = await getUnresolvedErrorCount()
      sendJson(res, 200, { success: resolved, id: errId, unresolvedCount })
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  if (pathname === '/api/errors/clear-resolved' && req.method === 'POST') {
    try {
      const cleared = await clearResolvedErrors()
      const unresolvedCount = await getUnresolvedErrorCount()
      sendJson(res, 200, { success: true, cleared, unresolvedCount })
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  if (pathname === '/api/errors/test' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req)
      const id = await logSystemError(
        body.category || 'BROWSER_CDP',
        body.component || 'TestEndpoint',
        body.message || 'Synthetic test error generated from Web Console',
        body.details || { env: process.env.NODE_ENV, platform: process.platform },
        body.severity || 'ERROR'
      )
      const unresolvedCount = await getUnresolvedErrorCount()
      sendJson(res, 200, { success: true, id, unresolvedCount })
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  return false
}
