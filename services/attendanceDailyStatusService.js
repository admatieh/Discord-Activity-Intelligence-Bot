const PDFDocument = require('pdfkit')
const db = require('../database/db')
const attendanceSettingsService = require('./attendanceSettingsService')
const rosterService = require('./rosterService')

function getDefinitions(guildId) {
  const res = attendanceSettingsService.getCheckpointDefinitions(guildId)
  return res.ok ? res.definitions || [] : []
}

function requiredActiveKeys(defs) {
  return defs
    .filter((d) => d.active && d.required)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map((d) => d.key)
}

/** Keys that must be satisfied for a day to appear on the official export */
function officialRequiredKeys(defs) {
  return defs
    .filter((d) => d.active && d.required && d.includeInOfficialCompletion !== false)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0))
    .map((d) => d.key)
}

function checkpointRowSatisfied(row) {
  if (!row) return false
  const s = String(row.status || '').toLowerCase()
  if (s === 'missing' || s === '') return false
  return true
}

function getDailyOverride(guildId, userId, date) {
  return (
    db
      .prepare(
        `SELECT * FROM attendance_daily_overrides
         WHERE guild_id=? AND user_id=? AND attendance_date=?`
      )
      .get(guildId, userId, date) || null
  )
}

function upsertDailyOverride({
  guildId,
  userId,
  attendanceDate,
  status,
  signatureText,
  notes,
  changedBy,
  studentId = null,
}) {
  let resolvedUserId = userId != null && String(userId).trim() !== '' ? String(userId).trim() : null
  if (!resolvedUserId && studentId != null && Number.isFinite(Number(studentId))) {
    const stu = rosterService.getStudentById({ guildId, studentId: Number(studentId) })
    if (stu?.discord_user_id) resolvedUserId = String(stu.discord_user_id).trim()
    else resolvedUserId = `student:${Number(studentId)}`
  }
  if (!guildId || !resolvedUserId || !attendanceDate || !status) {
    return { ok: false, error: 'guildId, userId or studentId, attendanceDate, and status are required.' }
  }
  db.prepare(
    `INSERT INTO attendance_daily_overrides (
      guild_id, user_id, student_id, attendance_date, status, signature_text, notes, changed_by, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(guild_id, user_id, attendance_date) DO UPDATE SET
      status=excluded.status,
      signature_text=COALESCE(excluded.signature_text, attendance_daily_overrides.signature_text),
      notes=COALESCE(excluded.notes, attendance_daily_overrides.notes),
      changed_by=excluded.changed_by,
      student_id=COALESCE(excluded.student_id, attendance_daily_overrides.student_id),
      updated_at=datetime('now')`
  ).run(
    guildId,
    resolvedUserId,
    studentId != null && Number.isFinite(Number(studentId)) ? Number(studentId) : null,
    attendanceDate,
    status,
    signatureText || null,
    notes || null,
    changedBy || null
  )
  const row = db
    .prepare(
      `SELECT * FROM attendance_daily_overrides
       WHERE guild_id=? AND user_id=? AND attendance_date=?`
    )
    .get(guildId, resolvedUserId, attendanceDate)
  return { ok: true, record: row }
}

function getCheckpointRowsForUserDay(guildId, userId, date) {
  return db
    .prepare(
      `SELECT * FROM attendance_checkpoints
       WHERE guild_id=? AND user_id=? AND attendance_date=?`
    )
    .all(guildId, userId, date)
}

function pickSignatureText(rows, displayFallback) {
  const sigs = rows.map((r) => r.signature_text).filter(Boolean)
  if (sigs.length) return String(sigs[sigs.length - 1])
  const names = rows.map((r) => r.display_name || r.username).filter(Boolean)
  if (names.length) return String(names[names.length - 1])
  return displayFallback || ''
}

function mapOverrideToDailyStatus(override) {
  const os = String(override.status || '').toLowerCase()
  if (['completed', 'present'].includes(os)) {
    return { status: 'complete', exportable: true }
  }
  if (os === 'manual') {
    return { status: 'manual', exportable: true }
  }
  if (os === 'excused') {
    return { status: 'excused', exportable: true }
  }
  if (os === 'late') {
    return { status: 'complete_late', exportable: true }
  }
  if (os === 'missing') {
    return { status: 'missing', exportable: false }
  }
  return { status: 'manual', exportable: true }
}

/**
 * @returns {{
 *   status: string,
 *   completedRequired: number,
 *   totalRequired: number,
 *   officialCompleted: number,
 *   officialTotal: number,
 *   checkpoints: Array<{ key: string, label: string, recorded: boolean, status: string|null, satisfied: boolean, late: boolean }>,
 *   signatureText: string,
 *   exportable: boolean
 * }}
 */
function getStudentDailyAttendanceStatus({ guildId, studentId, date }) {
  if (!guildId || !studentId || !date) {
    return {
      status: 'missing',
      completedRequired: 0,
      totalRequired: 0,
      officialCompleted: 0,
      officialTotal: 0,
      checkpoints: [],
      signatureText: '',
      exportable: false,
    }
  }

  const defs = getDefinitions(guildId)
  const defByKey = new Map(defs.map((d) => [d.key, d]))
  const reqKeys = requiredActiveKeys(defs)
  const offKeys = officialRequiredKeys(defs)
  const rows = getCheckpointRowsForUserDay(guildId, studentId, date)
  const byKey = new Map(rows.map((r) => [r.checkpoint_key, r]))
  const override = getDailyOverride(guildId, studentId, date)

  const checkpoints = reqKeys.map((key) => {
    const row = byKey.get(key)
    return {
      key,
      label: defByKey.get(key)?.label || key,
      recorded: Boolean(row),
      status: row?.status ?? null,
      satisfied: checkpointRowSatisfied(row),
      late: row?.status === 'late',
    }
  })

  const completedRequired = reqKeys.filter((k) => checkpointRowSatisfied(byKey.get(k))).length
  const totalRequired = reqKeys.length
  const officialCompleted = offKeys.filter((k) => checkpointRowSatisfied(byKey.get(k))).length
  const officialTotal = offKeys.length

  const displayFallback = rows[0]?.display_name || rows[0]?.username || studentId
  let signatureText = pickSignatureText(rows, displayFallback)
  if (override?.signature_text) signatureText = override.signature_text

  if (override) {
    const mapped = mapOverrideToDailyStatus(override)
    return {
      status: mapped.status,
      completedRequired,
      totalRequired,
      officialCompleted,
      officialTotal,
      checkpoints,
      signatureText,
      exportable: mapped.exportable,
    }
  }

  if (totalRequired === 0) {
    const hasAny = rows.length > 0
    return {
      status: hasAny ? 'complete' : 'missing',
      completedRequired: 0,
      totalRequired: 0,
      officialCompleted: 0,
      officialTotal: 0,
      checkpoints,
      signatureText,
      exportable: hasAny,
    }
  }

  const anyReqRecorded = reqKeys.some((k) => byKey.has(k))
  const allReqSatisfied = reqKeys.every((k) => checkpointRowSatisfied(byKey.get(k)))
  const anyLate = reqKeys.some((k) => byKey.get(k)?.status === 'late')
  const allOfficialSatisfied = officialTotal === 0 || offKeys.every((k) => checkpointRowSatisfied(byKey.get(k)))

  if (!anyReqRecorded) {
    return {
      status: 'missing',
      completedRequired: 0,
      totalRequired,
      officialCompleted,
      officialTotal,
      checkpoints,
      signatureText,
      exportable: false,
    }
  }

  if (!allReqSatisfied) {
    return {
      status: 'partial',
      completedRequired,
      totalRequired,
      officialCompleted,
      officialTotal,
      checkpoints,
      signatureText,
      exportable: false,
    }
  }

  const baseStatus = anyLate ? 'complete_late' : 'complete'
  return {
    status: baseStatus,
    completedRequired,
    totalRequired,
    officialCompleted,
    officialTotal,
    checkpoints,
    signatureText,
    exportable: allOfficialSatisfied,
  }
}

function listDatesInMonth(year, month) {
  const last = new Date(Number(year), Number(month), 0).getDate()
  const mm = String(month).padStart(2, '0')
  const dates = []
  for (let d = 1; d <= last; d++) {
    dates.push(`${year}-${mm}-${String(d).padStart(2, '0')}`)
  }
  return dates
}

function rosterStudentsForExport({ guildId, cohortId }) {
  const students = rosterService.listStudents({ guildId, cohortId: cohortId || null, active: true })
  if (students.length) {
    return {
      students,
      rosterConfigured: true,
      warning: null,
    }
  }
  if (cohortId) {
    return { students: [], rosterConfigured: true, warning: null }
  }
  const activeCohort = rosterService.getActiveCohort(guildId)
  const fallback = rosterService.listStudents({
    guildId,
    cohortId: activeCohort?.id || null,
    active: true,
  })
  if (fallback.length) {
    return { students: fallback, rosterConfigured: true, warning: null }
  }
  const inferred = db
    .prepare(
      `SELECT DISTINCT user_id as discord_user_id,
              MAX(display_name) as preferred_name,
              MAX(username) as discord_username,
              MAX(duty_station) as duty_station
       FROM attendance_checkpoints WHERE guild_id=?`
    )
    .all(guildId)
  if (!inferred.length) {
    return { students: [], rosterConfigured: false, warning: null }
  }
  return {
    students: inferred.map((r, i) => ({
      id: -(i + 1),
      full_name: r.preferred_name || r.discord_username || r.discord_user_id,
      preferred_name: r.preferred_name,
      discord_user_id: r.discord_user_id,
      discord_username: r.discord_username,
      duty_station: r.duty_station || 'Remote',
      active: 1,
    })),
    rosterConfigured: false,
    warning: 'No roster configured; using students seen in attendance records.',
  }
}

function dayLabel(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })
}

/**
 * @returns {{ students: any[], warning: string|null, groups: Array<{ student: object, rows: object[] }> }}
 */
function getOfficialAttendanceSheetRows({
  guildId,
  cohortId = null,
  month,
  year,
  dutyStationDefault = 'Remote',
  includeIncomplete = false,
  includeAllRosterStudents = true,
}) {
  if (!guildId || !month || !year) {
    return { ok: false, error: 'guildId, month, and year are required.', groups: [], students: [], warning: null }
  }

  const { students, rosterConfigured, warning } = rosterStudentsForExport({ guildId, cohortId })
  const dates = listDatesInMonth(year, month)
  const groups = []

  for (const s of students) {
    const userId = s.discord_user_id || `student:${s.id}`
    const fullName = s.preferred_name || s.full_name || s.discord_username || `Student ${s.id}`
    const duty = s.duty_station || dutyStationDefault
    const rows = []
    const appendix = []

    for (const date of dates) {
      const st = getStudentDailyAttendanceStatus({ guildId, studentId: userId, date })
      const baseRow = {
        date,
        dayLabel: dayLabel(date),
        dutyStation: duty,
        status: st.status,
        signatureText: st.signatureText || fullName,
        exportable: st.exportable,
        dailyDetail: st,
      }
      if (st.exportable && ['complete', 'complete_late', 'excused', 'manual'].includes(st.status)) {
        rows.push(baseRow)
      } else if (includeIncomplete && (st.status === 'partial' || st.status === 'missing')) {
        appendix.push({ ...baseRow, appendix: true })
      }
    }

    const hasExportRows = rows.length > 0
    if (!includeAllRosterStudents && !hasExportRows) {
      continue
    }

    groups.push({
      student: {
        id: s.id,
        userId,
        fullName,
        dutyStation: duty,
        preferredName: s.preferred_name || null,
      },
      rows,
      appendixRows: includeIncomplete ? appendix : [],
    })
  }

  return {
    ok: true,
    groups,
    students,
    rosterConfigured,
    warning,
    month: Number(month),
    year: Number(year),
  }
}

function drawStudentPage(doc, { courseName, monthYear, student, rows, dutyStationDefault }) {
  const margin = 48
  let y = margin
  doc.fillColor('#000000').fontSize(11)
  doc.font('Helvetica-Bold').fontSize(14).text('Youth Scholarship Programme - Attendance Sheet', margin, y, {
    align: 'center',
    width: doc.page.width - margin * 2,
  })
  y += 36
  doc.font('Helvetica').fontSize(11)
  doc.text(`Course Name: ${courseName || '—'}`, margin, y)
  y += 18
  doc.text(`Month: ${monthYear}`, margin, y)
  y += 28

  const fullName = student.fullName || 'Student'
  doc.font('Helvetica-Bold').text(`Student: ${fullName}`, margin, y)
  y += 22

  const tableTop = y
  const colNum = margin
  const colName = margin + 36
  const colDuty = margin + 220
  const colDay = margin + 310
  const colSig = margin + 420
  const rowH = 22
  doc.font('Helvetica-Bold').fontSize(9)
  doc.text('#', colNum, tableTop)
  doc.text('Full name', colName, tableTop)
  doc.text('Duty station', colDuty, tableTop)
  doc.text('Day & Date', colDay, tableTop)
  doc.text('Youth signature', colSig, tableTop)
  y = tableTop + rowH
  doc.moveTo(margin, y - 4).lineTo(doc.page.width - margin, y - 4).stroke('#000000')

  doc.font('Helvetica').fontSize(9)
  const maxRows = 28
  const dataRows = [...rows]
  while (dataRows.length < maxRows) {
    dataRows.push(null)
  }
  for (let i = 0; i < maxRows; i++) {
    const r = dataRows[i]
    const lineY = y + i * rowH
    doc.text(String(i + 1), colNum, lineY)
    if (r) {
      doc.text(fullName.slice(0, 28), colName, lineY, { width: 170 })
      doc.text(String(r.dutyStation || dutyStationDefault).slice(0, 14), colDuty, lineY)
      doc.text(String(r.dayLabel || '').slice(0, 28), colDay, lineY, { width: 100 })
      doc.text(String(r.signatureText || '').slice(0, 24), colSig, lineY, { width: 120 })
    } else {
      doc.text('', colName, lineY)
      doc.text('', colDuty, lineY)
      doc.text('', colDay, lineY)
      doc.text('', colSig, lineY)
    }
  }

  y = tableTop + rowH + maxRows * rowH + 16
  doc.moveTo(margin, tableTop + rowH - 4).stroke('#000000')
  doc.font('Helvetica').fontSize(10)
  doc.text('Supervisor Signature: _______________________________', margin, y)
}

function exportOfficialAttendancePdf({
  guildId,
  cohortId = null,
  month,
  year,
  courseName = '',
  dutyStationDefault = 'Remote',
  includeIncomplete = false,
  includeAllRosterStudents = true,
}) {
  const sheet = getOfficialAttendanceSheetRows({
    guildId,
    cohortId,
    month,
    year,
    dutyStationDefault,
    includeIncomplete,
    includeAllRosterStudents,
  })
  if (!sheet.ok) {
    return { ok: false, error: sheet.error || 'Could not build sheet.' }
  }

  const monthYear = `${String(month)} / ${year}`
  const chunks = []
  const doc = new PDFDocument({ size: 'A4', margin: 36 })
  doc.on('data', (c) => chunks.push(c))
  const done = new Promise((resolve) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)))
  })

  for (let i = 0; i < sheet.groups.length; i++) {
    const g = sheet.groups[i]
    if (i > 0) doc.addPage()
    drawStudentPage(doc, {
      courseName,
      monthYear,
      student: g.student,
      rows: g.rows,
      dutyStationDefault,
    })
    if (includeIncomplete && g.appendixRows && g.appendixRows.length) {
      doc.addPage()
      doc.fillColor('#000000').fontSize(12).text('Review appendix (non-exportable days)', 48, 48)
      doc.moveDown()
      doc.fontSize(9)
      g.appendixRows.forEach((r) => {
        doc.text(`${r.date}  ${r.dayLabel}  status=${r.status}`, { indent: 12 })
      })
    }
  }

  if (sheet.groups.length === 0) {
    doc.fontSize(12).text('No students in scope for this export.', 48, 48)
  }

  doc.end()
  return done.then((buffer) => ({
    ok: true,
    buffer,
    filename: `attendance_${(courseName || 'export').replace(/[^\w.-]+/g, '_')}_${year}-${String(month).padStart(2, '0')}.pdf`,
    warning: sheet.warning,
  }))
}

function getRangeDailySummary({ guildId, startDate, endDate, cohortId = null }) {
  const dates = []
  for (let d = new Date(`${startDate}T00:00:00`); d <= new Date(`${endDate}T00:00:00`); d.setDate(d.getDate() + 1)) {
    dates.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    )
  }
  const { students, rosterConfigured, warning } = rosterStudentsForExport({ guildId, cohortId })
  const byUser = {}
  for (const s of students) {
    const userId = s.discord_user_id || `student:${s.id}`
    byUser[userId] = {}
    for (const date of dates) {
      byUser[userId][date] = getStudentDailyAttendanceStatus({ guildId, studentId: userId, date })
    }
  }
  return { ok: true, dates, students, byUser, rosterConfigured, warning }
}

module.exports = {
  getStudentDailyAttendanceStatus,
  getOfficialAttendanceSheetRows,
  exportOfficialAttendancePdf,
  getRangeDailySummary,
  upsertDailyOverride,
  getDailyOverride,
  requiredActiveKeys,
  officialRequiredKeys,
}
