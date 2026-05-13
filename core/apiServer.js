// core/apiServer.js
const http = require('http');
const url = require('url');
const path = require('path');
const { executeCommand } = require('./commandExecutor');
const commands = require('../commands');
const db = require('../database/db');
const sessionModel = require('../models/sessionModel');
const sessionService = require('../modules/sessions/sessionService');
const sessionActionService = require('../services/sessionActionService');
const messageService = require('../services/messageService');
const schedulerService = require('../services/schedulerService');
const reportService = require('../services/reportService');
const activityFeedService = require('../services/activityFeedService');
const { getLogs } = require('../models/logModel');
const logger = require('../utils/logger');
const { ChannelType } = require('discord.js');

const PORT = process.env.BOT_API_PORT || 4000;
const API_KEY = process.env.BOT_API_KEY || 'local_dashboard_key_123';

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

function sendJson(res, status, payload) {
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
}

function sendPdf(res, status, buffer, filename) {
    res.writeHead(status, {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename.replace(/"/g, '')}"`,
        'Content-Length': buffer.length,
    });
    res.end(buffer);
}

function matchPath(pathname, pattern) {
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

function getRuntimePayload(client) {
    const memory = process.memoryUsage();
    const activeSessions = sessionModel.getActiveSessions ? sessionModel.getActiveSessions().length : 0;
    return {
        ok: true, status: 'online',
        uptime: process.uptime(),
        botReady: client.isReady(),
        guildCount: client.guilds?.cache?.size || 0,
        userCount: client.users?.cache?.size || 0,
        activeSessions, memory: {
            rss: Math.round(memory.rss / 1024 / 1024) + ' MB',
            heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + ' MB'
        },
        discordState: client.isReady() ? 'CONNECTED' : 'DISCONNECTED',
        version: process.env.npm_package_version || '1.0.0',
        timestamp: new Date().toISOString()
    };
}

function startApiServer(client) {
    global.client = client;
    sessionActionService.setClient(client);
    messageService.setClient(client);

    const server = http.createServer(async (req, res) => {
        const reqUrl = url.parse(req.url, true);
        const pathname = reqUrl.pathname;
        const method = req.method;
        const query = reqUrl.query;

        // Auth
        if (req.headers['x-api-key'] !== API_KEY) {
            return sendJson(res, 401, { ok: false, error: 'Unauthorized' });
        }

        try {
            // ----------------------------------------------------------------
            // Health / status
            // ----------------------------------------------------------------
            if (['/health', '/status', '/api/health', '/api/status'].includes(pathname) && method === 'GET') {
                return sendJson(res, 200, getRuntimePayload(client));
            }

            // ----------------------------------------------------------------
            // POST /api/execute
            // ----------------------------------------------------------------
            if (pathname === '/api/execute' && method === 'POST') {
                const data = await readBody(req);
                const { command, args, requestId, guildId, channelId, voiceChannelId, textChannelId } = data;
                const rawCmd = typeof command === 'string' ? command.trim() : '';
                let commandString = rawCmd.startsWith('!') ? rawCmd : (rawCmd ? `!${rawCmd}` : '');
                if (!commandString) {
                    return sendJson(res, 400, { success: false, error: 'command is required', requestId: requestId || `exec_${Date.now()}` });
                }
                if (args && typeof args === 'object') {
                    for (const [key, value] of Object.entries(args)) {
                        if (value === true) commandString += ` --${key}`;
                        else if (value !== false && value !== undefined) commandString += ` --${key} "${value}"`;
                    }
                }
                const textCtx = textChannelId || channelId || null;
                const voiceCtx = voiceChannelId || null;
                const context = {
                    source: 'dashboard',
                    user: { id: 'dashboard', username: 'Dashboard Admin' },
                    guild: guildId ? { id: guildId } : null,
                    channel: textCtx ? { id: textCtx } : null,
                    voiceChannelId: voiceCtx,
                    textChannelId: textCtx
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
            // GET /api/commands
            // ----------------------------------------------------------------
            if (pathname === '/api/commands' && method === 'GET') {
                const seen = new Set();
                const registry = [];
                for (const [, c] of commands) {
                    if (seen.has(c.name)) continue;
                    seen.add(c.name);
                    registry.push({
                        name: c.name,
                        description: c.description || '',
                        usage: c.usage || '',
                        category: c.category || 'general',
                        aliases: c.aliases || [],
                        options: c.options || [],
                        supportsDashboard: c.supportsDashboard || false,
                        requiresGuild: c.requiresGuild || false,
                        requiresVoiceChannel: c.requiresVoiceChannel || false,
                        requiresTextChannel: c.requiresTextChannel || false
                    });
                }
                return sendJson(res, 200, { success: true, data: registry });
            }

            // ----------------------------------------------------------------
            // Attendance checkpoints (daily check-in / checkout)
            // ----------------------------------------------------------------
            if (pathname === '/api/attendance/settings' && method === 'GET') {
                const attendanceSettingsService = require('../services/attendanceSettingsService');
                const guildId = query.guildId;
                if (!guildId) return sendJson(res, 400, { ok: false, error: 'guildId is required' });
                const result = attendanceSettingsService.getCheckpointDefinitions(guildId);
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            if (pathname === '/api/attendance/settings/checkpoints' && method === 'POST') {
                const attendanceSettingsService = require('../services/attendanceSettingsService');
                const body = await readBody(req);
                const result = attendanceSettingsService.createCheckpointDefinition(
                    body.guildId,
                    body,
                    body.changedBy || 'dashboard'
                );
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            let attendanceParams = matchPath(pathname, '/api/attendance/settings/checkpoints/:id');
            if (attendanceParams && method === 'PATCH') {
                const attendanceSettingsService = require('../services/attendanceSettingsService');
                const body = await readBody(req);
                const result = attendanceSettingsService.updateCheckpointDefinition(
                    body.guildId || query.guildId,
                    Number(attendanceParams.id),
                    body,
                    body.changedBy || 'dashboard'
                );
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            attendanceParams = matchPath(pathname, '/api/attendance/settings/checkpoints/:id');
            if (attendanceParams && method === 'DELETE') {
                const attendanceSettingsService = require('../services/attendanceSettingsService');
                const body = await readBody(req).catch(() => ({}));
                const guildId = body.guildId || query.guildId;
                const changedBy = body.changedBy || query.changedBy || 'dashboard';
                const force = String(query.force || body.force || '') === 'true';
                const result = attendanceSettingsService.deleteCheckpointDefinition(guildId, Number(attendanceParams.id), changedBy, { force });
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            attendanceParams = matchPath(pathname, '/api/attendance/settings/checkpoints/:id/deactivate');
            if (attendanceParams && method === 'POST') {
                const attendanceSettingsService = require('../services/attendanceSettingsService');
                const body = await readBody(req).catch(() => ({}));
                const guildId = body.guildId || query.guildId;
                const changedBy = body.changedBy || query.changedBy || 'dashboard';
                const result = attendanceSettingsService.deactivateCheckpointDefinition(guildId, Number(attendanceParams.id), changedBy);
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            if (pathname === '/api/attendance/settings/checkpoints/reorder' && method === 'POST') {
                const attendanceSettingsService = require('../services/attendanceSettingsService');
                const body = await readBody(req);
                const result = attendanceSettingsService.reorderCheckpointDefinitions(
                    body.guildId || query.guildId,
                    body.orderedIds || body.ids || [],
                    body.changedBy || 'dashboard'
                );
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            if (pathname === '/api/attendance/settings/restore-defaults' && method === 'POST') {
                const attendanceSettingsService = require('../services/attendanceSettingsService');
                const body = await readBody(req).catch(() => ({}));
                const guildId = body.guildId || query.guildId;
                if (!guildId) return sendJson(res, 400, { ok: false, error: 'guildId is required' });
                const result = attendanceSettingsService.restoreDefaultCheckpointDefinitions(
                    guildId,
                    body.changedBy || 'dashboard'
                );
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            attendanceParams = matchPath(pathname, '/api/attendance/settings/checkpoints/:id/update');
            if (attendanceParams && method === 'POST') {
                const attendanceSettingsService = require('../services/attendanceSettingsService');
                const body = await readBody(req);
                const result = attendanceSettingsService.updateCheckpointDefinition(
                    body.guildId || query.guildId,
                    Number(attendanceParams.id),
                    body,
                    body.changedBy || 'dashboard'
                );
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            attendanceParams = matchPath(pathname, '/api/attendance/settings/checkpoints/:id/delete');
            if (attendanceParams && method === 'POST') {
                const attendanceSettingsService = require('../services/attendanceSettingsService');
                const body = await readBody(req).catch(() => ({}));
                const guildId = body.guildId || query.guildId;
                const changedBy = body.changedBy || query.changedBy || 'dashboard';
                const force = String(query.force || body.force || '') === 'true';
                const result = attendanceSettingsService.deleteCheckpointDefinition(guildId, Number(attendanceParams.id), changedBy, { force });
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            if (pathname === '/api/attendance/today' && method === 'GET') {
                const attendanceService = require('../services/attendanceCheckpointService');
                const guildId = query.guildId;
                const date = query.date || null;
                const cohortIdRaw = query.cohortId;
                const cohortId =
                    cohortIdRaw != null && String(cohortIdRaw) !== '' && Number.isFinite(Number(cohortIdRaw))
                        ? Number(cohortIdRaw)
                        : null;
                if (!guildId) return sendJson(res, 400, { ok: false, error: 'guildId is required' });
                const result = attendanceService.getTodayAttendance({ guildId, date, cohortId });
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            if (pathname === '/api/attendance/week' && method === 'GET') {
                const attendanceService = require('../services/attendanceCheckpointService');
                const guildId = query.guildId;
                const weekStart = query.weekStart;
                const weekEnd = query.weekEnd;
                if (!guildId || !weekStart || !weekEnd) {
                    return sendJson(res, 400, { ok: false, error: 'guildId, weekStart, and weekEnd are required' });
                }
                const result = attendanceService.getWeeklyAttendance({ guildId, weekStart, weekEnd });
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            if (pathname === '/api/attendance/month' && method === 'GET') {
                const attendanceService = require('../services/attendanceCheckpointService');
                const guildId = query.guildId;
                const month = query.month;
                const year = query.year;
                if (!guildId || !month || !year) {
                    return sendJson(res, 400, { ok: false, error: 'guildId, month, and year are required' });
                }
                const result = attendanceService.getMonthlyAttendance({ guildId, month, year });
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            if (pathname === '/api/attendance/missing' && method === 'GET') {
                const attendanceService = require('../services/attendanceCheckpointService');
                const guildId = query.guildId;
                const date = query.date;
                if (!guildId || !date) return sendJson(res, 400, { ok: false, error: 'guildId and date are required' });
                const result = attendanceService.getMissingCheckpoints({ guildId, date });
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            if (pathname === '/api/attendance/manual' && method === 'POST') {
                const attendanceService = require('../services/attendanceCheckpointService');
                const body = await readBody(req);
                const {
                    guildId,
                    userId,
                    studentId,
                    date,
                    checkpointKey,
                    status,
                    reason,
                    notes,
                    changedBy,
                    displayName,
                    username,
                    dutyStation,
                    signatureText,
                } = body || {};
                const sid = studentId != null && studentId !== '' ? Number(studentId) : null;
                const result = attendanceService.upsertManualAttendance({
                    guildId,
                    userId,
                    studentId: Number.isFinite(sid) ? sid : null,
                    date,
                    checkpointKey,
                    status,
                    reason: reason ?? notes,
                    changedBy,
                    displayName,
                    username,
                    dutyStation,
                    signatureText,
                });
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            attendanceParams = matchPath(pathname, '/api/attendance/manual/:id');
            if (attendanceParams && method === 'DELETE') {
                const body = await readBody(req).catch(() => ({}));
                const guildId = body.guildId || query.guildId;
                if (!guildId) return sendJson(res, 400, { ok: false, error: 'guildId is required' });
                const info = db.prepare('DELETE FROM attendance_checkpoints WHERE id=? AND guild_id=?').run(Number(attendanceParams.id), guildId);
                return sendJson(res, info.changes > 0 ? 200 : 404, info.changes > 0 ? { ok: true } : { ok: false, error: 'Record not found' });
            }

            attendanceParams = matchPath(pathname, '/api/attendance/manual/:id/delete');
            if (attendanceParams && method === 'POST') {
                const body = await readBody(req).catch(() => ({}));
                const guildId = body.guildId || query.guildId;
                if (!guildId) return sendJson(res, 400, { ok: false, error: 'guildId is required' });
                const info = db.prepare('DELETE FROM attendance_checkpoints WHERE id=? AND guild_id=?').run(Number(attendanceParams.id), guildId);
                return sendJson(res, info.changes > 0 ? 200 : 404, info.changes > 0 ? { ok: true } : { ok: false, error: 'Record not found' });
            }

            if (pathname === '/api/attendance/export' && method === 'GET') {
                const attendanceService = require('../services/attendanceCheckpointService');
                const guildId = query.guildId;
                const startDate = query.startDate;
                const endDate = query.endDate;
                const courseName = query.courseName || '';
                const cohortId = query.cohortId ? Number(query.cohortId) : null;
                if (!guildId || !startDate || !endDate) {
                    return sendJson(res, 400, { ok: false, error: 'guildId, startDate, and endDate are required' });
                }
                const result = attendanceService.exportAttendanceCsv({ guildId, startDate, endDate, courseName, cohortId, mode: 'range' });
                if (!result.ok) return sendJson(res, 400, result);
                return sendJson(res, 200, result);
            }

            if (pathname === '/api/attendance/export/pdf' && method === 'GET') {
                const attendanceDaily = require('../services/attendanceDailyStatusService');
                const guildId = query.guildId;
                const month = query.month;
                const year = query.year;
                const courseName = query.courseName || '';
                const cohortId = query.cohortId ? Number(query.cohortId) : null;
                const dutyStationDefault = query.dutyStationDefault || 'Remote';
                const includeIncomplete = String(query.includeIncomplete || '') === 'true';
                const includeAllRosterStudents = String(query.includeAllRosterStudents || 'true') !== 'false';
                if (!guildId || !month || !year) {
                    return sendJson(res, 400, { ok: false, error: 'guildId, month, and year are required' });
                }
                const pdfRes = await attendanceDaily.exportOfficialAttendancePdf({
                    guildId,
                    cohortId,
                    month: Number(month),
                    year: Number(year),
                    courseName,
                    dutyStationDefault,
                    includeIncomplete,
                    includeAllRosterStudents,
                });
                if (!pdfRes.ok) return sendJson(res, 400, pdfRes);
                return sendPdf(res, 200, pdfRes.buffer, pdfRes.filename || 'attendance.pdf');
            }

            if (pathname === '/api/attendance/official-sheet' && method === 'GET') {
                const attendanceDaily = require('../services/attendanceDailyStatusService');
                const guildId = query.guildId;
                const month = query.month;
                const year = query.year;
                const cohortId = query.cohortId ? Number(query.cohortId) : null;
                const dutyStationDefault = query.dutyStationDefault || 'Remote';
                const includeIncomplete = String(query.includeIncomplete || '') === 'true';
                const includeAllRosterStudents = String(query.includeAllRosterStudents || 'true') !== 'false';
                if (!guildId || !month || !year) {
                    return sendJson(res, 400, { ok: false, error: 'guildId, month, and year are required' });
                }
                const result = attendanceDaily.getOfficialAttendanceSheetRows({
                    guildId,
                    cohortId,
                    month: Number(month),
                    year: Number(year),
                    dutyStationDefault,
                    includeIncomplete,
                    includeAllRosterStudents,
                });
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            if (pathname === '/api/attendance/summary-range' && method === 'GET') {
                const attendanceDaily = require('../services/attendanceDailyStatusService');
                const guildId = query.guildId;
                const startDate = query.startDate;
                const endDate = query.endDate;
                const cohortId = query.cohortId ? Number(query.cohortId) : null;
                if (!guildId || !startDate || !endDate) {
                    return sendJson(res, 400, { ok: false, error: 'guildId, startDate, and endDate are required' });
                }
                const result = attendanceDaily.getRangeDailySummary({ guildId, startDate, endDate, cohortId });
                return sendJson(res, 200, result);
            }

            if (pathname === '/api/attendance/daily-override' && method === 'POST') {
                const attendanceDaily = require('../services/attendanceDailyStatusService');
                const body = await readBody(req);
                const result = attendanceDaily.upsertDailyOverride({
                    guildId: body.guildId,
                    userId: body.userId,
                    attendanceDate: body.attendanceDate || body.date,
                    status: body.status,
                    signatureText: body.signatureText,
                    notes: body.notes,
                    changedBy: body.changedBy || 'dashboard',
                    studentId: body.studentId != null ? Number(body.studentId) : null,
                });
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            // ----------------------------------------------------------------
            // Roster / cohorts
            // ----------------------------------------------------------------
            if (pathname === '/api/roster/cohorts' && method === 'GET') {
                const rosterService = require('../services/rosterService');
                const guildId = query.guildId;
                if (!guildId) return sendJson(res, 400, { ok: false, error: 'guildId is required' });
                return sendJson(res, 200, { ok: true, cohorts: rosterService.listCohorts(guildId) });
            }

            if (pathname === '/api/roster/cohorts' && method === 'POST') {
                const rosterService = require('../services/rosterService');
                const body = await readBody(req);
                const result = rosterService.createCohort({
                    guildId: body.guildId,
                    name: body.name,
                    courseName: body.courseName || null,
                    courseCode: body.courseCode || null,
                    active: body.active === false ? 0 : 1,
                });
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            if (pathname === '/api/roster/students' && method === 'GET') {
                const rosterService = require('../services/rosterService');
                const guildId = query.guildId;
                const cohortId = query.cohortId ? Number(query.cohortId) : null;
                let active;
                if (query.active != null && query.active !== '') {
                    const s = String(query.active).toLowerCase();
                    if (s === 'true' || s === '1' || s === 'yes') active = true;
                    else if (s === 'false' || s === '0' || s === 'no') active = false;
                }
                if (!guildId) return sendJson(res, 400, { ok: false, error: 'guildId is required' });
                const students = rosterService.listStudents({ guildId, cohortId, active });
                return sendJson(res, 200, { ok: true, students });
            }

            if (pathname === '/api/roster/students' && method === 'POST') {
                const rosterService = require('../services/rosterService');
                const body = await readBody(req);
                const result = rosterService.upsertStudent({
                    guildId: body.guildId,
                    fullName: body.fullName,
                    preferredName: body.preferredName || null,
                    email: body.email || null,
                    discordUserId: body.discordUserId || null,
                    discordUsername: body.discordUsername || null,
                    dutyStation: body.dutyStation || 'Remote',
                    studentCode: body.studentCode || null,
                    active: body.active === false ? 0 : 1,
                });
                if (result.ok && body.cohortId) {
                    rosterService.attachStudentToCohort({
                        cohortId: Number(body.cohortId),
                        studentId: result.student.id,
                        active: 1,
                    });
                }
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            let rosterParams = matchPath(pathname, '/api/roster/students/:id');
            if (rosterParams && (method === 'PATCH' || method === 'POST')) {
                const rosterService = require('../services/rosterService');
                const body = await readBody(req);
                const guildId = body.guildId || query.guildId;
                if (!guildId) return sendJson(res, 400, { ok: false, error: 'guildId is required' });
                const result = rosterService.updateStudent({
                    guildId,
                    studentId: Number(rosterParams.id),
                    data: body,
                });
                if (result.ok && body.cohortId) {
                    rosterService.attachStudentToCohort({
                        cohortId: Number(body.cohortId),
                        studentId: Number(rosterParams.id),
                        active: body.active === false ? 0 : 1,
                    });
                }
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            if (pathname === '/api/roster/import' && method === 'POST') {
                const rosterService = require('../services/rosterService');
                const body = await readBody(req);
                const result = rosterService.importRosterCsv({
                    guildId: body.guildId,
                    csvText: body.csvText,
                    defaultCohortId: body.cohortId ? Number(body.cohortId) : null,
                    columnMap: body.columnMap || {},
                    dryRun: body.dryRun === true,
                });
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            if (pathname === '/api/roster/export' && method === 'GET') {
                const rosterService = require('../services/rosterService');
                const guildId = query.guildId;
                const cohortId = query.cohortId ? Number(query.cohortId) : null;
                const result = rosterService.exportRosterCsv({ guildId, cohortId });
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            if (pathname === '/api/roster/sync-discord' && method === 'POST') {
                const rosterService = require('../services/rosterService');
                const body = await readBody(req);
                const { guildId, cohortId, mode, syncedBy, studentRoleId, studentRoleName } = body;
                if (!guildId) return sendJson(res, 400, { ok: false, error: 'guildId is required' });
                if (!client.isReady()) return sendJson(res, 503, { ok: false, error: 'Bot not ready. Cannot access Discord guild members.' });
                const guild = client.guilds.cache.get(guildId);
                if (!guild) return sendJson(res, 404, { ok: false, error: 'Guild not found. Make sure the bot is in the server.' });
                const result = await rosterService.syncStudentsFromDiscordGuild({
                    guild,
                    guildId,
                    cohortId: cohortId ? Number(cohortId) : null,
                    syncedBy: syncedBy || 'dashboard',
                    mode: mode === 'mirror' ? 'mirror' : 'append',
                    studentRoleId: studentRoleId || null,
                    studentRoleName: studentRoleName || null,
                });
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            if (pathname === '/api/attendance/import/preview' && method === 'POST') {
                const attendanceImportService = require('../services/attendanceImportService');
                const body = await readBody(req);
                const result = attendanceImportService.previewImportRows({
                    guildId: body.guildId,
                    csvText: body.csvText
                });
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            if (pathname === '/api/attendance/import/commit' && method === 'POST') {
                const attendanceImportService = require('../services/attendanceImportService');
                const body = await readBody(req);
                const result = attendanceImportService.commitImport({
                    guildId: body.guildId,
                    csvText: body.csvText,
                    importedBy: body.importedBy || 'dashboard'
                });
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            // ----------------------------------------------------------------
            // GET /api/system/runtime
            // ----------------------------------------------------------------
            if (pathname === '/api/system/runtime' && method === 'GET') {
                const memory = process.memoryUsage();
                return sendJson(res, 200, {
                    success: true, data: {
                        uptime: process.uptime(),
                        memory: {
                            rss: Math.round(memory.rss / 1024 / 1024) + ' MB',
                            heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + ' MB',
                            heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + ' MB'
                        },
                        discordState: client.isReady() ? 'CONNECTED' : 'DISCONNECTED',
                        activeSessions: sessionModel.getActiveSessions().length,
                        version: process.env.npm_package_version || '1.0.0'
                    }
                });
            }

            // ----------------------------------------------------------------
            // GET /api/system/database
            // ----------------------------------------------------------------
            if (pathname === '/api/system/database' && method === 'GET') {
                const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data.db');
                let tables = [], counts = {};
                try {
                    tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r => r.name);
                    for (const t of tables) {
                        try { counts[t] = db.prepare(`SELECT COUNT(*) as n FROM ${t}`).get().n; } catch {}
                    }
                } catch {}
                return sendJson(res, 200, { ok: true, path: dbPath, tables, counts });
            }

            // ----------------------------------------------------------------
            // GET /api/actions/db-status
            // ----------------------------------------------------------------
            if (pathname === '/api/actions/db-status' && method === 'GET') {
                const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '..', 'data.db');
                let tables = [], sessionCount = 0, logCount = 0, userCount = 0;
                try {
                    tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name").all().map(r => r.name);
                    sessionCount = db.prepare('SELECT COUNT(*) as n FROM sessions').get().n;
                    logCount = db.prepare('SELECT COUNT(*) as n FROM logs').get().n;
                    userCount = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
                } catch {}
                return sendJson(res, 200, { ok: true, action: 'db-status', path: dbPath, tables, counts: { sessions: sessionCount, logs: logCount, users: userCount } });
            }

            // ----------------------------------------------------------------
            // Discord guild/channel/member routes
            // ----------------------------------------------------------------
            if (pathname === '/api/discord/guilds' && method === 'GET') {
                if (!client.isReady()) return sendJson(res, 503, { ok: false, error: 'Bot not ready' });
                const guilds = client.guilds.cache.map(g => ({ id: g.id, name: g.name, memberCount: g.memberCount, available: g.available, iconURL: g.iconURL() || null }));
                return sendJson(res, 200, { ok: true, guilds });
            }

            let params = matchPath(pathname, '/api/discord/guilds/:guildId/channels');
            if (params && method === 'GET') {
                const guild = client.guilds.cache.get(params.guildId);
                if (!guild) return sendJson(res, 404, { ok: false, error: 'Guild not found' });
                const channels = guild.channels.cache.map(ch => ({ id: ch.id, name: ch.name, type: ch.type, parentId: ch.parentId || null, parentName: ch.parent?.name || null }));
                return sendJson(res, 200, { ok: true, guildId: params.guildId, channels });
            }

            params = matchPath(pathname, '/api/discord/guilds/:guildId/voice-channels');
            if (params && method === 'GET') {
                const guild = client.guilds.cache.get(params.guildId);
                if (!guild) return sendJson(res, 404, { ok: false, error: 'Guild not found' });
                const channels = guild.channels.cache
                    .filter(ch => ch.type === ChannelType.GuildVoice || ch.type === ChannelType.GuildStageVoice)
                    .map(ch => ({
                        id: ch.id, name: ch.name, type: 'voice',
                        parentId: ch.parentId || null, parentName: ch.parent?.name || null,
                        memberCount: ch.members?.size || 0,
                        members: (ch.members || new Map()).filter(m => !m.user.bot).map(m => ({ id: m.id, username: m.user.username, displayName: m.displayName, bot: false }))
                    }));
                return sendJson(res, 200, { ok: true, guildId: params.guildId, channels });
            }

            params = matchPath(pathname, '/api/discord/guilds/:guildId/text-channels');
            if (params && method === 'GET') {
                const guild = client.guilds.cache.get(params.guildId);
                if (!guild) return sendJson(res, 404, { ok: false, error: 'Guild not found' });
                const channels = guild.channels.cache
                    .filter(ch => ch.type === ChannelType.GuildText || ch.type === ChannelType.GuildAnnouncement)
                    .map(ch => ({ id: ch.id, name: ch.name, type: 'text', parentId: ch.parentId || null, parentName: ch.parent?.name || null }));
                return sendJson(res, 200, { ok: true, guildId: params.guildId, channels });
            }

            params = matchPath(pathname, '/api/discord/guilds/:guildId/roles');
            if (params && method === 'GET') {
                const guild = client.guilds.cache.get(params.guildId);
                if (!guild) return sendJson(res, 404, { ok: false, error: 'Guild not found' });
                
                const roles = guild.roles.cache
                    .filter(r => r.id !== guild.id) // Exclude @everyone (role ID matches guild ID)
                    .map(r => ({
                        id: r.id,
                        name: r.name,
                        color: r.hexColor,
                        position: r.position,
                        managed: r.managed,
                        memberCount: r.members?.size || 0
                    }))
                    .sort((a, b) => b.position - a.position);

                return sendJson(res, 200, { ok: true, guildId: params.guildId, roles });
            }

            params = matchPath(pathname, '/api/discord/guilds/:guildId/members');
            if (params && method === 'GET') {
                const guild = client.guilds.cache.get(params.guildId);
                if (!guild) return sendJson(res, 404, { ok: false, error: 'Guild not found' });
                const members = guild.members.cache.filter(m => !m.user.bot).map(m => {
                    const vc = m.voice?.channel;
                    return { id: m.id, username: m.user.username, displayName: m.displayName, bot: false, avatarURL: m.user.displayAvatarURL() || null, voiceChannelId: vc?.id || null, voiceChannelName: vc?.name || null, joinedAt: m.joinedAt?.toISOString() || null };
                });
                return sendJson(res, 200, { ok: true, guildId: params.guildId, members });
            }

            // ----------------------------------------------------------------
            // POST /api/actions/session/start — structured session start
            // ----------------------------------------------------------------
            if (pathname === '/api/actions/session/start' && method === 'POST') {
                const body = await readBody(req);
                const result = await sessionActionService.startSessionFromAction({
                    guildId: body.guildId,
                    voiceChannelId: body.voiceChannelId,
                    textChannelId: body.textChannelId,
                    title: body.title,
                    durationMinutes: body.durationMinutes,
                    tracking: body.tracking,
                    options: body.options,
                    requestedBy: body.requestedBy || 'dashboard-admin',
                    source: 'dashboard',
                    sendDiscordAnnouncement: body.sendDiscordAnnouncement || false
                });
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            // ----------------------------------------------------------------
            // POST /api/actions/session/end
            // ----------------------------------------------------------------
            if (pathname === '/api/actions/session/end' && method === 'POST') {
                const body = await readBody(req);
                const result = await sessionActionService.endSessionFromAction({
                    sessionId: body.sessionId,
                    voiceChannelId: body.voiceChannelId,
                    requestedBy: body.requestedBy,
                    reason: body.reason || 'Dashboard end'
                });
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            // ----------------------------------------------------------------
            // POST /api/actions/session/report
            // ----------------------------------------------------------------
            if (pathname === '/api/actions/session/report' && method === 'POST') {
                const body = await readBody(req);
                const result = await sessionActionService.generateReportFromAction({
                    sessionId: body.sessionId,
                    requestedBy: body.requestedBy || 'dashboard',
                    postToChannelId: body.postToChannelId || null
                });
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            // ----------------------------------------------------------------
            // GET /api/sessions — list all sessions
            // ----------------------------------------------------------------
            if (pathname === '/api/sessions' && method === 'GET') {
                const limit = Number(query.limit) || 50;
                const rows = db.prepare('SELECT * FROM sessions ORDER BY start_time DESC LIMIT ?').all(limit);
                return sendJson(res, 200, { ok: true, sessions: rows });
            }

            // ----------------------------------------------------------------
            // GET /api/sessions/active
            // ----------------------------------------------------------------
            if (pathname === '/api/sessions/active' && method === 'GET') {
                const active = sessionModel.getActiveSessions();
                return sendJson(res, 200, { ok: true, count: active.length, sessions: active });
            }

            // ----------------------------------------------------------------
            // GET /api/sessions/:id
            // ----------------------------------------------------------------
            params = matchPath(pathname, '/api/sessions/:id');
            if (params && method === 'GET') {
                const session = sessionModel.getSessionById(Number(params.id));
                if (!session) return sendJson(res, 404, { ok: false, error: 'Session not found' });
                return sendJson(res, 200, { ok: true, session });
            }

            // ----------------------------------------------------------------
            // GET /api/actions/list-sessions
            // ----------------------------------------------------------------
            if (pathname === '/api/actions/list-sessions' && method === 'GET') {
                const active = sessionModel.getActiveSessions();
                return sendJson(res, 200, {
                    ok: true, action: 'list-sessions', count: active.length,
                    sessions: active.map(s => ({
                        id: s.id, channelId: s.channel_id, voiceChannelId: s.voice_channel_id || s.channel_id,
                        textChannelId: s.text_channel_id || null, guildId: s.guild_id || null,
                        title: s.title || null, triggeredBy: s.triggered_by,
                        startedAt: s.start_time, autoEndAt: s.auto_end_at, durationMinutes: s.duration_minutes
                    }))
                });
            }

            // ----------------------------------------------------------------
            // POST /api/actions/schedule/session
            // ----------------------------------------------------------------
            if (pathname === '/api/actions/schedule/session' && method === 'POST') {
                const body = await readBody(req);
                const result = schedulerService.scheduleSession({
                    guildId: body.guildId,
                    voiceChannelId: body.voiceChannelId,
                    textChannelId: body.textChannelId,
                    title: body.title,
                    scheduledFor: body.scheduledFor,
                    durationMinutes: body.durationMinutes,
                    createdBy: body.requestedBy || 'dashboard',
                    payload: body.payload || {}
                });
                return sendJson(res, result.ok ? 200 : 400, { ...result, action: 'schedule.session' });
            }

            // ----------------------------------------------------------------
            // POST /api/actions/schedule/recurring-session
            // ----------------------------------------------------------------
            if (pathname === '/api/actions/schedule/recurring-session' && method === 'POST') {
                const body = await readBody(req);
                const result = schedulerService.scheduleRecurringSession({
                    guildId: body.guildId,
                    voiceChannelId: body.voiceChannelId,
                    textChannelId: body.textChannelId,
                    title: body.title,
                    daysOfWeek: body.daysOfWeek,
                    time: body.time,
                    timezone: body.timezone,
                    durationMinutes: body.durationMinutes,
                    createdBy: body.requestedBy || body.createdBy || 'dashboard',
                    tracking: body.tracking,
                    options: body.options
                });
                if (!result.ok) return sendJson(res, 400, result);
                return sendJson(res, 200, {
                    ok: true,
                    message: 'Recurring session scheduled.',
                    scheduledItem: {
                        id: result.id,
                        title: body.title || 'Recurring Session',
                        nextRunAt: result.nextRunAt,
                        daysOfWeek: body.daysOfWeek,
                        time: body.time,
                        timezone: body.timezone || 'Asia/Beirut'
                    }
                });
            }

            // ----------------------------------------------------------------
            // POST /api/actions/schedule/message
            // ----------------------------------------------------------------
            if (pathname === '/api/actions/schedule/message' && method === 'POST') {
                const body = await readBody(req);
                const result = schedulerService.scheduleMessage({
                    guildId: body.guildId,
                    textChannelId: body.textChannelId,
                    content: body.content,
                    scheduledFor: body.scheduledFor,
                    createdBy: body.requestedBy || 'dashboard'
                });
                return sendJson(res, result.ok ? 200 : 400, { ...result, action: 'schedule.message' });
            }

            // ----------------------------------------------------------------
            // GET /api/actions/schedule
            // ----------------------------------------------------------------
            if (pathname === '/api/actions/schedule' && method === 'GET') {
                const items = schedulerService.getScheduledItems({
                    status: query.status || null,
                    guildId: query.guildId || null,
                    type: query.type || null,
                    limit: query.limit ? Number(query.limit) : 100
                });
                return sendJson(res, 200, { ok: true, count: items.length, items });
            }

            // ----------------------------------------------------------------
            // GET /api/actions/schedule/:id
            // ----------------------------------------------------------------
            params = matchPath(pathname, '/api/actions/schedule/:id');
            if (params && method === 'GET') {
                const item = db.prepare('SELECT * FROM scheduled_items WHERE id = ?').get(Number(params.id));
                if (!item) return sendJson(res, 404, { ok: false, error: 'Scheduled item not found' });
                return sendJson(res, 200, { ok: true, item });
            }

            // ----------------------------------------------------------------
            // POST /api/actions/schedule/:id/cancel
            // ----------------------------------------------------------------
            params = matchPath(pathname, '/api/actions/schedule/:id/cancel');
            if (params && method === 'POST') {
                const result = schedulerService.cancelScheduledItem(Number(params.id));
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            // ----------------------------------------------------------------
            // POST /api/actions/schedule/:id/run-now
            // ----------------------------------------------------------------
            params = matchPath(pathname, '/api/actions/schedule/:id/run-now');
            if (params && method === 'POST') {
                const result = await schedulerService.runNow(Number(params.id));
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            // ----------------------------------------------------------------
            // POST /api/actions/message/send
            // ----------------------------------------------------------------
            if (pathname === '/api/actions/message/send' && method === 'POST') {
                const body = await readBody(req);
                const result = await messageService.sendMessageNow({
                    guildId: body.guildId,
                    textChannelId: body.textChannelId,
                    content: body.content,
                    requestedBy: body.requestedBy || 'dashboard',
                    source: 'dashboard'
                });
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            // ----------------------------------------------------------------
            // GET /api/actions/message/deliveries
            // ----------------------------------------------------------------
            if (pathname === '/api/actions/message/deliveries' && method === 'GET') {
                const deliveries = messageService.listMessageDeliveries({
                    guildId: query.guildId || null,
                    textChannelId: query.textChannelId || null,
                    status: query.status || null,
                    limit: query.limit ? Number(query.limit) : 50
                });
                return sendJson(res, 200, { ok: true, count: deliveries.length, deliveries });
            }

            // ----------------------------------------------------------------
            // GET /api/reports
            // ----------------------------------------------------------------
            if (pathname === '/api/actions/reports' && method === 'GET') {
                const reports = reportService.listSessionReports({
                    guildId: query.guildId || null,
                    limit: query.limit ? Number(query.limit) : 20
                });
                return sendJson(res, 200, { ok: true, count: reports.length, reports });
            }

            // ----------------------------------------------------------------
            // GET /api/actions/reports/:sessionId
            // ----------------------------------------------------------------
            params = matchPath(pathname, '/api/actions/reports/:sessionId');
            if (params && method === 'GET') {
                const result = reportService.getSessionReport(Number(params.sessionId));
                return sendJson(res, result.ok ? 200 : 404, result);
            }

            // ----------------------------------------------------------------
            // POST /api/actions/reports/:sessionId/post
            // ----------------------------------------------------------------
            params = matchPath(pathname, '/api/actions/reports/:sessionId/post');
            if (params && method === 'POST') {
                const body = await readBody(req);
                const result = await sessionActionService.generateReportFromAction({
                    sessionId: Number(params.sessionId),
                    requestedBy: body.requestedBy || 'dashboard',
                    postToChannelId: body.textChannelId || null
                });
                return sendJson(res, result.ok ? 200 : 400, result);
            }

            // ----------------------------------------------------------------
            // GET /api/activity
            // ----------------------------------------------------------------
            if (pathname === '/api/activity' && method === 'GET') {
                const feed = activityFeedService.getActivityFeed({
                    limit: query.limit ? Number(query.limit) : 100,
                    guildId: query.guildId || null,
                    sessionId: query.sessionId ? Number(query.sessionId) : null,
                    type: query.type || null
                });
                return sendJson(res, 200, { ok: true, count: feed.length, feed });
            }

            // ----------------------------------------------------------------
            // GET /api/logs
            // ----------------------------------------------------------------
            if (pathname === '/api/logs' && method === 'GET') {
                const logs = getLogs({
                    level: query.level || null,
                    source: query.source || null,
                    sessionId: query.sessionId ? Number(query.sessionId) : null,
                    guildId: query.guildId || null,
                    limit: query.limit ? Number(query.limit) : 100
                });
                return sendJson(res, 200, { ok: true, count: logs.length, logs });
            }

            // ----------------------------------------------------------------
            // POST /api/actions/sync-voice-members
            // ----------------------------------------------------------------
            if (pathname === '/api/actions/sync-voice-members' && method === 'POST') {
                const body = await readBody(req);
                const { guildId, voiceChannelId, sessionId } = body;
                const execId = `exec_${Date.now()}`;
                if (!client.isReady()) return sendJson(res, 503, { ok: false, action: 'sync-voice-members', error: 'Bot not ready', executionId: execId });
                if (!guildId || !voiceChannelId) return sendJson(res, 400, { ok: false, action: 'sync-voice-members', error: 'guildId and voiceChannelId required', executionId: execId });
                const result = sessionActionService.syncVoiceMembers({ guildId, voiceChannelId, sessionId });
                return sendJson(res, result.ok ? 200 : 400, { ...result, action: 'sync-voice-members', executionId: execId });
            }

            // ----------------------------------------------------------------
            // GET /api/actions/check-permissions
            // ----------------------------------------------------------------
            if (pathname === '/api/actions/check-permissions' && method === 'GET') {
                if (!client.isReady()) return sendJson(res, 503, { ok: false, error: 'Bot not ready' });
                const checkGuild = query.guildId ? client.guilds.cache.get(query.guildId) : client.guilds.cache.first();
                if (!checkGuild) return sendJson(res, 404, { ok: false, error: 'Guild not found.' });
                const botMember = checkGuild.members.cache.get(client.user.id);
                const perms = botMember?.permissions;
                const checks = [
                    { name: 'View Channels', ok: perms?.has('ViewChannel') ?? false },
                    { name: 'Send Messages', ok: perms?.has('SendMessages') ?? false },
                    { name: 'Connect (Voice)', ok: perms?.has('Connect') ?? false },
                    { name: 'Read Message History', ok: perms?.has('ReadMessageHistory') ?? false },
                    { name: 'Add Reactions', ok: perms?.has('AddReactions') ?? false }
                ];
                return sendJson(res, 200, { ok: checks.every(c => c.ok), action: 'check-permissions', guildId: checkGuild.id, guildName: checkGuild.name, permissions: checks });
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
