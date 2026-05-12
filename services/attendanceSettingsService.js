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
  },
]

function normalizeDefinition(data) {
  return {
    key: String(data.key || '').trim(),
    label: String(data.label || '').trim(),
    commandType: data.commandType === 'checkout' ? 'checkout' : 'checkin',
    targetTime: String(data.targetTime || '').trim(),
    opensBeforeMinutes: Number.isFinite(Number(data.opensBeforeMinutes)) ? Number(data.opensBeforeMinutes) : 15,
    lateAfterMinutes: Number.isFinite(Number(data.lateAfterMinutes)) ? Number(data.lateAfterMinutes) : 15,
    closesAfterMinutes:
      data.closesAfterMinutes == null || data.closesAfterMinutes === ''
        ? null
        : Number(data.closesAfterMinutes),
    allowLateSubmission: data.allowLateSubmission !== false,
    allowAfterCloseManualOnly: data.allowAfterCloseManualOnly === true,
    required: data.required !== false,
    active: data.active !== false,
    sortOrder: Number.isFinite(Number(data.sortOrder)) ? Number(data.sortOrder) : 0,
    timezone: String(data.timezone || DEFAULT_TIMEZONE),
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
      required, active, sort_order, timezone, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
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
    .map((r) => ({
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
      sortOrder: r.sort_order,
      timezone: r.timezone || DEFAULT_TIMEZONE,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }))
  return { ok: true, definitions: rows }
}

function createCheckpointDefinition(guildId, data, changedBy = 'system') {
  if (!guildId) return { ok: false, error: 'guildId is required.' }
  const d = normalizeDefinition(data || {})
  if (!d.key || !d.label || !/^\d{2}:\d{2}$/.test(d.targetTime)) {
    return { ok: false, error: 'key, label, and targetTime (HH:mm) are required.' }
  }
  const info = db
    .prepare(
      `INSERT INTO attendance_checkpoint_definitions (
        guild_id, key, label, command_type, target_time,
        opens_before_minutes, late_after_minutes, closes_after_minutes,
        allow_late_submission, allow_after_close_manual_only,
        required, active, sort_order, timezone, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`
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
      d.sortOrder,
      d.timezone
    )
  const row = db
    .prepare('SELECT * FROM attendance_checkpoint_definitions WHERE id=?')
    .get(info.lastInsertRowid)
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
  const d = normalizeDefinition(data || {})
  const info = db
    .prepare(
      `UPDATE attendance_checkpoint_definitions SET
        key=?, label=?, command_type=?, target_time=?,
        opens_before_minutes=?, late_after_minutes=?, closes_after_minutes=?,
        allow_late_submission=?, allow_after_close_manual_only=?,
        required=?, active=?, sort_order=?, timezone=?, updated_at=datetime('now')
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
      d.sortOrder,
      d.timezone,
      guildId,
      Number(checkpointId)
    )
  if (info.changes < 1) return { ok: false, error: 'Checkpoint not found.' }
  const row = db
    .prepare('SELECT * FROM attendance_checkpoint_definitions WHERE guild_id=? AND id=?')
    .get(guildId, Number(checkpointId))
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

function deleteCheckpointDefinition(guildId, checkpointId, changedBy = 'system') {
  const info = db
    .prepare('DELETE FROM attendance_checkpoint_definitions WHERE guild_id=? AND id=?')
    .run(guildId, Number(checkpointId))
  if (info.changes < 1) return { ok: false, error: 'Checkpoint not found.' }
  try {
    activityEventModel.insertEvent({
      type: 'attendance_checkpoint_setting_deleted',
      userId: changedBy,
      channelId: null,
      metadata: { guildId, checkpointId: Number(checkpointId) },
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
}

