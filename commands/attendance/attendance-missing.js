const logger = require('../../utils/logger')
const attendanceService = require('../../services/attendanceCheckpointService')
const { requireInstructor } = require('../../utils/permissions')

module.exports = {
  name: 'attendance-missing',
  description: 'Show missing attendance checkpoints for a date.',
  usage: '!attendance-missing --date YYYY-MM-DD',
  category: 'attendance',
  requiredPermission: 'instructor',
  supportsDashboard: true,

  async execute(message, _args, { parsed } = {}) {
    try {
      if (!message.guild) return message.reply('❌ Server only.')
      const perm = await requireInstructor(message)
      if (!perm.allowed) return message.reply(perm.message || '❌ Instructor permission required.')

      const date = parsed?.options?.date
      if (!date) return message.reply('⚠️ Please provide a date: `!attendance-missing --date YYYY-MM-DD`')

      const res = attendanceService.getMissingCheckpoints({ guildId: message.guild.id, date })
      if (!res.ok) return message.reply(`❌ ${res.error}`)

      const missing = res.missing || []
      if (missing.length === 0) {
        const suffix = res.warning ? `\nℹ️ ${res.warning}` : ''
        return message.reply(`✅ No missing checkpoints detected for ${date}.${suffix}`)
      }

      const lines = [`⚠️ **Missing checkpoints** — ${date}`]
      for (const m of missing.slice(0, 25)) {
        lines.push(`- ${m.name} — \`${m.checkpointKey}\``)
      }
      if (missing.length > 25) lines.push(`_...and ${missing.length - 25} more._`)
      lines.push('')
      if (res.warning) {
        lines.push('')
        lines.push(`ℹ️ ${res.warning}`)
      }
      return message.reply(lines.join('\n'))
    } catch (error) {
      logger.error(`attendance-missing error: ${error.message}`, { error: error.message })
      return message.reply('❌ Could not load missing attendance.')
    }
  },
}

