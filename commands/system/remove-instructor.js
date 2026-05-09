const { checkBotAdmin, getInstructorRole } = require('../../utils/permissions');
const { resolveUserContext } = require('../../utils/commandResolver');
const logger = require('../../utils/logger');

module.exports = {
    name: 'remove-instructor',
    description: 'Remove the Instructor role from a user.',
    usage: '!remove-instructor @User',
    aliases: ['instructor-remove', 'revoke-instructor'],
    category: 'admin',
    requiredPermission: 'admin',
    supportsDashboard: true,
    options: [
        { name: 'user', type: 'string', required: true, description: 'User mention or ID' }
    ],

    async execute(message, args, { parsed } = {}) {
        try {
            if (!message.guild) return message.reply('❌ Server only.');

            const perm = checkBotAdmin(message.member);
            if (!perm.allowed) return message.reply(perm.message);

            const options = parsed?.options || args || {};
            const userCtx = resolveUserContext(message, options);

            if (userCtx.error) {
                return message.reply('❌ Please mention a user. Example: `!remove-instructor @User`');
            }

            let targetMember;
            try {
                targetMember = await message.guild.members.fetch(userCtx.userId);
            } catch (err) {
                return message.reply('❌ I couldn\'t find that user in this server.');
            }

            const roleResult = getInstructorRole(message.guild);
            if (typeof roleResult === 'string') {
                return message.reply(roleResult); // Error message
            }
            const instructorRole = roleResult;

            if (!targetMember.roles.cache.has(instructorRole.id)) {
                return message.reply(`ℹ️ <@${targetMember.id}> is not currently an instructor.`);
            }

            // Check bot permissions
            if (!message.guild.members.me.permissions.has('ManageRoles')) {
                return message.reply('❌ I need the Manage Roles permission to remove instructor roles.');
            }

            if (message.guild.members.me.roles.highest.position <= instructorRole.position) {
                return message.reply('❌ I cannot remove that role because it is above or equal to my bot role.');
            }

            await targetMember.roles.remove(instructorRole);
            logger.log(`Instructor role revoked from ${targetMember.user.tag} by ${message.author?.tag || 'Admin'}`);

            return message.reply(`✅ Instructor access removed from <@${targetMember.id}>.`);
        } catch (error) {
            logger.error(`remove-instructor error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred while removing instructor.');
        }
    }
};
