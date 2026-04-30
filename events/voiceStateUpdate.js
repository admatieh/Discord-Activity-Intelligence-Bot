// events/voiceStateUpdate.js
//
// Event routing ONLY — delegates to voiceHandler module.
// No business logic here.
// ---------------------------------------------------------------------------

const { handleVoiceStateUpdate } = require('../modules/voice/voiceHandler');

module.exports = {
    name: 'voiceStateUpdate',
    execute(oldState, newState) {
        handleVoiceStateUpdate(oldState, newState);
    }
};
