// events/messageReactionAdd.js
//
// Event routing ONLY.
// ---------------------------------------------------------------------------

const interactionService = require('../modules/interaction/interactionService');

module.exports = {
    name: 'messageReactionAdd',
    execute(reaction, user) {
        interactionService.handleReactionAdd(reaction, user);
    }
};
