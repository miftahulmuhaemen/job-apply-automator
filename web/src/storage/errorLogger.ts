import { d1Query, d1Execute } from './cloudflareClient.js'

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

export async function logSystemError(
  category: ErrorCategory | string,
  component: string,
  message: string,
  details?: any,
  severity: ErrorSeverity = 'ERROR'
): Promise<number> {
  try {
    const detailsString = details
      ? typeof details === 'string'
        ? details
        : JSON.stringify(details, Object.getOwnPropertyNames(details), 2)
      : null

    const res = await d1Execute(
      `INSERT INTO system_errors (category, severity, component, message, details) VALUES (?, ?, ?, ?, ?)`,
      [category, severity, component, message, detailsString]
    )
    return res.lastRowId
  } catch (err: any) {
    console.error(`[errorLogger] Failed to write system error to D1: ${err.message}`)
    return -1
  }
}

export interface GetErrorsOptions {
  resolved?: number
  category?: string
  severity?: string
  limit?: number
}

export async function getSystemErrors(options: GetErrorsOptions = {}): Promise<SystemErrorRecord[]> {
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
    return await d1Query<SystemErrorRecord>(query, params)
  } catch (err: any) {
    console.error(`[errorLogger] Failed to query system errors from D1: ${err.message}`)
    return []
  }
}

export async function resolveSystemError(id: number | string): Promise<boolean> {
  try {
    const res = await d1Execute(
      `UPDATE system_errors SET resolved = 1, resolved_at = datetime('now') WHERE id = ?`,
      [id]
    )
    return res.changes > 0
  } catch (err: any) {
    console.error(`[errorLogger] Failed to resolve system error #${id}: ${err.message}`)
    return false
  }
}

export async function clearResolvedErrors(): Promise<number> {
  try {
    const res = await d1Execute('DELETE FROM system_errors WHERE resolved = 1')
    return res.changes
  } catch (err: any) {
    console.error(`[errorLogger] Failed to clear resolved system errors: ${err.message}`)
    return 0
  }
}

export async function getUnresolvedErrorCount(): Promise<number> {
  try {
    const rows = await d1Query<{ count: number }>('SELECT COUNT(*) as count FROM system_errors WHERE resolved = 0')
    return rows[0]?.count || 0
  } catch {
    return 0
  }
}
