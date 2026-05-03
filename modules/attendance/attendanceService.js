// modules/attendance/attendanceService.js
//
// Responsibilities (ONLY):
//   - Record attendance (unique users) on VOICE_JOIN
//   - Record voice event intervals (join/leave)
//   - Trigger empty-channel grace when channel empties
//
// Listens to: VOICE_JOIN, VOICE_LEAVE
// Does NOT manage sessions. Uses sessionService only to check active state.
// All DB access goes through models.
// ---------------------------------------------------------------------------

const sessionService = require('../sessions/sessionService');
const sessionModel = require('../../models/sessionModel');
const attendanceModel = require('../../models/attendanceModel');
const voiceEventModel = require('../../models/voiceEventModel');
const attendanceSummaryModel = require('../../models/attendanceSummaryModel');
const logger = require('../../utils/logger');
const { ATTENDANCE } = require('../../config/constants');
const { eventBus, Events } = require('../../core/eventBus');

let initialized = false;

// ---------------------------------------------------------------------------
// Event handlers
// ---------------------------------------------------------------------------

function onVoiceJoin({ userId, channelId, timestamp }) {
    try {
        if (!sessionService.isSessionActive(channelId)) return;

        const sessionId = sessionService.getSessionId(channelId);
        if (!sessionId) return;

        // Cancel empty-channel grace if someone rejoined
        sessionService.cancelEmptyGrace(channelId);

        const now = timestamp || new Date().toISOString();

        // Register as attendee (idempotent)
        attendanceModel.addAttendee(sessionId, userId);

        // Prevent duplicate open events if user spams join
        const openEvent = voiceEventModel.getOpenEvent(sessionId, userId);
        if (openEvent) {
            return;
        }

        // Open a new voice event interval
        voiceEventModel.createJoinEvent(sessionId, userId, now);

        logger.log(`User ${userId} joined tracked channel ${channelId} (session #${sessionId}).`, {
            event: 'voice_join',
            userId,
            channelId,
            sessionId
        });
    } catch (error) {
        logger.error(`attendanceService.onVoiceJoin error: ${error.message}`, {
            userId,
            channelId,
            error: error.message
        });
    }
}

function onVoiceLeave({ userId, channelId, timestamp, remainingMembers }) {
    try {
        if (!sessionService.isSessionActive(channelId)) return;

        const sessionId = sessionService.getSessionId(channelId);
        if (!sessionId) return;

        const now = timestamp || new Date().toISOString();

        const closed = voiceEventModel.closeOpenEvent(sessionId, userId, now);

        if (closed) {
            logger.log(`User ${userId} left tracked channel ${channelId} (session #${sessionId}).`, {
                event: 'voice_leave',
                userId,
                channelId,
                sessionId
            });
        }

        // If channel is now empty, start grace timer
        if (typeof remainingMembers === 'number' && remainingMembers === 0) {
            sessionService.startEmptyGrace(channelId);
        }
    } catch (error) {
        logger.error(`attendanceService.onVoiceLeave error: ${error.message}`, {
            userId,
            channelId,
            error: error.message
        });
    }
}

// ---------------------------------------------------------------------------
// Finalization
// ---------------------------------------------------------------------------

function finalizeSessionAttendance(sessionId) {
    try {
        if (attendanceSummaryModel.isSessionFinalized(sessionId)) {
            logger.log(`Session #${sessionId} is already finalized.`);
            return;
        }

        const session = sessionModel.getSessionById(sessionId);
        if (!session || !session.end_time) {
            logger.warn(`Cannot finalize session #${sessionId}: Not found or not ended.`);
            return;
        }

        const parseDbDate = (dateStr) => {
            if (!dateStr) return null;
            return new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z').getTime();
        };

        const sessionStart = parseDbDate(session.start_time);
        const sessionEnd = parseDbDate(session.end_time);
        const sessionDurationSeconds = Math.max(0, (sessionEnd - sessionStart) / 1000);

        const attendees = attendanceModel.getAttendeesBySession(sessionId);
        const summaries = [];

        for (const attendee of attendees) {
            const userId = attendee.user_id;
            const events = voiceEventModel.getEventsBySessionAndUser(sessionId, userId);

            let totalTimeSeconds = 0;
            let firstJoinTimeStr = null;
            let lastLeaveTimeStr = null;
            let firstJoinTimeMs = null;
            let lastLeaveTimeMs = null;

            let intervals = [];

            for (const event of events) {
                const joinTime = parseDbDate(event.join_time);
                const leaveTime = event.leave_time ? parseDbDate(event.leave_time) : sessionEnd;

                if (!firstJoinTimeMs || joinTime < firstJoinTimeMs) {
                    firstJoinTimeMs = joinTime;
                    firstJoinTimeStr = event.join_time;
                }
                if (!lastLeaveTimeMs || leaveTime > lastLeaveTimeMs) {
                    lastLeaveTimeMs = leaveTime;
                    lastLeaveTimeStr = event.leave_time || session.end_time;
                }

                if (joinTime && leaveTime && leaveTime > joinTime) {
                    // Clip intervals to session boundaries just to be perfectly safe
                    const safeStart = Math.max(joinTime, sessionStart);
                    const safeEnd = Math.min(leaveTime, sessionEnd);
                    if (safeEnd > safeStart) {
                        intervals.push({ start: safeStart, end: safeEnd });
                    }
                }
            }

            // Merge overlapping intervals to handle out-of-order or duplicate events
            intervals.sort((a, b) => a.start - b.start);
            let mergedIntervals = [];
            if (intervals.length > 0) {
                let current = intervals[0];
                for (let i = 1; i < intervals.length; i++) {
                    if (intervals[i].start <= current.end) {
                        current.end = Math.max(current.end, intervals[i].end);
                    } else {
                        mergedIntervals.push(current);
                        current = intervals[i];
                    }
                }
                mergedIntervals.push(current);
            }

            for (const inv of mergedIntervals) {
                totalTimeSeconds += (inv.end - inv.start) / 1000;
            }

            let status = 'ON_TIME';

            if (totalTimeSeconds === 0 || totalTimeSeconds < (ATTENDANCE.MIN_ATTENDANCE_RATIO * sessionDurationSeconds)) {
                status = 'ABSENT';
            } else {
                if (firstJoinTimeMs > sessionStart + (ATTENDANCE.LATE_THRESHOLD_MIN * 60 * 1000)) {
                    status = 'LATE';
                }
                if (lastLeaveTimeMs < sessionEnd) {
                    status = 'LEFT_EARLY';
                }
            }

            summaries.push({
                session_id: sessionId,
                user_id: userId,
                status,
                total_time_seconds: Math.round(totalTimeSeconds),
                first_join_time: firstJoinTimeStr,
                last_leave_time: lastLeaveTimeStr
            });
        }

        const insertedCount = attendanceSummaryModel.insertMany(summaries);
        logger.log(`Finalized attendance for session #${sessionId}. Processed ${insertedCount} users.`);
        
        if (insertedCount > 0) {
            // Emit event to trigger summary generation
            eventBus.emit(Events.ATTENDANCE_FINALIZED, { sessionId });
        } else {
            logger.warn(`No attendance data generated for session #${sessionId}, skipping summary event.`);
        }
    } catch (error) {
        logger.error(`attendanceService.finalizeSessionAttendance error: ${error.message}`, {
            sessionId,
            error: error.message
        });
    }
}

function getSessionAttendanceSummary(sessionId) {
    try {
        const records = attendanceSummaryModel.getBySession(sessionId);
        const summary = {
            totalUsers: records.length,
            counts: {
                ON_TIME: 0,
                LATE: 0,
                LEFT_EARLY: 0,
                ABSENT: 0
            },
            users: []
        };

        for (const record of records) {
            summary.counts[record.status]++;
            summary.users.push({
                userId: record.user_id,
                status: record.status,
                totalTimeSeconds: record.total_time_seconds,
                firstJoinTime: record.first_join_time,
                lastLeaveTime: record.last_leave_time
            });
        }

        return summary;
    } catch (error) {
        logger.error(`attendanceService.getSessionAttendanceSummary error: ${error.message}`);
        return null;
    }
}

// ---------------------------------------------------------------------------
// Register listeners (once only)
// ---------------------------------------------------------------------------

function register() {
    if (initialized) return;
    initialized = true;

    eventBus.on(Events.VOICE_JOIN, (payload) => {
        try { onVoiceJoin(payload); } catch (err) {
            logger.error(`attendanceService VOICE_JOIN listener crash: ${err.message}`);
        }
    });

    eventBus.on(Events.VOICE_LEAVE, (payload) => {
        try { onVoiceLeave(payload); } catch (err) {
            logger.error(`attendanceService VOICE_LEAVE listener crash: ${err.message}`);
        }
    });

    eventBus.on(Events.SESSION_ENDED, (payload) => {
        try { 
            const { sessionId } = payload;
            if (sessionId) finalizeSessionAttendance(sessionId);
        } catch (err) {
            logger.error(`attendanceService SESSION_ENDED listener crash: ${err.message}`);
        }
    });

    logger.log('AttendanceService registered on event bus.');
}

module.exports = { 
    register,
    finalizeSessionAttendance,
    getSessionAttendanceSummary
};
