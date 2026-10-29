import { db, executeD1Mutation, escapeSqlString } from './db.js'

export type ErrorCategory =
  | 'BROWSER_CDP'
  | 'AUTH_SESSION'
  | 'CRAWLER'
  | 'SCRAPER'
  | 'SUBMISSION'
  | 'SYSTEM_DAEMON'
  | 'GENERAL'

export type ErrorSeverity = 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO'

export interface SystemErrorRecord {
  id: number
  timestamp: string
  category: ErrorCategory | string
  severity: ErrorSeverity | string
  component: string
  message: string
  details?: string | null
  resolved: number
  resolved_at?: string | null
}

export function logSystemError(
  category: ErrorCategory | string,
  component: string,
  message: string,
  details?: any,
  severity: ErrorSeverity = 'ERROR'
): number {
  try {
    const detailsString = details
      ? typeof details === 'string'
        ? details
        : JSON.stringify(details, Object.getOwnPropertyNames(details), 2)
      : null

    const stmt = db.prepare(`
      INSERT INTO system_errors (category, severity, component, message, details)
      VALUES (?, ?, ?, ?, ?)
    `)
    const res = stmt.run(category, severity, component, message, detailsString)
    executeD1Mutation(`INSERT INTO system_errors (category, severity, component, message, details) VALUES (${escapeSqlString(category)}, ${escapeSqlString(severity)}, ${escapeSqlString(component)}, ${escapeSqlString(message)}, ${escapeSqlString(detailsString)});`)
    return Number(res.lastInsertRowid)
  } catch (err: any) {
    console.error(`[errorLogger] Failed to write system error to DB: ${err.message}`)
    return -1
  }
}

export interface GetErrorsOptions {
  resolved?: number
  category?: string
  severity?: string
  limit?: number
}

export function getSystemErrors(options: GetErrorsOptions = {}): SystemErrorRecord[] {
  let query = 'SELECT * FROM system_errors WHERE 1=1'
  const params: any[] = []

  if (typeof options.resolved === 'number') {
    query += ' AND resolved = ?'
    params.push(options.resolved)
  }

  if (options.category && options.category !== 'ALL') {
    query += ' AND category = ?'
    params.push(options.category)
  }

  if (options.severity && options.severity !== 'ALL') {
    query += ' AND severity = ?'
    params.push(options.severity)
  }

  query += ' ORDER BY timestamp DESC, id DESC LIMIT ?'
  params.push(options.limit || 100)

  try {
    return db.prepare(query).all(...params) as unknown as SystemErrorRecord[]
  } catch (err: any) {
    console.error(`[errorLogger] Failed to query system errors: ${err.message}`)
    return []
  }
}

export function resolveSystemError(id: number | string): boolean {
  try {
    const stmt = db.prepare(`
      UPDATE system_errors
      SET resolved = 1, resolved_at = datetime('now')
      WHERE id = ?
    `)
    const res = stmt.run(id)
    executeD1Mutation(`UPDATE system_errors SET resolved = 1, resolved_at = datetime('now') WHERE id = ${escapeSqlString(id)};`)
    return res.changes > 0
  } catch (err: any) {
    console.error(`[errorLogger] Failed to resolve system error #${id}: ${err.message}`)
    return false
  }
}

export function clearResolvedErrors(): number {
  try {
    const res = db.prepare('DELETE FROM system_errors WHERE resolved = 1').run()
    executeD1Mutation('DELETE FROM system_errors WHERE resolved = 1;')
    return Number(res.changes)
  } catch (err: any) {
    console.error(`[errorLogger] Failed to clear resolved system errors: ${err.message}`)
    return 0
  }
}

export function getUnresolvedErrorCount(): number {
  try {
    const res = db.prepare('SELECT COUNT(*) as count FROM system_errors WHERE resolved = 0').get() as { count: number }
    return res?.count || 0
  } catch {
    return 0
  }
}
