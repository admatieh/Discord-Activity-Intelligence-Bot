const db = require('../database/db')
const rosterService = require('../services/rosterService')
const studentRoleConfig = require('../config/studentRoleConfig')

async function runTests() {
  console.log('--- DIAGNOSTIC: Root Cause Verification ---')

  const { roleName, roleIds, hasExplicitIds } = studentRoleConfig.getStudentRoleConfig()
  console.log('STUDENT_ROLE_NAME:', roleName)
  console.log('STUDENT_ROLE_IDS:', roleIds)
  console.log('hasExplicitIds:', hasExplicitIds)

  // Mock a discord.js guild with some members and roles
  const mockGuild = {
    id: 'guild_123',
    name: 'Test Guild',
    roles: {
      cache: {
        get: (id) => null,
        find: (fn) => null, // No Student role yet!
      }
    },
    members: {
      fetch: async () => {},
      cache: new Map()
    }
  }

  // 1. Result of checkStudentRoleStatus when no role exists
  const roleStatus = studentRoleConfig.checkStudentRoleStatus(mockGuild)
  console.log('\nResult of checkStudentRoleStatus (missing role):')
  console.log(roleStatus)

  // 2. Simulate API request parameters
  const requestBody = {
    guildId: mockGuild.id,
    cohortId: null,
    mode: 'append',
    syncedBy: 'dashboard'
  }
  console.log('\nSimulated request body from dashboard proxy:')
  console.log(requestBody)

  // 3. Simulate apiServer.js handling
  const guildFromCache = mockGuild // Mocking client.guilds.cache.get
  console.log('\nGuild exists in cache:', !!guildFromCache)

  const syncResult = await rosterService.syncStudentsFromDiscordGuild({
    guild: guildFromCache,
    guildId: requestBody.guildId,
    cohortId: requestBody.cohortId,
    syncedBy: requestBody.syncedBy,
    mode: requestBody.mode
  })

  console.log('\nResult of rosterService.syncStudentsFromDiscordGuild:')
  console.log(syncResult)
  console.log('Will this return 400? ->', syncResult.ok ? 'No' : 'Yes (because ok is false)')

  console.log('\n--- DIAGNOSTIC COMPLETE ---\n')

  console.log('--- RUNNING FULL TEST SUITE ---')

  // Clean db
  db.exec('DELETE FROM students WHERE guild_id=\'guild_123\'')
  db.exec('DELETE FROM cohorts WHERE guild_id=\'guild_123\'')
  db.exec('DELETE FROM cohort_members')

  // Mock roles
  const studentRole = { id: 'role_student', name: 'Student' }
  const instructorRole = { id: 'role_instructor', name: 'Instructor' }

  mockGuild.roles.cache.get = (id) => [studentRole, instructorRole].find(r => r.id === id)
  mockGuild.roles.cache.find = (fn) => [studentRole, instructorRole].find(fn)

  // Mock members
  const member1 = {
    user: { id: 'user_1', username: 'student_1', bot: false },
    displayName: 'Student One',
    roles: { cache: new Map([['role_student', studentRole]]) },
    guild: mockGuild
  }
  const member2 = {
    user: { id: 'user_2', username: 'student_2', bot: false },
    displayName: 'Student Two',
    roles: { cache: new Map([['role_student', studentRole]]) },
    guild: mockGuild
  }
  const instructor = {
    user: { id: 'user_inst', username: 'inst', bot: false },
    displayName: 'Instructor Bob',
    roles: { cache: new Map([['role_instructor', instructorRole]]) },
    guild: mockGuild
  }
  const botMember = {
    user: { id: 'user_bot', username: 'my_bot', bot: true },
    displayName: 'My Bot',
    roles: { cache: new Map([['role_student', studentRole]]) },
    guild: mockGuild
  }
  const normalMember = {
    user: { id: 'user_norm', username: 'norm', bot: false },
    displayName: 'Normal User',
    roles: { cache: new Map() },
    guild: mockGuild
  }

  mockGuild.members.cache.set(member1.user.id, member1)
  mockGuild.members.cache.set(member2.user.id, member2)
  mockGuild.members.cache.set(instructor.user.id, instructor)
  mockGuild.members.cache.set(botMember.user.id, botMember)
  mockGuild.members.cache.set(normalMember.user.id, normalMember)

  // Test 1: Append sync
  let res = await rosterService.syncStudentsFromDiscordGuild({ guild: mockGuild, guildId: mockGuild.id, mode: 'append' })
  console.log('Append sync result:', res.summary)
  let students = rosterService.listStudents({ guildId: mockGuild.id })
  console.log(`Expected 2 students, got ${students.length}`)
  if (students.length !== 2) throw new Error('Test failed')

  // Test 2: Rerun does not duplicate
  res = await rosterService.syncStudentsFromDiscordGuild({ guild: mockGuild, guildId: mockGuild.id, mode: 'append' })
  console.log('Rerun sync result (expected updated=2):', res.summary)
  if (res.summary.updated !== 2) throw new Error('Test failed: Should have updated 2 students')

  // Test 3: Remove Student role from user 1, append mode
  member1.roles.cache.delete('role_student')
  res = await rosterService.syncStudentsFromDiscordGuild({ guild: mockGuild, guildId: mockGuild.id, mode: 'append' })
  console.log('Append sync after role removed (expected deactivated=0):', res.summary)
  if (res.summary.deactivated !== 0) throw new Error('Test failed: Append mode should not deactivate')
  
  // Test 4: Mirror mode
  res = await rosterService.syncStudentsFromDiscordGuild({ guild: mockGuild, guildId: mockGuild.id, mode: 'mirror' })
  console.log('Mirror sync after role removed (expected deactivated=1):', res.summary)
  if (res.summary.deactivated !== 1) throw new Error('Test failed: Mirror mode should deactivate removed student')

  // Check db
  students = rosterService.listStudents({ guildId: mockGuild.id })
  const s1 = students.find(s => s.discord_user_id === 'user_1')
  const s2 = students.find(s => s.discord_user_id === 'user_2')
  console.log(`s1 active: ${s1.active}, s2 active: ${s2.active}`)
  if (s1.active !== 0 || s2.active !== 1) throw new Error('Test failed: active states incorrect')

  // Test 5: Checkin auto-create
  const newMember = {
    user: { id: 'user_3', username: 'student_3', bot: false },
    displayName: 'Student Three',
    roles: { cache: new Map([['role_student', studentRole]]) },
    guild: mockGuild
  }
  const checkinRes = rosterService.findOrCreateStudentFromDiscordMember({ guildId: mockGuild.id, member: newMember, source: 'discord_checkin_auto' })
  console.log('Auto-create on checkin:', checkinRes.student.discord_username, 'created:', checkinRes.created, 'source:', checkinRes.student.source)
  if (!checkinRes.created || checkinRes.student.source !== 'discord_checkin_auto') throw new Error('Test failed: Auto-create failed')

  console.log('All tests passed successfully!')

  console.log('--- TEST: ROLE OVERRIDES ---')
  const overrideRole = { id: 'role_override', name: 'OverrideStudent' }
  mockGuild.roles.cache.get = (id) => [studentRole, instructorRole, overrideRole].find(r => r.id === id)
  mockGuild.roles.cache.find = (fn) => [studentRole, instructorRole, overrideRole].find(fn)

  const overrideMember = {
    user: { id: 'user_override', username: 'override_student', bot: false },
    displayName: 'Override Student',
    roles: { cache: new Map([['role_override', overrideRole]]) },
    guild: mockGuild
  }
  mockGuild.members.cache.set(overrideMember.user.id, overrideMember)

  // Test 6: Override by role ID
  const overrideRes = await rosterService.syncStudentsFromDiscordGuild({
    guild: mockGuild,
    guildId: mockGuild.id,
    mode: 'append',
    studentRoleId: 'role_override'
  })
  console.log('Override sync by ID result:', overrideRes.summary)
  if (overrideRes.summary.matchedStudentRole !== 1) throw new Error('Test failed: Should match exactly 1 override student')

  // Test 7: Override by role Name
  const overrideNameRes = await rosterService.syncStudentsFromDiscordGuild({
    guild: mockGuild,
    guildId: mockGuild.id,
    mode: 'append',
    studentRoleName: 'OverrideStudent'
  })
  console.log('Override sync by Name result:', overrideNameRes.summary)
  if (overrideNameRes.summary.matchedStudentRole !== 1) throw new Error('Test failed: Should match exactly 1 override student by name')

  // Test 8: Missing override role
  const overrideMissingRes = await rosterService.syncStudentsFromDiscordGuild({
    guild: mockGuild,
    guildId: mockGuild.id,
    mode: 'append',
    studentRoleId: 'role_does_not_exist'
  })
  console.log('Missing override role sync result (expected ok=false):', overrideMissingRes.ok)
  if (overrideMissingRes.ok !== false || !overrideMissingRes.error.includes('Selected role was not found')) {
    throw new Error('Test failed: Should fail with "Selected role was not found" error')
  }

  console.log('--- ALL ROLE OVERRIDE TESTS PASSED ---')
}

runTests().catch(e => {
  console.error(e)
  process.exit(1)
})
