const { requireInstructor } = require('../../utils/permissions');
// commands/system/health-check.js
//
// System integrity validator — checks for data anomalies across the DB.
// Instructor/admin only.
//
// Validates:
//   1. Open voice intervals (end_time IS NULL) in sessions that have ended
//   2. Sessions that exceeded auto_end_at but are still open (end_time IS NULL)
//   3. activity_events rows with NULL session_id (orphaned events)
//   4. participation_summary rows with NULL user_id or session_id
//   5. attendance_summary rows with NULL session_id
//
// Usage:
//   !health-check
// ---------------------------------------------------------------------------

const db = require('../../database/db');
const logger = require('../../utils/logger');

module.exports = {
    name: 'health-check',
    requiredPermission: 'instructor',
    description: 'Validate system data integrity across all tables (instructor only).',
    usage: '!health-check',
    options: [],

    async execute(message, _args, { parsed } = {}) {
        const permission = await requireInstructor(message);
        if (!permission.allowed) return message.reply(permission.message);

        try {
            if (!message.guild) return message.reply('❌ Server only.');

            const checks = [];
            let failCount = 0;

            // ----------------------------------------------------------------
            // CHECK 1: Open voice intervals in ended sessions
            // ----------------------------------------------------------------
            try {
                const row = db.prepare(`
                    SELECT COUNT(*) AS count
                    FROM voice_activity_intervals vi
                    JOIN sessions s ON vi.session_id = s.id
                    WHERE vi.end_time IS NULL
                      AND s.end_time IS NOT NULL
                `).get();
                const count = row ? row.count : 0;
                const ok    = count === 0;
                if (!ok) failCount++;
                checks.push({
                    ok,
                    label: 'Open intervals in ended sessions',
                    detail: ok ? 'None found' : `${count} unclosed interval(s) in ended sessions`
                });
            } catch (e) {
                checks.push({ ok: false, label: 'Open intervals in ended sessions', detail: `Query failed: ${e.message}` });
                failCount++;
            }

            // ----------------------------------------------------------------
            // CHECK 2: Sessions past auto_end_at but still open
            // ----------------------------------------------------------------
            try {
                const now = new Date().toISOString();
                const row = db.prepare(`
                    SELECT COUNT(*) AS count
                    FROM sessions
                    WHERE end_time IS NULL
                      AND auto_end_at IS NOT NULL
                      AND auto_end_at < ?
                `).get(now);
                const count = row ? row.count : 0;
                const ok    = count === 0;
                if (!ok) failCount++;
                checks.push({
                    ok,
                    label: 'Sessions past auto_end_at still open',
                    detail: ok ? 'None found' : `${count} expired session(s) never closed`
                });
            } catch (e) {
                checks.push({ ok: false, label: 'Sessions past auto_end_at still open', detail: `Query failed: ${e.message}` });
                failCount++;
            }

            // ----------------------------------------------------------------
            // CHECK 3: Orphaned activity_events (NULL session_id)
            // ----------------------------------------------------------------
            try {
                const row = db.prepare(`
                    SELECT COUNT(*) AS count FROM activity_events WHERE session_id IS NULL
                `).get();
                const count = row ? row.count : 0;
                const ok    = count === 0;
                if (!ok) failCount++;
                checks.push({
                    ok,
                    label: 'Orphaned activity_events (NULL session_id)',
                    detail: ok ? 'None found' : `${count} event(s) with no session linkage`
                });
            } catch (e) {
                checks.push({ ok: false, label: 'Orphaned activity_events', detail: `Query failed: ${e.message}` });
                failCount++;
            }

            // ----------------------------------------------------------------
            // CHECK 4: participation_summary integrity
            // ----------------------------------------------------------------
            try {
                const row = db.prepare(`
                    SELECT COUNT(*) AS count FROM participation_summary
                    WHERE user_id IS NULL OR session_id IS NULL
                `).get();
                const count = row ? row.count : 0;
                const ok    = count === 0;
                if (!ok) failCount++;
                checks.push({
                    ok,
                    label: 'participation_summary NULL fields',
                    detail: ok ? 'None found' : `${count} row(s) with NULL user_id or session_id`
                });
            } catch (e) {
                checks.push({ ok: false, label: 'participation_summary NULL fields', detail: `Query failed: ${e.message}` });
                failCount++;
            }

            // ----------------------------------------------------------------
            // CHECK 5: attendance_summary integrity
            // ----------------------------------------------------------------
            try {
                const row = db.prepare(`
                    SELECT COUNT(*) AS count FROM attendance_summary WHERE session_id IS NULL
                `).get();
                const count = row ? row.count : 0;
                const ok    = count === 0;
                if (!ok) failCount++;
                checks.push({
                    ok,
                    label: 'attendance_summary NULL session_id',
                    detail: ok ? 'None found' : `${count} row(s) with no session linkage`
                });
            } catch (e) {
                checks.push({ ok: false, label: 'attendance_summary NULL session_id', detail: `Query failed: ${e.message}` });
                failCount++;
            }

            // ----------------------------------------------------------------
            // Format output
            // ----------------------------------------------------------------
            const lines = checks.map(c => {
                const icon = c.ok ? '✅' : '❌';
                return `${icon}  ${c.label}\n     └─ ${c.detail}`;
            });

            const overall  = failCount === 0
                ? '✅ **System healthy — all checks passed.**'
                : `❌ **${failCount} check(s) failed — review issues below.**`;

            const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');

            let output = `🏥 **Health Check** — ${timestamp}\n${overall}\n\n`;
            output    += lines.join('\n\n');

            logger.log(`health-check run by ${message.author?.id}. Failures: ${failCount}`, {
                userId: message.author?.id,
                failCount
            });

            return message.reply(output);
        } catch (error) {
            logger.error(`health-check command error: ${error.message}`, { error: error.message });
            return message.reply('❌ An error occurred during the health check.');
        }
    }
};
