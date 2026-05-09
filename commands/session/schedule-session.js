// commands/session/schedule-session.js
//
// Schedule a future voice session.
// Usage: !schedule-session --channel <voiceChannelId> --at "2026-05-09 14:00" --duration 60 --title "Study Session"

const schedulerService = require('../../services/schedulerService');

module.exports = {
    name: 'schedule-session',
    description: 'Schedule a voice session to start at a future time.',
    usage: '!schedule-session --channel <voiceChannelId> --at "<datetime>" --duration <minutes> --title "<title>"',
    category: 'session',
    aliases: ['sched-session'],
    supportsDashboard: true,
    requiresGuild: true,
    requiresVoiceChannel: true,
    options: [
        { name: 'channel', type: 'string', required: true, description: 'Voice channel ID to record' },
        { name: 'at', type: 'string', required: true, description: 'ISO datetime or readable date string' },
        { name: 'duration', type: 'number', required: false, description: 'Duration in minutes (default: 60)', default: 60 },
        { name: 'title', type: 'string', required: false, description: 'Session title' }
    ],

    async execute(message, args, context) {
        const voiceChannelId = args.channel;
        const scheduledFor = args.at;
        const durationMinutes = args.duration ? Number(args.duration) : 60;
        const title = args.title || null;
        const guildId = context?.guild?.id || message?.guild?.id;

        if (!voiceChannelId) return '❌ --channel (voice channel ID) is required.';
        if (!scheduledFor) return '❌ --at (schedule datetime) is required.';
        if (!guildId) return '❌ Guild context required.';

        const result = schedulerService.scheduleSession({
            guildId,
            voiceChannelId,
            title,
            scheduledFor,
            durationMinutes,
            createdBy: context?.user?.username || message?.author?.username || 'command'
        });

        if (result.ok) {
            return `✅ Session "${title || 'Untitled'}" scheduled for ${new Date(scheduledFor).toLocaleString()}. Item ID: #${result.id}`;
        }
        return `❌ Failed to schedule session: ${result.error}`;
    }
};
