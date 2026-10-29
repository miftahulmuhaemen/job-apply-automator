import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export const D1_DATABASE_ID = 'b54fd60b-28c4-4577-b02c-478797c90122'
export const D1_DATABASE_NAME = 'amiya'

export interface D1QueryResult<T = any> {
  results: T[]
  success: boolean
  meta?: {
    served_by?: string
    served_by_region?: string
    timings?: {
      sql_duration_ms?: number
    }
    duration?: number
    changes?: number
    rows_read?: number
    rows_written?: number
  }
}

/**
 * Execute SQL statement(s) against Cloudflare D1 'amiya' using cf CLI exclusively.
 */
export async function queryD1<T = any>(sql: string): Promise<D1QueryResult<T>[]> {
  try {
    const { stdout } = await execFileAsync('cf', [
      'd1', 'query', D1_DATABASE_ID,
      '--sql', sql
    ], {
      maxBuffer: 50 * 1024 * 1024
    })
    return JSON.parse(stdout)
  } catch (err: any) {
    console.error('[cfD1 Error]:', err.message || err)
    throw new Error(`Cloudflare D1 query failed: ${err.message || err}`)
  }
}

/**
 * Fetch status metadata for D1 database amiya.
 */
export async function getD1Status(): Promise<any> {
  try {
    const { stdout } = await execFileAsync('cf', ['d1', 'get', D1_DATABASE_ID])
    return JSON.parse(stdout)
  } catch (err: any) {
    return { error: err.message || String(err) }
  }
}
