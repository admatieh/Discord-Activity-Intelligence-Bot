// models/participationSummaryModel.js
const db = require('../database/db');
const logger = require('../utils/logger');

/**
 * Insert multiple participation summary records at once.
 * @param {Array} records Array of objects containing session_id, user_id, score, speaking_score, interaction_score, attendance_score, label
 */
function insertMany(records) {
    if (!records || records.length === 0) return 0;

    try {
        const stmt = db.prepare(`
            INSERT INTO participation_summary 
            (session_id, user_id, score, speaking_score, interaction_score, attendance_score, label)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const transaction = db.transaction((rows) => {
            let count = 0;
            for (const row of rows) {
                stmt.run(
                    row.session_id, 
                    row.user_id, 
                    row.score, 
                    row.speaking_score, 
                    row.interaction_score, 
                    row.attendance_score, 
                    row.label
                );
                count++;
            }
            return count;
        });

        return transaction(records);
    } catch (error) {
        logger.error(`participationSummaryModel.insertMany error: ${error.message}`);
        return 0;
    }
}

/**
 * Get all participation summaries for a session.
 */
function getBySession(sessionId) {
    try {
        return db.prepare('SELECT * FROM participation_summary WHERE session_id = ?').all(sessionId);
    } catch (error) {
        logger.error(`participationSummaryModel.getBySession error: ${error.message}`);
        return [];
    }
}

/**
 * Get the participation summary for a specific user in a session.
 */
function getByUser(sessionId, userId) {
    try {
        return db.prepare('SELECT * FROM participation_summary WHERE session_id = ? AND user_id = ?').get(sessionId, userId) || null;
    } catch (error) {
        logger.error(`participationSummaryModel.getByUser error: ${error.message}`);
        return null;
    }
}

/**
 * Get top N participation summaries for a session.
 */
function getTop(sessionId, limit) {
    try {
        return db.prepare('SELECT * FROM participation_summary WHERE session_id = ? ORDER BY score DESC LIMIT ?').all(sessionId, limit);
    } catch (error) {
        logger.error(`participationSummaryModel.getTop error: ${error.message}`);
        return [];
    }
}

/**
 * Check if a session has already been finalized (scored).
 */
function isSessionFinalized(sessionId) {
    try {
        const row = db.prepare('SELECT 1 FROM participation_summary WHERE session_id = ? LIMIT 1').get(sessionId);
        return !!row;
    } catch (error) {
        logger.error(`participationSummaryModel.isSessionFinalized error: ${error.message}`);
        return false;
    }
}

module.exports = {
    insertMany,
    getBySession,
    getByUser,
    getTop,
    isSessionFinalized
};
