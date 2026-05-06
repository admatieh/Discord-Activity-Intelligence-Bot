// dashboard/server/db/index.ts
import Database from 'better-sqlite3';
import path from 'path';

// Use environment variable, fallback to root project data.db
const dbPath = process.env.DATABASE_PATH 
    ? path.resolve(process.cwd(), '..', process.env.DATABASE_PATH)
    : path.join(process.cwd(), '..', 'data.db');

// Important: Open in readonly mode to prevent Dashboard from writing to DB
// and to avoid SQLite lock contention.
let db: Database.Database;

try {
    db = new Database(dbPath, { readonly: true, fileMustExist: true });
} catch (error) {
    console.error('[Dashboard DB] Error opening database:', error);
    // Create an in-memory dummy database if actual file fails, just to prevent crash
    db = new Database(':memory:');
}

export { db };
