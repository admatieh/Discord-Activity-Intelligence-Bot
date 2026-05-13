// config/studentRoleConfig.js
//
// Student role configuration for automatic roster sync.
// Reads from env:
//   STUDENT_ROLE_NAME  — role name to match (default "Student")
//   STUDENT_ROLE_IDS   — comma-separated role IDs (preferred if set)
//
// Usage:
//   const { hasStudentRole, getStudentRole } = require('./config/studentRoleConfig')

const STUDENT_ROLE_NAME = (process.env.STUDENT_ROLE_NAME || 'Student').trim()
const STUDENT_ROLE_IDS = (process.env.STUDENT_ROLE_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

/**
 * Return raw config values (for diagnostics / logging).
 */
function getStudentRoleConfig() {
  return {
    roleName: STUDENT_ROLE_NAME,
    roleIds: STUDENT_ROLE_IDS,
    hasExplicitIds: STUDENT_ROLE_IDS.length > 0,
  }
}

/**
 * Find the Student Discord Role object in a guild.
 * Prefers role IDs if configured, falls back to name match.
 * Returns null if not found (caller decides whether to error or skip).
 */
function getStudentRole(guild, options = {}) {
  if (!guild?.roles?.cache) return null

  // 1. Override: explicit role ID
  if (options.studentRoleId) {
    return guild.roles.cache.get(options.studentRoleId) || null
  }

  // 2. Override: explicit role name
  if (options.studentRoleName) {
    return guild.roles.cache.find(
      (r) => r.name.toLowerCase() === options.studentRoleName.toLowerCase()
    ) || null
  }

  // 3. Env: explicit role IDs
  if (STUDENT_ROLE_IDS.length > 0) {
    for (const id of STUDENT_ROLE_IDS) {
      const role = guild.roles.cache.get(id)
      if (role) return role
    }
  }

  // 4. Env: role name match (case-insensitive)
  const byName = guild.roles.cache.find(
    (r) => r.name.toLowerCase() === STUDENT_ROLE_NAME.toLowerCase()
  )
  return byName || null
}

/**
 * Check if a guild member has the Student role.
 * Returns false if Student role is not found in the guild (non-breaking).
 */
function hasStudentRole(member, options = {}) {
  if (!member?.roles?.cache || !member?.guild) return false
  const role = getStudentRole(member.guild, options)
  if (!role) return false
  return member.roles.cache.has(role.id)
}

/**
 * Check if a guild member is a valid student (has Student role AND is not a bot).
 */
function isStudentMember(member, options = {}) {
  if (!member?.user) return false
  if (member.user.bot) return false
  return hasStudentRole(member, options)
}

/**
 * Check if the Student role is configured and exists in the guild.
 * Returns { configured: true/false, role, reason }.
 */
function checkStudentRoleStatus(guild, options = {}) {
  if (!guild) {
    return { configured: false, role: null, reason: 'No guild provided.' }
  }
  const role = getStudentRole(guild, options)
  if (!role) {
    if (options.studentRoleId || options.studentRoleName) {
      return {
        configured: false,
        role: null,
        reason: 'Selected role was not found in this server. Refresh roles or choose another role.',
      }
    }
    return {
      configured: false,
      role: null,
      reason: 'Student role not found. Create a Student role or configure STUDENT_ROLE_NAME/STUDENT_ROLE_IDS.',
    }
  }
  return { configured: true, role, reason: null }
}

module.exports = {
  getStudentRoleConfig,
  getStudentRole,
  hasStudentRole,
  isStudentMember,
  checkStudentRoleStatus,
}
