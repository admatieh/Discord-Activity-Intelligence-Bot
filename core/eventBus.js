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
    VOICE_MUTE:      'VOICE_MUTE',
    VOICE_UNMUTE:    'VOICE_UNMUTE',
    MESSAGE_CREATE:  'MESSAGE_CREATE',
    MESSAGE_REPLY:   'MESSAGE_REPLY',
    REACTION_ADD:    'REACTION_ADD',
    SESSION_STARTED: 'SESSION_STARTED',
    SESSION_ENDED:   'SESSION_ENDED',
    ATTENDANCE_FINALIZED: 'ATTENDANCE_FINALIZED',
    PARTICIPATION_FINALIZED: 'PARTICIPATION_FINALIZED',
    SESSION_SUMMARY_READY: 'SESSION_SUMMARY_READY',
});

module.exports = { eventBus, Events };
