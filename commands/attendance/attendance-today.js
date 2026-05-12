const logger = require('../../utils/logger')
const attendanceService = require('../../services/attendanceCheckpointService')
const { requireInstructor } = require('../../utils/permissions')
const attendanceConfig = require('../../config/attendanceConfig')

function summarize(rows) {
  const byKey = new Map()
  for (const cp of attendanceConfig.CHECKPOINTS) {
    byKey.set(cp.key, { present: 0, late: 0, other: 0 })
  }
  for (const r of rows) {
    const bucket = byKey.get(r.checkpoint_key) || { present: 0, late: 0, other: 0 }
    if (r.status === 'present') bucket.present++
    else if (r.status === 'late') bucket.late++
    else bucket.other++
    byKey.set(r.checkpoint_key, bucket)
  }
  return byKey
}

module.exports = {
  name: 'attendance-today',
  description: "Instructor summary of today's attendance checkpoints.",
  usage: '!attendance-today [--date YYYY-MM-DD]',
  category: 'attendance',
  requiredPermission: 'instructor',
  supportsDashboard: true,

  async execute(message, _args, { parsed } = {}) {
    try {
      if (!message.guild) return message.reply('❌ Server only.')

      const perm = await requireInstructor(message)
      if (!perm.allowed) return message.reply(perm.message || '❌ Instructor permission required.')

      const date = parsed?.options?.date
      const res = attendanceService.getTodayAttendance({ guildId: message.guild.id, date })
      if (!res.ok) return message.reply(`❌ ${res.error}`)

      const sums = summarize(res.rows || [])
      const lines = [`📋 **Attendance Today** — ${res.attendanceDate}`]
      for (const cp of attendanceConfig.CHECKPOINTS) {
        const s = sums.get(cp.key) || { present: 0, late: 0, other: 0 }
        lines.push(`- **${cp.label}**: ${s.present} present, ${s.late} late${s.other ? `, ${s.other} other` : ''}`)
      }

      if ((res.rows || []).length === 0) {
        lines.push('')
        lines.push('ℹ️ No attendance check-ins recorded yet. Students can type `!checkin` or `!checkout` during an open checkpoint.')
      }

      return message.reply(lines.join('\n'))
    } catch (error) {
      logger.error(`attendance-today error: ${error.message}`, { error: error.message })
      return message.reply('❌ Could not load attendance summary.')
    }
  },
}

