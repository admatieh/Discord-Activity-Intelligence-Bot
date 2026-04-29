// events/guildMemberAdd.js
const userSync = require('../services/userSync');

module.exports = {
    name: 'guildMemberAdd',
    execute(member) {
        userSync.syncMember(member);
    }
};
