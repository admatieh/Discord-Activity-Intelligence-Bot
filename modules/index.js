// modules/index.js
//
// Module registry. Initializes all domain modules by registering their
// event bus listeners. Called once during bot startup.
// ---------------------------------------------------------------------------

const attendanceService = require('./attendance/attendanceService');
const activityLogger = require('./activity/activityLogger');
const logger = require('../utils/logger');

let initialized = false;

function registerAll() {
    if (initialized) return;
    initialized = true;

    try {
        attendanceService.register();
        activityLogger.register();
        logger.log('All modules registered.');
    } catch (error) {
        logger.error(`Module registration error: ${error.message}`);
    }
}

module.exports = { registerAll };
