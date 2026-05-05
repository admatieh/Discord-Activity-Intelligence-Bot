/**
 * Safe wrapper for event emission to prevent handler errors from crashing the process.
 * 
 * @param {Object} eventBus - The event emitter instance
 * @param {string} event - The event name
 * @param {any} payload - The event data
 */
function safeEmit(eventBus, event, payload) {
    try {
        eventBus.emit(event, payload);
    } catch (err) {
        console.error(`[EVENT EMIT ERROR] ${event}`, err);
    }
}

module.exports = { safeEmit };
