// modules/sessions/sessionSummaryService.js

const sessionModel = require('../../models/sessionModel');
const attendanceSummaryModel = require('../../models/attendanceSummaryModel');
const logger = require('../../utils/logger');
const { eventBus, Events } = require('../../core/eventBus');
const { safeEmit } = require('../../utils/safeEmit');

let initialized = false;

function getSessionSummary(sessionId) {
    try {
        const session = sessionModel.getSessionById(sessionId);
        if (!session) {
            return null;
        }

        const records = attendanceSummaryModel.getBySession(sessionId);

        if (!records || records.length === 0) {
            return {
                sessionId: session.id,
                channelId: session.channel_id,
                durationMinutes: session.duration_minutes,
                totalUsers: 0,
                counts: { ON_TIME: 0, LATE: 0, LEFT_EARLY: 0, ABSENT: 0 },
                topAttendees: [],
                lateUsers: [],
                empty: true
            };
        }

        const summary = {
            sessionId: session.id,
            channelId: session.channel_id,
            durationMinutes: session.duration_minutes,
            totalUsers: records.length,
            counts: {
                ON_TIME: 0,
                LATE: 0,
                LEFT_EARLY: 0,
                ABSENT: 0
            },
            topAttendees: [],
            lateUsers: []
        };

        let activeRecords = [];

        for (const record of records) {
            summary.counts[record.status]++;
            
            if (record.status !== 'ABSENT') {
                activeRecords.push(record);
            }
            if (record.status === 'LATE') {
                summary.lateUsers.push(record.user_id);
            }
        }

        // Sort by total time descending for top attendees
        activeRecords.sort((a, b) => b.total_time_seconds - a.total_time_seconds);
        summary.topAttendees = activeRecords.slice(0, 5).map(r => ({
            userId: r.user_id,
            timeSeconds: r.total_time_seconds
        }));

        return summary;
    } catch (error) {
        logger.error(`sessionSummaryService.getSessionSummary error: ${error.message}`);
        return null;
    }
}

function formatSummary(summary) {
    if (!summary) {
        return '❌ No summary data available.';
    }

    if (summary.empty) {
        return '⚠️ No attendance data recorded for this session.';
    }

    let text = `📊 **Session Summary**\n`;
    text += `Channel: <#${summary.channelId}>\n`;
    text += `Duration: ${summary.durationMinutes} min\n\n`;

    text += `👥 Total: ${summary.totalUsers}\n`;
    text += `✅ On Time: ${summary.counts.ON_TIME}\n`;
    text += `⏰ Late: ${summary.counts.LATE}\n`;
    text += `🚪 Left Early: ${summary.counts.LEFT_EARLY}\n`;
    text += `❌ Absent: ${summary.counts.ABSENT}\n\n`;

    if (summary.topAttendees.length > 0) {
        text += `🏆 **Top Attendees:**\n`;
        for (const user of summary.topAttendees) {
            const mins = Math.round(user.timeSeconds / 60);
            text += `- <@${user.userId}> (${mins} min)\n`;
        }
        text += `\n`;
    }

    if (summary.lateUsers.length > 0) {
        text += `⏰ **Late Users:**\n`;
        for (const userId of summary.lateUsers) {
            text += `- <@${userId}>\n`;
        }
    }

    return text.trim();
}

function register() {
    if (initialized) return;
    initialized = true;

    eventBus.on(Events.ATTENDANCE_FINALIZED, (payload) => {
        try {
            const { sessionId } = payload;
            const summary = getSessionSummary(sessionId);
            if (summary) {
                logger.log(`Session Summary ready for session #${sessionId}.`);
                safeEmit(eventBus, Events.SESSION_SUMMARY_READY, { sessionId, summary });
            }
        } catch (err) {
            logger.error(`sessionSummaryService ATTENDANCE_FINALIZED listener crash: ${err.message}`);
        }
    });

    logger.log('SessionSummaryService registered on event bus.');
}

module.exports = {
    getSessionSummary,
    formatSummary,
    register
};
