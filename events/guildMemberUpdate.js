// events/guildMemberUpdate.js
const userService = require('../modules/users/userService');

module.exports = {
    name: 'guildMemberUpdate',
    execute(oldMember, newMember) {
        userService.syncMember(newMember);
    }
};
