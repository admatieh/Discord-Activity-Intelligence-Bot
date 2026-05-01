// models/attendanceSummaryModel.js
//
// Data access for the attendance_summary table.
// Stores finalized attendance classification results per session.
// ---------------------------------------------------------------------------

const db = require('../database/db');
const logger = require('../utils/logger');

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

/**
 * Insert a single attendance summary record.
 * @param {Object} record
 * @param {number} record.session_id
 * @param {string} record.user_id
 * @param {string} record.status   - ON_TIME | LATE | LEFT_EARLY | ABSENT
 * @param {number} record.total_time_seconds
 * @param {string|null} record.first_join_time
 * @param {string|null} record.last_leave_time
 * @returns {number|null} The new row id, or null on failure.
 */
function insertSummary(record) {
    try {
        const result = db.prepare(
            `INSERT INTO attendance_summary
                (session_id, user_id, status, total_time_seconds, first_join_time, last_leave_time)
             VALUES (?, ?, ?, ?, ?, ?)`
        ).run(
            record.session_id,
            record.user_id,
            record.status,
            record.total_time_seconds,
            record.first_join_time ?? null,
            record.last_leave_time ?? null
        );

        return Number(result.lastInsertRowid);
    } catch (error) {
        logger.error(`attendanceSummaryModel.insertSummary error: ${error.message}`);
        return null;
    }
}

/**
 * Insert multiple attendance summary records in a single transaction.
 * @param {Object[]} records - Array of record objects (same shape as insertSummary).
 * @returns {number} Number of records successfully inserted.
 */
function insertMany(records) {
    const insert = db.prepare(
        `INSERT INTO attendance_summary
            (session_id, user_id, status, total_time_seconds, first_join_time, last_leave_time)
         VALUES (?, ?, ?, ?, ?, ?)`
    );

    let count = 0;

    const runAll = db.transaction((rows) => {
        for (const r of rows) {
            try {
                insert.run(
                    r.session_id,
                    r.user_id,
                    r.status,
                    r.total_time_seconds,
                    r.first_join_time ?? null,
                    r.last_leave_time ?? null
                );
                count++;
            } catch (error) {
                logger.error(`attendanceSummaryModel.insertMany row error: ${error.message}`, {
                    session_id: r.session_id,
                    user_id: r.user_id
                });
            }
        }
    });

    try {
        runAll(records);
    } catch (error) {
        logger.error(`attendanceSummaryModel.insertMany transaction error: ${error.message}`);
    }

    return count;
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * Get all attendance summaries for a session.
 * @param {number} sessionId
 * @returns {Object[]}
 */
function getBySession(sessionId) {
    try {
        return db.prepare(
            `SELECT * FROM attendance_summary
             WHERE session_id = ?
             ORDER BY status ASC, user_id ASC`
        ).all(sessionId);
    } catch (error) {
        logger.error(`attendanceSummaryModel.getBySession error: ${error.message}`);
        return [];
    }
}

/**
 * Get all attendance summaries for a specific user.
 * @param {string} userId
 * @returns {Object[]}
 */
function getByUser(userId) {
    try {
        return db.prepare(
            `SELECT * FROM attendance_summary
             WHERE user_id = ?
             ORDER BY created_at DESC`
        ).all(userId);
    } catch (error) {
        logger.error(`attendanceSummaryModel.getByUser error: ${error.message}`);
        return [];
    }
}

/**
 * Check if a session has already been finalized.
 * @param {number} sessionId
 * @returns {boolean}
 */
function isSessionFinalized(sessionId) {
    try {
        const row = db.prepare(
            'SELECT COUNT(*) as count FROM attendance_summary WHERE session_id = ?'
        ).get(sessionId);
        return row ? row.count > 0 : false;
    } catch (error) {
        logger.error(`attendanceSummaryModel.isSessionFinalized error: ${error.message}`);
        return false;
    }
}

module.exports = {
    insertSummary,
    insertMany,
    getBySession,
    getByUser,
    isSessionFinalized
};
