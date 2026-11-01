import {
  CLOUDFLARE_ACCOUNT_ID,
  D1_DATABASE_ID,
  D1_DATABASE_NAME,
  getCloudflareAuthHeaders,
  getCloudflareToken
} from './cloudflareClient.js'

export { D1_DATABASE_ID, D1_DATABASE_NAME }

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
 * Execute SQL statement(s) against Cloudflare D1 'amiya' directly via HTTPS REST API.
 */
export async function queryD1<T = any>(sql: string, params: any[] = []): Promise<D1QueryResult<T>[]> {
  try {
    const authHeaders = getCloudflareAuthHeaders()
    const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`

    const payload: any = { sql }
    if (params.length > 0) payload.params = params

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      const errText = await res.text()
      throw new Error(`HTTP ${res.status}: ${errText}`)
    }

    const data: any = await res.json()
    if (!data.success) {
      const msg = data.errors?.[0]?.message || 'D1 query failed'
      throw new Error(msg)
    }

    return (data.result || []) as D1QueryResult<T>[]
  } catch (err: any) {
    console.error('[cfD1 HTTPS Error]:', err.message || err)
    throw new Error(`Cloudflare D1 query failed: ${err.message || err}`)
  }
}

/**
 * Fetch status metadata for D1 database amiya via direct HTTPS.
 */
export async function getD1Status(): Promise<any> {
  try {
    const authHeaders = getCloudflareAuthHeaders()
    const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}`
    const res = await fetch(url, {
      method: 'GET',
      headers: { ...authHeaders }
    })

    const data: any = await res.json()
    return data.result || { success: data.success }
  } catch (err: any) {
    return { error: err.message || String(err) }
  }
}
