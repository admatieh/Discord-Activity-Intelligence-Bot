// utils/commandResolver.js
//
// Shared session + user context resolution for all commands.
// All commands must use these helpers — no duplicate logic anywhere.
//
// resolveSessionContext: resolves --id, --channel, --latest, or voice channel
// resolveUserContext:    resolves --user <@mention|id|raw-string>
// ---------------------------------------------------------------------------

const sessionService = require('../modules/sessions/sessionService');
const sessionModel   = require('../models/sessionModel');

// ---------------------------------------------------------------------------
// resolveSessionContext
// ---------------------------------------------------------------------------

/**
 * Resolve a session from parsed command options or the user's voice state.
 *
 * Priority order:
 *   1. --id <number>         → direct lookup by session ID
 *   2. --channel <#ch|name>  → active session in that channel
 *   3. --latest              → most recent session in the DB (any channel)
 *   4. default               → active session in user's current voice channel
 *
 * @param {import('discord.js').Message} message
 * @param {Record<string, any>} options   Parsed options from argParser
 * @returns {{ sessionId: number, channelId?: string } | { error: string }}
 */
function resolveSessionContext(message, options = {}) {
    try {
        let provided = 0;
        if (options.id !== undefined) provided++;
        if (options.channel !== undefined) provided++;
        if (options.latest !== undefined) provided++;

        if (provided > 1) {
            return { error: '❌ Conflicting session options. Use only one of: --id, --channel, --latest' };
        }

        // 1. --id
        if (options.id !== undefined) {
            const sessionId = Number(options.id);
            if (isNaN(sessionId) || sessionId <= 0) {
                return { error: '❌ --id must be a positive number.' };
            }
            const session = sessionModel.getSessionById(sessionId);
            if (!session) {
                return { error: `❌ Session #${sessionId} not found.` };
            }
            return { sessionId: session.id, channelId: session.channel_id };
        }

        // 2. --channel
        if (options.channel) {
            const ch = options.channel;
            // Resolved to a Discord channel object by argParser
            const channelId = (typeof ch === 'object' && ch.id) ? ch.id : String(ch);
            const active = sessionService.getSessionId(channelId);
            if (active) {
                return { sessionId: active, channelId };
            }
            // Fallback: most recent session in this channel
            const all = sessionModel.getAllSessions();
            const found = all.find(s => s.channel_id === channelId);
            if (found) return { sessionId: found.id, channelId };
            return { error: `⚠️ No session found for that channel.` };
        }

        // 3. --latest
        if (options.latest) {
            const all = sessionModel.getAllSessions(); // sorted DESC by start_time
            if (all.length === 0) {
                return { error: '⚠️ No sessions found in the database.' };
            }
            const s = all[0];
            return { sessionId: s.id, channelId: s.channel_id };
        }

        // 4. Default: user's current voice channel
        const voiceChannel = message?.member?.voice?.channel;
        if (voiceChannel) {
            const channelId = voiceChannel.id;
            const sessionId = sessionService.getSessionId(channelId);
            if (sessionId) {
                return { sessionId, channelId };
            }
            // No active session — fall back to most recent in this channel
            const all = sessionModel.getAllSessions();
            const found = all.find(s => s.channel_id === channelId);
            if (found) return { sessionId: found.id, channelId };
        }

        return {
            error: '⚠️ Could not resolve a session. Use --id, --channel, --latest, or join a voice channel.'
        };
    } catch (err) {
        return { error: `❌ resolveSessionContext failed: ${err.message}` };
    }
}

// ---------------------------------------------------------------------------
// resolveUserContext
// ---------------------------------------------------------------------------

/**
 * Resolve a Discord user ID from --user option.
 *
 * Accepts:
 *   - Discord user object (resolved by argParser from <@mention>)
 *   - Mention string: <@123456789> or <@!123456789>
 *   - Raw numeric string / number
 *
 * @param {Record<string, any>} options
 * @returns {{ userId: string } | { error: string }}
 */
function resolveUserContext(options = {}) {
    try {
        const raw = options.user;
        if (raw === undefined || raw === null) {
            return { error: '⚠️ No user specified. Use --user <@mention|id>.' };
        }

        // Discord.js user/member object resolved by argParser
        if (typeof raw === 'object' && raw !== null) {
            const id = raw.id || (raw.user && raw.user.id);
            if (id) return { userId: String(id) };
        }

        let str = String(raw);

        // Mention format: <@123> or <@!123>
        const mentionMatch = str.match(/^<@!?(\d+)>$/);
        if (mentionMatch) return { userId: mentionMatch[1] };

        // Raw numeric ID
        if (/^\d+$/.test(str)) return { userId: str };

        return { error: `⚠️ Could not resolve user from: "${str}". Use a mention or numeric ID.` };
    } catch (err) {
        return { error: `❌ resolveUserContext failed: ${err.message}` };
    }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { resolveSessionContext, resolveUserContext };
