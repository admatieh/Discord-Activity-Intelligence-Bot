const db = require('../database/db')
const attendanceService = require('./attendanceCheckpointService')
const activityEventModel = require('../modules/activity/activityEventModel')

function parseCsvAttendance(csvText) {
  const text = String(csvText || '').trim()
  if (!text) return { ok: false, error: 'CSV text is empty.' }
  const lines = text.split(/\r?\n/)
  if (lines.length < 2) return { ok: false, error: 'CSV must include a header and at least one row.' }
  const header = lines[0].split(',').map((s) => s.trim())
  const rows = lines.slice(1).filter(Boolean).map((line, i) => {
    const vals = line.split(',')
    const obj = {}
    for (let c = 0; c < header.length; c++) obj[header[c]] = (vals[c] || '').trim()
    return { rowNumber: i + 2, raw: obj }
  })
  return { ok: true, rows, header }
}

function normalizeAttendanceRow(raw) {
  const name = raw['Student Name'] || raw['Full name'] || raw['Full Name'] || ''
  const dutyStation = raw['Duty Station'] || raw['duty station'] || ''
  const date = raw['Date'] || raw['Day & Date'] || ''
  const checkpointLabel = raw['Checkpoint'] || raw['Checkpoint Label'] || ''
  const status = (raw['Status'] || 'imported').toLowerCase()
  const checkedAt = raw['Time'] || raw['Checked At'] || ''
  const signature = raw['Signature / Confirmation'] || raw['Youth signature'] || ''
  const notes = raw['Notes'] || ''
  return {
    studentName: name.trim(),
    dutyStation: dutyStation.trim(),
    date: date.trim(),
    checkpointLabel: checkpointLabel.trim(),
    status: status || 'imported',
    checkedAt: checkedAt.trim(),
    signatureText: signature.trim(),
    notes: notes.trim(),
  }
}

function previewImportRows({ guildId, csvText }) {
  if (!guildId) return { ok: false, error: 'guildId is required.' }
  const parsed = parseCsvAttendance(csvText)
  if (!parsed.ok) return parsed
  const preview = parsed.rows.map((r) => {
    const n = normalizeAttendanceRow(r.raw)
    const valid = Boolean(n.studentName && /^\d{4}-\d{2}-\d{2}/.test(n.date))
    return {
      rowNumber: r.rowNumber,
      raw: r.raw,
      normalized: n,
      status: valid ? 'imported' : 'needs_review',
      error: valid ? null : 'Missing student name or date (YYYY-MM-DD).',
    }
  })
  return { ok: true, rows: preview, total: preview.length }
}

function commitImport({ guildId, csvText, importedBy = 'dashboard' }) {
  if (!guildId) return { ok: false, error: 'guildId is required.' }
  const preview = previewImportRows({ guildId, csvText })
  if (!preview.ok) return preview

  const importRow = db
    .prepare(
      `INSERT INTO attendance_imports (guild_id, filename, file_type, imported_by, status, rows_total, rows_imported, rows_failed)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(guildId, 'csv_paste', 'csv', importedBy, 'pending', preview.total, 0, 0)
  const importId = Number(importRow.lastInsertRowid)

  let imported = 0
  let failed = 0
  const defs = require('./attendanceSettingsService').getCheckpointDefinitions(guildId).definitions || []
  const keyByLabel = new Map(defs.map((d) => [String(d.label || '').toLowerCase(), d.key]))
  const firstKey = defs[0]?.key || 'morning_checkin'

  for (const row of preview.rows) {
    let status = row.status
    let error = row.error
    try {
      if (status !== 'needs_review') {
        const n = row.normalized
        const key = keyByLabel.get(String(n.checkpointLabel || '').toLowerCase()) || firstKey
        const userId = `import:${n.studentName.toLowerCase().replace(/\s+/g, '_')}`
        attendanceService.upsertManualAttendance({
          guildId,
          userId,
          date: n.date.slice(0, 10),
          checkpointKey: key,
          status: n.status || 'imported',
          changedBy: importedBy,
          reason: n.notes || 'Imported from CSV',
          displayName: n.studentName,
          dutyStation: n.dutyStation || 'Remote',
        })
        imported++
      } else {
        failed++
      }
    } catch (e) {
      status = 'failed'
      error = e.message
      failed++
    }
    db.prepare(
      `INSERT INTO attendance_import_rows (import_id, row_number, raw_json, normalized_json, status, error)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      importId,
      row.rowNumber,
      JSON.stringify(row.raw),
      JSON.stringify(row.normalized),
      status,
      error || null
    )
  }

  const finalStatus = failed > 0 ? (imported > 0 ? 'needs_review' : 'failed') : 'completed'
  db.prepare(
    `UPDATE attendance_imports SET status=?, rows_imported=?, rows_failed=? WHERE id=?`
  ).run(finalStatus, imported, failed, importId)

  try {
    activityEventModel.insertEvent({
      type: 'attendance_csv_import_committed',
      userId: importedBy,
      metadata: { guildId, importId, imported, failed },
      channelId: null,
    })
  } catch (_) {}

  return { ok: true, importId, status: finalStatus, imported, failed, total: preview.total }
}

module.exports = {
  parseCsvAttendance,
  normalizeAttendanceRow,
  previewImportRows,
  commitImport,
}

