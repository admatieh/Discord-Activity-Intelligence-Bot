// core/apiServer.js
const http = require('http');
const url = require('url');
const path = require('path');
const { executeCommand } = require('./commandExecutor');
const commands = require('../commands');
const db = require('../database/db');
const sessionModel = require('../models/sessionModel');
const sessionService = require('../modules/sessions/sessionService');
const logger = require('../utils/logger');
const { ChannelType } = require('discord.js');

const PORT = process.env.BOT_API_PORT || 4000;
const API_KEY = process.env.BOT_API_KEY || 'local_dashboard_key_123';

// ---------------------------------------------------------------------------
// Helper: read POST body as JSON
// ---------------------------------------------------------------------------
function readBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try { resolve(JSON.parse(body || '{}')); }
            catch (e) { reject(new Error('Invalid JSON body')); }
        });
        req.on('error', reject);
    });
}

// ---------------------------------------------------------------------------
// Helper: send JSON response
// ---------------------------------------------------------------------------
function sendJson(res, status, payload) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
}

// ---------------------------------------------------------------------------
// Runtime/health helper
// ---------------------------------------------------------------------------
function getRuntimePayload(client) {
    const memory = process.memoryUsage();
    const activeSessions = sessionModel.getActiveSessions ? sessionModel.getActiveSessions().length : 0;
    return {
        ok: true,
        status: 'online',
        uptime: process.uptime(),
        botReady: client.isReady(),
        guildCount: client.guilds?.cache?.size || 0,
        userCount: client.users?.cache?.size || 0,
        activeSessions,
        memory: {
            rss: Math.round(memory.rss / 1024 / 1024) + ' MB',
            heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + ' MB'
        },
        discordState: client.isReady() ? 'CONNECTED' : 'DISCONNECTED',
        version: process.env.npm_package_version || '1.0.0',
        timestamp: new Date().toISOString()
    };
}

// ---------------------------------------------------------------------------
// Route helpers
// ---------------------------------------------------------------------------
function matchPath(pathname, pattern) {
    // Support simple :param segments
    const patternParts = pattern.split('/');
    const pathParts = pathname.split('/');
    if (patternParts.length !== pathParts.length) return null;
    const params = {};
    for (let i = 0; i < patternParts.length; i++) {
        if (patternParts[i].startsWith(':')) {
            params[patternParts[i].slice(1)] = pathParts[i];
        } else if (patternParts[i] !== pathParts[i]) {
            return null;
        }
    }
    return params;
}

// ---------------------------------------------------------------------------
// Main server
// ---------------------------------------------------------------------------
function startApiServer(client) {
    global.client = client;

    const server = http.createServer(async (req, res) => {
        const reqUrl = url.parse(req.url, true);
        const pathname = reqUrl.pathname;
        const method = req.method;

        // Security check — all routes require x-api-key
        const providedKey = req.headers['x-api-key'];
        if (providedKey !== API_KEY) {
            return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
        }

        try {
            // ----------------------------------------------------------------
            // POST /api/execute — raw command execution
            // ----------------------------------------------------------------
            if (pathname === '/api/execute' && method === 'POST') {
                const data = await readBody(req);
                const { command, args, requestId, guildId, channelId } = data;

                let commandString = '';
                if (typeof command === 'string' && command.startsWith('!')) {
                    commandString = command;
                } else {
                    commandString = `!${command}`;
                    if (args && typeof args === 'object') {
                        for (const [key, value] of Object.entries(args)) {
                            if (value === true) commandString += ` --${key}`;
                            else if (value !== false && value !== undefined) commandString += ` --${key} "${value}"`;
                        }
                    }
                }

                const context = {
                    source: 'dashboard',
                    user: { id: 'dashboard', username: 'Dashboard Admin' },
                    guild: guildId ? { id: guildId } : null,
                    channel: channelId ? { id: channelId } : null
                };

                const result = await executeCommand(commandString, context);

                return sendJson(res, result.exitCode === 0 ? 200 : 400, {
                    success: result.exitCode === 0,
                    requestId: requestId || `exec_${Date.now()}`,
                    data: result,
                    error: result.exitCode === 0 ? null : result.output
                });
            }

            // ----------------------------------------------------------------
            // GET /api/commands — live command registry
            // ----------------------------------------------------------------
            if (pathname === '/api/commands' && method === 'GET') {
                const registry = Array.from(commands.values()).map(c => ({
                    name: c.name,
                    description: c.description || '',
                    usage: c.usage || '',
                    category: c.category || 'general',
                    aliases: c.aliases || [],
                    options: c.options || []
                }));
                return sendJson(res, 200, { success: true, data: registry });
            }

            // ----------------------------------------------------------------
            // GET /api/system/runtime — full runtime stats
            // ----------------------------------------------------------------
            if (pathname === '/api/system/runtime' && method === 'GET') {
                const memory = process.memoryUsage();
                const activeSessions = sessionModel.getActiveSessions().length;
                return sendJson(res, 200, {
                    success: true,
                    data: {
                        uptime: process.uptime(),
                        memory: {
                            rss: Math.round(memory.rss / 1024 / 1024) + ' MB',
                            heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + ' MB',
                            heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + ' MB'
                        },
                        discordState: client.isReady() ? 'CONNECTED' : 'DISCONNECTED',
                        activeSessions,
                        version: process.env.npm_package_version || '1.0.0'
                    }
                });
            }

            // ----------------------------------------------------------------
            // Health / status aliases
            // ----------------------------------------------------------------
            const healthRoutes = ['/health', '/status', '/api/health', '/api/status'];
            if (healthRoutes.includes(pathname) && method === 'GET') {
                return sendJson(res, 200, getRuntimePayload(client));
            }

            // ----------------------------------------------------------------
            // GET /api/discord/guilds — list guilds bot is in
            // ----------------------------------------------------------------
            if (pathname === '/api/discord/guilds' && method === 'GET') {
                if (!client.isReady()) {
                    return sendJson(res, 503, { ok: false, error: 'Bot not ready' });
                }
                const guilds = client.guilds.cache.map(g => ({
                    id: g.id,
                    name: g.name,
                    memberCount: g.memberCount,
                    available: g.available,
                    iconURL: g.iconURL() || null
                }));
                return sendJson(res, 200, { ok: true, guilds });
            }

            // ----------------------------------------------------------------
            // GET /api/discord/guilds/:guildId/channels — all channels
            // ----------------------------------------------------------------
            let params = matchPath(pathname, '/api/discord/guilds/:guildId/channels');
            if (params && method === 'GET') {
                const guild = client.guilds.cache.get(params.guildId);
                if (!guild) return sendJson(res, 404, { ok: false, error: 'Guild not found' });
                const channels = guild.channels.cache.map(ch => ({
                    id: ch.id,
                    name: ch.name,
                    type: ch.type,
                    parentId: ch.parentId || null,
                    parentName: ch.parent?.name || null
                }));
                return sendJson(res, 200, { ok: true, guildId: params.guildId, channels });
            }

            // ----------------------------------------------------------------
            // GET /api/discord/guilds/:guildId/voice-channels
            // ----------------------------------------------------------------
            params = matchPath(pathname, '/api/discord/guilds/:guildId/voice-channels');
            if (params && method === 'GET') {
                const guild = client.guilds.cache.get(params.guildId);
                if (!guild) return sendJson(res, 404, { ok: false, error: 'Guild not found' });
                const channels = guild.channels.cache
                    .filter(ch => ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice)
                    .map(ch => ({
                        id: ch.id,
                        name: ch.name,
                        type: 'voice',
                        parentId: ch.parentId || null,
                        parentName: ch.parent?.name || null,
                        memberCount: ch.members?.size || 0,
                        members: (ch.members || new Map())
                            .filter(m => !m.user.bot)
                            .map(m => ({
                                id: m.id,
                                username: m.user.username,
                                displayName: m.displayName,
                                bot: false
                            }))
                    }));
                return sendJson(res, 200, { ok: true, guildId: params.guildId, channels });
            }

            // ----------------------------------------------------------------
            // GET /api/discord/guilds/:guildId/text-channels
            // ----------------------------------------------------------------
            params = matchPath(pathname, '/api/discord/guilds/:guildId/text-channels');
            if (params && method === 'GET') {
                const guild = client.guilds.cache.get(params.guildId);
                if (!guild) return sendJson(res, 404, { ok: false, error: 'Guild not found' });
                const channels = guild.channels.cache
                    .filter(ch => ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildAnnouncement)
                    .map(ch => ({
                        id: ch.id,
                        name: ch.name,
                        type: 'text',
                        parentId: ch.parentId || null,
                        parentName: ch.parent?.name || null
                    }));
                return sendJson(res, 200, { ok: true, guildId: params.guildId, channels });
            }

            // ----------------------------------------------------------------
            // GET /api/discord/guilds/:guildId/members
            // ----------------------------------------------------------------
            params = matchPath(pathname, '/api/discord/guilds/:guildId/members');
            if (params && method === 'GET') {
                const guild = client.guilds.cache.get(params.guildId);
                if (!guild) return sendJson(res, 404, { ok: false, error: 'Guild not found' });
                const members = guild.members.cache
                    .filter(m => !m.user.bot)
                    .map(m => {
                        const voiceChannel = m.voice?.channel;
                        return {
                            id: m.id,
                            username: m.user.username,
                            displayName: m.displayName,
                            bot: false,
                            avatarURL: m.user.displayAvatarURL() || null,
                            voiceChannelId: voiceChannel?.id || null,
                            voiceChannelName: voiceChannel?.name || null,
                            joinedAt: m.joinedAt?.toISOString() || null
                        };
                    });
                return sendJson(res, 200, { ok: true, guildId: params.guildId, members });
            }

            // ----------------------------------------------------------------
            // POST /api/actions/session/start — structured session start
            // ----------------------------------------------------------------
            if (pathname === '/api/actions/session/start' && method === 'POST') {
                const body = await readBody(req);
                const { guildId, voiceChannelId, durationMinutes, requestedBy } = body;
                const execId = `exec_${Date.now()}`;

                if (!voiceChannelId) {
                    return sendJson(res, 400, {
                        ok: false,
                        action: 'session.start',
                        error: 'Missing voiceChannelId',
                        details: 'Dashboard session start requires a selected voice channel.',
                        executionId: execId
                    });
                }

                if (!durationMinutes || durationMinutes <= 0) {
                    return sendJson(res, 400, {
                        ok: false,
                        action: 'session.start',
                        error: 'Missing or invalid durationMinutes',
                        executionId: execId
                    });
                }

                const triggeredBy = requestedBy || 'dashboard-admin';
                const result = sessionService.startSession(voiceChannelId, triggeredBy, { durationMinutes });

                if (result.success) {
                    // Bootstrap users already in voice channel if bot can see it
                    if (client.isReady() && guildId) {
                        const guild = client.guilds.cache.get(guildId);
                        const voiceChannel = guild?.channels?.cache?.get(voiceChannelId);
                        if (voiceChannel) {
                            sessionService.bootstrapChannelUsers(voiceChannel, result.sessionId);
                            sessionService.ensureChannelState(voiceChannel);
                        }
                    }

                    logger.log(`[API] Dashboard started session #${result.sessionId} in channel ${voiceChannelId}`);
                    return sendJson(res, 200, {
                        ok: true,
                        action: 'session.start',
                        message: result.message,
                        session: {
                            id: result.sessionId,
                            voiceChannelId,
                            guildId: guildId || null,
                            durationMinutes,
                            status: 'active',
                            startedAt: new Date().toISOString()
                        },
                        executionId: execId
                    });
                } else {
                    return sendJson(res, 400, {
                        ok: false,
                        action: 'session.start',
                        error: result.message,
                        executionId: execId
                    });
                }
            }

            // ----------------------------------------------------------------
            // POST /api/actions/session/end — structured session end
            // ----------------------------------------------------------------
            if (pathname === '/api/actions/session/end' && method === 'POST') {
                const body = await readBody(req);
                const { sessionId, voiceChannelId, requestedBy } = body;
                const execId = `exec_${Date.now()}`;

                let result;
                if (sessionId) {
                    result = sessionService.endSessionById(Number(sessionId), 'Dashboard end');
                } else if (voiceChannelId) {
                    result = sessionService.endSession(voiceChannelId);
                } else {
                    // End all active sessions
                    result = sessionService.endAllSessions();
                }

                logger.log(`[API] Dashboard ended session: ${JSON.stringify({ sessionId, voiceChannelId })}`);

                return sendJson(res, result.success ? 200 : 400, {
                    ok: result.success,
                    action: 'session.end',
                    message: result.message,
                    executionId: execId
                });
            }

            // ----------------------------------------------------------------
            // POST /api/actions/session/report — generate report
            // ----------------------------------------------------------------
            if (pathname === '/api/actions/session/report' && method === 'POST') {
                const body = await readBody(req);
                const { sessionId } = body;
                const execId = `exec_${Date.now()}`;

                if (!sessionId) {
                    return sendJson(res, 400, {
                        ok: false,
                        action: 'session.report',
                        error: 'sessionId required',
                        executionId: execId
                    });
                }

                // Execute the session-summary command internally
                const result = await executeCommand(`!session-summary --id ${sessionId}`, {
                    source: 'dashboard',
                    user: { id: 'dashboard', username: 'Dashboard Admin' }
                });

                return sendJson(res, 200, {
                    ok: result.exitCode === 0,
                    action: 'session.report',
                    message: result.output,
                    executionId: execId
                });
            }

            // ----------------------------------------------------------------
            // GET /api/system/database — DB debug info
            // ----------------------------------------------------------------
            if (pathname === '/api/system/database' && method === 'GET') {
                const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data.db');
                let tables = [];
                try {
                    tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r => r.name);
                } catch {}
                return sendJson(res, 200, {
                    ok: true,
                    path: dbPath,
                    exists: true,
                    readonly: false,
                    tables
                });
            }


            // ----------------------------------------------------------------
            // GET /api/actions/list-sessions — list all active sessions
            // ----------------------------------------------------------------
            if (pathname === '/api/actions/list-sessions' && method === 'GET') {
                const activeSessions = sessionModel.getActiveSessions();
                return sendJson(res, 200, {
                    ok: true,
                    action: 'list-sessions',
                    count: activeSessions.length,
                    sessions: activeSessions.map(s => ({
                        id: s.id,
                        channelId: s.channel_id,
                        triggeredBy: s.triggered_by,
                        startedAt: s.start_time,
                        autoEndAt: s.auto_end_at,
                        durationMinutes: s.duration_minutes
                    }))
                });
            }

            // ----------------------------------------------------------------
            // GET /api/actions/db-status — database health check
            // ----------------------------------------------------------------
            if (pathname === '/api/actions/db-status' && method === 'GET') {
                const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data.db');
                let tables = [];
                let sessionCount = 0;
                let logCount = 0;
                let userCount = 0;
                try {
                    tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r => r.name);
                    sessionCount = db.prepare('SELECT COUNT(*) as n FROM sessions').get().n;
                    logCount = db.prepare('SELECT COUNT(*) as n FROM logs').get().n;
                    userCount = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
                } catch {}
                return sendJson(res, 200, {
                    ok: true,
                    action: 'db-status',
                    path: dbPath,
                    tables,
                    counts: { sessions: sessionCount, logs: logCount, users: userCount }
                });
            }

            // ----------------------------------------------------------------
            // POST /api/actions/sync-voice-members — snapshot members in voice channel
            // ----------------------------------------------------------------
            if (pathname === '/api/actions/sync-voice-members' && method === 'POST') {
                const body = await readBody(req);
                const { guildId, voiceChannelId } = body;
                const execId = `exec_${Date.now()}`;

                if (!client.isReady()) {
                    return sendJson(res, 503, { ok: false, action: 'sync-voice-members', error: 'Bot not ready', executionId: execId });
                }
                if (!guildId || !voiceChannelId) {
                    return sendJson(res, 400, { ok: false, action: 'sync-voice-members', error: 'guildId and voiceChannelId required', executionId: execId });
                }

                const guild = client.guilds.cache.get(guildId);
                if (!guild) return sendJson(res, 404, { ok: false, error: 'Guild not found', executionId: execId });

                const channel = guild.channels.cache.get(voiceChannelId);
                if (!channel) return sendJson(res, 404, { ok: false, error: 'Channel not found', executionId: execId });

                const members = channel.members
                    ? [...channel.members.values()].filter(m => !m.user.bot).map(m => ({
                        id: m.id,
                        username: m.user.username,
                        displayName: m.displayName
                    }))
                    : [];

                return sendJson(res, 200, {
                    ok: true,
                    action: 'sync-voice-members',
                    channelId: voiceChannelId,
                    memberCount: members.length,
                    members,
                    executionId: execId
                });
            }

            // ----------------------------------------------------------------
            // GET /api/actions/check-permissions?guildId=...
            // ----------------------------------------------------------------
            params = matchPath(pathname, '/api/actions/check-permissions');
            if (params !== null || pathname === '/api/actions/check-permissions') {
                const parsedUrl = url.parse(req.url, true);
                const guildId = parsedUrl.query.guildId;

                if (!client.isReady()) {
                    return sendJson(res, 503, { ok: false, error: 'Bot not ready' });
                }

                const checkGuild = guildId ? client.guilds.cache.get(guildId) : client.guilds.cache.first();
                if (!checkGuild) {
                    return sendJson(res, 404, { ok: false, error: 'Guild not found. Bot may not be in any server.' });
                }

                const botMember = checkGuild.members.cache.get(client.user.id);
                const perms = botMember?.permissions;
                const checks = [
                    { name: 'View Channels', ok: perms?.has('ViewChannel') ?? false },
                    { name: 'Send Messages', ok: perms?.has('SendMessages') ?? false },
                    { name: 'Connect (Voice)', ok: perms?.has('Connect') ?? false },
                    { name: 'Read Message History', ok: perms?.has('ReadMessageHistory') ?? false },
                    { name: 'Add Reactions', ok: perms?.has('AddReactions') ?? false },
                ];
                const allOk = checks.every(c => c.ok);
                return sendJson(res, 200, {
                    ok: allOk,
                    action: 'check-permissions',
                    guildId: checkGuild.id,
                    guildName: checkGuild.name,
                    permissions: checks
                });
            }

            // ----------------------------------------------------------------
            // 404
            // ----------------------------------------------------------------
            return sendJson(res, 404, { ok: false, error: 'Not Found', path: pathname });


        } catch (err) {
            logger.error(`[API] Unhandled error: ${err.message}`, { path: pathname, error: err.message });
            return sendJson(res, 500, { ok: false, error: err.message });
        }
    });

    server.listen(PORT, '127.0.0.1', () => {
        logger.log(`[API] Internal server running on http://127.0.0.1:${PORT}`);
    });

    return server;
}

module.exports = { startApiServer };
