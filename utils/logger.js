// utils/logger.js
const logModel = require('../models/logModel');

/**
 * Centralized logger that writes to both console and the database logs table.
 * Every important action flows through here for auditability.
 */

function timestamp() {
    return new Date().toISOString();
}

function log(message, context = null) {
    console.log(`[${timestamp()}] [INFO]  ${message}`);
    logModel.insertLog('info', message, context);
}

function warn(message, context = null) {
    console.warn(`[${timestamp()}] [WARN]  ${message}`);
    logModel.insertLog('warn', message, context);
}

function error(message, context = null) {
    console.error(`[${timestamp()}] [ERROR] ${message}`);
    logModel.insertLog('error', message, context);
}

module.exports = { log, warn, error };