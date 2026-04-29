// services/userSync.js
//
// Syncs Discord guild members into the users table.
// Called on bot ready + member join/update events.
// ---------------------------------------------------------------------------

const userModel = require('../models/userModel');
const logger = require('../utils/logger');

/**
 * Sync all guild members into DB. Called once on ready.
 */
async function syncAllMembers(guild) {
    try {
        const members = await guild.members.fetch();
        let count = 0;

        for (const [, member] of members) {
            if (member.user.bot) continue;

            userModel.upsertUser({
                id: member.id,
                username: member.user.username,
                discriminator: member.user.discriminator || '0',
                displayName: member.displayName,
                joinedAt: member.joinedAt ? member.joinedAt.toISOString() : null,
                createdAt: member.user.createdAt ? member.user.createdAt.toISOString() : null
            });
            count++;
        }

        logger.log(`Synced ${count} members from guild "${guild.name}".`, { guildId: guild.id, count });
    } catch (error) {
        logger.error(`userSync.syncAllMembers error: ${error.message}`, { error: error.message });
    }
}

/**
 * Upsert a single member. Called on join/update events.
 */
function syncMember(member) {
    try {
        if (member.user.bot) return;

        userModel.upsertUser({
            id: member.id,
            username: member.user.username,
            discriminator: member.user.discriminator || '0',
            displayName: member.displayName,
            joinedAt: member.joinedAt ? member.joinedAt.toISOString() : null,
            createdAt: member.user.createdAt ? member.user.createdAt.toISOString() : null
        });
    } catch (error) {
        logger.error(`userSync.syncMember error: ${error.message}`, { memberId: member.id });
    }
}

module.exports = { syncAllMembers, syncMember };
