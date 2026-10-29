import { DatabaseSync } from 'node:sqlite'
import path from 'path'
import { execFileSync } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const D1_DATABASE_ID = 'b54fd60b-28c4-4577-b02c-478797c90122'
const LOCAL_DB_PATH = path.resolve(__dirname, '../data/amiya.db')

function runD1Query(sql: string) {
  const result = execFileSync('cf', ['d1', 'query', D1_DATABASE_ID, '--sql', sql], {
    encoding: 'utf-8',
    maxBuffer: 50 * 1024 * 1024,
  })
  return JSON.parse(result)
}

function escapeSqlString(val: any): string {
  if (val === null || val === undefined) return 'NULL'
  if (typeof val === 'number') return val.toString()
  if (typeof val === 'boolean') return val ? '1' : '0'
  const str = String(val).replace(/'/g, "''")
  return `'${str}'`
}

async function main() {
  console.log(`[D1 Migration] Connecting to local DB: ${LOCAL_DB_PATH}`)
  const localDb = new DatabaseSync(LOCAL_DB_PATH)

  console.log('[D1 Migration] Initializing D1 Schema...')
  const schemaSql = `
CREATE TABLE IF NOT EXISTS jobs_ledger (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT,
    company TEXT NOT NULL,
    title TEXT NOT NULL,
    portal TEXT NOT NULL,
    job_url TEXT NOT NULL UNIQUE,
    location TEXT,
    salary_raw TEXT,
    salary_min INTEGER,
    salary_max INTEGER,
    status TEXT NOT NULL,
    skip_reason TEXT,
    resume_path TEXT,
    applied_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    company_size TEXT,
    industry TEXT,
    experience_req TEXT,
    tech_stack TEXT,
    requirements_summary TEXT,
    screening_questions TEXT,
    candidate_answers TEXT,
    triage_decision TEXT DEFAULT 'PENDING',
    benefits TEXT,
    company_overview TEXT,
    full_description TEXT,
    market_salary_benchmark TEXT,
    benchmark_source TEXT,
    uuid TEXT,
    histories TEXT DEFAULT "[]",
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT,
    company_website TEXT,
    headquarters TEXT,
    leaders TEXT,
    hr_contacts TEXT,
    last_error TEXT,
    roadblock_url TEXT,
    roadblock_screenshot TEXT
);
CREATE INDEX IF NOT EXISTS idx_jobs_company_applied ON jobs_ledger(company, applied_at);

CREATE TABLE IF NOT EXISTS screening_qa (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    question_pattern TEXT NOT NULL UNIQUE,
    answer TEXT NOT NULL,
    category TEXT DEFAULT 'general',
    usage_count INTEGER DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS daily_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_date TEXT NOT NULL UNIQUE,
    applications_count INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    uuid TEXT,
    batch_size INTEGER DEFAULT 10,
    processed_count INTEGER DEFAULT 0,
    success_count INTEGER DEFAULT 0,
    skipped_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    status TEXT DEFAULT "COMPLETED",
    details TEXT
);

CREATE TABLE IF NOT EXISTS personalization_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    description TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    uuid TEXT,
    is_enabled INTEGER DEFAULT 1,
    is_deleted INTEGER DEFAULT 0,
    deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS scheduler_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    enabled INTEGER NOT NULL DEFAULT 1,
    schedule_time TEXT NOT NULL DEFAULT '09:00',
    max_daily_applications INTEGER NOT NULL DEFAULT 10,
    portals TEXT NOT NULL DEFAULT 'Jobstreet,LinkedIn',
    last_run_at TEXT,
    next_run_at TEXT,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    cli_agent_enabled INTEGER DEFAULT 1,
    cli_agent_model TEXT DEFAULT "gemini-3.8-flash-high",
    cli_agent_binary TEXT DEFAULT "/home/sahana/.local/bin/agy",
    cli_agent_timeout_seconds INTEGER DEFAULT 60
);

CREATE TABLE IF NOT EXISTS companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    normalized_name TEXT NOT NULL UNIQUE,
    industry TEXT,
    company_size TEXT,
    location TEXT,
    overview TEXT,
    applications_count INTEGER DEFAULT 0,
    crawled_count INTEGER DEFAULT 0,
    first_crawled_at TEXT,
    last_applied_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    website TEXT,
    headquarters TEXT,
    leaders TEXT,
    hr_contacts TEXT,
    products_summary TEXT
);

CREATE TABLE IF NOT EXISTS websites_master (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL UNIQUE,
    allowed INTEGER DEFAULT 1,
    auth_type TEXT DEFAULT 'Google PIN',
    username TEXT,
    credential_note TEXT,
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    adapter_schema TEXT
);

CREATE TABLE IF NOT EXISTS system_errors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now')),
    category TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'ERROR',
    component TEXT NOT NULL,
    message TEXT NOT NULL,
    details TEXT,
    resolved INTEGER DEFAULT 0,
    resolved_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_errors_resolved_ts ON system_errors(resolved, timestamp DESC);
  `

  runD1Query(schemaSql)
  console.log('[D1 Migration] Schema initialized successfully.')

  const tables = [
    'websites_master',
    'companies',
    'scheduler_settings',
    'personalization_rules',
    'screening_qa',
    'daily_runs',
    'system_errors',
    'jobs_ledger'
  ]

  for (const table of tables) {
    const rows = localDb.prepare(`SELECT * FROM ${table}`).all() as Record<string, any>[]
    console.log(`[D1 Migration] Migrating table '${table}' (${rows.length} rows)...`)
    if (rows.length === 0) continue

    // Clear existing rows in D1 table
    runD1Query(`DELETE FROM ${table};`)

    // Insert in batches of 5 to avoid argument length limits
    const chunkSize = 5
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize)
      const stmts: string[] = []

      for (const row of chunk) {
        const cols = Object.keys(row)
        const vals = cols.map(c => escapeSqlString(row[c]))
        stmts.push(`INSERT OR REPLACE INTO ${table} (${cols.join(', ')}) VALUES (${vals.join(', ')});`)
      }

      runD1Query(stmts.join(' '))
    }
  }

  console.log('[D1 Migration] Verifying row counts on Cloudflare D1...')
  for (const table of tables) {
    const localCount = (localDb.prepare(`SELECT count(*) as count FROM ${table}`).get() as any).count
    const d1Result = runD1Query(`SELECT count(*) as count FROM ${table};`)
    const d1Count = d1Result[0]?.results[0]?.count ?? -1
    console.log(` - Table ${table}: local=${localCount}, D1=${d1Count} -> ${localCount === d1Count ? 'OK' : 'MISMATCH'}`)
  }

  console.log('[D1 Migration] Completed successfully.')
}

main().catch(err => {
  console.error('[D1 Migration Error]:', err)
  process.exit(1)
})
