// dashboard/server/db/index.ts
// Shared SQLite database connection — READ-ONLY from dashboard side
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// DATABASE_PATH must be an absolute path in .env.local for Windows compatibility.
// Example: DATABASE_PATH=C:/Users/ADAM/Desktop/Discord-Activity-Intelligence-Bot/data.db
// Falls back to looking next to dashboard's parent directory.
function resolveDbPath(): string {
    const envPath = process.env.DATABASE_PATH;
    if (envPath) {
        // If it's already absolute, use it directly
        if (path.isAbsolute(envPath) || envPath.match(/^[A-Za-z]:/)) {
            return envPath.replace(/\//g, path.sep);
        }
        // Relative: resolve from project root (parent of dashboard)
        return path.resolve(process.cwd(), '..', envPath);
    }
    // Default: data.db next to project root
    return path.join(process.cwd(), '..', 'data.db');
}

const dbPath = resolveDbPath();
const dbExists = fs.existsSync(dbPath);

let db: Database.Database;

if (!dbExists) {
    console.error(`[Dashboard DB] ⚠ Database not found at: ${dbPath}`);
    console.error(`[Dashboard DB] Set DATABASE_PATH in dashboard/.env.local to the absolute path of data.db`);
    // In-memory fallback so Next.js doesn't crash at build time
    db = new Database(':memory:');
    // Create minimal schema so queries don't fail
    db.exec(`
        CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY, channel_id TEXT, triggered_by TEXT, start_time TEXT, end_time TEXT, duration_minutes INTEGER, auto_end_at TEXT);
        CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY, level TEXT, message TEXT, context TEXT, created_at TEXT);
        CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, username TEXT, discriminator TEXT, display_name TEXT, updated_at TEXT);
        CREATE TABLE IF NOT EXISTS voice_events (id INTEGER PRIMARY KEY, session_id INTEGER, user_id TEXT, join_time TEXT, leave_time TEXT);
        CREATE TABLE IF NOT EXISTS attendance_summary (id INTEGER PRIMARY KEY, session_id INTEGER, user_id TEXT, status TEXT, total_time_seconds INTEGER, created_at TEXT);
        CREATE TABLE IF NOT EXISTS participation_summary (id INTEGER PRIMARY KEY, session_id INTEGER, user_id TEXT, score INTEGER, label TEXT, created_at TEXT);
        CREATE TABLE IF NOT EXISTS activity_events (id INTEGER PRIMARY KEY, type TEXT, user_id TEXT, session_id INTEGER, created_at TEXT);
    `);
} else {
    try {
        db = new Database(dbPath, { readonly: true, fileMustExist: true });
        console.log(`[Dashboard DB] ✓ Connected (readonly): ${dbPath}`);
    } catch (error: any) {
        console.error(`[Dashboard DB] ✗ Failed to open: ${dbPath}`, error.message);
        db = new Database(':memory:');
    }
}

export { db, dbPath, dbExists };
