// modules/participation/participationAggregator.js
//
// Responsibilities:
//   - Aggregate all session data (attendance, voice, interactions) into a clean per-user structure.
//   - Read-only data compilation. Does not compute scores.
// ---------------------------------------------------------------------------

const sessionModel = require('../../models/sessionModel');
const attendanceSummaryModel = require('../../models/attendanceSummaryModel');
const voiceActivityModel = require('../../models/voiceActivityModel');
const activityEventModel = require('../activity/activityEventModel');
const logger = require('../../utils/logger');

/**
 * Aggregates all activity for a specific session into a unified per-user format.
 * @param {number|string} sessionId 
 * @returns {object|null} The aggregated data, or null if session not found.
 */
function aggregateSession(sessionId) {
    try {
        // Step 1 - Get Session
        const session = sessionModel.getSessionById(sessionId);
        if (!session) {
            logger.warn(`participationAggregator: Session #${sessionId} not found.`);
            return null;
        }

        const sessionStart = session.start_time ? new Date(session.start_time).getTime() : 0;
        const sessionEnd = session.end_time ? new Date(session.end_time).getTime() : Date.now();

        // Step 2 - Get Attendance Summary
        const attendance = attendanceSummaryModel.getBySession(sessionId);
        if (!attendance || attendance.length === 0) {
            return {
                sessionId,
                users: []
            };
        }

        // Step 3 - Build User Map
        const userMap = new Map();

        for (const record of attendance) {
            userMap.set(record.user_id, {
                userId: record.user_id,
                totalTimeSeconds: record.total_time_seconds,
                speakingTimeSeconds: 0,
                speakingSegments: 0,
                messageCount: 0,
                replyCount: 0,
                reactionCount: 0,
                status: record.status
            });
        }

        // Step 4 - Aggregate Speaking Data
        const intervals = voiceActivityModel.getIntervalsBySession(sessionId);
        for (const interval of intervals) {
            if (!userMap.has(interval.user_id)) continue;
            
            const startMs = new Date(interval.start_time).getTime();
            const endMs = interval.end_time ? new Date(interval.end_time).getTime() : sessionEnd;
            
            // Clamp to session boundaries
            const clampedStart = Math.max(startMs, sessionStart);
            const clampedEnd = Math.min(endMs, sessionEnd);
            
            const durationMs = clampedEnd - clampedStart;
            if (durationMs > 0) {
                const user = userMap.get(interval.user_id);
                user.speakingTimeSeconds += Math.round(durationMs / 1000);
                user.speakingSegments++;
            }
        }

        // Step 5 - Aggregate Interaction Data
        const events = activityEventModel.getEventsBySession(sessionId);
        for (const event of events) {
            if (!userMap.has(event.user_id)) continue;

            const user = userMap.get(event.user_id);

            switch (event.type) {
                case 'MESSAGE_CREATE':
                    user.messageCount++;
                    break;
                case 'MESSAGE_REPLY':
                    user.replyCount++;
                    break;
                case 'REACTION_ADD':
                    user.reactionCount++;
                    break;
            }
        }

        // Step 6 - Final Output
        return {
            sessionId,
            users: Array.from(userMap.values())
        };

    } catch (error) {
        logger.error(`participationAggregator.aggregateSession error: ${error.message}`);
        return null;
    }
}

module.exports = {
    aggregateSession
};
