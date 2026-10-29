use rusqlite::{Connection, Result};
use std::path::{Path, PathBuf};

pub struct DbPool;

impl DbPool {
    pub fn get_db_path() -> PathBuf {
        let base_candidates = [
            Path::new("data/amiya.db"),
            Path::new("../data/amiya.db"),
            Path::new("../../data/amiya.db"),
        ];

        for path in &base_candidates {
            if path.exists() {
                return path.to_path_buf();
            }
        }

        // Default path
        PathBuf::from("data/amiya.db")
    }

    pub fn open() -> Result<Connection> {
        let path = Self::get_db_path();
        if let Some(parent) = path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        let conn = Connection::open(&path)?;

        // WAL mode & pragmas for performance and concurrent web reader safety
        conn.execute_batch(
            "PRAGMA journal_mode = WAL;
             PRAGMA synchronous = NORMAL;
             PRAGMA foreign_keys = ON;
             PRAGMA busy_timeout = 5000;",
        )?;

        Self::verify_schema(&conn)?;
        Ok(conn)
    }

    fn ensure_column(conn: &Connection, table: &str, column_def: &str) -> Result<()> {
        let col_name = column_def.split_whitespace().next().unwrap_or("");
        let query = format!("PRAGMA table_info({})", table);
        let mut stmt = conn.prepare(&query)?;
        let col_exists = stmt.exists([])?;
        
        let mut exists = false;
        if col_exists {
            let mut rows = stmt.query([])?;
            while let Some(row) = rows.next()? {
                let name: String = row.get(1)?;
                if name.eq_ignore_ascii_case(col_name) {
                    exists = true;
                    break;
                }
            }
        }

        if !exists {
            let alter_sql = format!("ALTER TABLE {} ADD COLUMN {}", table, column_def);
            let _ = conn.execute(&alter_sql, []);
        }
        Ok(())
    }

    pub fn verify_schema(conn: &Connection) -> Result<()> {
        conn.execute_batch(
            "CREATE TABLE IF NOT EXISTS jobs_ledger (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uuid TEXT UNIQUE,
                job_id TEXT,
                company TEXT NOT NULL,
                title TEXT NOT NULL,
                portal TEXT NOT NULL,
                job_url TEXT UNIQUE,
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
                triage_decision TEXT DEFAULT 'KEEP',
                benefits TEXT,
                company_overview TEXT,
                full_description TEXT,
                market_salary_benchmark TEXT,
                benchmark_source TEXT,
                histories TEXT,
                is_deleted INTEGER DEFAULT 0
            );

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
                uuid TEXT UNIQUE,
                run_date TEXT NOT NULL,
                batch_size INTEGER DEFAULT 10,
                processed_count INTEGER DEFAULT 0,
                success_count INTEGER DEFAULT 0,
                skipped_count INTEGER DEFAULT 0,
                failed_count INTEGER DEFAULT 0,
                status TEXT DEFAULT 'COMPLETED',
                details TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS scheduler_settings (
                id INTEGER PRIMARY KEY,
                enabled INTEGER DEFAULT 1,
                schedule_time TEXT DEFAULT '09:00',
                max_daily_applications INTEGER DEFAULT 10,
                portals TEXT DEFAULT 'Jobstreet, LinkedIn',
                last_run_at TEXT,
                next_run_at TEXT,
                cli_agent_enabled INTEGER DEFAULT 1,
                cli_agent_model TEXT DEFAULT 'gemini-3.8-flash-high',
                cli_agent_binary TEXT DEFAULT '/home/sahana/.local/bin/agy',
                cli_agent_timeout_seconds INTEGER DEFAULT 60,
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
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
                adapter_schema TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );",
        )?;

        // Ensure optional migration columns
        Self::ensure_column(conn, "scheduler_settings", "cli_agent_enabled INTEGER DEFAULT 1")?;
        Self::ensure_column(conn, "scheduler_settings", "cli_agent_model TEXT DEFAULT 'gemini-3.8-flash-high'")?;
        Self::ensure_column(conn, "scheduler_settings", "cli_agent_binary TEXT DEFAULT '/home/sahana/.local/bin/agy'")?;
        Self::ensure_column(conn, "scheduler_settings", "cli_agent_timeout_seconds INTEGER DEFAULT 60")?;
        Self::ensure_column(conn, "websites_master", "adapter_schema TEXT")?;

        // Initialize default scheduler_settings row if empty
        conn.execute(
            "INSERT OR IGNORE INTO scheduler_settings (id, enabled, schedule_time, max_daily_applications, portals)
             VALUES (1, 1, '09:00', 10, 'Jobstreet, LinkedIn')",
            [],
        )?;

        Ok(())
    }
}
