// utils/permissions.js

const { INSTRUCTOR_ROLE_NAME } = require('../config/roles');

const INSTRUCTOR_ROLE_IDS = (process.env.INSTRUCTOR_ROLE_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

const BOT_ADMIN_USER_IDS = (process.env.BOT_ADMIN_USER_IDS || '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);

function hasAnyRoleId(member, roleIds) {
    if (!roleIds.length) return false;
    const cache = member?.roles?.cache;
    return roleIds.some((roleId) => roleCacheHas(cache, roleId));
}

function hasRoleName(member, roleName) {
    if (!roleName) return false;
    const cache = member?.roles?.cache;
    return roleCacheSome(cache, (role) => role?.name === roleName);
}

function roleCacheHas(cache, roleId) {
    if (!cache || !roleId) return false;
    try {
        if (typeof cache.has === 'function') return cache.has(roleId);
        if (typeof cache.get === 'function') return Boolean(cache.get(roleId));
        if (Array.isArray(cache)) return cache.some((role) => role?.id === roleId);
        if (typeof cache === 'object') return Boolean(cache[roleId]);
    } catch (_) {}
    return false;
}

function roleCacheSome(cache, predicate) {
    if (!cache) return false;
    try {
        if (typeof cache.some === 'function') return cache.some(predicate);
        if (typeof cache.values === 'function') return Array.from(cache.values()).some(predicate);
        if (Array.isArray(cache)) return cache.some(predicate);
        if (typeof cache === 'object') return Object.values(cache).some(predicate);
    } catch (_) {}
    return false;
}

/**
 * Check if a guild member can use instructor/admin commands.
 * In this project, instructors are treated the same as admins for bot actions.
 *
 * @returns {{ allowed: boolean, reason?: string, message?: string, role?: string }}
 */
function checkInstructor(member) {
    if (!member) {
        return {
            allowed: false,
            reason: 'missing_member',
            message: '❌ I could not verify your server role. Please run this command inside the Discord server.'
        };
    }

    const userId = member.user?.id || member.id;

    const isBotAdminUser = BOT_ADMIN_USER_IDS.includes(userId);
    const isDiscordAdmin = member.permissions?.has?.('Administrator') === true;
    const hasInstructorRoleId = hasAnyRoleId(member, INSTRUCTOR_ROLE_IDS);
    const hasInstructorRoleName = hasRoleName(member, INSTRUCTOR_ROLE_NAME);

    if (isBotAdminUser || isDiscordAdmin || hasInstructorRoleId || hasInstructorRoleName) {
        return {
            allowed: true,
            role: isDiscordAdmin || isBotAdminUser ? 'admin' : 'instructor'
        };
    }

    return {
        allowed: false,
        reason: 'missing_instructor_permission',
        message:
            `❌ You need the **${INSTRUCTOR_ROLE_NAME}** role or Administrator permission to use this command.`
    };
}

/**
 * Check if a guild member is a Bot Admin (Discord Admin or in BOT_ADMIN_USER_IDS).
 *
 * @returns {{ allowed: boolean, reason?: string, message?: string }}
 */
function checkBotAdmin(member) {
    if (!member) {
        return {
            allowed: false,
            reason: 'missing_member',
            message: '❌ I could not verify your server role. Please run this command inside the Discord server.'
        };
    }

    const userId = member.user?.id || member.id;
    const isBotAdminUser = BOT_ADMIN_USER_IDS.includes(userId);
    const isDiscordAdmin = member.permissions?.has?.('Administrator') === true;

    if (isBotAdminUser || isDiscordAdmin) {
        return { allowed: true, role: 'admin' };
    }

    return {
        allowed: false,
        reason: 'missing_admin_permission',
        message: '❌ You must be a Discord Administrator or Bot Admin to use this command.'
    };
}

/**
 * Use this for student-safe/public commands.
 */
function checkPublic() {
    return { allowed: true, role: 'public' };
}

/**
 * Helper to resolve the configured Instructor role.
 * 
 * @param {import('discord.js').Guild} guild 
 * @returns {import('discord.js').Role | null | string} Error string or Role object
 */
function getInstructorRole(guild) {
    if (!guild || !guild.roles) return '❌ Guild not found or invalid.';

    // Check by configured IDs first
    for (const roleId of INSTRUCTOR_ROLE_IDS) {
        const role = guild.roles.cache.get(roleId);
        if (role) return role;
    }

    // Fallback to name
    const roleByName = guild.roles.cache.find(r => r.name === INSTRUCTOR_ROLE_NAME);
    if (roleByName) return roleByName;

    return `❌ Instructor role not found. Please create a role named "${INSTRUCTOR_ROLE_NAME}" or set INSTRUCTOR_ROLE_IDS.`;
}

async function requireInstructor(message) {
    let member = message.member;
    try {
        if (message.guild && message.author?.id && !member) {
            member = await message.guild.members.fetch(message.author.id);
        }
    } catch (_) {}
    return checkInstructor(member);
}

async function requireBotAdmin(message) {
    let member = message.member;
    try {
        if (message.guild && message.author?.id && !member) {
            member = await message.guild.members.fetch(message.author.id);
        }
    } catch (_) {}
    return checkBotAdmin(member);
}

module.exports = {
    checkInstructor,
    checkBotAdmin,
    checkPublic,
    getInstructorRole,
    requireInstructor,
    requireBotAdmin
};