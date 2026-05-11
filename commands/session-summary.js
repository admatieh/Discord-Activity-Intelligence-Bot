const { sendResponse } = require('utils/responseHelper');
const { requireInstructor } = require('../utils/permissions');
// commands/session-summary.js

const sessionSummaryService = require('../modules/sessions/sessionSummaryService');
const sessionModel = require('../models/sessionModel');
const logger = require('../utils/logger');

module.exports = {
    name: 'session-summary',
    category: 'session',
    requiredPermission: 'instructor',
    aliases: ['summary'],
    description: 'Displays the attendance summary of a specific session.',
    usage: '!session-summary [--latest] [--id <number>] [--channel <mention>]',
    options: [
        { name: 'latest', type: 'boolean', required: false, description: 'Get the summary for the most recent session across all channels.' },
        { name: 'id', type: 'number', required: false, description: 'Get the summary for a specific session ID.' },
        { name: 'channel', type: 'channel', required: false, description: 'Get the most recent summary for a specific voice channel.' },
        { name: 'private', type: 'boolean', required: false, description: 'Send the response privately by DM' },
        { name: 'quiet', type: 'boolean', required: false, description: 'Only send a short confirmation' },
        { name: 'silent', type: 'boolean', required: false, description: 'Do not send a public response' }
    ],

    execute: async (message, _args, { parsed } = {}) => {
        const permission = await requireInstructor(message);
        if (!permission.allowed) return message.reply(permission.message);

        try {
            const options = parsed?.options || {};
            const { latest, id, channel } = options;

            let sessionId = null;

            if (id) {
                sessionId = parseInt(id, 10);
                if (isNaN(sessionId)) {
                    return sendResponse(message, '❌ Invalid session ID provided.', parsed?.options || {});
                }
            } else if (latest) {
                const sessions = sessionModel.getAllSessions();
                if (sessions.length > 0) {
                    sessionId = sessions[0].id;
                }
            } else if (channel) {
                const targetChannelId = typeof channel === 'object' ? channel.id : channel;
                const sessions = sessionModel.getAllSessions();
                const chanSession = sessions.find(s => s.channel_id === targetChannelId);
                if (chanSession) {
                    sessionId = chanSession.id;
                }
            } else {
                return sendResponse(message, '❌ Please specify how to find the session: `--latest`, `--id <number>`, or `--channel <mention>`.', parsed?.options || {});
            }

            if (!sessionId) {
                return sendResponse(message, '❌ No matching session found.', parsed?.options || {});
            }

            const session = sessionModel.getSessionById(sessionId);
            if (!session) {
                return sendResponse(message, `❌ Session #${sessionId} not found.`, parsed?.options || {});
            }

            if (!session.end_time) {
                return sendResponse(message, `⚠️ Session #${sessionId} is still active. End it first to view its summary.`, parsed?.options || {});
            }

            const summary = sessionSummaryService.getSessionSummary(sessionId);

            if (!summary || summary.totalUsers === 0) {
                return sendResponse(message, `📊 Session #${sessionId} has no attendance data.`, parsed?.options || {});
            }

            const formatted = sessionSummaryService.formatSummary(summary);

            return sendResponse(message, { content: formatted }, parsed?.options || {});
        } catch (error) {
            logger.error(`session-summary command error: ${error.message}`);
            return sendResponse(message, '❌ An error occurred while fetching the session summary.', parsed?.options || {});
        }
    }
};
