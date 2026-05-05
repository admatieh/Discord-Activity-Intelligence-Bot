// commands/session-summary.js

const sessionSummaryService = require('../modules/sessions/sessionSummaryService');
const sessionModel = require('../models/sessionModel');
const logger = require('../utils/logger');

module.exports = {
    name: 'session-summary',
    category: 'session',
    aliases: ['summary'],
    description: 'Displays the attendance summary of a specific session.',
    usage: '!session-summary [--latest] [--id <number>] [--channel <mention>]',
    options: [
        { name: 'latest', type: 'boolean', required: false, description: 'Get the summary for the most recent session across all channels.' },
        { name: 'id', type: 'number', required: false, description: 'Get the summary for a specific session ID.' },
        { name: 'channel', type: 'channel', required: false, description: 'Get the most recent summary for a specific voice channel.' }
    ],

    execute: async (message, _args, { parsed } = {}) => {
        try {
            const options = parsed?.options || {};
            const { latest, id, channel } = options;

            let sessionId = null;

            if (id) {
                sessionId = parseInt(id, 10);
                if (isNaN(sessionId)) {
                    return message.reply('❌ Invalid session ID provided.');
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
                return message.reply('❌ Please specify how to find the session: `--latest`, `--id <number>`, or `--channel <mention>`.');
            }

            if (!sessionId) {
                return message.reply('❌ No matching session found.');
            }

            const session = sessionModel.getSessionById(sessionId);
            if (!session) {
                return message.reply(`❌ Session #${sessionId} not found.`);
            }

            if (!session.end_time) {
                return message.reply(`⚠️ Session #${sessionId} is still active. End it first to view its summary.`);
            }

            const summary = sessionSummaryService.getSessionSummary(sessionId);
            
            if (!summary || summary.totalUsers === 0) {
                return message.reply(`📊 Session #${sessionId} has no attendance data.`);
            }
            
            const formatted = sessionSummaryService.formatSummary(summary);

            return message.reply({ content: formatted });
        } catch (error) {
            logger.error(`session-summary command error: ${error.message}`);
            return message.reply('❌ An error occurred while fetching the session summary.');
        }
    }
};
