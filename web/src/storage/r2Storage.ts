import fs from 'node:fs'
import {
  CLOUDFLARE_ACCOUNT_ID,
  R2_BUCKET_NAME,
  getCloudflareToken,
  r2Put,
  r2Get
} from './cloudflareClient.js'

export { R2_BUCKET_NAME }

export interface R2ObjectItem {
  key: string
  size: string | number
  etag: string
  uploaded: string
  storage_class: string
}

/**
 * Upload a local file to Cloudflare R2 bucket 'amiya' directly via HTTPS REST API.
 */
export async function uploadToR2(key: string, filePath: string, contentType = 'application/octet-stream'): Promise<any> {
  try {
    const fileBuf = fs.readFileSync(filePath)
    await r2Put(key, fileBuf, contentType)
    return { success: true, key }
  } catch (err: any) {
    console.error(`[r2Storage Upload Error] Failed for ${key}:`, err.message || err)
    throw new Error(`Cloudflare R2 upload failed for ${key}: ${err.message || err}`)
  }
}

/**
 * Upload an in-memory buffer directly to Cloudflare R2 bucket with zero local disk footprint.
 */
export async function uploadBufferToR2(key: string, buffer: Buffer | Uint8Array, contentType = 'application/octet-stream'): Promise<{ success: boolean; key: string }> {
  try {
    await r2Put(key, buffer, contentType)
    return { success: true, key }
  } catch (err: any) {
    console.error(`[r2Storage UploadBuffer Error] Failed for ${key}:`, err.message || err)
    throw new Error(`Cloudflare R2 buffer upload failed for ${key}: ${err.message || err}`)
  }
}

/**
 * Capture a Puppeteer page screenshot directly to Cloudflare R2 with zero local disk footprint.
 */
export async function captureScreenshotToR2(page: any, r2Key: string, options?: { fullPage?: boolean }): Promise<string> {
  const buf = await page.screenshot({ fullPage: options?.fullPage ?? false })
  await r2Put(r2Key, buf, 'image/png')
  return r2Key
}

/**
 * Retrieve an object buffer from Cloudflare R2 bucket 'amiya' directly via HTTPS REST API.
 */
export async function getR2ObjectBuffer(key: string): Promise<Buffer | null> {
  try {
    return await r2Get(key)
  } catch (err: any) {
    console.error(`[r2Storage Get Error] Failed for ${key}:`, err.message || err)
    return null
  }
}

/**
 * List objects from Cloudflare R2 bucket 'amiya' directly via HTTPS REST API.
 */
export async function listR2Objects(prefix?: string): Promise<R2ObjectItem[]> {
  try {
    const token = getCloudflareToken()
    let url = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/r2/buckets/${R2_BUCKET_NAME}/objects?per_page=1000`
    if (prefix) {
      url += `&prefix=${encodeURIComponent(prefix)}`
    }
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`)
    }
    const data: any = await res.json()
    if (Array.isArray(data.result)) return data.result
    return data.result?.objects || []
  } catch (err: any) {
    console.error('[r2Storage List Error]:', err.message || err)
    return []
  }
}
