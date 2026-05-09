// services/messageService.js
//
// Responsibilities:
//   - Send messages to Discord text channels now or on schedule
//   - Validate inputs thoroughly
//   - Write message_deliveries records
//   - Write logs and activity events
//   - Return structured JSON results
// ---------------------------------------------------------------------------

const db = require('../database/db');
const logger = require('../utils/logger');

const MAX_DISCORD_MESSAGE_LENGTH = 2000;

let _client = null;

function setClient(discordClient) {
    _client = discordClient;
}

function getClient() {
    return _client;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function writeDelivery({ scheduledItemId, guildId, textChannelId, content, status, sentAt, discordMessageId, error }) {
    try {
        return db.prepare(`
            INSERT INTO message_deliveries
                (scheduled_item_id, guild_id, text_channel_id, content, status, sent_at, discord_message_id, error, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
            scheduledItemId || null,
            guildId || null,
            textChannelId,
            content,
            status || 'sent',
            sentAt || null,
            discordMessageId || null,
            error || null
        ).lastInsertRowid;
    } catch (err) {
        logger.error(`[MessageService] writeDelivery error: ${err.message}`);
        return null;
    }
}

function writeActivityEvent({ type, human_label, guild_id, severity, metadata }) {
    try {
        db.prepare(`
            INSERT INTO activity_events
                (type, user_id, channel_id, session_id, metadata, guild_id, human_label, severity, created_at)
            VALUES (?, 'system', NULL, NULL, ?, ?, ?, ?, datetime('now'))
        `).run(
            type,
            metadata ? JSON.stringify(metadata) : null,
            guild_id || null,
            human_label || null,
            severity || 'info'
        );
    } catch {}
}

// ---------------------------------------------------------------------------
// sendMessageNow
// ---------------------------------------------------------------------------

/**
 * Send a message to a Discord text channel immediately.
 * @param {{ guildId, textChannelId, content, requestedBy, source }} params
 * @returns {{ ok, action, message, delivery, error }}
 */
async function sendMessageNow({ guildId, textChannelId, content, requestedBy, source }) {
    const action = 'message.send';
    const execId = `msg_${Date.now()}`;

    // Validate
    if (!textChannelId) {
        return { ok: false, action, error: 'textChannelId is required', executionId: execId };
    }
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
        return { ok: false, action, error: 'content is required and must be non-empty', executionId: execId };
    }
    if (content.length > MAX_DISCORD_MESSAGE_LENGTH) {
        return { ok: false, action, error: `Content exceeds Discord limit of ${MAX_DISCORD_MESSAGE_LENGTH} characters`, executionId: execId };
    }

    const client = getClient();
    if (!client || !client.isReady()) {
        return { ok: false, action, error: 'Discord client not ready', executionId: execId };
    }

    // Resolve channel
    let textChannel = null;
    if (guildId) {
        const guild = client.guilds.cache.get(guildId);
        if (!guild) {
            return { ok: false, action, error: `Guild ${guildId} not found`, executionId: execId };
        }
        textChannel = guild.channels.cache.get(textChannelId);
    } else {
        // Search all guilds
        for (const [, guild] of client.guilds.cache) {
            const ch = guild.channels.cache.get(textChannelId);
            if (ch) { textChannel = ch; break; }
        }
    }

    if (!textChannel) {
        writeDelivery({ guildId, textChannelId, content, status: 'failed', error: 'Channel not found' });
        return { ok: false, action, error: 'Text channel not found', executionId: execId };
    }

    if (!textChannel.isTextBased()) {
        writeDelivery({ guildId, textChannelId, content, status: 'failed', error: 'Channel is not text-based' });
        return { ok: false, action, error: 'Channel is not text-based', executionId: execId };
    }

    // Send
    try {
        const sentMessage = await textChannel.send(content);
        const sentAt = new Date().toISOString();

        const deliveryId = writeDelivery({
            guildId,
            textChannelId,
            content,
            status: 'sent',
            sentAt,
            discordMessageId: sentMessage.id
        });

        writeActivityEvent({
            type: 'MESSAGE_SENT',
            human_label: `Message sent to #${textChannel.name}`,
            guild_id: guildId,
            severity: 'info',
            metadata: { textChannelId, discordMessageId: sentMessage.id, requestedBy, source }
        });

        logger.log(`[MessageService] Message sent to #${textChannel.name} by ${requestedBy || source || 'unknown'}.`);

        return {
            ok: true,
            action,
            message: `Message sent to #${textChannel.name}.`,
            delivery: {
                id: deliveryId,
                textChannelId,
                discordMessageId: sentMessage.id,
                sentAt
            },
            executionId: execId
        };
    } catch (sendErr) {
        writeDelivery({ guildId, textChannelId, content, status: 'failed', error: sendErr.message });
        logger.error(`[MessageService] Send failed: ${sendErr.message}`);
        return { ok: false, action, error: `Failed to send: ${sendErr.message}`, executionId: execId };
    }
}

// ---------------------------------------------------------------------------
// scheduleMessage (delegates to schedulerService)
// ---------------------------------------------------------------------------

function scheduleMessage({ guildId, textChannelId, content, scheduledFor, requestedBy }) {
    const schedulerService = require('./schedulerService');
    return schedulerService.scheduleMessage({ guildId, textChannelId, content, scheduledFor, createdBy: requestedBy });
}

// ---------------------------------------------------------------------------
// cancelScheduledMessage (delegates)
// ---------------------------------------------------------------------------

function cancelScheduledMessage(id) {
    const schedulerService = require('./schedulerService');
    return schedulerService.cancelScheduledItem(id);
}

// ---------------------------------------------------------------------------
// listMessageDeliveries
// ---------------------------------------------------------------------------

function listMessageDeliveries(filters = {}) {
    try {
        let query = 'SELECT * FROM message_deliveries WHERE 1=1';
        const params = [];

        if (filters.guildId) { query += ' AND guild_id = ?'; params.push(filters.guildId); }
        if (filters.textChannelId) { query += ' AND text_channel_id = ?'; params.push(filters.textChannelId); }
        if (filters.status) { query += ' AND status = ?'; params.push(filters.status); }

        query += ' ORDER BY created_at DESC';

        if (filters.limit) { query += ' LIMIT ?'; params.push(Number(filters.limit)); }
        else { query += ' LIMIT 100'; }

        return db.prepare(query).all(...params);
    } catch (err) {
        logger.error(`[MessageService] listMessageDeliveries error: ${err.message}`);
        return [];
    }
}

module.exports = {
    setClient,
    sendMessageNow,
    scheduleMessage,
    cancelScheduledMessage,
    listMessageDeliveries
};
