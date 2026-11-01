import http from 'node:http'
import {
  getPersonalizationRules,
  addPersonalizationRule,
  togglePersonalizationRule,
  restorePersonalizationRule,
  updatePersonalizationRule,
  softDeletePersonalizationRule
} from '../storage/db.js'
import { readJsonBody, sendJson } from './routeUtils.js'

export async function handleCriteriaRoutes(
  req: http.IncomingMessage,
  res: http.ServerResponse,
  pathname: string,
  url: URL
): Promise<boolean> {
  if (pathname === '/api/personalization' && req.method === 'GET') {
    try {
      const includeDeleted = url.searchParams.get('include_deleted') === '1'
      const rules = await getPersonalizationRules(includeDeleted)
      sendJson(res, 200, { success: true, count: rules.length, data: rules })
    } catch (err: any) {
      sendJson(res, 500, { success: false, error: err.message })
    }
    return true
  }

  if (pathname === '/api/personalization' && req.method === 'POST') {
    try {
      const body = await readJsonBody(req)
      if (!body.category || !body.key || !body.value) {
        sendJson(res, 400, { success: false, error: 'Category, key, and value are required.' })
        return true
      }
      const newRule = await addPersonalizationRule(body.category, body.key, body.value, body.description || '')
      sendJson(res, 201, { success: true, data: newRule })
    } catch (err: any) {
      sendJson(res, 400, { success: false, error: err.message })
    }
    return true
  }

  const toggleRuleMatch = pathname.match(/^\/api\/personalization\/([^\/]+)\/toggle$/)
  if (toggleRuleMatch && req.method === 'POST') {
    const ruleId = toggleRuleMatch[1]
    try {
      const toggled = await togglePersonalizationRule(ruleId)
      sendJson(res, 200, { success: toggled, id: ruleId })
    } catch (err: any) {
      sendJson(res, 400, { success: false, error: err.message })
    }
    return true
  }

  const restoreRuleMatch = pathname.match(/^\/api\/personalization\/([^\/]+)\/restore$/)
  if (restoreRuleMatch && req.method === 'POST') {
    const ruleId = restoreRuleMatch[1]
    try {
      const restored = await restorePersonalizationRule(ruleId)
      sendJson(res, 200, { success: restored, id: ruleId })
    } catch (err: any) {
      sendJson(res, 400, { success: false, error: err.message })
    }
    return true
  }

  const ruleItemMatch = pathname.match(/^\/api\/personalization\/([^\/]+)$/)
  if (ruleItemMatch && (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH')) {
    const ruleId = ruleItemMatch[1]
    try {
      const parsed = await readJsonBody(req)
      const updated = await updatePersonalizationRule(ruleId, {
        category: parsed.category,
        key: parsed.key,
        value: parsed.value,
        description: parsed.description
      })
      sendJson(res, 200, { success: updated, id: ruleId })
    } catch (err: any) {
      sendJson(res, 400, { success: false, error: err.message })
    }
    return true
  }

  if (ruleItemMatch && req.method === 'DELETE') {
    const ruleId = ruleItemMatch[1]
    try {
      const deleted = await softDeletePersonalizationRule(ruleId)
      sendJson(res, 200, { success: deleted, id: ruleId })
    } catch (err: any) {
      sendJson(res, 400, { success: false, error: err.message })
    }
    return true
  }

  return false
}
