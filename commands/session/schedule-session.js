// commands/session/schedule-session.js
//
// Schedule a future voice session.
// Usage:
// !schedule-session --channel <voiceChannelId> --at "today 10:10 AM" --duration 45 --title "Group Focus Session"
// !schedule-session --channel <voiceChannelId> --in 30m --duration 45 --title "Quick Focus Session"

const { requireInstructor } = require('../../utils/permissions');
const schedulerService = require('../../services/schedulerService');
const parseScheduleTime = require('../../utils/parseScheduleTime');

module.exports = {
    name: 'schedule-session',
    description: 'Schedule a voice session to start at a future time.',
    usage: '!schedule-session --channel <voiceChannelId> --at "<time>" [or --in "<relative time>"] --duration <minutes> --title "<title>"',
    category: 'session',
    requiredPermission: 'instructor',
    aliases: ['sched-session'],
    supportsDashboard: true,
    requiresGuild: true,
    requiresVoiceChannel: true,

    options: [
        {
            name: 'channel',
            type: 'string',
            required: true,
            description: 'Voice channel ID to record'
        },
        {
            name: 'at',
            type: 'string',
            required: false,
            description: 'Time, e.g. "today 10:10 AM", "tomorrow 2:30 PM", or ISO'
        },
        {
            name: 'in',
            type: 'string',
            required: false,
            description: 'Relative time, e.g. "30m", "1h 30m"'
        },
        {
            name: 'duration',
            type: 'number',
            required: false,
            description: 'Duration in minutes',
            default: 60
        },
        {
            name: 'title',
            type: 'string',
            required: false,
            description: 'Session title'
        },
        {
            name: 'private',
            type: 'boolean',
            required: false,
            description: 'Send the response privately by DM'
        },
        {
            name: 'quiet',
            type: 'boolean',
            required: false,
            description: 'Only send a short confirmation'
        },
        {
            name: 'silent',
            type: 'boolean',
            required: false,
            description: 'Do not send a public response'
        }
    ],

    async execute(message, args = {}, context = {}) {
        const permission = await requireInstructor(message);

        if (!permission.allowed) {
            return message.reply(permission.message);
        }

        let voiceChannelId = args.channel;

        if (typeof voiceChannelId === 'object' && voiceChannelId !== null) {
            voiceChannelId = voiceChannelId.id;
        } else if (voiceChannelId) {
            voiceChannelId = String(voiceChannelId).replace(/[<#>]/g, '');
        }

        let guildId = context?.guild?.id || message?.guild?.id;

        if (typeof guildId === 'object' && guildId !== null) {
            guildId = guildId.id;
        }

        if (typeof voiceChannelId === 'object' && voiceChannelId !== null) {
            return '❌ voiceChannelId must be a string ID.';
        }

        if (typeof guildId === 'object' && guildId !== null) {
            return '❌ guildId must be a string ID.';
        }

        let durationMinutes = args.duration ? Number(args.duration) : 60;

        if (Number.isNaN(durationMinutes) || durationMinutes <= 0) {
            durationMinutes = 60;
        }

        const title = args.title ? String(args.title) : null;
        const rawTimeInput = args.at || args.in;

        if (!voiceChannelId) {
            return '❌ --channel (voice channel ID) is required.';
        }

        if (!rawTimeInput) {
            return '❌ --at (e.g. "tomorrow 2:30 PM") or --in (e.g. "30m") is required.';
        }

        if (!guildId) {
            return '❌ Guild context required.';
        }

        const parsedTimeResult = parseScheduleTime(rawTimeInput);

        if (!parsedTimeResult.ok) {
            let errStr = `❌ ${parsedTimeResult.error}`;

            if (parsedTimeResult.examples && parsedTimeResult.examples.length) {
                errStr += `\nExamples:\n- ${parsedTimeResult.examples.join('\n- ')}`;
            }

            return errStr;
        }

        const result = schedulerService.scheduleSession({
            guildId: String(guildId),
            voiceChannelId: String(voiceChannelId),
            title,
            scheduledFor: parsedTimeResult.scheduledFor,
            durationMinutes,
            createdBy: String(
                context?.user?.username ||
                message?.author?.username ||
                'command'
            )
        });

        if (result.ok) {
            return `✅ Session "${title || 'Untitled'}" scheduled for ${parsedTimeResult.displayTime}. Item ID: #${result.id}`;
        }

        return `❌ Failed to schedule session: ${result.error}`;
    }
};