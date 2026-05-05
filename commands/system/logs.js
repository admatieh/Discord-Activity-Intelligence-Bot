// commands/system/logs.js
//
// Query recent entries from the logs table in the database.
// Instructor/admin only.
//
// Usage:
//   !logs                          → last 20 log entries (all levels)
//   !logs --level error            → last 20 error entries
//   !logs --level info             → last 20 info entries
//   !logs --level warn             → last 20 warn entries
//   !logs --limit 50               → last 50 entries
// ---------------------------------------------------------------------------

const db = require('../../database/db');
const { checkInstructor } = require('../../utils/permissions');
const logger = require('../../utils/logger');
const { sendSplitMessage } = require('../../utils/messageSender');

const DEFAULT_LIMIT  = 20;
const MAX_LIMIT      = 50;
const VALID_LEVELS   = new Set(['error', 'warn', 'info']);

const LEVEL_EMOJI = {
    error: '❌',
    warn:  '⚠️',
    info:  'ℹ️'
};

module.exports = {
    name: 'logs',
    description: 'Query recent log entries from the database (instructor only).',
    usage: '!logs [--level error|warn|info] [--limit <n>]',
    options: [
        { name: 'level', type: 'string', required: false, description: 'Filter by log level: error | warn | info' },
        { name: 'limit', type: 'number', required: false, description: `Number of entries to show (default: ${DEFAULT_LIMIT}, max: ${MAX_LIMIT})` }
    ],

    async execute(message, _args, { parsed } = {}) {
        try {
            if (!message.guild) return message.reply('❌ Server only.');

            const perm = checkInstructor(message.member);
            if (!perm.allowed) return message.reply(perm.message);

            const options = parsed?.options || {};

            // Validate --level
            const level = options.level ? String(options.level).toLowerCase() : null;
            if (level && !VALID_LEVELS.has(level)) {
                return message.reply(`❌ Invalid level "${level}". Use: error | warn | info`);
            }

            // Validate --limit
            const rawLimit = options.limit !== undefined ? Number(options.limit) : DEFAULT_LIMIT;
            const limit    = isNaN(rawLimit) || rawLimit < 1
                ? DEFAULT_LIMIT
                : Math.min(rawLimit, MAX_LIMIT);

            // Query
            let rows;
            if (level) {
                rows = db.prepare(
                    `SELECT id, level, message, created_at FROM logs WHERE level = ? ORDER BY created_at DESC LIMIT ?`
                ).all(level, limit);
            } else {
                rows = db.prepare(
                    `SELECT id, level, message, created_at FROM logs ORDER BY created_at DESC LIMIT ?`
                ).all(limit);
            }

            if (!rows || rows.length === 0) {
                const levelStr = level ? ` with level "${level}"` : '';
                return message.reply(`⚠️ No log entries found${levelStr}.`);
            }

            const lines = rows.map(row => {
                const emoji = LEVEL_EMOJI[row.level] || '•';
                const time  = row.created_at ? row.created_at.slice(0, 19).replace('T', ' ') : '—';
                const msg   = String(row.message || '').slice(0, 80);
                return `${emoji} [${row.level.toUpperCase().padEnd(5)}] ${time}  ${msg}`;
            });

            const levelLabel = level ? ` — level: ${level.toUpperCase()}` : '';
            const title = `📄 **Logs${levelLabel}** (showing ${rows.length})`;
            
            return sendSplitMessage(message, title, lines, { useCodeBlock: true });
        } catch (error) {
            logger.error(`logs command error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred while querying logs.');
        }
    }
};
