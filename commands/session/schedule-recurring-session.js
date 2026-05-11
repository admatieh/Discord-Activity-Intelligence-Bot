// commands/session/schedule-recurring-session.js
//
// Schedule a recurring weekly voice session.
// Usage:
//   !schedule-recurring-session --channel <voiceChannelId> --days MO,TU,WE,TH --time "09:00" --duration 60 --title "Daily Study Session"
//   !schedule-recurring-session --channel <id> --days MO,WE,FR --time "14:00" --timezone "Asia/Beirut" --title "Afternoon Study"
//
// Aliases: !recurring-session, !weekly-session

const { requireInstructor } = require('../../utils/permissions');
const schedulerService = require('../../services/schedulerService');
const { formatRecurrenceRuleHuman, DAY_CODE_TO_SHORT, DEFAULT_TIMEZONE } = require('../../utils/recurrence');

const VALID_DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

module.exports = {
    name: 'schedule-recurring-session',
    description: 'Schedule a recurring weekly voice session.',
    usage: '!schedule-recurring-session --channel <voiceChannelId> --days MO,TU,WE,TH --time "09:00" --duration 60 --title "Session Title"',
    category: 'session',
    requiredPermission: 'instructor',
    aliases: ['recurring-session', 'weekly-session'],
    supportsDashboard: true,
    requiresGuild: true,

    options: [
        { name: 'channel', type: 'string', required: true, description: 'Voice channel ID to record' },
        { name: 'days', type: 'string', required: true, description: 'Comma-separated day codes: MO,TU,WE,TH,FR,SA,SU' },
        { name: 'time', type: 'string', required: true, description: 'Local time in HH:mm (e.g. 09:00)' },
        { name: 'duration', type: 'number', required: false, description: 'Duration in minutes (default: 60)', default: 60 },
        { name: 'title', type: 'string', required: false, description: 'Session title' },
        { name: 'timezone', type: 'string', required: false, description: `IANA timezone (default: ${DEFAULT_TIMEZONE})` },
        { name: 'text-channel', type: 'string', required: false, description: 'Text channel ID for announcements/reports' }
    ],

    async execute(message, args = {}, context = {}) {
        const permission = await requireInstructor(message);
        if (!permission.allowed) {
            return message.reply(permission.message);
        }

        // --- Resolve guild ID ---
        let guildId = context?.guild?.id || message?.guild?.id;
        if (typeof guildId === 'object' && guildId !== null) guildId = guildId.id;
        if (!guildId) return '❌ Guild context required.';

        // --- Resolve voice channel ID ---
        let voiceChannelId = args.channel;
        if (typeof voiceChannelId === 'object' && voiceChannelId !== null) {
            voiceChannelId = voiceChannelId.id;
        } else if (voiceChannelId) {
            voiceChannelId = String(voiceChannelId).replace(/[<#>]/g, '');
        }
        if (!voiceChannelId) return '❌ --channel (voice channel ID) is required.';

        // --- Resolve optional text channel ---
        let textChannelId = args['text-channel'] || args.textChannel || null;
        if (typeof textChannelId === 'object' && textChannelId !== null) textChannelId = textChannelId.id;
        if (textChannelId) textChannelId = String(textChannelId).replace(/[<#>]/g, '');

        // --- Parse days ---
        const rawDays = args.days;
        if (!rawDays) return '❌ --days is required. Example: --days MO,TU,WE,TH';

        const daysOfWeek = String(rawDays)
            .toUpperCase()
            .split(',')
            .map(d => d.trim())
            .filter(Boolean);

        const invalidDays = daysOfWeek.filter(d => !VALID_DAYS.includes(d));
        if (invalidDays.length > 0) {
            return `❌ Invalid day code(s): ${invalidDays.join(', ')}. Valid codes: MO, TU, WE, TH, FR, SA, SU`;
        }
        if (daysOfWeek.length === 0) {
            return '❌ At least one day is required in --days.';
        }

        // --- Parse time ---
        const timeStr = args.time;
        if (!timeStr) return '❌ --time is required. Example: --time "09:00"';
        if (!/^\d{1,2}:\d{2}$/.test(String(timeStr))) {
            return '❌ --time must be in HH:mm format. Example: --time "09:00"';
        }
        const [hh, mm] = String(timeStr).split(':').map(Number);
        if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
            return '❌ --time values out of range. Hours: 0–23, Minutes: 0–59';
        }
        const normalizedTime = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;

        // --- Duration ---
        let durationMinutes = args.duration ? Number(args.duration) : 60;
        if (isNaN(durationMinutes) || durationMinutes <= 0) durationMinutes = 60;

        // --- Timezone ---
        const timezone = args.timezone ? String(args.timezone) : DEFAULT_TIMEZONE;

        // --- Title ---
        const title = args.title ? String(args.title) : 'Recurring Session';

        // --- Created by ---
        const createdBy = String(
            context?.user?.username ||
            message?.author?.username ||
            'command'
        );

        // --- Schedule ---
        const result = schedulerService.scheduleRecurringSession({
            guildId: String(guildId),
            voiceChannelId: String(voiceChannelId),
            textChannelId: textChannelId ? String(textChannelId) : null,
            title,
            daysOfWeek,
            time: normalizedTime,
            timezone,
            durationMinutes,
            createdBy
        });

        if (!result.ok) {
            return `❌ Failed to schedule recurring session: ${result.error}`;
        }

        // --- Success response ---
        const dayNames = daysOfWeek.map(d => DAY_CODE_TO_SHORT[d] || d).join(', ');
        const nextDate = new Date(result.nextRunAt);
        const nextStr = nextDate.toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', timeZone: timezone
        });
        const [h, m] = normalizedTime.split(':').map(Number);
        const ampm = h >= 12 ? 'PM' : 'AM';
        const h12 = h % 12 || 12;
        const timeDisplay = `${h12}:${String(m).padStart(2, '0')} ${ampm}`;

        return [
            `✅ **Recurring session scheduled!**`,
            `📋 Title: **${title}**`,
            `📅 Days: ${dayNames}`,
            `🕘 Time: **${timeDisplay}** ${timezone}`,
            `⏱ Duration: ${durationMinutes} min`,
            `🔜 Next run: **${nextStr} at ${timeDisplay}**`,
            `🆔 Schedule ID: #${result.id}`,
            ``,
            `💡 Use \`!scheduled\` to view all schedules. Use \`!cancel-scheduled --id ${result.id}\` to stop this recurring session.`
        ].join('\n');
    }
};
