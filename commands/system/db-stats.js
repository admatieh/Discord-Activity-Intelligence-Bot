const { sendResponse } = require('../../utils/responseHelper');
const { requireInstructor } = require('../../utils/permissions');
// commands/system/db-stats.js
//
// Show row counts for all major database tables.
// Gives a quick health overview of how much data is stored.
// Instructor/admin only.
//
// Usage:
//   !db-stats
// ---------------------------------------------------------------------------

const db = require('../../database/db');
const logger = require('../../utils/logger');

// Table definitions: [emoji, table_name, display_label]
const TABLES = [
    ['📅', 'sessions',                   'Sessions'],
    ['👥', 'attendees',                  'Attendees (raw)'],
    ['🎙️', 'voice_events',              'Voice Events'],
    ['🔊', 'voice_activity_intervals',  'Voice Intervals'],
    ['💬', 'activity_events',           'Activity Events'],
    ['📋', 'attendance_summary',        'Attendance Summary'],
    ['📊', 'participation_summary',     'Participation Summary'],
    ['📄', 'logs',                       'Logs'],
    ['👤', 'users',                      'Users']
];

module.exports = {
    name: 'db-stats',
    requiredPermission: 'instructor',
    description: 'Show row counts for all major database tables (instructor only).',
    usage: '!db-stats',
    options: [

        { name: 'private', type: 'boolean', required: false, description: 'Send the response privately by DM' },
        { name: 'quiet', type: 'boolean', required: false, description: 'Only send a short confirmation' },
        { name: 'silent', type: 'boolean', required: false, description: 'Do not send a public response' }
    ],

    async execute(message, _args, { parsed } = {}) {
        const permission = await requireInstructor(message);
        if (!permission.allowed) return message.reply(permission.message);

        try {
            if (!message.guild) return sendResponse(message, '❌ Server only.', parsed?.options || {});

            const results = [];
            let totalRows = 0;

            for (const [emoji, table, label] of TABLES) {
                try {
                    const row   = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get();
                    const count = row ? row.count : 0;
                    totalRows  += count;
                    results.push({ emoji, label, count });
                } catch (_err) {
                    // Table may not exist in older schema versions
                    results.push({ emoji, label, count: 'N/A' });
                }
            }

            const COL_LABEL = 24;
            const COL_COUNT = 8;

            const header  = `${'Table'.padEnd(COL_LABEL)} ${'Rows'.padEnd(COL_COUNT)}`;
            const divider = '─'.repeat(header.length);

            const lines = results.map(r => {
                const label = r.label.padEnd(COL_LABEL);
                const count = String(r.count).padEnd(COL_COUNT);
                return `${r.emoji}  ${label} ${count}`;
            });

            const footer = `${'TOTAL'.padEnd(COL_LABEL)} ${totalRows}`;

            let output = `🗄️ **Database Stats**\n`;
            output    += `\`\`\`\n${header}\n${divider}\n${lines.join('\n')}\n${divider}\n${footer}\n\`\`\``;

            return sendResponse(message, output, parsed?.options || {});
        } catch (error) {
            logger.error(`db-stats command error: ${error.message}`, { error: error.message });
            return sendResponse(message, '❌ An error occurred while querying database stats.', parsed?.options || {});
        }
    }
};
