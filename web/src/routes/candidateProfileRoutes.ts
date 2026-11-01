import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import {
  getAllCandidateAttributes,
  updateCandidateAttribute,
  toggleCandidateAttributeDelegation,
  deleteCandidateAttribute,
  upsertCandidateAttribute
} from '../storage/db.js'
import { buildCandidatePortfolioPdf } from '../generator/portfolioBuilder.js'
import { getR2ObjectBuffer, uploadToR2 } from '../storage/r2Storage.js'
import { readJsonBody, sendJson } from './routeUtils.js'

export async function handleCandidateProfileRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string
): Promise<boolean> {
  if (pathname === '/api/candidate/portfolio' && (req.method === 'GET' || req.method === 'HEAD')) {
    try {
      const ASSETS_DIR = path.resolve(process.cwd(), 'data/assets')
      const assetPath = path.join(ASSETS_DIR, 'portfolio.pdf')
      let pdfBuffer: Buffer | null = null

      if (fs.existsSync(assetPath)) {
        pdfBuffer = fs.readFileSync(assetPath)
      } else {
        pdfBuffer = await getR2ObjectBuffer('assets/portfolio.pdf')
        if (!pdfBuffer) {
          const buildRes = await buildCandidatePortfolioPdf()
          if (fs.existsSync(buildRes.pdfPath)) {
            pdfBuffer = fs.readFileSync(buildRes.pdfPath)
          }
        }
      }

      if (!pdfBuffer) {
        res.writeHead(404, { 'Content-Type': 'text/plain' })
        res.end('Portfolio not found')
        return true
      }

      res.writeHead(200, {
        'Content-Type': 'application/pdf',
        'Content-Length': pdfBuffer.length,
        'Content-Disposition': 'inline; filename="candidate_portfolio.pdf"'
      })
      res.end(pdfBuffer)
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end(`Error retrieving portfolio: ${err.message}`)
    }
    return true
  }

  if (pathname === '/api/candidate/portfolio/generate' && req.method === 'POST') {
    try {
      const resData = await buildCandidatePortfolioPdf()
      sendJson(res, 200, {
        success: true,
        filename: resData.filename,
        filesize: resData.filesize,
        message: 'Authentic portfolio PDF successfully generated and synced to Cloudflare R2'
      })
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  if (pathname === '/api/candidate/photo' && (req.method === 'GET' || req.method === 'HEAD')) {
    try {
      const ASSETS_DIR = path.resolve(process.cwd(), 'data/assets')
      const photoCandidates = ['photo.jpg', 'photo.jpeg', 'photo.png']
      let photoPath: string | null = null
      let photoExt = 'jpeg'

      for (const candidate of photoCandidates) {
        const candidatePath = path.join(ASSETS_DIR, candidate)
        if (fs.existsSync(candidatePath)) {
          photoPath = candidatePath
          photoExt = candidate.endsWith('.png') ? 'png' : 'jpeg'
          break
        }
      }

      let photoBuffer: Buffer | null = null
      if (photoPath) {
        photoBuffer = fs.readFileSync(photoPath)
      } else {
        photoBuffer = await getR2ObjectBuffer('assets/photo.jpg')
        if (photoBuffer) photoExt = 'jpeg'
        else {
          photoBuffer = await getR2ObjectBuffer('assets/photo.png')
          if (photoBuffer) photoExt = 'png'
        }
      }

      if (!photoBuffer) {
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: 'Candidate photo not found. Please upload via console.' }))
        return true
      }

      res.writeHead(200, {
        'Content-Type': `image/${photoExt}`,
        'Content-Length': photoBuffer.length,
        'Cache-Control': 'no-cache'
      })
      res.end(photoBuffer)
    } catch (err: any) {
      res.writeHead(500, { 'Content-Type': 'text/plain' })
      res.end(`Error retrieving candidate photo: ${err.message}`)
    }
    return true
  }

  if (pathname === '/api/candidate/photo' && req.method === 'POST') {
    try {
      const chunks: Buffer[] = []
      let totalSize = 0
      const MAX_SIZE = 4 * 1024 * 1024

      await new Promise<void>((resolve, reject) => {
        req.on('data', chunk => {
          totalSize += chunk.length
          if (totalSize > MAX_SIZE) {
            reject(new Error('Photo file size exceeds maximum 4MB limit'))
            return
          }
          chunks.push(chunk)
        })
        req.on('end', () => resolve())
        req.on('error', reject)
      })

      const rawBuffer = Buffer.concat(chunks)
      if (rawBuffer.length === 0) {
        sendJson(res, 400, { success: false, error: 'Empty file buffer received' })
        return true
      }

      let ext = 'jpg'
      let mime = 'image/jpeg'
      let targetBuffer: Buffer = rawBuffer

      if (rawBuffer.length >= 4 && rawBuffer[0] === 0x89 && rawBuffer[1] === 0x50 && rawBuffer[2] === 0x4e && rawBuffer[3] === 0x4f) {
        ext = 'png'
        mime = 'image/png'
      } else if (rawBuffer.length >= 3 && rawBuffer[0] === 0xff && rawBuffer[1] === 0xd8 && rawBuffer[2] === 0xff) {
        ext = 'jpg'
        mime = 'image/jpeg'
      } else {
        const contentTypeHeader = req.headers['content-type'] || ''
        if (contentTypeHeader.includes('multipart/form-data')) {
          const boundaryMatch = contentTypeHeader.match(/boundary=(?:"([^"]+)"|([^;]+))/i)
          if (boundaryMatch) {
            const boundary = boundaryMatch[1] || boundaryMatch[2]
            const headerEndIndex = rawBuffer.indexOf('\r\n\r\n')
            if (headerEndIndex !== -1) {
              const tailIndex = rawBuffer.lastIndexOf(`\r\n--${boundary}`)
              const fileBody = tailIndex > headerEndIndex
                ? rawBuffer.subarray(headerEndIndex + 4, tailIndex)
                : rawBuffer.subarray(headerEndIndex + 4)

              if (fileBody.length >= 4 && fileBody[0] === 0x89 && fileBody[1] === 0x50 && fileBody[2] === 0x4e && fileBody[3] === 0x47) {
                ext = 'png'
                mime = 'image/png'
                targetBuffer = fileBody
              } else if (fileBody.length >= 3 && fileBody[0] === 0xff && fileBody[1] === 0xd8 && fileBody[2] === 0xff) {
                ext = 'jpg'
                mime = 'image/jpeg'
                targetBuffer = fileBody
              } else {
                sendJson(res, 400, { success: false, error: 'Uploaded file is not a valid JPEG or PNG image' })
                return true
              }
            }
          }
        } else {
          sendJson(res, 400, { success: false, error: 'Uploaded file must be a valid JPEG or PNG image (max 4MB)' })
          return true
        }
      }

      const ASSETS_DIR = path.resolve(process.cwd(), 'data/assets')
      if (!fs.existsSync(ASSETS_DIR)) fs.mkdirSync(ASSETS_DIR, { recursive: true })
      const targetPath = path.join(ASSETS_DIR, `photo.${ext}`)
      fs.writeFileSync(targetPath, targetBuffer)

      try {
        await uploadToR2(`assets/photo.${ext}`, targetPath, mime)
      } catch (r2Err: any) {
        console.warn('[R2 Sync Warning]', r2Err.message)
      }

      try {
        await updateCandidateAttribute('photo_document', `photo.${ext}`)
      } catch (dbErr: any) {
        console.warn('[DB Attribute Sync Warning]', dbErr.message)
      }

      sendJson(res, 200, {
        success: true,
        filename: `photo.${ext}`,
        size: targetBuffer.length,
        message: `Candidate photo uploaded successfully (${Math.round(targetBuffer.length / 1024)} KB) and synced to R2`
      })
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  if (pathname === '/api/candidate/attributes' && req.method === 'GET') {
    try {
      const attributes = await getAllCandidateAttributes()
      sendJson(res, 200, { success: true, count: attributes.length, data: attributes })
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  const attributeDelegateMatch = pathname.match(/^\/api\/candidate\/attributes\/([^\/]+)\/delegate$/)
  if (attributeDelegateMatch && req.method === 'POST') {
    const key = decodeURIComponent(attributeDelegateMatch[1])
    try {
      const parsed = await readJsonBody(req)
      const delegate = parsed.delegate !== false
      const updated = await toggleCandidateAttributeDelegation(key, delegate)
      sendJson(res, 200, { success: updated, key, isDelegated: delegate })
    } catch (err: any) {
      sendJson(res, 400, { success: false, error: err.message })
    }
    return true
  }

  const attributeUpdateMatch = pathname.match(/^\/api\/candidate\/attributes\/([^\/]+)$/)
  if (attributeUpdateMatch && req.method === 'DELETE') {
    const key = decodeURIComponent(attributeUpdateMatch[1])
    try {
      const deleted = await deleteCandidateAttribute(key)
      sendJson(res, 200, { success: deleted, key })
    } catch (err: any) {
      sendJson(res, 400, { success: false, error: err.message })
    }
    return true
  }

  if (attributeUpdateMatch && (req.method === 'PUT' || req.method === 'POST')) {
    const key = decodeURIComponent(attributeUpdateMatch[1])
    try {
      const parsed = await readJsonBody(req)
      const val = parsed.value ?? ''
      const updated = await updateCandidateAttribute(key, val)
      sendJson(res, 200, { success: updated, key, value: val })
    } catch (err: any) {
      sendJson(res, 400, { success: false, error: err.message })
    }
    return true
  }

  if (pathname === '/api/candidate/attributes' && req.method === 'POST') {
    try {
      const parsed = await readJsonBody(req)
      await upsertCandidateAttribute({
        key: parsed.key,
        label: parsed.label || parsed.key,
        description: parsed.description || null,
        category: parsed.category || 'custom',
        value: parsed.value || null,
        source_portal: parsed.source_portal || 'manual',
        required_by_default: parsed.required ? 1 : 0
      })
      sendJson(res, 201, { success: true, key: parsed.key })
    } catch (err: any) {
      sendJson(res, 400, { success: false, error: err.message })
    }
    return true
  }

  return false
}
