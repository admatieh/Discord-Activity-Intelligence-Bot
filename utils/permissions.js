// utils/permissions.js
const { INSTRUCTOR_ROLE_NAME } = require('../config/roles');

/**
 * Check if a guild member has instructor or admin permissions.
 * @returns {{ allowed: boolean, message?: string }}
 */
function checkInstructor(member) {
    const hasRole = member.roles.cache.some(
        (role) => role.name === INSTRUCTOR_ROLE_NAME
    );
    const isAdmin = member.permissions.has('Administrator');

    if (!hasRole && !isAdmin) {
        return {
            allowed: false,
            message: `❌ You need the **${INSTRUCTOR_ROLE_NAME}** role or Administrator permission.`
        };
    }
    return { allowed: true };
}

module.exports = { checkInstructor };
