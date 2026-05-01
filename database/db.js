// database/db.js
const Database = require('better-sqlite3');
const path = require('path');

// Store the database file in the project root
const db = new Database(path.join(__dirname, '..', 'data.db'));

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ---------------------------------------------------------------------------
// Schema helpers
// ---------------------------------------------------------------------------

function hasColumn(tableName, columnName) {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    return columns.some((col) => col.name === columnName);
}

function ensureColumn(tableName, columnSql, columnName) {
    if (!hasColumn(tableName, columnName)) {
        db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnSql};`);
    }
}

// ---------------------------------------------------------------------------
// Schema initialization
// ---------------------------------------------------------------------------

function initializeSchema() {
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

        CREATE INDEX IF NOT EXISTS idx_logs_level
            ON logs (level);

        CREATE INDEX IF NOT EXISTS idx_logs_created_at
            ON logs (created_at);

        CREATE TABLE IF NOT EXISTS users ( id TEXT PRIMARY KEY, username TEXT NOT NULL, discriminator TEXT, display_name TEXT, joined_at TEXT, created_at TEXT, updated_at TEXT NOT NULL DEFAULT (datetime('now')) );

        CREATE TABLE IF NOT EXISTS activity_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            type TEXT NOT NULL,
            user_id TEXT NOT NULL,  
            channel_id TEXT,
            session_id INTEGER,
            metadata TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        CREATE INDEX IF NOT EXISTS idx_activity_events_type
            ON activity_events (type);

        CREATE INDEX IF NOT EXISTS idx_activity_events_user
            ON activity_events (user_id);

        CREATE INDEX IF NOT EXISTS idx_sessions_channel_active
            ON sessions (channel_id, end_time);

        CREATE INDEX IF NOT EXISTS idx_voice_events_session
            ON voice_events (session_id);

        CREATE INDEX IF NOT EXISTS idx_activity_events_session
            ON activity_events (session_id);

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

        CREATE INDEX IF NOT EXISTS idx_attendance_summary_session
            ON attendance_summary (session_id);

        CREATE INDEX IF NOT EXISTS idx_attendance_summary_user
            ON attendance_summary (user_id);
    `);

    // Ensure columns exist for older databases that may lack them
    ensureColumn('sessions', 'duration_minutes INTEGER', 'duration_minutes');
    ensureColumn('sessions', 'auto_end_at TEXT', 'auto_end_at');
}

try {
    initializeSchema();
    console.log('[LOG] Database connected and tables ready.');
} catch (error) {
    console.error(`[ERROR] Database schema initialization failed: ${error.message}`);
}

module.exports = db;