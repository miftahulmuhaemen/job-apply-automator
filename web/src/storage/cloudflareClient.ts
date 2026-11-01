export const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || 'c9c8f7d136addc5b184df921cfb2b4fd'
export const D1_DATABASE_ID = process.env.D1_DATABASE_ID || 'b54fd60b-28c4-4577-b02c-478797c90122'
export const D1_DATABASE_NAME = 'amiya'
export const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'amiya'

/**
 * Resolves standard Cloudflare API authentication headers strictly from .env.
 * Supports either:
 * 1. CLOUDFLARE_API_TOKEN (Bearer token)
 * 2. CLOUDFLARE_API_KEY + CLOUDFLARE_EMAIL (Global API Key)
 */
export function getCloudflareAuthHeaders(): Record<string, string> {
  const envToken = process.env.CLOUDFLARE_API_TOKEN?.trim()
  if (envToken) {
    return { 'Authorization': `Bearer ${envToken}` }
  }

  const apiKey = process.env.CLOUDFLARE_API_KEY?.trim()
  const email = process.env.CLOUDFLARE_EMAIL?.trim()
  if (apiKey && email) {
    return {
      'X-Auth-Key': apiKey,
      'X-Auth-Email': email
    }
  }

  throw new Error(
    'Cloudflare authentication missing: CLOUDFLARE_API_TOKEN or CLOUDFLARE_API_KEY + CLOUDFLARE_EMAIL must be set in .env'
  )
}

export function getCloudflareToken(): string {
  const headers = getCloudflareAuthHeaders()
  const auth = headers['Authorization'] || ''
  return auth.replace(/^Bearer\s+/i, '')
}

/**
 * Execute a read query against Cloudflare D1 via direct HTTPS REST API.
 */
export async function d1Query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`
  const payload: any = { sql }
  if (params.length > 0) payload.params = params

  const authHeaders = getCloudflareAuthHeaders()
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`D1 query HTTP ${res.status}: ${text}`)
  }

  const json: any = await res.json()
  if (!json.success) {
    const msg = json.errors?.[0]?.message || 'Unknown D1 query error'
    throw new Error(`D1 query error: ${msg}`)
  }

  return (json.result?.[0]?.results || []) as T[]
}

/**
 * Execute a mutation query (INSERT, UPDATE, DELETE, ALTER) against Cloudflare D1.
 */
export async function d1Execute(sql: string, params: any[] = []): Promise<{ success: boolean; changes: number; lastRowId: number }> {
  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/d1/database/${D1_DATABASE_ID}/query`
  const payload: any = { sql }
  if (params.length > 0) payload.params = params

  const authHeaders = getCloudflareAuthHeaders()
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`D1 execute HTTP ${res.status}: ${text}`)
  }

  const json: any = await res.json()
  if (!json.success) {
    const msg = json.errors?.[0]?.message || 'Unknown D1 execute error'
    throw new Error(`D1 execute error: ${msg}`)
  }

  const meta = json.result?.[0]?.meta || {}
  return {
    success: true,
    changes: meta.changes || 0,
    lastRowId: meta.last_row_id || 0
  }
}

/**
 * Upload an object directly to Cloudflare R2 bucket via HTTPS REST API.
 */
export async function r2Put(key: string, body: Buffer | Uint8Array | string, contentType: string): Promise<boolean> {
  const cleanKey = key.replace(/^\/+/, '')
  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${R2_BUCKET_NAME}/objects/${encodeURI(cleanKey)}`
  const bodyData = (typeof body === 'string' ? Buffer.from(body, 'utf-8') : body) as any

  const authHeaders = getCloudflareAuthHeaders()
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...authHeaders, 'Content-Type': contentType },
    body: bodyData
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`R2 PUT '${cleanKey}' HTTP ${res.status}: ${text}`)
  }

  return true
}

/**
 * Retrieve an object directly from Cloudflare R2 bucket via HTTPS REST API.
 */
export async function r2Get(key: string): Promise<Buffer | null> {
  const cleanKey = key.replace(/^\/+/, '')
  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${R2_BUCKET_NAME}/objects/${encodeURI(cleanKey)}`

  const authHeaders = getCloudflareAuthHeaders()
  const res = await fetch(url, {
    method: 'GET',
    headers: { ...authHeaders }
  })

  if (res.status === 404) return null
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`R2 GET '${cleanKey}' HTTP ${res.status}: ${text}`)
  }

  const arrayBuf = await res.arrayBuffer()
  return Buffer.from(arrayBuf)
}

/**
 * Delete an object directly from Cloudflare R2 bucket via HTTPS REST API.
 */
export async function r2Delete(key: string): Promise<boolean> {
  const cleanKey = key.replace(/^\/+/, '')
  const url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${R2_BUCKET_NAME}/objects/${encodeURI(cleanKey)}`

  const authHeaders = getCloudflareAuthHeaders()
  const res = await fetch(url, {
    method: 'DELETE',
    headers: { ...authHeaders }
  })

  return res.ok || res.status === 404
}
