import http from 'node:http'
import {
  getWebsites,
  addWebsite,
  updateWebsite,
  deleteWebsite,
  toggleWebsiteAllowed
} from '../storage/db.js'
import { checkPortalSessions, launchPortalAuth } from '../browser/auth.js'
import { readJsonBody, sendJson } from './routeUtils.js'

export async function handleWebsitesRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string
): Promise<boolean> {
  if (pathname === '/api/websites' && req.method === 'GET') {
    try {
      const websites = await getWebsites()
      sendJson(res, 200, { success: true, count: websites.length, data: websites })
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  if (pathname === '/api/websites/session-status' && req.method === 'GET') {
    try {
      const statuses = checkPortalSessions()
      sendJson(res, 200, { success: true, data: statuses })
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  const websiteAuthMatch = pathname.match(/^\/api\/websites\/([^\/]+)\/authenticate$/)
  if (websiteAuthMatch && req.method === 'POST') {
    const siteId = websiteAuthMatch[1]
    try {
      const websites = await getWebsites()
      const site = websites.find(w => w.id === siteId)
      if (!site) {
        sendJson(res, 404, { success: false, error: 'Website not found' })
        return true
      }

      const combined = `${site.url} ${site.name}`.toLowerCase()
      let portalKey = 'kalibrr'
      if (combined.includes('kalibrr')) portalKey = 'kalibrr'
      else if (combined.includes('glints')) portalKey = 'glints'
      else if (combined.includes('jobstreet') || combined.includes('seek')) portalKey = 'jobstreet'
      else if (combined.includes('linkedin')) portalKey = 'linkedin'

      const result = launchPortalAuth(portalKey)
      sendJson(res, 200, { success: true, portalKey, result })
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  const websiteCheckMatch = pathname.match(/^\/api\/websites\/([^\/]+)\/check-session$/)
  if (websiteCheckMatch && req.method === 'POST') {
    const siteId = websiteCheckMatch[1]
    try {
      const websites = await getWebsites()
      const site = websites.find(w => w.id === siteId)
      if (!site) {
        sendJson(res, 404, { success: false, error: 'Website not found' })
        return true
      }

      const combined = `${site.url} ${site.name}`.toLowerCase()
      let portalKey = 'kalibrr'
      if (combined.includes('kalibrr')) portalKey = 'kalibrr'
      else if (combined.includes('glints')) portalKey = 'glints'
      else if (combined.includes('jobstreet') || combined.includes('seek')) portalKey = 'jobstreet'
      else if (combined.includes('linkedin')) portalKey = 'linkedin'

      const statuses = checkPortalSessions()
      sendJson(res, 200, { success: true, portalKey, status: statuses[portalKey] || 'REQUIRES_LOGIN' })
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  if (pathname === '/api/websites' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req)
      const site = await addWebsite({
        name: body.name,
        url: body.url,
        allowed: Boolean(body.allowed),
        auth_type: body.auth_type,
        username: body.username,
        credential_note: body.credential_note,
        notes: body.notes
      })
      sendJson(res, 201, { success: true, data: site })
    } catch (err: any) {
      sendJson(res, 400, { success: false, error: err.message })
    }
    return true
  }

  const websiteToggleMatch = pathname.match(/^\/api\/websites\/([^\/]+)\/toggle$/)
  if (websiteToggleMatch && req.method === 'POST') {
    const siteId = websiteToggleMatch[1]
    try {
      const updated = await toggleWebsiteAllowed(siteId)
      sendJson(res, 200, { success: updated, id: siteId })
    } catch (err: any) {
      sendJson(res, 400, { success: false, error: err.message })
    }
    return true
  }

  const websiteItemMatch = pathname.match(/^\/api\/websites\/([^\/]+)$/)
  if (websiteItemMatch && req.method === 'POST') {
    const siteId = websiteItemMatch[1]
    try {
      const body = await readJsonBody(req)
      const updated = await updateWebsite(siteId, body)
      sendJson(res, 200, { success: updated, id: siteId })
    } catch (err: any) {
      sendJson(res, 400, { success: false, error: err.message })
    }
    return true
  }

  if (websiteItemMatch && req.method === 'DELETE') {
    const siteId = websiteItemMatch[1]
    try {
      const deleted = await deleteWebsite(siteId)
      sendJson(res, 200, { success: deleted, id: siteId })
    } catch (err: any) {
      sendJson(res, 400, { success: false, error: err.message })
    }
    return true
  }

  return false
}
