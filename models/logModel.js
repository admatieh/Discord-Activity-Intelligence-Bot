// models/logModel.js
const db = require('../database/db');

/**
 * Insert a log entry into the database.
 * @param {'info'|'warn'|'error'} level
 * @param {string} message
 * @param {object|string|null} context - Optional context (will be JSON-stringified if object)
 * @returns {boolean}
 */
function insertLog(level, message, context = null) {
    try {
        const contextStr = context && typeof context === 'object'
            ? JSON.stringify(context)
            : context;

        db.prepare(
            `INSERT INTO logs (level, message, context) VALUES (?, ?, ?)`
        ).run(level, message, contextStr || null);

        return true;
    } catch (error) {
        // Fallback to console — never throw from the logger
        console.error(`[LOG-MODEL] Failed to persist log: ${error.message}`);
        return false;
    }
}

module.exports = { insertLog };
