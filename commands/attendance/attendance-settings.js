const logger = require('../../utils/logger')
const { requireInstructor } = require('../../utils/permissions')
const attendanceSettingsService = require('../../services/attendanceSettingsService')

module.exports = {
  name: 'attendance-settings',
  aliases: ['attendance-checkpoints'],
  description: 'Show configured attendance checkpoints for this server.',
  usage: '!attendance-settings',
  category: 'attendance',
  requiredPermission: 'instructor',
  supportsDashboard: true,

  async execute(message) {
    try {
      if (!message.guild) return message.reply('❌ Server only.')
      const perm = await requireInstructor(message)
      if (!perm.allowed) return message.reply(perm.message || '❌ Instructor permission required.')

      const res = attendanceSettingsService.getCheckpointDefinitions(message.guild.id)
      if (!res.ok) return message.reply(`❌ ${res.error}`)
      const defs = res.definitions || []
      const lines = ['⚙️ **Attendance Checkpoint Settings**']
      for (const d of defs) {
        lines.push(
          `- **${d.label}** (\`${d.commandType}\`) at ${d.targetTime} | opens -${d.opensBeforeMinutes}m | late +${d.lateAfterMinutes}m | close ${d.closesAfterMinutes == null ? 'end of day' : `+${d.closesAfterMinutes}m`} | late allowed: ${d.allowLateSubmission ? 'yes' : 'no'} | ${d.active ? 'active' : 'inactive'}`
        )
      }
      return message.reply(lines.join('\n'))
    } catch (error) {
      logger.error(`attendance-settings error: ${error.message}`, { error: error.message })
      return message.reply('❌ Could not load attendance settings.')
    }
  },
}

