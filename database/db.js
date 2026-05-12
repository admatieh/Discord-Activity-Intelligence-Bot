// database/db.js
const Database = require('better-sqlite3');
const path = require('path');

// ---------------------------------------------------------------------------
// DB Path — respect DATABASE_PATH env var first
// ---------------------------------------------------------------------------

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data.db');
console.log(`[DATABASE] Using DB path: ${dbPath}`);

const db = new Database(dbPath);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------------------
// Schema helpers
// ---------------------------------------------------------------------------

function hasColumn(tableName, columnName) {
    try {
        const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
        return columns.some((col) => col.name === columnName);
    } catch {
        return false;
    }
}

function hasTable(tableName) {
    try {
        const row = db.prepare(
            `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
        ).get(tableName);
        return !!row;
    } catch {
        return false;
    }
}

function hasIndex(indexName) {
    try {
        const row = db.prepare(
            `SELECT name FROM sqlite_master WHERE type='index' AND name=?`
        ).get(indexName);
        return !!row;
    } catch {
        return false;
    }
}

function ensureColumn(tableName, columnSql, columnName) {
    if (!hasColumn(tableName, columnName)) {
        try {
            db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql};`);
            console.log(`[DATABASE] Added column: ${tableName}.${columnName}`);
        } catch (err) {
            console.error(`[DATABASE] Failed to add column ${tableName}.${columnName}: ${err.message}`);
        }
    }
}

// ---------------------------------------------------------------------------
// Schema initialization — CREATE IF NOT EXISTS (safe, never drops data)
// ---------------------------------------------------------------------------

function initializeSchema() {
    // ---- Core tables (existing) ----
    db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            channel_id TEXT NOT NULL,
            triggered_by TEXT NOT NULL,
            start_time TEXT NOT NULL DEFAULT (datetime('now')),
            end_time TEXT,
            duration_minutes INTEGER,
            auto_end_at TEXT
        );

        CREATE TABLE IF NOT EXISTS attendees (
            session_id INTEGER NOT NULL,
            user_id TEXT NOT NULL,
            PRIMARY KEY (session_id, user_id),
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS voice_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            user_id TEXT NOT NULL,
            join_time TEXT NOT NULL,
            leave_time TEXT,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_voice_events_session_user
            ON voice_events (session_id, user_id);

        CREATE TABLE IF NOT EXISTS logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            level TEXT NOT NULL DEFAULT 'info',
            message TEXT NOT NULL,
            context TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_logs_level ON logs (level);
        CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs (created_at);

        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT NOT NULL,
            discriminator TEXT,
            display_name TEXT,
            joined_at TEXT,
            created_at TEXT,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE TABLE IF NOT EXISTS activity_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            user_id TEXT NOT NULL,
            channel_id TEXT,
            session_id INTEGER,
            metadata TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_activity_events_type ON activity_events (type);
        CREATE INDEX IF NOT EXISTS idx_activity_events_user ON activity_events (user_id);
        CREATE INDEX IF NOT EXISTS idx_sessions_channel_active ON sessions (channel_id, end_time);
        CREATE INDEX IF NOT EXISTS idx_voice_events_session ON voice_events (session_id);
        CREATE INDEX IF NOT EXISTS idx_activity_events_session ON activity_events (session_id);

        CREATE TABLE IF NOT EXISTS attendance_summary (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            user_id TEXT NOT NULL,
            status TEXT NOT NULL,
            total_time_seconds INTEGER NOT NULL,
            first_join_time TEXT,
            last_leave_time TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_attendance_summary_session ON attendance_summary (session_id);
        CREATE INDEX IF NOT EXISTS idx_attendance_summary_user ON attendance_summary (user_id);

        CREATE TABLE IF NOT EXISTS voice_activity_intervals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            user_id TEXT NOT NULL,
            start_time TEXT NOT NULL,
            end_time TEXT,
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_voice_activity_session_user
            ON voice_activity_intervals (session_id, user_id);

        CREATE TABLE IF NOT EXISTS participation_summary (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            user_id TEXT NOT NULL,
            score INTEGER NOT NULL,
            speaking_score INTEGER NOT NULL,
            interaction_score INTEGER NOT NULL,
            attendance_score INTEGER NOT NULL,
            label TEXT NOT NULL,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_participation_summary_session ON participation_summary (session_id);
        CREATE INDEX IF NOT EXISTS idx_participation_summary_user ON participation_summary (user_id);
    `);

    // ---- Extended sessions columns (safe migrations) ----
    ensureColumn('sessions', 'duration_minutes INTEGER', 'duration_minutes');
    ensureColumn('sessions', 'auto_end_at TEXT', 'auto_end_at');
    ensureColumn('sessions', 'guild_id TEXT', 'guild_id');
    ensureColumn('sessions', 'voice_channel_id TEXT', 'voice_channel_id');
    ensureColumn('sessions', 'text_channel_id TEXT', 'text_channel_id');
    ensureColumn('sessions', 'title TEXT', 'title');
    ensureColumn('sessions', 'source TEXT', 'source');
    ensureColumn('sessions', 'status TEXT', 'status');
    ensureColumn('sessions', 'tracking_json TEXT', 'tracking_json');
    ensureColumn('sessions', 'options_json TEXT', 'options_json');
    ensureColumn('sessions', 'report_message_id TEXT', 'report_message_id');
    ensureColumn('sessions', 'updated_at TEXT', 'updated_at');
    ensureColumn('sessions', 'ended_reason TEXT', 'ended_reason');

    // ---- Extended logs columns ----
    ensureColumn('logs', 'source TEXT', 'source');
    ensureColumn('logs', 'event TEXT', 'event');
    ensureColumn('logs', 'guild_id TEXT', 'guild_id');
    ensureColumn('logs', 'session_id INTEGER', 'session_id');
    ensureColumn('logs', 'user_id TEXT', 'user_id');
    ensureColumn('logs', 'command TEXT', 'command');
    ensureColumn('logs', 'execution_id TEXT', 'execution_id');
    ensureColumn('logs', 'metadata_json TEXT', 'metadata_json');

    // ---- Extended activity_events columns ----
    ensureColumn('activity_events', 'guild_id TEXT', 'guild_id');
    ensureColumn('activity_events', 'message TEXT', 'message');
    ensureColumn('activity_events', 'actor_display_name TEXT', 'actor_display_name');
    ensureColumn('activity_events', 'target_channel_name TEXT', 'target_channel_name');
    ensureColumn('activity_events', 'human_label TEXT', 'human_label');
    ensureColumn('activity_events', 'severity TEXT', 'severity');

    // ---- New: scheduled_items ----
    db.exec(`
        CREATE TABLE IF NOT EXISTS scheduled_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            title TEXT,
            guild_id TEXT NOT NULL,
            voice_channel_id TEXT,
            text_channel_id TEXT,
            scheduled_for TEXT NOT NULL,
            timezone TEXT,
            duration_minutes INTEGER,
            payload_json TEXT,
            status TEXT NOT NULL DEFAULT 'scheduled',
            recurrence_rule TEXT,
            last_run_at TEXT,
            next_run_at TEXT,
            created_by TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT,
            cancelled_at TEXT,
            error TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_scheduled_items_status_time
            ON scheduled_items (status, scheduled_for);
        CREATE INDEX IF NOT EXISTS idx_scheduled_items_type
            ON scheduled_items (type);
        CREATE INDEX IF NOT EXISTS idx_scheduled_items_guild
            ON scheduled_items (guild_id);
    `);

    // ---- New: message_deliveries ----
    db.exec(`
        CREATE TABLE IF NOT EXISTS message_deliveries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scheduled_item_id INTEGER,
            guild_id TEXT,
            text_channel_id TEXT NOT NULL,
            content TEXT NOT NULL,
            status TEXT DEFAULT 'sent',
            sent_at TEXT,
            discord_message_id TEXT,
            error TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_message_deliveries_channel
            ON message_deliveries (text_channel_id);
        CREATE INDEX IF NOT EXISTS idx_message_deliveries_status
            ON message_deliveries (status);
    `);

    // ---- New: session_reports ----
    db.exec(`
        CREATE TABLE IF NOT EXISTS session_reports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_id INTEGER NOT NULL,
            summary_json TEXT,
            generated_at TEXT DEFAULT (datetime('now')),
            generated_by TEXT,
            posted_to_channel_id TEXT,
            discord_message_id TEXT,
            export_path TEXT,
            status TEXT DEFAULT 'generated',
            FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_session_reports_session
            ON session_reports (session_id);
    `);

    // ---- New: attendance checkpoints (daily check-in / checkout) ----
    db.exec(`
        CREATE TABLE IF NOT EXISTS attendance_checkpoints (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            username TEXT,
            display_name TEXT,
            duty_station TEXT DEFAULT 'Remote',
            attendance_date TEXT NOT NULL,
            checkpoint_key TEXT NOT NULL,
            checkpoint_label TEXT,
            status TEXT NOT NULL,
            checked_at TEXT,
            local_checked_at TEXT,
            source TEXT,
            discord_message_id TEXT,
            channel_id TEXT,
            session_id INTEGER,
            signature_text TEXT,
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT,
            UNIQUE (guild_id, user_id, attendance_date, checkpoint_key)
        );

        CREATE INDEX IF NOT EXISTS idx_attendance_checkpoints_guild_date
            ON attendance_checkpoints (guild_id, attendance_date);
        CREATE INDEX IF NOT EXISTS idx_attendance_checkpoints_user_date
            ON attendance_checkpoints (user_id, attendance_date);
        CREATE INDEX IF NOT EXISTS idx_attendance_checkpoints_checkpoint
            ON attendance_checkpoints (checkpoint_key, attendance_date);
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS attendance_manual_overrides (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            checkpoint_id INTEGER,
            guild_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            attendance_date TEXT NOT NULL,
            checkpoint_key TEXT NOT NULL,
            old_status TEXT,
            new_status TEXT,
            reason TEXT,
            changed_by TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_attendance_overrides_guild_date
            ON attendance_manual_overrides (guild_id, attendance_date);
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS attendance_settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL UNIQUE,
            timezone TEXT,
            active_days_json TEXT,
            checkpoints_json TEXT,
            reminder_channel_id TEXT,
            enabled INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT
        );
    `);

    // v2 instructor-controlled checkpoint definitions
    db.exec(`
        CREATE TABLE IF NOT EXISTS attendance_checkpoint_definitions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            key TEXT NOT NULL,
            label TEXT NOT NULL,
            command_type TEXT NOT NULL,
            target_time TEXT NOT NULL,
            opens_before_minutes INTEGER DEFAULT 15,
            late_after_minutes INTEGER DEFAULT 15,
            closes_after_minutes INTEGER,
            allow_late_submission INTEGER DEFAULT 1,
            allow_after_close_manual_only INTEGER DEFAULT 0,
            required INTEGER DEFAULT 1,
            active INTEGER DEFAULT 1,
            sort_order INTEGER DEFAULT 0,
            timezone TEXT DEFAULT 'Asia/Beirut',
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT,
            UNIQUE (guild_id, key)
        );

        CREATE INDEX IF NOT EXISTS idx_attendance_checkpoint_defs_guild_active
            ON attendance_checkpoint_definitions (guild_id, active, sort_order);
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS attendance_imports (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            filename TEXT,
            file_type TEXT,
            imported_by TEXT,
            status TEXT,
            rows_total INTEGER,
            rows_imported INTEGER,
            rows_failed INTEGER,
            error TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_attendance_imports_guild
            ON attendance_imports (guild_id, created_at);
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS attendance_import_rows (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            import_id INTEGER NOT NULL,
            row_number INTEGER,
            raw_json TEXT,
            normalized_json TEXT,
            status TEXT,
            error TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            FOREIGN KEY (import_id) REFERENCES attendance_imports(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_attendance_import_rows_import
            ON attendance_import_rows (import_id, status);
    `);

    // ---- Roster / cohorts foundation ----
    db.exec(`
        CREATE TABLE IF NOT EXISTS cohorts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            name TEXT NOT NULL,
            course_name TEXT,
            course_code TEXT,
            active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_cohorts_guild_active
            ON cohorts (guild_id, active);
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS students (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            full_name TEXT NOT NULL,
            preferred_name TEXT,
            email TEXT,
            discord_user_id TEXT,
            discord_username TEXT,
            duty_station TEXT DEFAULT 'Remote',
            student_code TEXT,
            active INTEGER DEFAULT 1,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_students_guild_active
            ON students (guild_id, active);
        CREATE INDEX IF NOT EXISTS idx_students_discord_user
            ON students (guild_id, discord_user_id);
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS cohort_members (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cohort_id INTEGER NOT NULL,
            student_id INTEGER NOT NULL,
            joined_at TEXT DEFAULT (datetime('now')),
            active INTEGER DEFAULT 1,
            UNIQUE(cohort_id, student_id),
            FOREIGN KEY (cohort_id) REFERENCES cohorts(id) ON DELETE CASCADE,
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_cohort_members_cohort_active
            ON cohort_members (cohort_id, active);
        CREATE INDEX IF NOT EXISTS idx_cohort_members_student
            ON cohort_members (student_id);
    `);

    // ---- Period approvals and audit logging foundation ----
    db.exec(`
        CREATE TABLE IF NOT EXISTS attendance_periods (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT NOT NULL,
            cohort_id INTEGER,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'draft',
            approved_by TEXT,
            approved_at TEXT,
            exported_at TEXT,
            notes TEXT,
            created_at TEXT DEFAULT (datetime('now')),
            updated_at TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_attendance_periods_guild_dates
            ON attendance_periods (guild_id, start_date, end_date);
    `);

    db.exec(`
        CREATE TABLE IF NOT EXISTS audit_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            guild_id TEXT,
            actor_user_id TEXT,
            actor_display_name TEXT,
            action TEXT NOT NULL,
            entity_type TEXT,
            entity_id TEXT,
            before_json TEXT,
            after_json TEXT,
            metadata_json TEXT,
            source TEXT,
            created_at TEXT DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_audit_logs_guild_created
            ON audit_logs (guild_id, created_at);
    `);
}

try {
    initializeSchema();
    console.log('[DATABASE] Schema ready. All tables initialized.');
} catch (error) {
    console.error(`[DATABASE] Schema initialization failed: ${error.message}`);
}

module.exports = db;