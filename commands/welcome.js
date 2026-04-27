module.exports = {
    name: 'welcome',
    execute(message) {
        if (!message.guild) {
            return message.reply('❌ This command can only be used inside a server channel.');
        }

        const channelName = message.channel.name;
        const roleName = 'Students';

        return message.reply(`Welcome everyone in ${channelName}! Don't forget to mute your microphone when you're not speaking. ${roleName} will be used to track attendance.`);
    }
};