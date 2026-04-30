// events/ready.js
const sessionService = require('../modules/sessions/sessionService');
const userService = require('../modules/users/userService');
const modules = require('../modules');
const logger = require('../utils/logger');

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
    }
};