// services/schedulerService.js
//
// Responsibilities:
//   - Load scheduled_items from DB
//   - Poll every 20 seconds for due items
//   - Execute sessions and messages on schedule
//   - Mark running/completed/failed
//   - Handle missed jobs after restart (within 10-minute window)
//   - Avoid duplicate execution via in-memory lock
//   - Graceful shutdown
// ---------------------------------------------------------------------------

const db = require('../database/db');
const logger = require('../utils/logger');
const { parseRecurrenceRule, getNextOccurrence, isMissedRunTooOld, validateRecurringSessionInput, buildWeeklyRecurrenceRule, formatRecurrenceRuleHuman, DEFAULT_TIMEZONE, DEFAULT_DURATION_MINUTES } = require('../utils/recurrence');

let client = null;       // Discord client reference — set via initScheduler
let pollInterval = null; // setInterval handle
let isRunning = false;   // concurrency lock

const POLL_INTERVAL_MS = 20_000;        // 20 seconds
const STALE_RUNNING_THRESHOLD_MS = 300_000; // 5 minutes — stale "running" jobs get re-queued
const RECURRING_MISSED_GRACE_MINUTES = 15; // skip & reschedule if missed by more than this

// ---------------------------------------------------------------------------
// DB helpers
// ---------------------------------------------------------------------------

function toSqlValue(value) {
    if (value === undefined) return null;
    if (value === null) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    return value;
}

function getScheduledItem(id) {
    try {
        return db.prepare('SELECT * FROM scheduled_items WHERE id = ?').get(id) || null;
    } catch (err) {
        logger.error(`[Scheduler] getScheduledItem error: ${err.message}`);
        return null;
    }
}

function markRunning(id) {
    try {
        db.prepare(
            `UPDATE scheduled_items SET status = 'running', updated_at = datetime('now') WHERE id = ?`
        ).run(id);
    } catch (err) {
        logger.error(`[Scheduler] markRunning error for id=${id}: ${err.message}`);
    }
}

function markCompleted(id) {
    try {
        db.prepare(
            `UPDATE scheduled_items SET status = 'completed', last_run_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
        ).run(id);
    } catch (err) {
        logger.error(`[Scheduler] markCompleted error for id=${id}: ${err.message}`);
    }
}

function markFailed(id, errorMsg) {
    try {
        db.prepare(
            `UPDATE scheduled_items SET status = 'failed', error = ?, last_run_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
        ).run(errorMsg || 'Unknown error', id);
    } catch (err) {
        logger.error(`[Scheduler] markFailed error for id=${id}: ${err.message}`);
    }
}

// ---------------------------------------------------------------------------
// Recurring item helpers
// ---------------------------------------------------------------------------

/**
 * After a recurring item runs (success or skip), advance its schedule.
 * Updates: scheduled_for, next_run_at, last_run_at, status='scheduled', clears error.
 */
function advanceRecurringItem(id, rule, nowDate, errorMsg) {
    const parsed = parseRecurrenceRule(rule);
    if (!parsed.ok) {
        logger.warn(`[Scheduler] Cannot advance recurring item #${id}: ${parsed.error}`);
        markFailed(id, `Cannot parse recurrence rule: ${parsed.error}`);
        return;
    }
    const next = getNextOccurrence(parsed.rule, nowDate || new Date());
    if (!next.ok) {
        logger.warn(`[Scheduler] No next occurrence for recurring item #${id}: ${next.error}`);
        markFailed(id, `No next occurrence: ${next.error}`);
        return;
    }
    const nextIso = next.nextDate.toISOString();
    try {
        db.prepare(`
            UPDATE scheduled_items
            SET scheduled_for = ?,
                next_run_at   = ?,
                last_run_at   = datetime('now'),
                status        = 'scheduled',
                error         = ?,
                updated_at    = datetime('now')
            WHERE id = ?
        `).run(nextIso, nextIso, errorMsg || null, id);
        logger.log(`[Scheduler] Recurring item #${id} rescheduled → ${nextIso}`);
    } catch (err) {
        logger.error(`[Scheduler] advanceRecurringItem DB error for #${id}: ${err.message}`);
    }
}

// ---------------------------------------------------------------------------
// Execute a scheduled session
// ---------------------------------------------------------------------------

async function executeScheduledSession(item) {
    const execId = `sched_${item.id}_${Date.now()}`;
    logger.log(`[Scheduler] Executing scheduled session: "${item.title || item.id}" (item #${item.id})`, { execId });

    try {
        let payload = {};
        try { payload = JSON.parse(item.payload_json || '{}'); } catch {}

        const sessionService = require('../modules/sessions/sessionService');

        const result = sessionService.startSession(
            item.voice_channel_id || payload.voiceChannelId,
            item.created_by || 'scheduler',
            { 
                durationMinutes: item.duration_minutes || payload.durationMinutes || 60,
                ...(payload.options || {})
            }
        );

        if (!result.success) {
            const errorMsg = result.message;
            if (item.recurrence_rule) {
                // One failure should not kill recurring schedule — reschedule and store error
                advanceRecurringItem(item.id, item.recurrence_rule, new Date(), errorMsg);
                writeActivityEvent({
                    type: 'RECURRING_SESSION_FAILED',
                    human_label: `Recurring session "${item.title || 'Untitled'}" failed — rescheduled`,
                    guild_id: item.guild_id,
                    session_id: null,
                    severity: 'error',
                    metadata: { itemId: item.id, error: errorMsg }
                });
            } else {
                markFailed(item.id, errorMsg);
                writeActivityEvent({
                    type: 'SCHEDULED_SESSION_FAILED',
                    human_label: `Scheduled session "${item.title || 'Untitled'}" failed to start`,
                    guild_id: item.guild_id,
                    session_id: null,
                    severity: 'error',
                    metadata: { itemId: item.id, error: errorMsg }
                });
            }
            logger.warn(`[Scheduler] Session start failed for item #${item.id}: ${errorMsg}`);
            return;
        }

        // Bootstrap voice members if Discord client is ready
        if (client && client.isReady() && item.guild_id && item.voice_channel_id) {
            try {
                const guild = client.guilds.cache.get(item.guild_id);
                const voiceChannel = guild?.channels?.cache?.get(item.voice_channel_id);
                if (voiceChannel) {
                    sessionService.bootstrapChannelUsers(voiceChannel, result.sessionId);
                    sessionService.ensureChannelState(voiceChannel);
                }
            } catch (discordErr) {
                logger.warn(`[Scheduler] Could not bootstrap voice members: ${discordErr.message}`);
            }
        }

        // Optional: post Discord announcement
        if (item.text_channel_id && client && client.isReady()) {
            try {
                const guild = client.guilds.cache.get(item.guild_id);
                const textChannel = guild?.channels?.cache?.get(item.text_channel_id);
                if (textChannel && textChannel.isTextBased()) {
                    await textChannel.send(
                        `📢 **Scheduled session started:** ${item.title || 'Recording session'} — will run for ${item.duration_minutes || 60} minutes.`
                    );
                }
            } catch (sendErr) {
                logger.warn(`[Scheduler] Could not send session announcement: ${sendErr.message}`);
            }
        }

        markCompleted(item.id);

        // If recurring, reschedule instead of leaving as completed
        if (item.recurrence_rule) {
            advanceRecurringItem(item.id, item.recurrence_rule, new Date());
            writeActivityEvent({
                type: 'RECURRING_SESSION_NEXT_RUN_UPDATED',
                human_label: `Recurring session "${item.title || 'Untitled'}" completed — rescheduled`,
                guild_id: item.guild_id,
                session_id: result.sessionId,
                severity: 'info',
                metadata: { itemId: item.id, sessionId: result.sessionId }
            });
        }

        writeActivityEvent({
            type: 'SCHEDULED_SESSION_STARTED',
            human_label: `Scheduled session "${item.title || 'Untitled'}" started`,
            guild_id: item.guild_id,
            session_id: result.sessionId,
            severity: 'info',
            metadata: { itemId: item.id, sessionId: result.sessionId }
        });

        logger.log(`[Scheduler] Session #${result.sessionId} started from schedule item #${item.id}.`);
    } catch (err) {
        markFailed(item.id, err.message);
        logger.error(`[Scheduler] executeScheduledSession crash for item #${item.id}: ${err.message}`);
    }
}

// ---------------------------------------------------------------------------
// Execute a scheduled message
// ---------------------------------------------------------------------------

async function executeScheduledMessage(item) {
    const execId = `sched_msg_${item.id}_${Date.now()}`;
    logger.log(`[Scheduler] Executing scheduled message item #${item.id}`, { execId });

    try {
        let payload = {};
        try { payload = JSON.parse(item.payload_json || '{}'); } catch {}

        const content = payload.content || item.title || '(No content)';
        const textChannelId = item.text_channel_id || payload.textChannelId;

        if (!textChannelId) {
            markFailed(item.id, 'No text channel specified');
            return;
        }

        if (!client || !client.isReady()) {
            markFailed(item.id, 'Discord client not ready');
            return;
        }

        const guild = client.guilds.cache.get(item.guild_id);
        if (!guild) {
            markFailed(item.id, `Guild ${item.guild_id} not found`);
            return;
        }

        const textChannel = guild.channels.cache.get(textChannelId);
        if (!textChannel || !textChannel.isTextBased()) {
            markFailed(item.id, `Text channel ${textChannelId} not found or not text-based`);
            return;
        }

        const sentMessage = await textChannel.send(content);

        // Write message delivery record
        db.prepare(`
            INSERT INTO message_deliveries
                (scheduled_item_id, guild_id, text_channel_id, content, status, sent_at, discord_message_id)
            VALUES (?, ?, ?, ?, 'sent', datetime('now'), ?)
        `).run(item.id, item.guild_id, textChannelId, content, sentMessage.id);

        markCompleted(item.id);

        writeActivityEvent({
            type: 'SCHEDULED_MESSAGE_SENT',
            human_label: `Scheduled message sent to #${textChannel.name}`,
            guild_id: item.guild_id,
            severity: 'info',
            metadata: { itemId: item.id, channelId: textChannelId, discordMessageId: sentMessage.id }
        });

        logger.log(`[Scheduler] Scheduled message sent to ${textChannel.name} (item #${item.id}).`);
    } catch (err) {
        markFailed(item.id, err.message);

        // Try to record failed delivery
        try {
            let payload = {};
            try { payload = JSON.parse(item.payload_json || '{}'); } catch {}
            db.prepare(`
                INSERT INTO message_deliveries
                    (scheduled_item_id, guild_id, text_channel_id, content, status, error)
                VALUES (?, ?, ?, ?, 'failed', ?)
            `).run(item.id, item.guild_id, item.text_channel_id || payload.textChannelId || '', payload.content || '', err.message);
        } catch {}

        logger.error(`[Scheduler] executeScheduledMessage crash for item #${item.id}: ${err.message}`);
    }
}

// ---------------------------------------------------------------------------
// Main poll loop
// ---------------------------------------------------------------------------

async function executeDueItems() {
    if (isRunning) return; // prevent overlap
    isRunning = true;

    try {
        const now = new Date().toISOString();

        // Also recover stale "running" items (crashed mid-execution)
        const staleThreshold = new Date(Date.now() - STALE_RUNNING_THRESHOLD_MS).toISOString();
        db.prepare(`
            UPDATE scheduled_items
            SET status = 'scheduled', updated_at = datetime('now')
            WHERE status = 'running' AND updated_at < ?
        `).run(staleThreshold);

        const dueItems = db.prepare(`
            SELECT * FROM scheduled_items
            WHERE status = 'scheduled'
              AND scheduled_for <= ?
            ORDER BY scheduled_for ASC
            LIMIT 20
        `).all(now);

        for (const item of dueItems) {
            // For recurring items, check if we missed the run beyond the grace period
            if (item.recurrence_rule) {
                if (isMissedRunTooOld(item.scheduled_for, RECURRING_MISSED_GRACE_MINUTES)) {
                    logger.warn(`[Scheduler] Recurring item #${item.id} missed by >${RECURRING_MISSED_GRACE_MINUTES}m — skipping, rescheduling`);
                    writeActivityEvent({
                        type: 'RECURRING_SESSION_SKIPPED',
                        human_label: `Recurring session "${item.title || 'Untitled'}" skipped (missed grace window)`,
                        guild_id: item.guild_id,
                        severity: 'warning',
                        metadata: { itemId: item.id, scheduledFor: item.scheduled_for, graceMinutes: RECURRING_MISSED_GRACE_MINUTES }
                    });
                    advanceRecurringItem(item.id, item.recurrence_rule, new Date());
                    continue;
                }

                // Check if a session is already active in this voice channel → skip this run
                const sessionService = require('../modules/sessions/sessionService');
                const active = sessionService.getActiveSessionForChannel
                    ? sessionService.getActiveSessionForChannel(item.voice_channel_id)
                    : null;
                if (active) {
                    logger.warn(`[Scheduler] Recurring item #${item.id} skipped — session already active in channel ${item.voice_channel_id}`);
                    writeActivityEvent({
                        type: 'RECURRING_SESSION_SKIPPED',
                        human_label: `Recurring session "${item.title || 'Untitled'}" skipped — session already active`,
                        guild_id: item.guild_id,
                        severity: 'info',
                        metadata: { itemId: item.id, activeSessionId: active.id }
                    });
                    advanceRecurringItem(item.id, item.recurrence_rule, new Date());
                    continue;
                }
            }

            // Mark running before execution to prevent double-run
            markRunning(item.id);

            if (item.type === 'session') {
                await executeScheduledSession(item);
            } else if (item.type === 'message') {
                await executeScheduledMessage(item);
            } else {
                markFailed(item.id, `Unknown type: ${item.type}`);
            }
        }
    } catch (err) {
        logger.error(`[Scheduler] executeDueItems crash: ${err.message}`);
    } finally {
        isRunning = false;
    }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Schedule a session.
 * @param {{ guildId, voiceChannelId, textChannelId, title, scheduledFor, durationMinutes, createdBy, payload }} input
 * @returns {{ ok, id, error }}
 */
function scheduleSession(input) {
    try {
        const { guildId, voiceChannelId, textChannelId, title, scheduledFor, durationMinutes, createdBy, payload } = input;

        if (typeof guildId === 'object' && guildId !== null) return { ok: false, error: 'guildId must be a string ID' };
        if (typeof voiceChannelId === 'object' && voiceChannelId !== null) return { ok: false, error: 'voiceChannelId must be a string ID' };
        if (textChannelId && typeof textChannelId === 'object') return { ok: false, error: 'textChannelId must be a string ID' };

        if (!guildId) return { ok: false, error: 'guildId is required' };
        if (!voiceChannelId) return { ok: false, error: 'voiceChannelId is required' };
        if (!scheduledFor) return { ok: false, error: 'scheduledFor is required' };

        const scheduledForDate = new Date(scheduledFor);
        if (isNaN(scheduledForDate.getTime())) {
            return { ok: false, error: 'Invalid scheduledFor date' };
        }
        if (scheduledForDate <= new Date()) {
            return { ok: false, error: 'Scheduled time must be in the future' };
        }

        const safeGuildId = String(guildId);
        const safeVoiceChannelId = String(voiceChannelId);
        const safeTextChannelId = textChannelId ? String(textChannelId) : null;
        const safeTitle = title ? String(title) : null;
        const safeCreatedBy = createdBy ? String(createdBy) : 'dashboard';

        const payloadJson = toSqlValue(payload || {});
        const result = db.prepare(`
            INSERT INTO scheduled_items
                (type, title, guild_id, voice_channel_id, text_channel_id, scheduled_for,
                 duration_minutes, payload_json, status, created_by, created_at)
            VALUES ('session', ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, datetime('now'))
        `).run(
            safeTitle,
            safeGuildId,
            safeVoiceChannelId,
            safeTextChannelId,
            scheduledForDate.toISOString(),
            Number(durationMinutes) || 60,
            payloadJson,
            safeCreatedBy
        );

        const id = Number(result.lastInsertRowid);

        writeActivityEvent({
            type: 'SESSION_SCHEDULED',
            human_label: `Session "${title || 'Untitled'}" scheduled for ${scheduledForDate.toLocaleString()}`,
            guild_id: guildId,
            severity: 'info',
            metadata: { itemId: id, voiceChannelId, scheduledFor: scheduledForDate.toISOString() }
        });

        logger.log(`[Scheduler] Session scheduled: item #${id} for ${scheduledForDate.toISOString()}`);
        return { ok: true, id };
    } catch (err) {
        logger.error(`[Scheduler] scheduleSession error: ${err.message}`);
        return { ok: false, error: err.message };
    }
}

/**
 * Schedule a recurring session.
 * @param {{ guildId, voiceChannelId, textChannelId, title, daysOfWeek, time, timezone, durationMinutes, createdBy, tracking, options }} input
 * @returns {{ ok, id, nextRunAt, error }}
 */
function scheduleRecurringSession(input) {
    try {
        const {
            guildId, voiceChannelId, textChannelId, title,
            daysOfWeek, time, timezone, durationMinutes,
            createdBy, tracking, options
        } = input;

        // Input validation
        const validation = validateRecurringSessionInput({ guildId, voiceChannelId, daysOfWeek, time, timezone, durationMinutes });
        if (!validation.ok) return validation;

        const safeGuildId = String(guildId);
        const safeVoiceChannelId = String(voiceChannelId);
        const safeTextChannelId = textChannelId ? String(textChannelId) : null;
        const safeTitle = title ? String(title) : 'Recurring Session';
        const safeCreatedBy = createdBy ? String(createdBy) : 'dashboard';
        const safeDuration = durationMinutes ? Number(durationMinutes) : DEFAULT_DURATION_MINUTES;
        const safeTz = timezone || DEFAULT_TIMEZONE;

        // Build recurrence rule
        const ruleResult = buildWeeklyRecurrenceRule({ daysOfWeek, time, timezone: safeTz });
        if (!ruleResult.ok) return ruleResult;
        const rule = ruleResult.rule;
        const ruleJson = JSON.stringify(rule);

        // Calculate first occurrence
        const nextResult = getNextOccurrence(rule, new Date());
        if (!nextResult.ok) return { ok: false, error: nextResult.error };
        const nextIso = nextResult.nextDate.toISOString();

        // Store payload
        const payloadJson = JSON.stringify({ tracking: tracking || {}, options: options || {} });

        const result = db.prepare(`
            INSERT INTO scheduled_items
                (type, title, guild_id, voice_channel_id, text_channel_id,
                 scheduled_for, timezone, duration_minutes, payload_json,
                 recurrence_rule, next_run_at, status, created_by, created_at)
            VALUES ('session', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled', ?, datetime('now'))
        `).run(
            safeTitle,
            safeGuildId,
            safeVoiceChannelId,
            safeTextChannelId,
            nextIso,
            safeTz,
            safeDuration,
            payloadJson,
            ruleJson,
            nextIso,
            safeCreatedBy
        );

        const id = Number(result.lastInsertRowid);
        const humanRule = formatRecurrenceRuleHuman(rule);

        writeActivityEvent({
            type: 'RECURRING_SESSION_CREATED',
            human_label: `Recurring session "${safeTitle}" scheduled for ${humanRule}`,
            guild_id: safeGuildId,
            severity: 'info',
            metadata: { itemId: id, daysOfWeek, time, timezone: safeTz, nextRunAt: nextIso }
        });

        logger.log(`[Scheduler] Recurring session created: item #${id}, next run ${nextIso}`);
        return {
            ok: true,
            id,
            nextRunAt: nextIso,
            rule
        };
    } catch (err) {
        logger.error(`[Scheduler] scheduleRecurringSession error: ${err.message}`);
        return { ok: false, error: err.message };
    }
}

/**
 * Schedule a message.
 * @param {{ guildId, textChannelId, content, scheduledFor, createdBy }} input
 * @returns {{ ok, id, error }}
 */
function scheduleMessage(input) {
    try {
        const { guildId, textChannelId, content, scheduledFor, createdBy } = input;

        if (!guildId) return { ok: false, error: 'guildId is required' };
        if (!textChannelId) return { ok: false, error: 'textChannelId is required' };
        if (!content || content.trim().length === 0) return { ok: false, error: 'content is required' };
        if (!scheduledFor) return { ok: false, error: 'scheduledFor is required' };

        const scheduledForDate = new Date(scheduledFor);
        if (isNaN(scheduledForDate.getTime())) {
            return { ok: false, error: 'Invalid scheduledFor date' };
        }
        if (scheduledForDate <= new Date()) {
            return { ok: false, error: 'Scheduled time must be in the future' };
        }

        const payloadJson = JSON.stringify({ content, textChannelId });
        const result = db.prepare(`
            INSERT INTO scheduled_items
                (type, title, guild_id, text_channel_id, scheduled_for,
                 payload_json, status, created_by, created_at)
            VALUES ('message', ?, ?, ?, ?, ?, 'scheduled', ?, datetime('now'))
        `).run(
            content.slice(0, 100),
            guildId,
            textChannelId,
            scheduledForDate.toISOString(),
            payloadJson,
            createdBy || 'dashboard'
        );

        const id = Number(result.lastInsertRowid);

        writeActivityEvent({
            type: 'MESSAGE_SCHEDULED',
            human_label: `Message scheduled for ${scheduledForDate.toLocaleString()}`,
            guild_id: guildId,
            severity: 'info',
            metadata: { itemId: id, textChannelId, scheduledFor: scheduledForDate.toISOString() }
        });

        logger.log(`[Scheduler] Message scheduled: item #${id} for ${scheduledForDate.toISOString()}`);
        return { ok: true, id };
    } catch (err) {
        logger.error(`[Scheduler] scheduleMessage error: ${err.message}`);
        return { ok: false, error: err.message };
    }
}

/**
 * Cancel a scheduled item by id.
 */
function cancelScheduledItem(id) {
    try {
        const item = getScheduledItem(id);
        if (!item) return { ok: false, error: 'Scheduled item not found' };
        if (item.status === 'cancelled') return { ok: false, error: 'Already cancelled' };
        if (item.status === 'completed') return { ok: false, error: 'Cannot cancel a completed item' };
        if (item.status === 'running') return { ok: false, error: 'Cannot cancel a running item' };

        db.prepare(
            `UPDATE scheduled_items SET status = 'cancelled', cancelled_at = datetime('now'), updated_at = datetime('now') WHERE id = ?`
        ).run(id);

        writeActivityEvent({
            type: 'SCHEDULED_ITEM_CANCELLED',
            human_label: `Scheduled ${item.type} "${item.title || '#' + id}" cancelled`,
            guild_id: item.guild_id,
            severity: 'info',
            metadata: { itemId: id, type: item.type }
        });

        logger.log(`[Scheduler] Item #${id} cancelled.`);
        return { ok: true, message: `Scheduled item #${id} cancelled.` };
    } catch (err) {
        logger.error(`[Scheduler] cancelScheduledItem error: ${err.message}`);
        return { ok: false, error: err.message };
    }
}

/**
 * Get scheduled items with optional filters.
 */
function getScheduledItems(filters = {}) {
    try {
        let query = 'SELECT * FROM scheduled_items WHERE 1=1';
        const params = [];

        if (filters.status) { query += ' AND status = ?'; params.push(filters.status); }
        if (filters.guildId) { query += ' AND guild_id = ?'; params.push(filters.guildId); }
        if (filters.type) { query += ' AND type = ?'; params.push(filters.type); }

        query += ' ORDER BY scheduled_for ASC';

        if (filters.limit) { query += ' LIMIT ?'; params.push(filters.limit); }

        return db.prepare(query).all(...params);
    } catch (err) {
        logger.error(`[Scheduler] getScheduledItems error: ${err.message}`);
        return [];
    }
}

/**
 * Trigger a scheduled item immediately (run-now).
 */
async function runNow(id) {
    const item = getScheduledItem(id);
    if (!item) return { ok: false, error: 'Item not found' };
    if (item.status === 'running') return { ok: false, error: 'Already running' };
    if (item.status === 'completed') return { ok: false, error: 'Already completed' };
    if (item.status === 'cancelled') return { ok: false, error: 'Item was cancelled' };

    markRunning(id);
    if (item.type === 'session') await executeScheduledSession(item);
    else if (item.type === 'message') await executeScheduledMessage(item);
    else { markFailed(id, `Unknown type: ${item.type}`); return { ok: false, error: `Unknown type: ${item.type}` }; }

    return { ok: true, message: `Item #${id} executed.` };
}

// ---------------------------------------------------------------------------
// Activity event writer (safe, non-blocking)
// ---------------------------------------------------------------------------

function writeActivityEvent({ type, human_label, guild_id, session_id, severity, metadata }) {
    try {
        db.prepare(`
            INSERT INTO activity_events
                (type, user_id, channel_id, session_id, metadata, guild_id, human_label, severity, created_at)
            VALUES (?, 'system', NULL, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
            type,
            session_id || null,
            metadata ? JSON.stringify(metadata) : null,
            guild_id || null,
            human_label || null,
            severity || 'info'
        );
    } catch {
        // Silent — never crash the scheduler for activity logging
    }
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Initialize the scheduler. Call once on bot ready.
 * @param {import('discord.js').Client} discordClient
 */
function initScheduler(discordClient) {
    client = discordClient;

    if (pollInterval) {
        clearInterval(pollInterval);
    }

    // Run once immediately on startup to catch missed jobs
    executeDueItems().catch(err => logger.error(`[Scheduler] Initial executeDueItems error: ${err.message}`));

    pollInterval = setInterval(() => {
        executeDueItems().catch(err => logger.error(`[Scheduler] Poll error: ${err.message}`));
    }, POLL_INTERVAL_MS);

    logger.log(`[Scheduler] Initialized. Polling every ${POLL_INTERVAL_MS / 1000}s.`);
}

/**
 * Stop the scheduler gracefully.
 */
function stopScheduler() {
    if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
    }
    logger.log('[Scheduler] Stopped.');
}

module.exports = {
    initScheduler,
    stopScheduler,
    scheduleSession,
    scheduleMessage,
    scheduleRecurringSession,
    cancelScheduledItem,
    getScheduledItems,
    executeDueItems,
    runNow,
    writeActivityEvent
};
