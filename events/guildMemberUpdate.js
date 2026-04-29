// events/guildMemberUpdate.js
const userSync = require('../services/userSync');

module.exports = {
    name: 'guildMemberUpdate',
    execute(oldMember, newMember) {
        userSync.syncMember(newMember);
    }
};
