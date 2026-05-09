// models/logModel.js
const db = require('../database/db');

/**
 * Insert a log entry into the database.
 * Supports both legacy (level, message, context) and enhanced columns.
 *
 * @param {'info'|'warn'|'error'} level
 * @param {string} message
 * @param {object|string|null} context - Optional. Legacy context field.
 * @param {object} [extra] - Optional enhanced fields: { source, event, guildId, sessionId, userId, command, executionId, metadataJson }
 * @returns {boolean}
 */
function insertLog(level, message, context = null, extra = {}) {
    try {
        const contextStr = context && typeof context === 'object'
            ? JSON.stringify(context)
            : context;

        const {
            source = null,
            event = null,
            guildId = null,
            sessionId = null,
            userId = null,
            command = null,
            executionId = null,
            metadataJson = null
        } = extra || {};

        db.prepare(
            `INSERT INTO logs
                (level, message, context, source, event, guild_id, session_id, user_id, command, execution_id, metadata_json)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
            level,
            message,
            contextStr || null,
            source,
            event,
            guildId,
            sessionId || null,
            userId,
            command,
            executionId,
            metadataJson ? (typeof metadataJson === 'object' ? JSON.stringify(metadataJson) : metadataJson) : null
        );

        return true;
    } catch (error) {
        // Fallback to simple insert — never throw from the logger
        try {
            const contextStr = context && typeof context === 'object'
                ? JSON.stringify(context)
                : (context || null);
            db.prepare(`INSERT INTO logs (level, message, context) VALUES (?, ?, ?)`).run(level, message, contextStr);
            return true;
        } catch (fallbackErr) {
            console.error(`[LOG-MODEL] Failed to persist log: ${fallbackErr.message}`);
            return false;
        }
    }
}

/**
 * Get recent logs with optional filters.
 */
function getLogs(filters = {}) {
    try {
        let query = 'SELECT * FROM logs WHERE 1=1';
        const params = [];

        if (filters.level) { query += ' AND level = ?'; params.push(filters.level); }
        if (filters.source) { query += ' AND source = ?'; params.push(filters.source); }
        if (filters.sessionId) { query += ' AND session_id = ?'; params.push(filters.sessionId); }
        if (filters.guildId) { query += ' AND guild_id = ?'; params.push(filters.guildId); }

        query += ' ORDER BY created_at DESC';
        query += ` LIMIT ${Math.min(Number(filters.limit) || 100, 1000)}`;

        return db.prepare(query).all(...params);
    } catch (error) {
        console.error(`[LOG-MODEL] getLogs error: ${error.message}`);
        return [];
    }
}

module.exports = { insertLog, getLogs };
