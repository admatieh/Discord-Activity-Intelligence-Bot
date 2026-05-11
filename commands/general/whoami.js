module.exports = {
    name: 'whoami',
    description: 'Show your current role and permissions.',
    usage: '!whoami',
    category: 'general',
    requiredPermission: 'public',
    supportsDashboard: true,

    execute(message) {
        const member = message.member;
        const displayName = member?.displayName || message.author?.username || 'Unknown';
        const userId = message.author?.id || 'Unknown';
        const guildName = message.guild?.name || 'Unknown Server';
        const { checkInstructor, checkBotAdmin } = require('../../utils/permissions');
        const adminCheck = checkBotAdmin(member);
        const instructorCheck = checkInstructor(member);

        let role = 'Student';
        let access = 'You can view your own attendance and participation only.';

        if (adminCheck.allowed) {
            role = 'Admin';
            access = 'You have full access to all bot features and can manage instructors.';
        } else if (instructorCheck.allowed) {
            role = 'Instructor';
            access = 'You can record sessions, schedule sessions, send announcements, and view reports.';
        }

        const output = `👤 **You are ${displayName}**
**ID:** ${userId}
**Server:** ${guildName}
**Role:** ${role}
**Access:** ${access}`;

        return message.reply(output);
    }
};
