// models/sessionModel.js
const db = require('../database/db');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

function createSession({ channelId, triggeredBy, durationMinutes, autoEndAt, options }) {
    try {
        const optionsJson = options ? JSON.stringify(options) : null;
        const result = db.prepare(
            `INSERT INTO sessions (channel_id, triggered_by, duration_minutes, auto_end_at, options_json)
             VALUES (?, ?, ?, ?, ?)`
        ).run(channelId, triggeredBy, durationMinutes, autoEndAt, optionsJson);

        return Number(result.lastInsertRowid);
    } catch (error) {
        logger.error(`sessionModel.createSession error: ${error.message}`);
        return null;
    }
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

function getActiveSessionByChannel(channelId) {
    try {
        return db.prepare(
            `SELECT * FROM sessions
             WHERE channel_id = ?
               AND end_time IS NULL
             LIMIT 1`
        ).get(channelId) || null;
    } catch (error) {
        logger.error(`sessionModel.getActiveSessionByChannel error: ${error.message}`);
        return null;
    }
}

function getSessionById(sessionId) {
    try {
        return db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId) || null;
    } catch (error) {
        logger.error(`sessionModel.getSessionById error: ${error.message}`);
        return null;
    }
}

function getActiveSessions() {
    try {
        return db.prepare(
            `SELECT * FROM sessions
             WHERE end_time IS NULL
               AND auto_end_at IS NOT NULL`
        ).all();
    } catch (error) {
        logger.error(`sessionModel.getActiveSessions error: ${error.message}`);
        return [];
    }
}

function getExpiredSessions(currentTime) {
    try {
        return db.prepare(
            `SELECT * FROM sessions
             WHERE end_time IS NULL
               AND auto_end_at IS NOT NULL
               AND auto_end_at < ?`
        ).all(currentTime);
    } catch (error) {
        logger.error(`sessionModel.getExpiredSessions error: ${error.message}`);
        return [];
    }
}

function getAllSessions() {
    try {
        return db.prepare(
            'SELECT * FROM sessions ORDER BY start_time DESC'
        ).all();
    } catch (error) {
        logger.error(`sessionModel.getAllSessions error: ${error.message}`);
        return [];
    }
}

// ---------------------------------------------------------------------------
// Update
// ---------------------------------------------------------------------------

function endSession(sessionId) {
    try {
        const result = db.prepare(
            "UPDATE sessions SET end_time = datetime('now') WHERE id = ? AND end_time IS NULL"
        ).run(sessionId);

        return result.changes > 0;
    } catch (error) {
        logger.error(`sessionModel.endSession error: ${error.message}`);
        return false;
    }
}

function updateChannelId(sessionId, newChannelId) {
    try {
        const result = db.prepare(
            'UPDATE sessions SET channel_id = ? WHERE id = ? AND end_time IS NULL'
        ).run(newChannelId, sessionId);

        return result.changes > 0;
    } catch (error) {
        logger.error(`sessionModel.updateChannelId error: ${error.message}`);
        return false;
    }
}

module.exports = {
    createSession,
    getActiveSessionByChannel,
    getSessionById,
    getActiveSessions,
    getExpiredSessions,
    getAllSessions,
    endSession,
    updateChannelId
};