// core/eventBus.js
//
// Lightweight internal event bus built on Node.js EventEmitter.
// All domain events flow through this single bus.
// Modules subscribe here — no direct coupling between producers and consumers.
// ---------------------------------------------------------------------------

const { EventEmitter } = require('events');

const eventBus = new EventEmitter();

// Prevent memory leak warnings for many listeners
eventBus.setMaxListeners(50);

// ---------------------------------------------------------------------------
// Event name constants
// ---------------------------------------------------------------------------

const Events = Object.freeze({
    VOICE_JOIN:      'VOICE_JOIN',
    VOICE_LEAVE:     'VOICE_LEAVE',
    VOICE_SWITCH:    'VOICE_SWITCH',
    SESSION_STARTED: 'SESSION_STARTED',
    SESSION_ENDED:   'SESSION_ENDED',
    ATTENDANCE_FINALIZED: 'ATTENDANCE_FINALIZED',
    SESSION_SUMMARY_READY: 'SESSION_SUMMARY_READY',
});

module.exports = { eventBus, Events };
