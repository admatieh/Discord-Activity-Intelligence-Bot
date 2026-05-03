// events/ready.js
const sessionService = require('../modules/sessions/sessionService');
const userService = require('../modules/users/userService');
const modules = require('../modules');
const logger = require('../utils/logger');
const { eventBus, Events } = require('../core/eventBus');
const sessionSummaryService = require('../modules/sessions/sessionSummaryService');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        logger.log(`Logged in as ${client.user.tag}`);

        // Register all event bus listeners
        modules.registerAll();

        // Initialize sessions: close stale ones and restart timers
        sessionService.initSessions();

        // Sync all guild members into users table
        for (const [, guild] of client.guilds.cache) {
            await userService.syncAllMembers(guild);
        }

        const sentSummaries = new Set();

        // Auto-post summaries when ready
        eventBus.on(Events.SESSION_SUMMARY_READY, async ({ sessionId, summary }) => {
            try {
                if (sentSummaries.has(sessionId)) {
                    logger.warn(`Summary already sent for session #${sessionId}, skipping duplicate.`);
                    return;
                }
                sentSummaries.add(sessionId);

                const channel = client.channels.cache.get(summary.channelId) || 
                                await client.channels.fetch(summary.channelId).catch(() => null);
                
                if (!channel) {
                    logger.warn(`Could not fetch channel ${summary.channelId} for auto-summary of session #${sessionId}.`);
                    return;
                }

                if (channel.isTextBased()) {
                    const formatted = sessionSummaryService.formatSummary(summary);
                    await channel.send({ content: formatted });
                }
            } catch (err) {
                logger.error(`Error sending auto-summary for session #${sessionId}: ${err.message}`);
            }
        });
    }
};