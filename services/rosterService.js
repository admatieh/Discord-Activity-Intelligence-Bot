const db = require('../database/db')
const { parse } = require('csv-parse/sync')

const ROSTER_HEADER_ALIASES = {
  fullName: ['full name', 'full_name', 'name', 'student_name'],
  preferredName: ['preferred name', 'preferred_name', 'preferred'],
  email: ['email', 'email address', 'e-mail'],
  discordUserId: ['discord user id', 'discord_user_id', 'discord_id', 'discord userid'],
  discordUsername: ['discord username', 'discord_username', 'username', 'discord name'],
  dutyStation: ['duty station', 'duty_station', 'station'],
  studentCode: ['student code', 'student_code', 'code'],
  cohort: ['cohort', 'cohort_name', 'course'],
}

function norm(v) {
  return String(v || '').trim().toLowerCase()
}

function normalizeName(v) {
  return norm(v).replace(/\s+/g, ' ')
}

function resolveColumnMap(headers = [], explicitMap = {}) {
  const normalizedHeaders = headers.map((h) => norm(h))
  const map = {}
  for (const [field, aliases] of Object.entries(ROSTER_HEADER_ALIASES)) {
    const explicit = explicitMap[field]
    if (explicit && normalizedHeaders.includes(norm(explicit))) {
      map[field] = headers[normalizedHeaders.indexOf(norm(explicit))]
      continue
    }
    const hit = aliases.find((a) => normalizedHeaders.includes(a))
    if (hit) map[field] = headers[normalizedHeaders.indexOf(hit)]
  }
  return map
}

function createCohort({ guildId, name, courseName = null, courseCode = null, active = 1 }) {
  if (!guildId || !name) return { ok: false, error: 'guildId and name are required.' }
  const info = db
    .prepare(
      `INSERT INTO cohorts (guild_id, name, course_name, course_code, active, updated_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`
    )
    .run(guildId, name, courseName, courseCode, active ? 1 : 0)
  const row = db.prepare(`SELECT * FROM cohorts WHERE id=?`).get(info.lastInsertRowid)
  return { ok: true, cohort: row }
}

function findCohortByName(guildId, name) {
  if (!guildId || !name) return null
  return db
    .prepare(`SELECT * FROM cohorts WHERE guild_id=? AND LOWER(name)=LOWER(?) LIMIT 1`)
    .get(guildId, String(name).trim())
}

function listCohorts(guildId) {
  if (!guildId) return []
  return db
    .prepare(`SELECT * FROM cohorts WHERE guild_id=? ORDER BY active DESC, created_at DESC`)
    .all(guildId)
}

function getActiveCohort(guildId) {
  if (!guildId) return null
  return db
    .prepare(`SELECT * FROM cohorts WHERE guild_id=? AND active=1 ORDER BY created_at DESC LIMIT 1`)
    .get(guildId)
}

function upsertStudent({
  guildId,
  fullName,
  preferredName = null,
  email = null,
  discordUserId = null,
  discordUsername = null,
  dutyStation = 'Remote',
  studentCode = null,
  active = 1,
}) {
  if (!guildId || !fullName) return { ok: false, error: 'guildId and fullName are required.' }

  let existing = null
  if (discordUserId) {
    existing = db
      .prepare(`SELECT * FROM students WHERE guild_id=? AND discord_user_id=? LIMIT 1`)
      .get(guildId, discordUserId)
  }
  if (!existing && email) {
    existing = db.prepare(`SELECT * FROM students WHERE guild_id=? AND email=? LIMIT 1`).get(guildId, email)
  }
  if (!existing && studentCode) {
    existing = db
      .prepare(`SELECT * FROM students WHERE guild_id=? AND student_code=? LIMIT 1`)
      .get(guildId, studentCode)
  }
  if (!existing && fullName) {
    const normalized = normalizeName(fullName)
    const byName = db
      .prepare(`SELECT * FROM students WHERE guild_id=?`)
      .all(guildId)
      .find((row) => normalizeName(row.full_name) === normalized)
    if (byName) existing = byName
  }

  if (existing) {
    db.prepare(
      `UPDATE students
       SET full_name=?, preferred_name=?, email=?, discord_user_id=?, discord_username=?,
           duty_station=?, student_code=?, active=?, updated_at=datetime('now')
       WHERE id=?`
    ).run(
      fullName,
      preferredName,
      email,
      discordUserId,
      discordUsername,
      dutyStation,
      studentCode,
      active ? 1 : 0,
      existing.id
    )
    return { ok: true, student: db.prepare(`SELECT * FROM students WHERE id=?`).get(existing.id), created: false }
  }

  const info = db
    .prepare(
      `INSERT INTO students (
          guild_id, full_name, preferred_name, email, discord_user_id, discord_username,
          duty_station, student_code, active, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .run(
      guildId,
      fullName,
      preferredName,
      email,
      discordUserId,
      discordUsername,
      dutyStation,
      studentCode,
      active ? 1 : 0
    )

  return { ok: true, student: db.prepare(`SELECT * FROM students WHERE id=?`).get(info.lastInsertRowid), created: true }
}

function findExistingStudentForImport({ guildId, fullName, email, discordUserId, studentCode }) {
  let existing = null
  if (discordUserId) {
    existing = db
      .prepare(`SELECT * FROM students WHERE guild_id=? AND discord_user_id=? LIMIT 1`)
      .get(guildId, discordUserId)
  }
  if (!existing && email) {
    existing = db.prepare(`SELECT * FROM students WHERE guild_id=? AND email=? LIMIT 1`).get(guildId, email)
  }
  if (!existing && studentCode) {
    existing = db
      .prepare(`SELECT * FROM students WHERE guild_id=? AND student_code=? LIMIT 1`)
      .get(guildId, studentCode)
  }
  if (!existing && fullName) {
    const normalized = normalizeName(fullName)
    existing = db
      .prepare(`SELECT * FROM students WHERE guild_id=?`)
      .all(guildId)
      .find((row) => normalizeName(row.full_name) === normalized)
  }
  return existing || null
}

function listStudents({ guildId, cohortId = null, active } = {}) {
  if (!guildId) return []
  const where = ['s.guild_id = ?']
  const params = [guildId]

  if (typeof active === 'boolean') {
    where.push('s.active = ?')
    params.push(active ? 1 : 0)
  }

  let sql = `SELECT s.* FROM students s`
  if (cohortId) {
    sql += ` INNER JOIN cohort_members cm ON cm.student_id = s.id AND cm.cohort_id = ?`
    params.unshift(cohortId)
    where.push('cm.active = 1')
  }
  sql += ` WHERE ${where.join(' AND ')} ORDER BY s.full_name COLLATE NOCASE`
  return db.prepare(sql).all(...params)
}

function getStudentById({ guildId, studentId }) {
  if (!guildId || !studentId) return null
  return db.prepare(`SELECT * FROM students WHERE guild_id=? AND id=?`).get(guildId, Number(studentId))
}

function attachStudentToCohort({ cohortId, studentId, active = 1 }) {
  if (!cohortId || !studentId) return { ok: false, error: 'cohortId and studentId are required.' }
  db.prepare(
    `INSERT INTO cohort_members (cohort_id, student_id, active)
     VALUES (?, ?, ?)
     ON CONFLICT(cohort_id, student_id) DO UPDATE SET active=excluded.active`
  ).run(cohortId, studentId, active ? 1 : 0)
  return { ok: true }
}

function updateStudent({ guildId, studentId, data }) {
  if (!guildId || !studentId) return { ok: false, error: 'guildId and studentId are required.' }
  const existing = getStudentById({ guildId, studentId })
  if (!existing) return { ok: false, error: 'Student not found.' }
  const merged = {
    full_name: data.fullName ?? existing.full_name,
    preferred_name: data.preferredName ?? existing.preferred_name,
    email: data.email ?? existing.email,
    discord_user_id: data.discordUserId ?? existing.discord_user_id,
    discord_username: data.discordUsername ?? existing.discord_username,
    duty_station: data.dutyStation ?? existing.duty_station,
    student_code: data.studentCode ?? existing.student_code,
    active: data.active === undefined ? existing.active : (data.active ? 1 : 0),
  }
  db.prepare(
    `UPDATE students SET
      full_name=?, preferred_name=?, email=?, discord_user_id=?, discord_username=?,
      duty_station=?, student_code=?, active=?, updated_at=datetime('now')
    WHERE guild_id=? AND id=?`
  ).run(
    merged.full_name,
    merged.preferred_name,
    merged.email,
    merged.discord_user_id,
    merged.discord_username,
    merged.duty_station,
    merged.student_code,
    merged.active,
    guildId,
    Number(studentId)
  )
  return { ok: true, student: getStudentById({ guildId, studentId }) }
}

function linkStudentToDiscordUser({ guildId, studentId, discordUserId, discordUsername = null }) {
  if (!guildId || !studentId || !discordUserId) {
    return { ok: false, error: 'guildId, studentId, and discordUserId are required.' }
  }
  const info = db
    .prepare(
      `UPDATE students
       SET discord_user_id=?, discord_username=?, updated_at=datetime('now')
       WHERE guild_id=? AND id=?`
    )
    .run(discordUserId, discordUsername, guildId, Number(studentId))
  if (info.changes < 1) return { ok: false, error: 'Student not found.' }
  return { ok: true }
}

function findStudentByDiscordUserId({ guildId, discordUserId }) {
  if (!guildId || !discordUserId) return null
  return db
    .prepare(`SELECT * FROM students WHERE guild_id=? AND discord_user_id=? AND active=1 LIMIT 1`)
    .get(guildId, discordUserId)
}

function importRosterCsv({
  guildId,
  csvText,
  defaultCohortId = null,
  columnMap = {},
  dryRun = false,
} = {}) {
  if (!guildId) return { ok: false, error: 'guildId is required.' }
  if (!csvText || !String(csvText).trim()) return { ok: false, error: 'csvText is required.' }

  let records = []
  try {
    records = parse(String(csvText), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true,
    })
  } catch (e) {
    return { ok: false, error: `Invalid CSV: ${e.message}` }
  }
  const headers = Object.keys(records[0] || {})
  const resolvedMap = resolveColumnMap(headers, columnMap)

  const result = {
    ok: true,
    rowsTotal: records.length,
    rowsImported: 0,
    rowsUpdated: 0,
    rowsSkipped: 0,
    rowsFailed: 0,
    errors: [],
    warnings: [],
    preview: [],
    mapping: resolvedMap,
  }

  if (!resolvedMap.fullName) {
    return { ok: false, error: 'Could not map Full Name column. Please provide column mapping.' }
  }

  const tx = db.transaction(() => {
    for (let i = 0; i < records.length; i++) {
      const raw = records[i]
      const rowNum = i + 2
      const fullName = String(raw[resolvedMap.fullName] || '').trim()
      if (!fullName) {
        result.rowsFailed++
        result.errors.push({ row: rowNum, error: 'Full Name is required.' })
        continue
      }
      const payload = {
        guildId,
        fullName,
        preferredName: resolvedMap.preferredName ? String(raw[resolvedMap.preferredName] || '').trim() || null : null,
        email: resolvedMap.email ? String(raw[resolvedMap.email] || '').trim() || null : null,
        discordUserId: resolvedMap.discordUserId ? String(raw[resolvedMap.discordUserId] || '').trim() || null : null,
        discordUsername: resolvedMap.discordUsername ? String(raw[resolvedMap.discordUsername] || '').trim() || null : null,
        dutyStation: resolvedMap.dutyStation ? String(raw[resolvedMap.dutyStation] || '').trim() || 'Remote' : 'Remote',
        studentCode: resolvedMap.studentCode ? String(raw[resolvedMap.studentCode] || '').trim() || null : null,
        active: 1,
      }

      const existing = findExistingStudentForImport(payload)
      const action = existing ? 'updated' : 'imported'
      let studentId = existing?.id || null
      if (!dryRun) {
        const upsert = upsertStudent(payload)
        if (!upsert.ok) {
          result.rowsFailed++
          result.errors.push({ row: rowNum, error: upsert.error || 'Failed to upsert student.' })
          continue
        }
        studentId = upsert.student.id
        if (upsert.created) result.rowsImported++
        else result.rowsUpdated++
      } else {
        if (action === 'imported') result.rowsImported++
        else result.rowsUpdated++
      }

      let cohortId = defaultCohortId ? Number(defaultCohortId) : null
      const cohortName = resolvedMap.cohort ? String(raw[resolvedMap.cohort] || '').trim() : ''
      if (cohortName) {
        let cohort = findCohortByName(guildId, cohortName)
        if (!cohort) {
          if (!dryRun) {
            const created = createCohort({ guildId, name: cohortName })
            cohort = created.cohort
          } else {
            cohort = { id: null, name: cohortName }
          }
        }
        cohortId = cohort?.id || cohortId
      } else if (!cohortId) {
        const activeCohort = getActiveCohort(guildId)
        cohortId = activeCohort?.id || null
      }

      if (cohortId && !dryRun && studentId) {
        attachStudentToCohort({ cohortId, studentId, active: 1 })
      }
      if (result.preview.length < 10) {
        result.preview.push({
          row: rowNum,
          fullName,
          action,
          cohortId: cohortId || null,
        })
      }
    }
  })

  tx()

  if (result.rowsFailed > 0) {
    result.warnings.push(`${result.rowsFailed} rows failed validation and were skipped.`)
  }
  return result
}

function exportRosterCsv({ guildId, cohortId = null } = {}) {
  if (!guildId) return { ok: false, error: 'guildId is required.' }
  const header = [
    'Full Name',
    'Preferred Name',
    'Email',
    'Discord User ID',
    'Discord Username',
    'Duty Station',
    'Student Code',
    'Cohort',
  ]
  const students = listStudents({ guildId, cohortId })
  const cohortMap = new Map()
  for (const c of listCohorts(guildId)) cohortMap.set(c.id, c.name)
  const rows = students.map((s) => {
    const cohortLinks = db
      .prepare(`SELECT cohort_id FROM cohort_members WHERE student_id=? AND active=1`)
      .all(s.id)
    const cohortName = cohortLinks.map((r) => cohortMap.get(r.cohort_id)).filter(Boolean).join('; ')
    return [
      s.full_name || '',
      s.preferred_name || '',
      s.email || '',
      s.discord_user_id || '',
      s.discord_username || '',
      s.duty_station || 'Remote',
      s.student_code || '',
      cohortName || '',
    ]
  })
  const escape = (v) => {
    const s = String(v == null ? '' : v)
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [header.join(',')]
  for (const r of rows) lines.push(r.map(escape).join(','))
  return { ok: true, csv: `${lines.join('\n')}\n`, count: rows.length }
}

function findOrCreateStudentFromDiscordMember({ guildId, member }) {
  if (!guildId || !member?.user?.id) return { ok: false, error: 'guildId and member.user.id are required.' }
  const existing = findStudentByDiscordUserId({ guildId, discordUserId: member.user.id })
  if (existing) return { ok: true, student: existing, created: false }
  return upsertStudent({
    guildId,
    fullName: member.displayName || member.user.username || member.user.id,
    preferredName: member.displayName || null,
    discordUserId: member.user.id,
    discordUsername: member.user.username || null,
  })
}

module.exports = {
  createCohort,
  listCohorts,
  getActiveCohort,
  upsertStudent,
  listStudents,
  getStudentById,
  updateStudent,
  attachStudentToCohort,
  linkStudentToDiscordUser,
  importRosterCsv,
  exportRosterCsv,
  findStudentByDiscordUserId,
  findOrCreateStudentFromDiscordMember,
}
