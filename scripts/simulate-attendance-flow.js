/**
 * Safe attendance flow simulation — uses isolated DB at tmp/attendance-simulation.db
 * Run: npm run simulate:attendance
 */

const fs = require('fs')
const path = require('path')

const dbPath = path.join(__dirname, '..', 'tmp', 'attendance-simulation.db')
const tmpDir = path.dirname(dbPath)
if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true })
if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath)

process.env.DATABASE_PATH = dbPath

const db = require('../database/db')
const rosterService = require('../services/rosterService')
const attendanceSettingsService = require('../services/attendanceSettingsService')
const attendanceCheckpointService = require('../services/attendanceCheckpointService')
const attendanceDailyStatusService = require('../services/attendanceDailyStatusService')

const guildId = 'sim_guild_attendance'
const date = '2026-05-10'

function pass(name) {
  console.log(`[PASS] ${name}`)
}
function fail(name, err) {
  console.log(`[FAIL] ${name} -> ${err?.message || err}`)
  process.exitCode = 1
}

async function run() {
  console.log('=== Attendance simulation (isolated DB) ===\n')

  try {
    const cohortRes = rosterService.createCohort({ guildId, name: 'Sim Cohort', courseName: 'FS-DH Test', active: 1 })
    if (!cohortRes.ok) throw new Error(cohortRes.error)
    pass('Create cohort')

    const sA = rosterService.upsertStudent({
      guildId,
      fullName: 'Student A Full',
      preferredName: 'Student A',
      discordUserId: 'sim_user_a',
      dutyStation: 'Remote',
      active: 1,
    })
    const sB = rosterService.upsertStudent({
      guildId,
      fullName: 'Student B Full',
      preferredName: 'Student B',
      discordUserId: 'sim_user_b',
      dutyStation: 'Remote',
      active: 1,
    })
    const sC = rosterService.upsertStudent({
      guildId,
      fullName: 'Student C Full',
      preferredName: 'Student C',
      discordUserId: 'sim_user_c',
      dutyStation: 'Remote',
      active: 1,
    })
    if (!sA.ok || !sB.ok || !sC.ok) throw new Error('student upsert')
    rosterService.attachStudentToCohort({ cohortId: cohortRes.cohort.id, studentId: sA.student.id, active: 1 })
    rosterService.attachStudentToCohort({ cohortId: cohortRes.cohort.id, studentId: sB.student.id, active: 1 })
    rosterService.attachStudentToCohort({ cohortId: cohortRes.cohort.id, studentId: sC.student.id, active: 1 })
    pass('Create 3 students + cohort members')

    attendanceSettingsService.getCheckpointDefinitions(guildId)
    pass('Ensure default checkpoints')

    const cp = (k) =>
      db.prepare('SELECT * FROM attendance_checkpoint_definitions WHERE guild_id=? AND key=?').get(guildId, k)

    const r1 = attendanceCheckpointService.upsertManualAttendance({
      guildId,
      userId: 'sim_user_a',
      date,
      checkpointKey: 'morning_checkin',
      status: 'present',
      changedBy: 'sim',
      displayName: 'Student A',
    })
    const r2 = attendanceCheckpointService.upsertManualAttendance({
      guildId,
      userId: 'sim_user_a',
      date,
      checkpointKey: 'midday_checkin',
      status: 'present',
      changedBy: 'sim',
      displayName: 'Student A',
    })
    const r3 = attendanceCheckpointService.upsertManualAttendance({
      guildId,
      userId: 'sim_user_a',
      date,
      checkpointKey: 'checkout',
      status: 'present',
      changedBy: 'sim',
      displayName: 'Student A',
    })
    if (!r1.ok || !r2.ok || !r3.ok) throw new Error('student A checkpoints')
    const stA = attendanceDailyStatusService.getStudentDailyAttendanceStatus({ guildId, studentId: 'sim_user_a', date })
    if (stA.status !== 'complete' || !stA.exportable) throw new Error(`Student A expected complete/exportable got ${JSON.stringify(stA)}`)
    pass('Student A: full day complete/exportable')

    attendanceCheckpointService.upsertManualAttendance({
      guildId,
      userId: 'sim_user_b',
      date,
      checkpointKey: 'morning_checkin',
      status: 'present',
      changedBy: 'sim',
      displayName: 'Student B',
    })
    const stB = attendanceDailyStatusService.getStudentDailyAttendanceStatus({ guildId, studentId: 'sim_user_b', date })
    if (stB.status !== 'partial' || stB.exportable) throw new Error('Student B should be partial not exportable')
    pass('Student B: partial not exportable')

    const stC = attendanceDailyStatusService.getStudentDailyAttendanceStatus({ guildId, studentId: 'sim_user_c', date })
    if (stC.status !== 'missing' || stC.exportable) throw new Error('Student C should be missing')
    pass('Student C: missing')

    attendanceDailyStatusService.upsertDailyOverride({
      guildId,
      userId: 'sim_user_b',
      attendanceDate: date,
      status: 'manual',
      signatureText: 'Instructor approved',
      notes: 'Forgot checkout',
      changedBy: 'sim',
    })
    const stB2 = attendanceDailyStatusService.getStudentDailyAttendanceStatus({ guildId, studentId: 'sim_user_b', date })
    if (!stB2.exportable) throw new Error('Student B should be exportable after override')
    pass('Student B: manual override exportable')

    const today = attendanceCheckpointService.getTodayAttendance({ guildId, date, cohortId: cohortRes.cohort.id })
    if (!today.ok || !today.dailyByUser) throw new Error('today summary')
    pass('Today summary with dailyByUser')

    const week = attendanceDailyStatusService.getRangeDailySummary({
      guildId,
      startDate: date,
      endDate: date,
      cohortId: cohortRes.cohort.id,
    })
    if (!week.ok) throw new Error('week summary')
    pass('Range summary')

    const sheet = attendanceDailyStatusService.getOfficialAttendanceSheetRows({
      guildId,
      cohortId: cohortRes.cohort.id,
      month: 5,
      year: 2026,
      includeIncomplete: false,
      includeAllRosterStudents: true,
    })
    if (!sheet.ok || !sheet.groups?.length) throw new Error('official sheet rows')
    pass('Official sheet rows')

    const sNoDiscord = rosterService.upsertStudent({
      guildId,
      fullName: 'Sim No Discord Full',
      preferredName: 'SimNoDiscord',
      discordUserId: null,
      discordUsername: null,
      dutyStation: 'Remote',
      active: 1,
    })
    const sHasDiscord = rosterService.upsertStudent({
      guildId,
      fullName: 'Sim Has Discord Full',
      preferredName: 'SimHas',
      discordUserId: 'sim_has_discord_uid',
      discordUsername: 'simhasuser',
      dutyStation: 'Remote',
      active: 1,
    })
    if (!sNoDiscord.ok || !sHasDiscord.ok) throw new Error('extra students')
    rosterService.attachStudentToCohort({ cohortId: cohortRes.cohort.id, studentId: sNoDiscord.student.id, active: 1 })
    rosterService.attachStudentToCohort({ cohortId: cohortRes.cohort.id, studentId: sHasDiscord.student.id, active: 1 })

    const manualDate = '2026-05-11'
    const uidNo = `student:${sNoDiscord.student.id}`
    const mNo = attendanceCheckpointService.upsertManualAttendance({
      guildId,
      userId: null,
      studentId: sNoDiscord.student.id,
      date: manualDate,
      checkpointKey: 'morning_checkin',
      status: 'present',
      changedBy: 'sim',
      displayName: sNoDiscord.student.full_name,
    })
    const mHas = attendanceCheckpointService.upsertManualAttendance({
      guildId,
      userId: null,
      studentId: sHasDiscord.student.id,
      date: manualDate,
      checkpointKey: 'morning_checkin',
      status: 'late',
      changedBy: 'sim',
      displayName: sHasDiscord.student.full_name,
    })
    if (!mNo.ok || !mHas.ok) throw new Error(`manual by studentId: ${mNo.error || ''} ${mHas.error || ''}`)
    const rowNo = db.prepare(`SELECT * FROM attendance_checkpoints WHERE guild_id=? AND user_id=? AND attendance_date=?`).get(guildId, uidNo, manualDate)
    const rowHas = db
      .prepare(`SELECT * FROM attendance_checkpoints WHERE guild_id=? AND user_id=? AND attendance_date=?`)
      .get(guildId, 'sim_has_discord_uid', manualDate)
    if (!rowNo || !rowHas) throw new Error('manual rows by studentId / resolved discord id')

    attendanceDailyStatusService.upsertDailyOverride({
      guildId,
      userId: null,
      studentId: sNoDiscord.student.id,
      attendanceDate: manualDate,
      status: 'manual',
      signatureText: 'ok',
      notes: 'no uid',
      changedBy: 'sim',
    })
    attendanceDailyStatusService.upsertDailyOverride({
      guildId,
      userId: null,
      studentId: sHasDiscord.student.id,
      attendanceDate: manualDate,
      status: 'manual',
      signatureText: 'ok',
      notes: 'with uid',
      changedBy: 'sim',
    })
    const dNo = attendanceDailyStatusService.getStudentDailyAttendanceStatus({ guildId, studentId: uidNo, date: manualDate })
    const dHas = attendanceDailyStatusService.getStudentDailyAttendanceStatus({
      guildId,
      studentId: 'sim_has_discord_uid',
      date: manualDate,
    })
    if (!dNo.exportable || dNo.status !== 'manual') throw new Error(`no discord daily ${JSON.stringify(dNo)}`)
    if (!dHas.exportable || dHas.status !== 'manual') throw new Error(`has discord daily ${JSON.stringify(dHas)}`)

    const sheet2 = attendanceDailyStatusService.getOfficialAttendanceSheetRows({
      guildId,
      cohortId: cohortRes.cohort.id,
      month: 5,
      year: 2026,
      includeIncomplete: true,
      includeAllRosterStudents: true,
    })
    if (!sheet2.ok) throw new Error('sheet2')
    const groupNo = sheet2.groups?.find((g) => g.student.userId === uidNo)
    const groupHas = sheet2.groups?.find((g) => g.student.userId === 'sim_has_discord_uid')
    if (!groupNo?.rows?.some((r) => r.date === manualDate)) throw new Error('official row no discord')
    if (!groupHas?.rows?.some((r) => r.date === manualDate)) throw new Error('official row has discord')
    pass('Manual + daily override by studentId (with/without Discord); official sheet rows')

    const pdf = await attendanceDailyStatusService.exportOfficialAttendancePdf({
      guildId,
      cohortId: cohortRes.cohort.id,
      month: 5,
      year: 2026,
      courseName: 'FS-DH',
      includeIncomplete: true,
      includeAllRosterStudents: true,
    })
    if (!pdf.ok || !pdf.buffer?.length) throw new Error('pdf')
    pass(`PDF generated (${pdf.buffer.length} bytes)`)

    const csv = attendanceCheckpointService.exportAttendanceCsv({
      guildId,
      startDate: date,
      endDate: date,
      cohortId: cohortRes.cohort.id,
    })
    if (!csv.ok || !csv.csv.includes('Daily Status')) throw new Error('csv columns')
    if (!csv.csv.includes('Exportable Day')) throw new Error('csv exportable column')
    pass('CSV includes daily columns')

    const optKey = `optional_extra_${Date.now()}`
    attendanceSettingsService.createCheckpointDefinition(
      guildId,
      {
        key: optKey,
        label: 'Optional extra',
        commandType: 'checkin',
        targetTime: '14:00',
        required: false,
        includeInOfficialCompletion: false,
        active: true,
        sortOrder: 99,
      },
      'sim'
    )
    const stA2 = attendanceDailyStatusService.getStudentDailyAttendanceStatus({ guildId, studentId: 'sim_user_a', date })
    if (!stA2.exportable) throw new Error('optional checkpoint should not block export')
    pass('Optional non-official checkpoint does not block export')

    const optRow = cp(optKey)
    attendanceSettingsService.deactivateCheckpointDefinition(guildId, optRow.id, 'sim')
    const defsAfter = attendanceSettingsService.getCheckpointDefinitions(guildId).definitions.filter((d) => d.key === optKey)
    if (defsAfter[0]?.active !== false) throw new Error('deactivate failed')
    pass('Deactivate optional checkpoint')

    console.log('\n=== Simulation complete ===')
  } catch (e) {
    fail('simulation', e)
  }
}

run()
