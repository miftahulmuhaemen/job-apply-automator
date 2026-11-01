import { d1Query, d1Execute } from "../cloudflareClient.js"
import { uuidv7 } from "../../utils/uuidv7.js"

/* =========================================================
   WEBSITES MASTER TABLE (Policy, Scope & Credentials)
   ========================================================= */
export interface WebsiteRecord {
  id: string
  name: string
  url: string
  allowed: number
  auth_type: string
  username: string | null
  credential_note: string | null
  notes: string | null
  cooldown_days?: number
  created_at: string
  updated_at: string
}

export async function getWebsites(): Promise<WebsiteRecord[]> {
  const query = `
    SELECT id, name, url, allowed, auth_type, username, credential_note, notes, cooldown_days, created_at, updated_at
    FROM websites_master
    ORDER BY allowed DESC, name ASC
  `
  let rows = await d1Query<WebsiteRecord>(query)
  if (rows.length === 0) {
    await seedWebsitesMaster()
    rows = await d1Query<WebsiteRecord>(query)
  }
  return rows
}

export async function seedWebsitesMaster(): Promise<void> {
  const websites = [
    {
      id: uuidv7(),
      name: 'Jobstreet Indonesia',
      url: 'https://www.jobstreet.co.id',
      allowed: 1,
      auth_type: 'Google PIN / OTP',
      username: 'automated.ats.candidate@gmail.com',
      credential_note: 'Interactive CLI verification pauses and prompts for PIN. Cookies persist in data/browser_profile.',
      notes: 'Primary syndicated ATS board for tech postings.'
    },
    {
      id: uuidv7(),
      name: 'LinkedIn Indonesia',
      url: 'https://www.linkedin.com',
      allowed: 1,
      auth_type: 'Cookie Session',
      username: 'candidate.profile@linkedin',
      credential_note: 'Persistent session cookies stored in local Brave profile.',
      notes: 'Secondary syndicated platform for high-seniority roles.'
    },
    {
      id: uuidv7(),
      name: 'Kalibrr Indonesia',
      url: 'https://www.kalibrr.com',
      allowed: 1,
      auth_type: 'Email / Password',
      username: 'candidate.kalibrr@gmail.com',
      credential_note: 'Standard form login with bot-detection bypass.',
      notes: 'Specialized Southeast Asian tech recruitment network.'
    },
    {
      id: uuidv7(),
      name: 'Glints Indonesia',
      url: 'https://glints.com',
      allowed: 1,
      auth_type: 'Google PIN',
      username: 'candidate.glints@gmail.com',
      credential_note: 'Requires OTP check on unverified device IP.',
      notes: 'Verified startup & scaleup job portal.'
    },
    {
      id: uuidv7(),
      name: 'Deel Job Directory',
      url: 'https://www.deel.com',
      allowed: 0,
      auth_type: 'None',
      username: null,
      credential_note: 'Access disabled by default.',
      notes: 'Global contractor platform; requires explicit project authorization.'
    }
  ]

  for (const w of websites) {
    await d1Execute(`
      INSERT OR IGNORE INTO websites_master (id, name, url, allowed, auth_type, username, credential_note, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [w.id, w.name, w.url, w.allowed, w.auth_type, w.username, w.credential_note, w.notes])
  }
}

export async function addWebsite(data: { name: string; url: string; allowed: boolean; auth_type?: string; username?: string; credential_note?: string; notes?: string }): Promise<WebsiteRecord> {
  const id = uuidv7()
  await d1Execute(`
    INSERT INTO websites_master (id, name, url, allowed, auth_type, username, credential_note, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    id,
    data.name,
    data.url,
    data.allowed ? 1 : 0,
    data.auth_type || 'Google PIN',
    data.username || null,
    data.credential_note || null,
    data.notes || null
  ])
  const rows = await d1Query<WebsiteRecord>(`SELECT * FROM websites_master WHERE id = ?`, [id])
  return rows[0]
}

export async function updateWebsite(id: string, data: Partial<WebsiteRecord>): Promise<boolean> {
  const allowedVal = data.allowed !== undefined ? (data.allowed ? 1 : 0) : null
  const res = await d1Execute(`
    UPDATE websites_master
    SET name = COALESCE(?, name),
        url = COALESCE(?, url),
        allowed = COALESCE(?, allowed),
        auth_type = COALESCE(?, auth_type),
        username = COALESCE(?, username),
        credential_note = COALESCE(?, credential_note),
        notes = COALESCE(?, notes),
        updated_at = datetime('now')
    WHERE id = ?
  `, [
    data.name ?? null,
    data.url ?? null,
    allowedVal,
    data.auth_type ?? null,
    data.username ?? null,
    data.credential_note ?? null,
    data.notes ?? null,
    id
  ])
  return res.changes > 0
}

export async function deleteWebsite(id: string): Promise<boolean> {
  const res = await d1Execute(`DELETE FROM websites_master WHERE id = ?`, [id])
  return res.changes > 0
}

export async function toggleWebsiteAllowed(id: string): Promise<boolean> {
  const res = await d1Execute(`
    UPDATE websites_master 
    SET allowed = CASE WHEN allowed = 1 THEN 0 ELSE 1 END, updated_at = datetime('now') 
    WHERE id = ?
  `, [id])
  return res.changes > 0
}


export async function getWebsiteAdapterSchema(domainOrName: string): Promise<string | null> {
  const rows = await d1Query<{ adapter_schema?: string }>(`
    SELECT adapter_schema 
    FROM websites_master 
    WHERE lower(name) = lower(?) OR instr(lower(url), lower(?)) > 0 
    LIMIT 1
  `, [domainOrName, domainOrName])
  return rows[0]?.adapter_schema || null
}

export async function saveWebsiteAdapterSchema(domainOrName: string, schemaJson: string): Promise<boolean> {
  const res = await d1Execute(`
    UPDATE websites_master 
    SET adapter_schema = ?, updated_at = datetime('now')
    WHERE lower(name) = lower(?) OR instr(lower(url), lower(?)) > 0
  `, [schemaJson, domainOrName, domainOrName])
  return res.changes > 0
}
