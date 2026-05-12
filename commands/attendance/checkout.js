const logger = require('../../utils/logger')
const attendanceService = require('../../services/attendanceCheckpointService')

module.exports = {
  name: 'checkout',
  description: 'Confirm your attendance for the currently open checkout checkpoint.',
  usage: '!checkout',
  category: 'attendance',
  requiredPermission: 'public',
  supportsDashboard: true,
  privacy: 'self-only',

  async execute(message) {
    try {
      if (!message.guild) return message.reply('❌ Server only.')

      const userId = message.author?.id
      if (!userId) return message.reply('❌ Could not determine your user ID.')

      const displayName =
        message.member?.displayName ||
        message.author?.globalName ||
        message.author?.username ||
        null

      const result = attendanceService.recordCheckpoint({
        guildId: message.guild.id,
        userId,
        username: message.author?.username || null,
        displayName,
        channelId: message.channel?.id || null,
        messageId: message.id || null,
        commandType: 'checkout',
        source: 'discord_command',
      })

      if (!result.ok) {
        if (result.nextCheckpoint?.targetTime) {
          return message.reply(
            `⏳ No checkout checkpoint is currently available. Next checkpoint: **${result.nextCheckpoint.label}** at **${result.nextCheckpoint.targetTime}**.`
          )
        }
        return message.reply(`⏳ ${result.error}`)
      }

      const label = result.checkpoint?.label || 'Checkout'
      const status = result.status === 'late' ? '⏰ Late' : '✅'
      const time = result.record?.local_checked_at || result.record?.checked_at || ''
      if (result.status === 'late') {
        return message.reply(`⚠️ **${label}** recorded as late${time ? ` at ${time}.` : '.'}`)
      }
      return message.reply(`${status} **${label}** recorded${time ? ` at ${time}.` : '.'}`)
    } catch (error) {
      logger.error(`checkout error: ${error.message}`, { error: error.message })
      return message.reply('❌ Could not record your checkout.')
    }
  },
}

