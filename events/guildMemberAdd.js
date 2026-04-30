// events/guildMemberAdd.js
const userService = require('../modules/users/userService');

module.exports = {
    name: 'guildMemberAdd',
    execute(member) {
        userService.syncMember(member);
    }
};
