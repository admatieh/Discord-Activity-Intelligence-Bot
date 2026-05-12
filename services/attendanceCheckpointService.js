const db = require('../database/db')
const logger = require('../utils/logger')
const activityEventModel = require('../modules/activity/activityEventModel')
const attendanceSettingsService = require('./attendanceSettingsService')
const rosterService = require('./rosterService')

function parseHHmm(str) {
  const m = /^(\d{2}):(\d{2})$/.exec(String(str || '').trim())
  if (!m) return null
  const hh = Number(m[1])
  const mm = Number(m[2])
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null
  return hh * 60 + mm
}

function weekdayToCode(short) {
  const s = String(short || '').slice(0, 3).toLowerCase()
  if (s === 'mon') return 'MO'
  if (s === 'tue') return 'TU'
  if (s === 'wed') return 'WE'
  if (s === 'thu') return 'TH'
  if (s === 'fri') return 'FR'
  if (s === 'sat') return 'SA'
  if (s === 'sun') return 'SU'
  return null
}

function getZonedParts(date, timeZone) {
  const d = date instanceof Date ? date : new Date(date)
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(d)
  const get = (type) => parts.find((p) => p.type === type)?.value
  const year = get('year')
  const month = get('month')
  const day = get('day')
  const hour = get('hour')
  const minute = get('minute')
  const weekday = get('weekday')
  return {
    year,
    month,
    day,
    weekday,
    hh: Number(hour),
    mm: Number(minute),
    dateString: year && month && day ? `${year}-${month}-${day}` : null,
    localTime: hour != null && minute != null ? `${hour}:${minute}` : null,
  }
}

function minutesSinceMidnight(parts) {
  if (!Number.isFinite(parts.hh) || !Number.isFinite(parts.mm)) return null
  return parts.hh * 60 + parts.mm
}

function getCheckpointWindows(cp) {
  const opens = parseHHmm(cp.opensAt)
  const target = parseHHmm(cp.targetAt)
  const lateAfter = parseHHmm(cp.lateAfter)
  const closes = parseHHmm(cp.closesAt)
  if ([opens, target, lateAfter, closes].some((n) => n == null)) return null
  return { opens, target, lateAfter, closes }
}

function normalizeDef(def) {
  const target = parseHHmm(def.targetTime)
  const opens = target == null ? null : target - (Number(def.opensBeforeMinutes) || 0)
  const lateAfter = target == null ? null : target + (Number(def.lateAfterMinutes) || 0)
  const closes =
    target == null
      ? null
      : def.closesAfterMinutes == null || def.closesAfterMinutes === ''
        ? null
        : target + Number(def.closesAfterMinutes)
  return {
    ...def,
    _target: target,
    _opens: opens,
    _lateAfter: lateAfter,
    _closes: closes,
  }
}

function resolveCurrentCheckpoint({ guildId, commandType, now = new Date() }) {
  if (!guildId) return { ok: false, error: 'guildId is required.' }
  const defsRes = attendanceSettingsService.getCheckpointDefinitions(guildId)
  if (!defsRes.ok) return defsRes
  const defs = (defsRes.definitions || [])
    .filter((d) => d.active && d.commandType === commandType)
    .map(normalizeDef)
    .filter((d) => d._target != null)

  if (defs.length === 0) {
    return { ok: false, error: `No active ${commandType} checkpoints configured for this server.` }
  }

  const timezone = defs[0].timezone || 'Asia/Beirut'
  const parts = getZonedParts(now, timezone)
  const mins = minutesSinceMidnight(parts)
  if (!parts.dateString || mins == null) return { ok: false, error: 'Could not determine local time.' }

  // 1) in open window
  const inOpen = defs.filter((d) => mins >= d._opens && (d._closes == null || mins <= d._closes))
  if (inOpen.length > 0) {
    // nearest target, prefer latest passed if tie
    inOpen.sort((a, b) => {
      const da = Math.abs(mins - a._target)
      const db = Math.abs(mins - b._target)
      if (da !== db) return da - db
      return b._target - a._target
    })
    const cp = inOpen[0]
    const status = mins > cp._lateAfter ? 'late' : 'present'
    return { ok: true, checkpoint: cp, status, attendanceDate: parts.dateString, timezone, localTime: parts.localTime }
  }

  // 2) if no open but late submissions are allowed -> latest target passed
  const lateCandidates = defs.filter(
    (d) =>
      d.allowLateSubmission &&
      mins > d._target &&
      (d._closes == null || mins <= d._closes)
  )
  if (lateCandidates.length > 0) {
    lateCandidates.sort((a, b) => b._target - a._target)
    const cp = lateCandidates[0]
    return { ok: true, checkpoint: cp, status: 'late', attendanceDate: parts.dateString, timezone, localTime: parts.localTime }
  }

  const next = defs
    .filter((d) => mins < d._opens)
    .sort((a, b) => a._opens - b._opens)[0]
  return {
    ok: false,
    error: `No ${commandType === 'checkout' ? 'checkout' : 'check-in'} checkpoint is currently available.`,
    nextCheckpoint: next || null,
    attendanceDate: parts.dateString,
    timezone,
  }
}

function upsertCheckpointRow({
  guildId,
  userId,
  username,
  displayName,
  dutyStation,
  attendanceDate,
  checkpointKey,
  checkpointLabel,
  status,
  checkedAtIso,
  localCheckedAt,
  source,
  discordMessageId,
  channelId,
  sessionId,
  signatureText,
  notes,
}) {
  const stmt = db.prepare(`
    INSERT INTO attendance_checkpoints (
      guild_id, user_id, username, display_name, duty_station,
      attendance_date, checkpoint_key, checkpoint_label, status,
      checked_at, local_checked_at, source, discord_message_id, channel_id,
      session_id, signature_text, notes, updated_at
    ) VALUES (
      @guildId, @userId, @username, @displayName, @dutyStation,
      @attendanceDate, @checkpointKey, @checkpointLabel, @status,
      @checkedAtIso, @localCheckedAt, @source, @discordMessageId, @channelId,
      @sessionId, @signatureText, @notes, datetime('now')
    )
    ON CONFLICT(guild_id, user_id, attendance_date, checkpoint_key) DO UPDATE SET
      status=excluded.status,
      checked_at=COALESCE(attendance_checkpoints.checked_at, excluded.checked_at),
      local_checked_at=COALESCE(attendance_checkpoints.local_checked_at, excluded.local_checked_at),
      username=COALESCE(excluded.username, attendance_checkpoints.username),
      display_name=COALESCE(excluded.display_name, attendance_checkpoints.display_name),
      duty_station=COALESCE(excluded.duty_station, attendance_checkpoints.duty_station),
      source=COALESCE(excluded.source, attendance_checkpoints.source),
      discord_message_id=COALESCE(excluded.discord_message_id, attendance_checkpoints.discord_message_id),
      channel_id=COALESCE(excluded.channel_id, attendance_checkpoints.channel_id),
      session_id=COALESCE(excluded.session_id, attendance_checkpoints.session_id),
      signature_text=COALESCE(excluded.signature_text, attendance_checkpoints.signature_text),
      notes=COALESCE(excluded.notes, attendance_checkpoints.notes),
      updated_at=datetime('now')
  `)

  stmt.run({
    guildId,
    userId,
    username: username || null,
    displayName: displayName || null,
    dutyStation: dutyStation || 'Remote',
    attendanceDate,
    checkpointKey,
    checkpointLabel: checkpointLabel || null,
    status,
    checkedAtIso: checkedAtIso || null,
    localCheckedAt: localCheckedAt || null,
    source: source || null,
    discordMessageId: discordMessageId || null,
    channelId: channelId || null,
    sessionId: sessionId || null,
    signatureText: signatureText || null,
    notes: notes || null,
  })

  return db
    .prepare(
      `SELECT * FROM attendance_checkpoints
       WHERE guild_id=? AND user_id=? AND attendance_date=? AND checkpoint_key=?`
    )
    .get(guildId, userId, attendanceDate, checkpointKey)
}

function recordCheckpoint({
  guildId,
  userId,
  username,
  displayName,
  channelId,
  messageId,
  commandType,
  source = 'discord_command',
  now = new Date(),
}) {
  if (!guildId || !userId) {
    return { ok: false, error: 'guildId and userId are required.' }
  }

  const current = resolveCurrentCheckpoint({ guildId, now, commandType })

  if (!current.ok) {
    return current
  }

  const existing = db
    .prepare(
      `SELECT * FROM attendance_checkpoints
       WHERE guild_id=? AND user_id=? AND attendance_date=? AND checkpoint_key=?`
    )
    .get(guildId, userId, current.attendanceDate, current.checkpoint.key)

  const checkedAtIso = new Date(now).toISOString()
  const localCheckedAt = current.localTime ? `${current.attendanceDate} ${current.localTime}` : null

  const row = upsertCheckpointRow({
    guildId,
    userId,
    username,
    displayName,
    dutyStation: 'Remote',
    attendanceDate: current.attendanceDate,
    checkpointKey: current.checkpoint.key,
    checkpointLabel: current.checkpoint.label,
    status: current.status,
    checkedAtIso,
    localCheckedAt,
    source,
    discordMessageId: messageId,
    channelId,
    signatureText: displayName || username || userId,
  })

  try {
    activityEventModel.insertEvent({
      type: commandType === 'checkout' ? 'attendance_checkout_recorded' : 'attendance_checkin_recorded',
      userId,
      channelId: channelId || null,
      sessionId: null,
      metadata: {
        guildId,
        checkpointKey: current.checkpoint.key,
        checkpointLabel: current.checkpoint.label,
        status: current.status,
        attendanceDate: current.attendanceDate,
        displayName: displayName || username || userId,
      },
    })
  } catch (e) {
    logger.error(`attendance activity insert failed: ${e.message}`)
  }

  return {
    ok: true,
    attendanceDate: current.attendanceDate,
    checkpoint: current.checkpoint,
    status: current.status,
    alreadyCompleted: Boolean(existing && existing.checked_at),
    record: row,
  }
}

function getTodayAttendance({ guildId, date }) {
  if (!guildId) return { ok: false, error: 'guildId is required.' }
  const tz = (attendanceSettingsService.getCheckpointDefinitions(guildId).definitions?.[0]?.timezone) || 'Asia/Beirut'
  const attendanceDate = date || getZonedParts(new Date(), tz).dateString
  if (!attendanceDate) return { ok: false, error: 'Could not determine attendance date.' }

  const rows = db
    .prepare(
      `SELECT * FROM attendance_checkpoints
       WHERE guild_id=? AND attendance_date=?
       ORDER BY display_name COLLATE NOCASE, username COLLATE NOCASE`
    )
    .all(guildId, attendanceDate)

  return { ok: true, attendanceDate, rows }
}

function getWeeklyAttendance({ guildId, weekStart, weekEnd }) {
  if (!guildId || !weekStart || !weekEnd) {
    return { ok: false, error: 'guildId, weekStart, and weekEnd are required.' }
  }
  const rows = db
    .prepare(
      `SELECT * FROM attendance_checkpoints
       WHERE guild_id=? AND attendance_date BETWEEN ? AND ?
       ORDER BY attendance_date ASC, display_name COLLATE NOCASE, username COLLATE NOCASE`
    )
    .all(guildId, weekStart, weekEnd)
  return { ok: true, weekStart, weekEnd, rows }
}

function getMonthlyAttendance({ guildId, month, year }) {
  if (!guildId || !month || !year) {
    return { ok: false, error: 'guildId, month, and year are required.' }
  }
  const mm = String(month).padStart(2, '0')
  const prefix = `${year}-${mm}`
  const rows = db
    .prepare(
      `SELECT * FROM attendance_checkpoints
       WHERE guild_id=? AND attendance_date LIKE ?
       ORDER BY attendance_date ASC, display_name COLLATE NOCASE, username COLLATE NOCASE`
    )
    .all(guildId, `${prefix}%`)
  return { ok: true, month: Number(month), year: Number(year), rows }
}

function getMissingCheckpoints({ guildId, date, users }) {
  if (!guildId || !date) return { ok: false, error: 'guildId and date are required.' }
  const defs = attendanceSettingsService.getCheckpointDefinitions(guildId).definitions || []
  const checkpoints = defs.filter((d) => d.active && d.required).map((c) => c.key)

  // Determine roster: provided users list (preferred), active roster table, then inferred records fallback.
  let roster = Array.isArray(users) ? users.filter((u) => u && u.userId) : null
  let usedRosterFallback = false
  if (!roster || roster.length === 0) {
    const activeCohort = rosterService.getActiveCohort(guildId)
    const rosterRows = rosterService.listStudents({
      guildId,
      cohortId: activeCohort?.id || null,
      active: true,
    })
    roster = (rosterRows || []).map((s) => ({
      userId: s.discord_user_id || `student:${s.id}`,
      name: s.preferred_name || s.full_name || s.discord_username || `Student ${s.id}`,
      dutyStation: s.duty_station || 'Remote',
      sourceStudentId: s.id,
      hasDiscordUserId: Boolean(s.discord_user_id),
    }))
  }

  if (!roster || roster.length === 0) {
    usedRosterFallback = true
    const people = db
      .prepare(
        `SELECT DISTINCT user_id as userId, COALESCE(display_name, username, user_id) as name, duty_station as dutyStation
         FROM attendance_checkpoints WHERE guild_id=? AND attendance_date=?`
      )
      .all(guildId, date)
    roster = people
  }

  const existing = db
    .prepare(
      `SELECT user_id, checkpoint_key
       FROM attendance_checkpoints
       WHERE guild_id=? AND attendance_date=?`
    )
    .all(guildId, date)

  const byUser = new Map()
  for (const r of existing) {
    const s = byUser.get(r.user_id) || new Set()
    s.add(r.checkpoint_key)
    byUser.set(r.user_id, s)
  }

  const missing = []
  for (const u of roster) {
    const s = byUser.get(u.userId) || new Set()
    for (const key of checkpoints) {
      if (!s.has(key)) {
        missing.push({
          userId: u.userId,
          name: u.name || u.displayName || u.username || u.userId,
          dutyStation: u.dutyStation || 'Remote',
          attendanceDate: date,
          checkpointKey: key,
        })
      }
    }
  }

  return {
    ok: true,
    date,
    missing,
    rosterConfigured: !usedRosterFallback,
    warning: usedRosterFallback
      ? 'No roster configured. Missing students may be incomplete.'
      : null,
  }
}

function upsertManualAttendance({
  guildId,
  userId,
  date,
  checkpointKey,
  status,
  changedBy,
  reason,
  displayName,
  username,
  dutyStation,
}) {
  if (!guildId || !userId || !date || !checkpointKey || !status) {
    return { ok: false, error: 'guildId, userId, date, checkpointKey, and status are required.' }
  }

  const existing = db
    .prepare(
      `SELECT * FROM attendance_checkpoints
       WHERE guild_id=? AND user_id=? AND attendance_date=? AND checkpoint_key=?`
    )
    .get(guildId, userId, date, checkpointKey)

  const cp = (attendanceSettingsService.getCheckpointDefinitions(guildId).definitions || []).find((c) => c.key === checkpointKey)
  const row = upsertCheckpointRow({
    guildId,
    userId,
    username,
    displayName,
    dutyStation,
    attendanceDate: date,
    checkpointKey,
    checkpointLabel: cp?.label || checkpointKey,
    status,
    checkedAtIso: existing?.checked_at || new Date().toISOString(),
    localCheckedAt: existing?.local_checked_at || null,
    source: 'dashboard_manual',
    discordMessageId: existing?.discord_message_id || null,
    channelId: existing?.channel_id || null,
    sessionId: existing?.session_id || null,
    signatureText: existing?.signature_text || displayName || username || userId,
    notes: reason || existing?.notes || null,
  })

  try {
    db.prepare(
      `INSERT INTO attendance_manual_overrides (
        checkpoint_id, guild_id, user_id, attendance_date, checkpoint_key,
        old_status, new_status, reason, changed_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      row?.id || null,
      guildId,
      userId,
      date,
      checkpointKey,
      existing?.status || null,
      status,
      reason || null,
      changedBy || null
    )
  } catch (e) {
    logger.error(`attendance override insert failed: ${e.message}`)
  }

  try {
    activityEventModel.insertEvent({
      type: 'attendance_manual_override',
      userId: changedBy || userId,
      channelId: null,
      sessionId: null,
      metadata: {
        guildId,
        targetUserId: userId,
        date,
        checkpointKey,
        oldStatus: existing?.status || null,
        newStatus: status,
        reason: reason || null,
      },
    })
  } catch (_) {}

  return { ok: true, record: row, previous: existing || null }
}

function exportAttendanceCsv({ guildId, startDate, endDate, courseName = '', cohortId = null, mode = 'range' }) {
  if (!guildId || !startDate || !endDate) {
    return { ok: false, error: 'guildId, startDate, and endDate are required.' }
  }

  const rows = db
    .prepare(
      `SELECT * FROM attendance_checkpoints
       WHERE guild_id=? AND attendance_date BETWEEN ? AND ?
       ORDER BY attendance_date ASC, display_name COLLATE NOCASE, username COLLATE NOCASE`
    )
    .all(guildId, startDate, endDate)

  const defs = attendanceSettingsService.getCheckpointDefinitions(guildId).definitions || []
  const keyToTarget = new Map(defs.map((d) => [d.key, d.targetTime]))

  const header = [
    'Course Name',
    'Cohort',
    'Student Name',
    'Duty Station',
    'Date',
    'Day',
    'Checkpoint Label',
    'Checkpoint Target Time',
    'Status',
    'Checked At',
    'Signature / Confirmation',
    'Source',
    'Notes',
  ]

  const escape = (s) => {
    const v = s == null ? '' : String(s)
    if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`
    return v
  }

  const lines = [header.join(',')]
  const cohortName =
    cohortId && Number.isFinite(Number(cohortId))
      ? db.prepare(`SELECT name FROM cohorts WHERE id=?`).get(Number(cohortId))?.name || ''
      : ''
  const dayName = (isoDate) => {
    const d = new Date(`${isoDate}T00:00:00`)
    return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { weekday: 'short' })
  }

  const existingKeys = new Set(
    rows.map((r) => `${r.user_id}::${r.attendance_date}::${r.checkpoint_key}`)
  )
  const rosterStudents = rosterService.listStudents({ guildId, cohortId, active: true })
  const requiredDefs = defs.filter((d) => d.active && d.required)
  const dateList = []
  for (
    let d = new Date(`${startDate}T00:00:00`);
    d <= new Date(`${endDate}T00:00:00`);
    d.setDate(d.getDate() + 1)
  ) {
    const yyyy = d.getFullYear()
    const mm = String(d.getMonth() + 1).padStart(2, '0')
    const dd = String(d.getDate()).padStart(2, '0')
    dateList.push(`${yyyy}-${mm}-${dd}`)
  }

  const expandedRows = [...rows]
  for (const s of rosterStudents) {
    if (!s.discord_user_id) continue
    for (const dt of dateList) {
      for (const cp of requiredDefs) {
        const key = `${s.discord_user_id}::${dt}::${cp.key}`
        if (existingKeys.has(key)) continue
        expandedRows.push({
          display_name: s.preferred_name || s.full_name,
          username: s.discord_username,
          user_id: s.discord_user_id,
          duty_station: s.duty_station || 'Remote',
          attendance_date: dt,
          checkpoint_key: cp.key,
          checkpoint_label: cp.label,
          status: 'missing',
          local_checked_at: '',
          checked_at: '',
          signature_text: '',
          source: 'roster_expected',
          notes: '',
        })
      }
    }
  }

  for (const r of expandedRows) {
    lines.push(
      [
        courseName,
        cohortName,
        r.display_name || r.username || r.user_id,
        r.duty_station || 'Remote',
        r.attendance_date,
        dayName(r.attendance_date),
        r.checkpoint_label || r.checkpoint_key,
        keyToTarget.get(r.checkpoint_key) || '',
        r.status || '',
        r.local_checked_at || r.checked_at || '',
        r.signature_text || '',
        r.source || '',
        r.notes || '',
      ].map(escape).join(',')
    )
  }

  try {
    activityEventModel.insertEvent({
      type: 'attendance_export_generated',
      userId: 'system',
      channelId: null,
      sessionId: null,
      metadata: { guildId, startDate, endDate, mode },
    })
  } catch (_) {}

  return { ok: true, csv: lines.join('\n'), count: expandedRows.length }
}

function getUserCheckpointRange({ guildId, userId, startDate, endDate }) {
  if (!guildId || !userId || !startDate || !endDate) {
    return { ok: false, error: 'guildId, userId, startDate, and endDate are required.' }
  }
  const rows = db
    .prepare(
      `SELECT * FROM attendance_checkpoints
       WHERE guild_id=? AND user_id=? AND attendance_date BETWEEN ? AND ?
       ORDER BY attendance_date DESC`
    )
    .all(guildId, userId, startDate, endDate)
  return { ok: true, rows }
}

module.exports = {
  resolveCurrentCheckpoint,
  recordCheckpoint,
  getTodayAttendance,
  getWeeklyAttendance,
  getMonthlyAttendance,
  getMissingCheckpoints,
  upsertManualAttendance,
  exportAttendanceCsv,
  getUserCheckpointRange,
}

