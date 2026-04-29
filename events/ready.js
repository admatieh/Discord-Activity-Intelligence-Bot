// events/ready.js
const sessionManager = require('../services/sessionManager');
const userSync = require('../services/userSync');
const logger = require('../utils/logger');

module.exports = {
    name: 'ready',
    once: true,
    async execute(client) {
        logger.log(`Logged in as ${client.user.tag}`);

        // Initialize sessions: close stale ones and restart timers
        sessionManager.initSessions();

        // Sync all guild members into users table
        for (const [, guild] of client.guilds.cache) {
            await userSync.syncAllMembers(guild);
        }
    }
};