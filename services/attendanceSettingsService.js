const db = require('../database/db')
const activityEventModel = require('../modules/activity/activityEventModel')

const DEFAULT_TIMEZONE = process.env.ATTENDANCE_TIMEZONE || 'Asia/Beirut'

const DEFAULT_CHECKPOINTS = [
  {
    key: 'morning_checkin',
    label: 'Morning check-in',
    commandType: 'checkin',
    targetTime: '09:00',
    opensBeforeMinutes: 15,
    lateAfterMinutes: 15,
    closesAfterMinutes: null,
    allowLateSubmission: true,
    allowAfterCloseManualOnly: false,
    required: true,
    active: true,
    sortOrder: 10,
    includeInOfficialCompletion: true,
  },
  {
    key: 'midday_checkin',
    label: 'Midday check-in',
    commandType: 'checkin',
    targetTime: '12:00',
    opensBeforeMinutes: 15,
    lateAfterMinutes: 15,
    closesAfterMinutes: null,
    allowLateSubmission: true,
    allowAfterCloseManualOnly: false,
    required: true,
    active: true,
    sortOrder: 20,
    includeInOfficialCompletion: true,
  },
  {
    key: 'checkout',
    label: 'Checkout',
    commandType: 'checkout',
    targetTime: '16:00',
    opensBeforeMinutes: 15,
    lateAfterMinutes: 15,
    closesAfterMinutes: null,
    allowLateSubmission: true,
    allowAfterCloseManualOnly: false,
    required: true,
    active: true,
    sortOrder: 30,
    includeInOfficialCompletion: true,
  },
]

function slugKeyFromLabel(label) {
  const base = String(label || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48)
  return base || 'checkpoint'
}

function allocateCheckpointKey(guildId, desiredKey) {
  let k = desiredKey
  let n = 0
  while (db.prepare('SELECT 1 FROM attendance_checkpoint_definitions WHERE guild_id=? AND key=?').get(guildId, k)) {
    n += 1
    k = `${desiredKey}_${n}`
  }
  return k
}

function normalizeDefinition(data) {
  return {
    key: String(data.key || '').trim(),
    label: String(data.label || '').trim(),
    commandType: data.commandType === 'checkout' ? 'checkout' : 'checkin',
    targetTime: String(data.targetTime || '').trim(),
    opensBeforeMinutes: Number.isFinite(Number(data.opensBeforeMinutes)) ? Number(data.opensBeforeMinutes) : 15,
    lateAfterMinutes: Number.isFinite(Number(data.lateAfterMinutes)) ? Number(data.lateAfterMinutes) : 15,
    closesAfterMinutes:
      data.closesAfterMinutes == null || data.closesAfterMinutes === '' || data.closesAfterMinutes === 'null'
        ? null
        : Number(data.closesAfterMinutes),
    allowLateSubmission: data.allowLateSubmission !== false,
    allowAfterCloseManualOnly: data.allowAfterCloseManualOnly === true,
    required: data.required !== false,
    active: data.active !== false,
    includeInOfficialCompletion: data.includeInOfficialCompletion !== false,
    sortOrder: Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : 0,
    timezone: String(data.timezone || DEFAULT_TIMEZONE),
  }
}

function mapRow(r) {
  if (!r) return null
  return {
    id: r.id,
    guildId: r.guild_id,
    key: r.key,
    label: r.label,
    commandType: r.command_type,
    targetTime: r.target_time,
    opensBeforeMinutes: r.opens_before_minutes,
    lateAfterMinutes: r.late_after_minutes,
    closesAfterMinutes: r.closes_after_minutes,
    allowLateSubmission: r.allow_late_submission === 1,
    allowAfterCloseManualOnly: r.allow_after_close_manual_only === 1,
    required: r.required === 1,
    active: r.active === 1,
    includeInOfficialCompletion: !(r.include_in_official_completion === 0),
    sortOrder: r.sort_order,
    timezone: r.timezone || DEFAULT_TIMEZONE,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

function ensureDefaultCheckpointDefinitions(guildId) {
  const c = db
    .prepare('SELECT COUNT(*) as n FROM attendance_checkpoint_definitions WHERE guild_id=?')
    .get(guildId)?.n
  if (Number(c) > 0) return

  const stmt = db.prepare(`
    INSERT INTO attendance_checkpoint_definitions (
      guild_id, key, label, command_type, target_time,
      opens_before_minutes, late_after_minutes, closes_after_minutes,
      allow_late_submission, allow_after_close_manual_only,
      required, active, include_in_official_completion, sort_order, timezone, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `)
  const tx = db.transaction(() => {
    for (const d of DEFAULT_CHECKPOINTS) {
      stmt.run(
        guildId,
        d.key,
        d.label,
        d.commandType,
        d.targetTime,
        d.opensBeforeMinutes,
        d.lateAfterMinutes,
        d.closesAfterMinutes,
        d.allowLateSubmission ? 1 : 0,
        d.allowAfterCloseManualOnly ? 1 : 0,
        d.required ? 1 : 0,
        d.active ? 1 : 0,
        d.includeInOfficialCompletion !== false ? 1 : 0,
        d.sortOrder,
        d.timezone || DEFAULT_TIMEZONE
      )
    }
  })
  tx()
}

function getCheckpointDefinitions(guildId) {
  if (!guildId) return { ok: false, error: 'guildId is required.' }
  ensureDefaultCheckpointDefinitions(guildId)
  const rows = db
    .prepare(
      `SELECT * FROM attendance_checkpoint_definitions
       WHERE guild_id=?
       ORDER BY sort_order ASC, id ASC`
    )
    .all(guildId)
    .map(mapRow)
  return { ok: true, definitions: rows }
}

function createCheckpointDefinition(guildId, data, changedBy = 'system') {
  if (!guildId) return { ok: false, error: 'guildId is required.' }
  const raw = { ...(data || {}) }
  let d = normalizeDefinition(raw)
  if (!d.label || !/^\d{2}:\d{2}$/.test(d.targetTime)) {
    return { ok: false, error: 'label and targetTime (HH:mm) are required.' }
  }
  if (!d.key) {
    d = { ...d, key: allocateCheckpointKey(guildId, slugKeyFromLabel(d.label)) }
  } else {
    const want = String(raw.key || '').trim()
    const taken = db.prepare('SELECT 1 FROM attendance_checkpoint_definitions WHERE guild_id=? AND key=?').get(guildId, want)
    d = { ...d, key: taken ? allocateCheckpointKey(guildId, want) : want }
  }
  const info = db
    .prepare(
      `INSERT INTO attendance_checkpoint_definitions (
        guild_id, key, label, command_type, target_time,
        opens_before_minutes, late_after_minutes, closes_after_minutes,
        allow_late_submission, allow_after_close_manual_only,
        required, active, include_in_official_completion, sort_order, timezone, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
    )
    .run(
      guildId,
      d.key,
      d.label,
      d.commandType,
      d.targetTime,
      d.opensBeforeMinutes,
      d.lateAfterMinutes,
      d.closesAfterMinutes,
      d.allowLateSubmission ? 1 : 0,
      d.allowAfterCloseManualOnly ? 1 : 0,
      d.required ? 1 : 0,
      d.active ? 1 : 0,
      d.includeInOfficialCompletion ? 1 : 0,
      d.sortOrder,
      d.timezone
    )
  const row = db.prepare('SELECT * FROM attendance_checkpoint_definitions WHERE id=?').get(info.lastInsertRowid)
  try {
    activityEventModel.insertEvent({
      type: 'attendance_checkpoint_setting_created',
      userId: changedBy,
      channelId: null,
      metadata: { guildId, checkpointId: row?.id, key: d.key },
    })
  } catch (_) {}
  return { ok: true, row }
}

function updateCheckpointDefinition(guildId, checkpointId, data, changedBy = 'system') {
  if (!guildId || !checkpointId) return { ok: false, error: 'guildId and checkpointId are required.' }
  const existing = db
    .prepare('SELECT * FROM attendance_checkpoint_definitions WHERE guild_id=? AND id=?')
    .get(guildId, Number(checkpointId))
  if (!existing) return { ok: false, error: 'Checkpoint not found.' }

  const merged = {
    ...mapRow(existing),
    ...(data || {}),
  }
  if (data?.allowKeyChange !== true) {
    merged.key = existing.key
  }
  const d = normalizeDefinition(merged)
  const info = db
    .prepare(
      `UPDATE attendance_checkpoint_definitions SET
        key=?, label=?, command_type=?, target_time=?,
        opens_before_minutes=?, late_after_minutes=?, closes_after_minutes=?,
        allow_late_submission=?, allow_after_close_manual_only=?,
        required=?, active=?, include_in_official_completion=?, sort_order=?, timezone=?, updated_at=datetime('now')
       WHERE guild_id=? AND id=?`
    )
    .run(
      d.key,
      d.label,
      d.commandType,
      d.targetTime,
      d.opensBeforeMinutes,
      d.lateAfterMinutes,
      d.closesAfterMinutes,
      d.allowLateSubmission ? 1 : 0,
      d.allowAfterCloseManualOnly ? 1 : 0,
      d.required ? 1 : 0,
      d.active ? 1 : 0,
      d.includeInOfficialCompletion ? 1 : 0,
      d.sortOrder,
      d.timezone,
      guildId,
      Number(checkpointId)
    )
  if (info.changes < 1) return { ok: false, error: 'Checkpoint not found.' }
  const row = db.prepare('SELECT * FROM attendance_checkpoint_definitions WHERE guild_id=? AND id=?').get(guildId, Number(checkpointId))
  try {
    activityEventModel.insertEvent({
      type: 'attendance_checkpoint_setting_updated',
      userId: changedBy,
      channelId: null,
      metadata: { guildId, checkpointId: Number(checkpointId) },
    })
  } catch (_) {}
  return { ok: true, row }
}

function countCheckpointAttendanceRecords(guildId, checkpointKey) {
  const n =
    db
      .prepare('SELECT COUNT(*) as n FROM attendance_checkpoints WHERE guild_id=? AND checkpoint_key=?')
      .get(guildId, checkpointKey)?.n || 0
  return Number(n)
}

function deleteCheckpointDefinition(guildId, checkpointId, changedBy = 'system', options = {}) {
  const row = db
    .prepare('SELECT * FROM attendance_checkpoint_definitions WHERE guild_id=? AND id=?')
    .get(guildId, Number(checkpointId))
  if (!row) return { ok: false, error: 'Checkpoint not found.' }
  const cnt = countCheckpointAttendanceRecords(guildId, row.key)
  if (cnt > 0 && !options.force) {
    db.prepare(
      `UPDATE attendance_checkpoint_definitions SET active=0, updated_at=datetime('now') WHERE guild_id=? AND id=?`
    ).run(guildId, Number(checkpointId))
    try {
      activityEventModel.insertEvent({
        type: 'attendance_checkpoint_setting_deactivated',
        userId: changedBy,
        channelId: null,
        metadata: { guildId, checkpointId: Number(checkpointId), reason: 'has_attendance_records' },
      })
    } catch (_) {}
    return {
      ok: true,
      deactivated: true,
      message: 'This checkpoint already has attendance records. It was deactivated instead.',
    }
  }
  const info = db.prepare('DELETE FROM attendance_checkpoint_definitions WHERE guild_id=? AND id=?').run(guildId, Number(checkpointId))
  if (info.changes < 1) return { ok: false, error: 'Checkpoint not found.' }
  try {
    activityEventModel.insertEvent({
      type: 'attendance_checkpoint_setting_deleted',
      userId: changedBy,
      channelId: null,
      metadata: { guildId, checkpointId: Number(checkpointId) },
    })
  } catch (_) {}
  return { ok: true, deleted: true }
}

function deactivateCheckpointDefinition(guildId, checkpointId, changedBy = 'system') {
  const info = db
    .prepare(
      `UPDATE attendance_checkpoint_definitions SET active=0, updated_at=datetime('now') WHERE guild_id=? AND id=?`
    )
    .run(guildId, Number(checkpointId))
  if (info.changes < 1) return { ok: false, error: 'Checkpoint not found.' }
  try {
    activityEventModel.insertEvent({
      type: 'attendance_checkpoint_setting_deactivated',
      userId: changedBy,
      channelId: null,
      metadata: { guildId, checkpointId: Number(checkpointId) },
    })
  } catch (_) {}
  return { ok: true }
}

function reorderCheckpointDefinitions(guildId, orderedIds = [], changedBy = 'system') {
  if (!guildId || !Array.isArray(orderedIds) || orderedIds.length === 0) {
    return { ok: false, error: 'guildId and orderedIds are required.' }
  }
  const tx = db.transaction(() => {
    orderedIds.forEach((id, idx) => {
      db.prepare(
        `UPDATE attendance_checkpoint_definitions SET sort_order=?, updated_at=datetime('now') WHERE guild_id=? AND id=?`
      ).run((idx + 1) * 10, guildId, Number(id))
    })
  })
  tx()
  try {
    activityEventModel.insertEvent({
      type: 'attendance_checkpoint_settings_reordered',
      userId: changedBy,
      channelId: null,
      metadata: { guildId, orderedIds },
    })
  } catch (_) {}
  return { ok: true }
}

function restoreDefaultCheckpointDefinitions(guildId, changedBy = 'system') {
  if (!guildId) return { ok: false, error: 'guildId is required.' }
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO attendance_checkpoint_definitions (
      guild_id, key, label, command_type, target_time,
      opens_before_minutes, late_after_minutes, closes_after_minutes,
      allow_late_submission, allow_after_close_manual_only,
      required, active, include_in_official_completion, sort_order, timezone, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `)
  const tx = db.transaction(() => {
    for (const d of DEFAULT_CHECKPOINTS) {
      stmt.run(
        guildId,
        d.key,
        d.label,
        d.commandType,
        d.targetTime,
        d.opensBeforeMinutes,
        d.lateAfterMinutes,
        d.closesAfterMinutes,
        d.allowLateSubmission ? 1 : 0,
        d.allowAfterCloseManualOnly ? 1 : 0,
        d.required ? 1 : 0,
        d.active ? 1 : 0,
        d.includeInOfficialCompletion !== false ? 1 : 0,
        d.sortOrder,
        d.timezone || DEFAULT_TIMEZONE
      )
    }
  })
  tx()
  try {
    activityEventModel.insertEvent({
      type: 'attendance_checkpoint_settings_restore_defaults',
      userId: changedBy,
      channelId: null,
      metadata: { guildId },
    })
  } catch (_) {}
  return { ok: true }
}

module.exports = {
  DEFAULT_CHECKPOINTS,
  ensureDefaultCheckpointDefinitions,
  getCheckpointDefinitions,
  createCheckpointDefinition,
  updateCheckpointDefinition,
  deleteCheckpointDefinition,
  deactivateCheckpointDefinition,
  reorderCheckpointDefinitions,
  restoreDefaultCheckpointDefinitions,
  countCheckpointAttendanceRecords,
}
