import { d1Query, d1Execute } from "../cloudflareClient.js"
import { uuidv7 } from "../../utils/uuidv7.js"

/* =========================================================
   DYNAMIC PERSONALIZATION RULES
   ========================================================= */
export interface PersonalizationRuleRecord {
  id: number
  uuid: string
  category: string
  key: string
  value: string
  description: string
  is_enabled: number
  is_deleted: number
  deleted_at?: string | null
  updated_at: string
}

export async function getPersonalizationRules(includeDeleted: boolean = false): Promise<PersonalizationRuleRecord[]> {
  const query = includeDeleted
    ? `SELECT id, COALESCE(uuid, 'rule-' || id) as uuid, category, key, value, description, is_enabled, is_deleted, deleted_at, updated_at FROM personalization_rules ORDER BY id ASC`
    : `SELECT id, COALESCE(uuid, 'rule-' || id) as uuid, category, key, value, description, is_enabled, is_deleted, deleted_at, updated_at FROM personalization_rules WHERE is_deleted = 0 ORDER BY id ASC`
  return await d1Query<PersonalizationRuleRecord>(query)
}

export function syncPersonalizationToFile() {
  // Cloudflare D1 Native: Rules persist directly in D1 table 'personalization_rules'
}

export async function addPersonalizationRule(category: string, key: string, value: string, description: string): Promise<PersonalizationRuleRecord> {
  const newUuid = uuidv7()
  const res = await d1Execute(`
    INSERT INTO personalization_rules (uuid, category, key, value, description, is_enabled, is_deleted, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, 0, datetime('now'))
  `, [newUuid, category, key, value, description])
  
  const rows = await d1Query<PersonalizationRuleRecord>(
    `SELECT * FROM personalization_rules WHERE uuid = ?`,
    [newUuid]
  )
  return rows[0]
}

export interface UpdatePersonalizationRuleParams {
  category?: string
  key?: string
  value?: string
  description?: string
}

export async function updatePersonalizationRule(
  id: number | string,
  updates: UpdatePersonalizationRuleParams | string,
  legacyDescription?: string
): Promise<boolean> {
  if (typeof updates === 'string') {
    return await updatePersonalizationRule(id, { value: updates, description: legacyDescription })
  }

  const fields: string[] = []
  const values: any[] = []

  if (updates.category !== undefined) {
    fields.push('category = ?')
    values.push(updates.category)
  }
  if (updates.key !== undefined) {
    fields.push('key = ?')
    values.push(updates.key)
  }
  if (updates.value !== undefined) {
    fields.push('value = ?')
    values.push(updates.value)
  }
  if (updates.description !== undefined) {
    fields.push('description = ?')
    values.push(updates.description)
  }

  if (fields.length === 0) return true

  fields.push("updated_at = datetime('now')")
  values.push(id, id)

  const res = await d1Execute(
    `UPDATE personalization_rules SET ${fields.join(', ')} WHERE id = ? OR uuid = ?`,
    values
  )
  return res.changes > 0
}

export async function togglePersonalizationRule(id: number | string): Promise<boolean> {
  const res = await d1Execute(
    `UPDATE personalization_rules SET is_enabled = CASE WHEN is_enabled = 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = ? OR uuid = ?`,
    [id, id]
  )
  return res.changes > 0
}

export async function softDeletePersonalizationRule(id: number | string): Promise<boolean> {
  const res = await d1Execute(
    `UPDATE personalization_rules SET is_deleted = 1, deleted_at = datetime('now'), updated_at = datetime('now') WHERE id = ? OR uuid = ?`,
    [id, id]
  )
  return res.changes > 0
}

export async function restorePersonalizationRule(id: number | string): Promise<boolean> {
  const res = await d1Execute(
    `UPDATE personalization_rules SET is_deleted = 0, deleted_at = NULL, updated_at = datetime('now') WHERE id = ? OR uuid = ?`,
    [id, id]
  )
  return res.changes > 0
}

export async function deletePersonalizationRule(id: number | string): Promise<boolean> {
  return await softDeletePersonalizationRule(id)
}

