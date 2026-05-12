const logger = require('../../utils/logger')
const attendanceService = require('../../services/attendanceCheckpointService')
const attendanceSettingsService = require('../../services/attendanceSettingsService')
const { requireInstructor } = require('../../utils/permissions')

function isoDate(d) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function startOfWeekMonday(date) {
  const d = new Date(date)
  const day = d.getDay() // 0..6 (Sun..Sat)
  const diff = (day === 0 ? -6 : 1) - day
  d.setDate(d.getDate() + diff)
  return d
}

module.exports = {
  name: 'attendance-week',
  description: 'Instructor weekly summary of attendance checkpoints.',
  usage: '!attendance-week [--weekStart YYYY-MM-DD] [--weekEnd YYYY-MM-DD]',
  category: 'attendance',
  requiredPermission: 'instructor',
  supportsDashboard: true,

  async execute(message, _args, { parsed } = {}) {
    try {
      if (!message.guild) return message.reply('❌ Server only.')

      const perm = await requireInstructor(message)
      if (!perm.allowed) return message.reply(perm.message || '❌ Instructor permission required.')

      const optStart = parsed?.options?.weekStart
      const optEnd = parsed?.options?.weekEnd

      const start = optStart ? new Date(optStart) : startOfWeekMonday(new Date())
      const end = optEnd ? new Date(optEnd) : new Date(start.getTime() + 6 * 24 * 60 * 60 * 1000)
      const weekStart = isoDate(start)
      const weekEnd = isoDate(end)

      const res = attendanceService.getWeeklyAttendance({ guildId: message.guild.id, weekStart, weekEnd })
      if (!res.ok) return message.reply(`❌ ${res.error}`)
      const defsRes = attendanceSettingsService.getCheckpointDefinitions(message.guild.id)
      const checkpoints = (defsRes.definitions || []).filter((d) => d.active)

      const rows = res.rows || []
      if (rows.length === 0) {
        return message.reply(`📅 **Attendance Week** — ${weekStart} to ${weekEnd}\nℹ️ No attendance checkpoints recorded yet this week.`)
      }

      // Simple totals by checkpoint key
      const counts = new Map(checkpoints.map((c) => [c.key, { present: 0, late: 0 }]))
      for (const r of rows) {
        const c = counts.get(r.checkpoint_key) || { present: 0, late: 0 }
        if (r.status === 'present') c.present++
        else if (r.status === 'late') c.late++
        counts.set(r.checkpoint_key, c)
      }

      const lines = [`📅 **Attendance Week** — ${weekStart} to ${weekEnd}`]
      for (const cp of checkpoints) {
        const c = counts.get(cp.key) || { present: 0, late: 0 }
        lines.push(`- **${cp.label}**: ${c.present} present, ${c.late} late`)
      }
      lines.push('')
      lines.push('Tip: use the dashboard Attendance page for per-student daily matrices and exports.')
      return message.reply(lines.join('\n'))
    } catch (error) {
      logger.error(`attendance-week error: ${error.message}`, { error: error.message })
      return message.reply('❌ Could not load weekly attendance.')
    }
  },
}

