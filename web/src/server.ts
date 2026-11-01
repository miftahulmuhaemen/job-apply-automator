import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { handleJobsRoutes } from './routes/jobsRoutes.js'
import { handleJobDocumentsRoutes } from './routes/jobDocumentsRoutes.js'
import { handleCandidateProfileRoutes } from './routes/candidateProfileRoutes.js'
import { handleCompaniesRoutes } from './routes/companiesRoutes.js'
import { handleWebsitesRoutes } from './routes/websitesRoutes.js'
import { handleCriteriaRoutes } from './routes/criteriaRoutes.js'
import { handleSystemRoutes, triggerRustScheduleRun } from './routes/systemRoutes.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PUBLIC_DIR = path.join(__dirname, '..', 'dist')
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3100

function startDailySchedulerDaemon() {
  console.log('[SCHEDULER] Daily scheduler daemon initialized (invoking Native Rust CLI)...')
  triggerRustScheduleRun(false).catch(err => {
    console.warn('[SCHEDULER] Startup catch-up trigger error:', err.message)
  })

  setInterval(() => {
    triggerRustScheduleRun(false).catch(() => {})
  }, 60000)
}

const contentTypes: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
}

export function startWebServer(port: number = PORT): http.Server {
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
    const pathname = url.pathname

    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    try {
      if (await handleJobsRoutes(req, res, pathname)) return
      if (await handleJobDocumentsRoutes(req, res, pathname)) return
      if (await handleCandidateProfileRoutes(req, res, pathname)) return
      if (await handleCompaniesRoutes(req, res, pathname)) return
      if (await handleWebsitesRoutes(req, res, pathname)) return
      if (await handleCriteriaRoutes(req, res, pathname, url)) return
      if (await handleSystemRoutes(req, res, pathname, url)) return
    } catch (err: any) {
      console.error('[SERVER ERROR]', err)
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ success: false, error: err.message || 'Internal server error' }))
      return
    }

    let filePath = path.join(PUBLIC_DIR, pathname === '/' ? 'index.html' : pathname)
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(PUBLIC_DIR, 'index.html')
    }

    const ext = path.extname(filePath)
    try {
      const content = fs.readFileSync(filePath)
      res.writeHead(200, { 'Content-Type': contentTypes[ext] || 'text/plain' })
      res.end(content)
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain' })
      res.end('Not Found')
    }
  })

  server.listen(port, '0.0.0.0', () => {
    console.log(`[WEB] Triage Web Console running at http://localhost:${port}`)
    startDailySchedulerDaemon()
  })

  return server
}

if (process.argv[1] && process.argv[1].includes('server')) {
  startWebServer()
}
