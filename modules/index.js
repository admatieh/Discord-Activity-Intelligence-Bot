// modules/index.js
//
// Module registry. Initializes all domain modules by registering their
// event bus listeners. Called once during bot startup.
// ---------------------------------------------------------------------------

const attendanceService = require('./attendance/attendanceService');
const sessionSummaryService = require('./sessions/sessionSummaryService');
const activityLogger = require('./activity/activityLogger');
const voiceActivityService = require('./activity/voiceActivityService');
const interactionService = require('./interaction/interactionService');
const participationService = require('./participation/participationService');
const logger = require('../utils/logger');

let initialized = false;

function registerAll() {
    if (initialized) return;
    initialized = true;

    try {
        attendanceService.register();
        sessionSummaryService.register();
        activityLogger.register();
        voiceActivityService.register();
        interactionService.register();
        participationService.register();
        logger.log('All modules registered.');
    } catch (error) {
        logger.error(`Module registration error: ${error.message}`);
    }
}

module.exports = { registerAll };
