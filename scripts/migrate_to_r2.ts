import fs from 'fs'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const BUCKET_NAME = 'amiya'
const SCREENSHOTS_DIR = path.resolve(__dirname, '../data/screenshots')
const RESUMES_DIR = path.resolve(__dirname, '../output/resumes')

function uploadToR2(key: string, filePath: string, contentType: string) {
  console.log(`[R2 Upload] Uploading ${key} (${filePath})...`)
  execFileSync('cf', [
    'r2', 'objects', 'put', key,
    '--bucket-name', BUCKET_NAME,
    '--file', filePath,
    '--content-type', contentType
  ], { stdio: 'inherit' })
}

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  if (!fs.existsSync(dirPath)) return arrayOfFiles
  const files = fs.readdirSync(dirPath)
  for (const file of files) {
    const fullPath = path.join(dirPath, file)
    if (fs.statSync(fullPath).isDirectory()) {
      getAllFiles(fullPath, arrayOfFiles)
    } else if (file !== '.gitkeep') {
      arrayOfFiles.push(fullPath)
    }
  }
  return arrayOfFiles
}

async function main() {
  console.log(`[R2 Migration] Uploading assets to bucket '${BUCKET_NAME}'...`)

  // 1. Upload screenshots
  const screenshotFiles = getAllFiles(SCREENSHOTS_DIR)
  console.log(`[R2 Migration] Found ${screenshotFiles.length} screenshots.`)
  for (const file of screenshotFiles) {
    const rel = path.relative(SCREENSHOTS_DIR, file)
    const key = `screenshots/${rel}`
    uploadToR2(key, file, 'image/png')
  }

  // 2. Upload resumes
  const resumeFiles = getAllFiles(RESUMES_DIR)
  console.log(`[R2 Migration] Found ${resumeFiles.length} resumes.`)
  for (const file of resumeFiles) {
    const rel = path.relative(RESUMES_DIR, file)
    const key = `resumes/${rel}`
    uploadToR2(key, file, 'application/pdf')
  }

  // 3. Verify objects on R2
  console.log('[R2 Migration] Verifying uploaded objects...')
  const listRaw = execFileSync('cf', ['r2', 'objects', 'list', '--bucket-name', BUCKET_NAME], { encoding: 'utf-8' })
  const list = JSON.parse(listRaw)
  console.log(`[R2 Migration] Verified ${list.objects?.length || 0} objects in R2 bucket '${BUCKET_NAME}'.`)

  // 4. Clean up local heavy screenshots to eliminate project bloat
  console.log('[R2 Migration] Purging local screenshot bloat from data/screenshots...')
  for (const file of screenshotFiles) {
    fs.unlinkSync(file)
  }
  // Keep .gitkeep
  fs.writeFileSync(path.join(SCREENSHOTS_DIR, '.gitkeep'), '')

  console.log('[R2 Migration] Migration and purge complete!')
}

main().catch(err => {
  console.error('[R2 Migration Error]:', err)
  process.exit(1)
})
