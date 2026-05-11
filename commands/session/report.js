const { sendResponse } = require('../../utils/responseHelper');
const { requireInstructor } = require('../../utils/permissions');
// commands/session/report.js
//
// Generate and view a session report.
// Usage:
//   !report                   -> latest completed session
//   !report --session 123     -> specific session
//   !report --session 123 --post -> specific session, and "post" it
// ---------------------------------------------------------------------------

const sessionModel = require('../../models/sessionModel');
const reportService = require('../../services/reportService');
const logger = require('../../utils/logger');
const db = require('../../database/db');

module.exports = {
    name: 'report',
    category: 'session',
    requiredPermission: 'instructor',
    aliases: ['session-report', 'generate-report'],
    description: 'Generate a report for a session.',
    usage: '!report [--session 12] [--private]',
    options: [
        { name: 'session', type: 'number', required: false, description: 'Session ID to generate a report for' },
        { name: 'post', type: 'boolean', required: false, description: 'Post the report to the current channel' },
        { name: 'private', type: 'boolean', required: false, description: 'Send the response privately by DM' },
        { name: 'quiet', type: 'boolean', required: false, description: 'Only send a short confirmation' },
        { name: 'silent', type: 'boolean', required: false, description: 'Do not send a public response' }
    ],
    async execute(message, _args, { parsed } = {}) {
        const permission = await requireInstructor(message);
        if (!permission.allowed) return message.reply(permission.message);

        if (!message.guild) return sendResponse(message, '❌ Server only.', parsed?.options || {});

        const options = parsed?.options || {};
        let sessionId = options.session ? Number(options.session) : null;

        // If no session provided, find the latest completed session
        if (!sessionId) {
            const allSessions = sessionModel.getAllSessions();
            const latestCompleted = allSessions.find(s => s.end_time !== null);
            if (!latestCompleted) {
                return sendResponse(message, '❌ No completed session exists to generate a report for.', parsed?.options || {});
            }
            sessionId = latestCompleted.id;
        } else {
            // Verify the session exists
            const session = sessionModel.getSessionById(sessionId);
            if (!session) {
                return sendResponse(message, `❌ Session #${sessionId} not found.`, parsed?.options || {});
            }
        }

        try {
            // Generate the report via the report service
            const result = await reportService.generateSessionReport(sessionId, {
                requestedBy: message.author.id
            });

            if (!result.ok) {
                return sendResponse(message, `❌ Error generating report: ${result.error}`, parsed?.options || {});
            }

            // Get the clean summary
            const formatted = reportService.formatReportForDiscord(result.report);

            if (options.post) {
                // Send normally to the channel (not as a reply) and log it in the DB
                const discordMsg = await message.channel.send(formatted.slice(0, 2000));
                try {
                    db.prepare(
                        `UPDATE session_reports SET posted_to_channel_id = ?, discord_message_id = ? WHERE session_id = ? ORDER BY id DESC LIMIT 1`
                    ).run(message.channel.id, discordMsg.id, sessionId);
                } catch (dbErr) {
                    logger.warn(`[ReportCommand] Could not update report post metadata: ${dbErr.message}`);
                }
                // If we successfully posted it, we don't need to reply directly
                // since the report is now right below the command in the same channel.
                return;
            } else {
                // Just reply to the user's message
                return message.reply(formatted.slice(0, 2000));
            }

        } catch (error) {
            logger.error(`report command error: ${error.message}`, { error: error.message });
            return sendResponse(message, '❌ An error occurred while generating the report.', parsed?.options || {});
        }
    }
};
