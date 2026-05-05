// modules/participation/participationService.js
//
// Responsibilities:
//   - Compute participation scores for users based on aggregated data.
//   - Store results in the database.
//   - Listen to ATTENDANCE_FINALIZED and emit PARTICIPATION_FINALIZED.
// ---------------------------------------------------------------------------

const { eventBus, Events } = require('../../core/eventBus');
const { safeEmit } = require('../../utils/safeEmit');
const sessionModel = require('../../models/sessionModel');
const participationSummaryModel = require('../../models/participationSummaryModel');
const { aggregateSession } = require('./participationAggregator');
const logger = require('../../utils/logger');

let initialized = false;

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function getLabel(score) {
    if (score >= 80) return "HIGHLY_ACTIVE";
    if (score >= 60) return "ACTIVE";
    if (score >= 40) return "MODERATE";
    if (score >= 1) return "LOW";
    return "INACTIVE";
}

function computeScores(sessionId) {
    try {
        if (participationSummaryModel.isSessionFinalized(sessionId)) {
            logger.log(`Session #${sessionId} participation is already finalized.`);
            return;
        }

        const data = aggregateSession(sessionId);
        if (!data || !data.users || data.users.length === 0) {
            logger.warn(`participationService: No data to aggregate for session #${sessionId}`);
            return;
        }

        const session = sessionModel.getSessionById(sessionId);
        if (!session) {
            logger.warn(`participationService: Session #${sessionId} not found in DB.`);
            return;
        }

        const sessionStart = session.start_time ? new Date(session.start_time).getTime() : 0;
        const sessionEnd = session.end_time ? new Date(session.end_time).getTime() : Date.now();
        const sessionDurationSeconds = Math.max(1, (sessionEnd - sessionStart) / 1000); // Prevent division by 0

        const records = [];

        for (const user of data.users) {
            // 1. Speaking Score (0–50)
            const speakingRatio = user.speakingTimeSeconds / sessionDurationSeconds;
            let speakingScore = speakingRatio * 50;
            speakingScore = clamp(speakingScore, 0, 50);

            if (user.speakingSegments >= 3) {
                speakingScore += 5;
            }
            speakingScore = clamp(speakingScore, 0, 50);

            // 2. Interaction Score (0–30)
            let interactionRaw = (user.messageCount * 2) + (user.replyCount * 3) + (user.reactionCount * 1);
            let interactionScore = clamp(interactionRaw, 0, 30);

            // 3. Attendance Score (0–20)
            let attendanceScore = 0;
            switch (user.status) {
                case 'ON_TIME': attendanceScore = 20; break;
                case 'LATE': attendanceScore = 12; break;
                case 'LEFT_EARLY': attendanceScore = 8; break;
                case 'ABSENT': attendanceScore = 0; break;
            }

            // 4. Final Score
            const totalScore = clamp(Math.round(speakingScore + interactionScore + attendanceScore), 0, 100);
            
            records.push({
                session_id: sessionId,
                user_id: user.userId,
                score: totalScore,
                speaking_score: Math.round(speakingScore),
                interaction_score: interactionScore,
                attendance_score: attendanceScore,
                label: getLabel(totalScore)
            });
        }

        const insertedCount = participationSummaryModel.insertMany(records);
        logger.log(`Finalized participation for session #${sessionId}. Processed ${insertedCount} users.`);

        if (insertedCount > 0) {
            safeEmit(eventBus, Events.PARTICIPATION_FINALIZED, { sessionId });
        }
    } catch (error) {
        logger.error(`participationService.computeScores error: ${error.message}`);
    }
}

function register() {
    if (initialized) return;
    initialized = true;

    eventBus.on(Events.ATTENDANCE_FINALIZED, (payload) => {
        try {
            const { sessionId } = payload;
            if (sessionId) computeScores(sessionId);
        } catch (err) {
            logger.error(`participationService ATTENDANCE_FINALIZED listener crash: ${err.message}`);
        }
    });

    logger.log('ParticipationService registered on event bus.');
}

module.exports = {
    register,
    computeScores
};
