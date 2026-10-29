import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export const R2_BUCKET_NAME = 'amiya'

export interface R2ObjectItem {
  key: string
  size: string
  etag: string
  uploaded: string
  storage_class: string
}

/**
 * Upload a local file to Cloudflare R2 bucket 'amiya' using cf CLI exclusively.
 */
export async function uploadToR2(key: string, filePath: string, contentType?: string): Promise<any> {
  const args = [
    'r2', 'objects', 'put', key,
    '--bucket-name', R2_BUCKET_NAME,
    '--file', filePath
  ]
  if (contentType) {
    args.push('--content-type', contentType)
  }

  try {
    const { stdout } = await execFileAsync('cf', args, { maxBuffer: 10 * 1024 * 1024 })
    return JSON.parse(stdout)
  } catch (err: any) {
    console.error(`[r2Storage Upload Error] Failed for ${key}:`, err.message || err)
    throw new Error(`Cloudflare R2 upload failed for ${key}: ${err.message || err}`)
  }
}

/**
 * Retrieve an object buffer from Cloudflare R2 bucket 'amiya' using cf CLI.
 */
export async function getR2ObjectBuffer(key: string): Promise<Buffer | null> {
  try {
    const { stdout } = await execFileAsync('cf', [
      'r2', 'objects', 'get', key,
      '--bucket-name', R2_BUCKET_NAME,
      '-q'
    ], { encoding: 'buffer', maxBuffer: 50 * 1024 * 1024 })
    return stdout
  } catch (err: any) {
    console.error(`[r2Storage Get Error] Failed for ${key}:`, err.message || err)
    return null
  }
}
export async function listR2Objects(prefix?: string): Promise<R2ObjectItem[]> {
  try {
    const args = [
      'r2', 'objects', 'list',
      '--bucket-name', R2_BUCKET_NAME,
      '--per-page', '1000'
    ]
    if (prefix) {
      args.push('--prefix', prefix)
    }
    const { stdout } = await execFileAsync('cf', args, { maxBuffer: 10 * 1024 * 1024 })
    const data = JSON.parse(stdout)
    if (Array.isArray(data)) return data
    return data.objects || []
  } catch (err: any) {
    console.error('[r2Storage List Error]:', err.message || err)
    return []
  }
}
