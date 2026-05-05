// commands/session/session-list.js
//
// List sessions with optional filtering.
//
// Usage:
//   !session-list                 → last 15 sessions (all statuses)
//   !session-list --view open     → active sessions only
//   !session-list --view all      → last 15, same as default
// ---------------------------------------------------------------------------

const sessionModel = require('../../models/sessionModel');
const { checkInstructor } = require('../../utils/permissions');
const logger = require('../../utils/logger');

const MAX_ROWS = 15;

module.exports = {
    name: 'session-list',
    description: 'List recent or active sessions.',
    usage: '!session-list [--view all|open]',
    options: [
        { name: 'view', type: 'string', required: false, description: '"open" for active sessions only, "all" for recent history' }
    ],

    execute(message, _args, { parsed } = {}) {
        try {
            if (!message.guild) return message.reply('❌ Server only.');

            const perm = checkInstructor(message.member);
            if (!perm.allowed) return message.reply(perm.message);

            const options = parsed?.options || {};
            const view    = (options.view || 'all').toLowerCase();

            let sessions;

            if (view === 'open') {
                sessions = sessionModel.getActiveSessions();
                if (sessions.length === 0) {
                    return message.reply('📋 No active sessions currently running.');
                }
            } else {
                sessions = sessionModel.getAllSessions().slice(0, MAX_ROWS);
                if (sessions.length === 0) {
                    return message.reply('📋 No sessions found in the database.');
                }
            }

            const truncated = sessions.length >= MAX_ROWS;
            const rows      = sessions.slice(0, MAX_ROWS);

            const lines = rows.map(s => {
                const status  = s.end_time ? '🔴 Ended ' : '🟢 Active';
                const started = s.start_time ? s.start_time.replace('T', ' ').slice(0, 16) : '—';
                const ended   = s.end_time   ? s.end_time.replace('T', ' ').slice(0, 16)   : '—';
                return `#${String(s.id).padEnd(4)} ${status}  Ch: ${s.channel_id.slice(-6)}…  Start: ${started}  End: ${ended}`;
            });

            const header = view === 'open'
                ? `📋 **Active Sessions (${rows.length})**`
                : `📋 **Sessions — Recent ${rows.length}${truncated ? '+' : ''}**`;

            const body = `\`\`\`\n${lines.join('\n')}\n\`\`\``;
            const footer = truncated ? `_Showing first ${MAX_ROWS}. Use \`!session-info --view all\` for full history._` : '';

            return message.reply(`${header}\n${body}${footer}`);
        } catch (error) {
            logger.error(`session-list command error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred while listing sessions.');
        }
    }
};
