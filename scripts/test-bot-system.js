// scripts/test-bot-system.js

const fs = require('fs');
const path = require('path');

// ============================================================================
// ENVIRONMENT SETUP
// ============================================================================
const args = process.argv.slice(2);
const USE_REAL_DB = args.includes('--real-db-readonly');
const LIVE_DISCORD = process.env.RUN_LIVE_DISCORD_TESTS === 'true';

let testDbPath = path.join(__dirname, '..', 'data.test.db');

if (USE_REAL_DB) {
    console.log('[ENV] Using REAL database in read-only mode (data.db)');
    process.env.DATABASE_PATH = path.join(__dirname, '..', 'data.db');
} else {
    console.log('[ENV] Using isolated test database (data.test.db)');
    process.env.DATABASE_PATH = testDbPath;
    // Ensure clean state if test DB already exists
    if (fs.existsSync(testDbPath)) {
        try { fs.unlinkSync(testDbPath); } catch (e) {}
    }
}

// Set a dummy token to prevent accidental connections
if (!process.env.TOKEN) process.env.TOKEN = 'dummy_token_for_tests';

// ============================================================================
// TEST RUNNER UTILS
// ============================================================================
const stats = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    critical: 0,
    warnings: 0
};

const failures = [];

async function test(name, fn, options = {}) {
    stats.total++;
    try {
        await fn();
        console.log(`[PASS] ${name}`);
        stats.passed++;
    } catch (err) {
        console.log(`[FAIL] ${name}`);
        console.log(`       -> ${err.message}`);
        stats.failed++;
        failures.push({ name, err, options });
        if (options.critical !== false) {
            stats.critical++;
        } else {
            stats.warnings++;
        }
    }
}

function skip(name, reason) {
    stats.total++;
    stats.skipped++;
    console.log(`[SKIP] ${name} (Reason: ${reason})`);
}

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

function assertHasKeys(obj, keys, label) {
    assert(obj !== null && typeof obj === 'object', `${label} is not an object`);
    for (const key of keys) {
        assert(key in obj, `${label} missing key: ${key}`);
    }
}

function assertArray(value, label) {
    assert(Array.isArray(value), `${label} should be an array`);
}

function assertOkResponse(res, label) {
    assert(res && typeof res === 'object', `${label} returned invalid response`);
    assert(res.ok === true || res.success === true, `${label} returned failure: ${res.error || 'unknown'}`);
}

// ============================================================================
// MOCKS
// ============================================================================

class MockChannel {
    constructor(id, name, isText) {
        this.id = id;
        this.name = name;
        this._isText = isText;
        this.members = new Map();
        this.members.filter = () => ({ size: 0 }); // Mock collection filter
    }
    isTextBased() { return this._isText; }
    isVoiceBased() { return !this._isText; }
    async send(content) {
        return { id: `mock_msg_${Date.now()}`, content };
    }
}

class MockGuild {
    constructor(id) {
        this.id = id;
        this.channels = {
            cache: new Map([
                ['text_test', new MockChannel('text_test', 'general', true)],
                ['voice_test', new MockChannel('voice_test', 'Voice 1', false)]
            ])
        };
    }
}

class MockClient {
    constructor() {
        this.guilds = {
            cache: new Map([
                ['guild_test', new MockGuild('guild_test')]
            ])
        };
    }
    isReady() { return true; }
}

const mockClient = new MockClient();

// ============================================================================
// RUNNER
// ============================================================================

async function runTests() {
    console.log('\n==================================================');
    console.log('BOT SYSTEM TESTS STARTED');
    console.log('==================================================\n');

    // --- PHASE 1: Imports ---
    let db, logModel, schedulerService, messageService, sessionActionService, reportService, activityFeedService, apiServer, commandExecutor;

    await test('Import database/db.js', async () => {
        db = require('../database/db');
        assert(db && db.prepare, 'db does not export a valid sqlite connection');
    });

    await test('Import models/logModel.js', async () => {
        logModel = require('../models/logModel');
        assert(typeof logModel.insertLog === 'function', 'Missing insertLog');
        assert(typeof logModel.getLogs === 'function', 'Missing getLogs');
    });

    await test('Import services/schedulerService.js', async () => {
        schedulerService = require('../services/schedulerService');
        assert(typeof schedulerService.scheduleSession === 'function', 'Missing scheduleSession');
        assert(typeof schedulerService.executeDueItems === 'function', 'Missing executeDueItems');
    });

    await test('Import services/messageService.js', async () => {
        messageService = require('../services/messageService');
        assert(typeof messageService.sendMessageNow === 'function', 'Missing sendMessageNow');
        messageService.setClient(mockClient);
    });

    await test('Import services/sessionActionService.js', async () => {
        sessionActionService = require('../services/sessionActionService');
        assert(typeof sessionActionService.startSessionFromAction === 'function', 'Missing startSessionFromAction');
        sessionActionService.setClient(mockClient);
    });

    await test('Import services/reportService.js', async () => {
        reportService = require('../services/reportService');
        assert(typeof reportService.generateSessionReport === 'function', 'Missing generateSessionReport');
    });

    await test('Import services/activityFeedService.js', async () => {
        activityFeedService = require('../services/activityFeedService');
        assert(typeof activityFeedService.getActivityFeed === 'function', 'Missing getActivityFeed');
    });

    await test('Import core/apiServer.js', async () => {
        apiServer = require('../core/apiServer');
        assert(typeof apiServer.startApiServer === 'function', 'Missing startApiServer');
    });

    await test('Import core/commandExecutor.js', async () => {
        commandExecutor = require('../core/commandExecutor');
        assert(typeof commandExecutor.executeCommand === 'function', 'Missing executeCommand');
    });

    // --- PHASE 2: Database Schema ---
    await test('Database tables exist', async () => {
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
        const required = ['sessions', 'logs', 'activity_events', 'scheduled_items', 'message_deliveries', 'session_reports'];
        for (const req of required) {
            assert(tables.includes(req), `Missing table: ${req}`);
        }
    });

    await test('scheduled_items schema has required columns', async () => {
        const cols = db.prepare("PRAGMA table_info(scheduled_items)").all().map(c => c.name);
        const required = ['id', 'type', 'guild_id', 'status', 'scheduled_for', 'payload_json'];
        for (const req of required) {
            assert(cols.includes(req), `Missing column: ${req}`);
        }
    });

    await test('logs schema has enhanced columns', async () => {
        const cols = db.prepare("PRAGMA table_info(logs)").all().map(c => c.name);
        const required = ['source', 'event', 'guild_id', 'session_id', 'metadata_json'];
        for (const req of required) {
            assert(cols.includes(req), `Missing column: ${req}`);
        }
    });

    await test('activity_events schema has enhanced columns', async () => {
        const cols = db.prepare("PRAGMA table_info(activity_events)").all().map(c => c.name);
        const required = ['guild_id', 'human_label', 'severity'];
        for (const req of required) {
            assert(cols.includes(req), `Missing column: ${req}`);
        }
    });

    // --- PHASE 3: Log Model Tests ---
    if (!USE_REAL_DB) {
        await test('Insert and retrieve enhanced log', async () => {
            const success = logModel.insertLog('info', 'Test log from bot system test', null, {
                source: 'test-runner',
                event: 'test.log',
                guildId: 'guild_test',
                sessionId: 123,
                userId: 'user_test',
                command: 'test-command',
                executionId: 'exec_test',
                metadataJson: { hello: 'world' }
            });
            assert(success, 'insertLog returned false');

            const logs = logModel.getLogs({ source: 'test-runner', limit: 1 });
            assert(logs.length > 0, 'Log not retrieved');
            const log = logs[0];
            assert(log.guild_id === 'guild_test', 'guildId mismatch');
            assert(log.session_id === 123, 'sessionId mismatch');
            assert(log.metadata_json.includes('world'), 'metadata missing');
        });
    } else {
        skip('Insert and retrieve enhanced log', 'Real DB mode (read-only)');
    }

    // --- PHASE 4: Scheduler Service Tests ---
    if (!USE_REAL_DB) {
        await test('Schedule session validation and insert', async () => {
            const invalidRes = schedulerService.scheduleSession({
                guildId: 'guild_test',
                voiceChannelId: 'voice_test',
                scheduledFor: new Date(Date.now() - 10000).toISOString() // past
            });
            assert(invalidRes.ok === false, 'Should fail past date');

            const validRes = schedulerService.scheduleSession({
                guildId: 'guild_test',
                voiceChannelId: 'voice_test',
                title: 'Test Session Scheduler',
                scheduledFor: new Date(Date.now() + 60000).toISOString()
            });
            assert(validRes.ok === true, 'Failed to schedule session');
            assert(validRes.id > 0, 'No ID returned');

            const item = db.prepare('SELECT * FROM scheduled_items WHERE id = ?').get(validRes.id);
            assert(item.status === 'scheduled', 'Status not scheduled');
            assert(item.type === 'session', 'Type not session');
        });

        await test('Schedule message validation and insert', async () => {
            const validRes = schedulerService.scheduleMessage({
                guildId: 'guild_test',
                textChannelId: 'text_test',
                content: 'Test msg',
                scheduledFor: new Date(Date.now() + 60000).toISOString()
            });
            assert(validRes.ok === true, 'Failed to schedule message');
            assert(validRes.id > 0, 'No ID returned');

            const item = db.prepare('SELECT * FROM scheduled_items WHERE id = ?').get(validRes.id);
            assert(item.status === 'scheduled', 'Status not scheduled');
        });

        await test('Cancel scheduled item', async () => {
            const res = schedulerService.scheduleMessage({
                guildId: 'guild_test',
                textChannelId: 'text_test',
                content: 'Cancel me',
                scheduledFor: new Date(Date.now() + 100000).toISOString()
            });
            const cancelRes = schedulerService.cancelScheduledItem(res.id);
            assert(cancelRes.ok === true, 'Failed to cancel');
            
            const item = db.prepare('SELECT * FROM scheduled_items WHERE id = ?').get(res.id);
            assert(item.status === 'cancelled', 'Status not updated to cancelled');
        });
    } else {
        skip('Scheduler inserts', 'Real DB mode');
    }

    // --- PHASE 5: Message Service Tests ---
    if (!USE_REAL_DB) {
        await test('sendMessageNow validation', async () => {
            const res1 = await messageService.sendMessageNow({
                guildId: 'guild_test',
                textChannelId: 'text_test',
                content: ''
            });
            assert(res1.ok === false, 'Should fail empty content');

            const res2 = await messageService.sendMessageNow({
                guildId: 'guild_test',
                textChannelId: 'invalid_channel',
                content: 'Hello'
            });
            assert(res2.ok === false, 'Should fail invalid channel');
        });

        await test('sendMessageNow success (mocked)', async () => {
            const res = await messageService.sendMessageNow({
                guildId: 'guild_test',
                textChannelId: 'text_test', // In mockClient
                content: 'Test message sending'
            });
            assert(res.ok === true, 'sendMessageNow failed: ' + res.error);
            assert(res.delivery, 'Missing delivery payload');

            const delivery = db.prepare('SELECT * FROM message_deliveries WHERE id = ?').get(res.delivery.id);
            assert(delivery.status === 'sent', 'Delivery status not sent');
        });
    } else {
        skip('Message sending', 'Real DB mode');
    }

    // --- PHASE 6: Session Action Service Tests ---
    if (!USE_REAL_DB) {
        await test('startSessionFromAction validation', async () => {
            const res = await sessionActionService.startSessionFromAction({
                guildId: 'guild_test',
                voiceChannelId: 'invalid_voice', // Will fail since not in mock or real client
            });
            assert(res.ok === false, 'Should fail invalid voice channel');
        });

        // We can't fully test success startSessionFromAction easily because sessionService 
        // has internal DB queries and event emissions, but we can verify it returns a structured failure gracefully
        await test('startSessionFromAction mock execution', async () => {
            const res = await sessionActionService.startSessionFromAction({
                guildId: 'guild_test',
                voiceChannelId: 'voice_test', // In mock
                textChannelId: 'text_test',
                title: 'Integration Test Session',
                durationMinutes: 30
            });
            // Result might be true or false depending on if sessionService complains about permissions or missing real Discord structures.
            // Just assert it doesn't crash and returns ok boolean
            assert(typeof res.ok === 'boolean', 'Response missing ok boolean');
            if (res.ok) {
                assertHasKeys(res.session, ['id', 'status'], 'Missing session payload');
                
                // cleanup
                await sessionActionService.endSessionFromAction({ sessionId: res.session.id });
            }
        });
    } else {
        skip('Session actions', 'Real DB mode');
    }

    // --- PHASE 7: Report Service Tests ---
    if (!USE_REAL_DB) {
        await test('generateSessionReport gracefully handles empty session', async () => {
            // Manually insert a mock session
            const result = db.prepare(`INSERT INTO sessions (channel_id, triggered_by) VALUES ('123', 'tester')`).run();
            const sid = result.lastInsertRowid;
            
            const rep = await reportService.generateSessionReport(sid);
            assert(rep.ok === true, 'generateSessionReport failed: ' + rep.error);
            assertHasKeys(rep.report, ['sessionId', 'participants', 'attendanceCounts'], 'Invalid report payload');
            assert(rep.report.participants.length === 0, 'Should have 0 participants');
        });
    } else {
        skip('Report generation', 'Real DB mode');
    }

    // --- PHASE 8: Activity Feed Tests ---
    await test('getActivityFeed returns array', async () => {
        const feed = activityFeedService.getActivityFeed({ limit: 5 });
        assertArray(feed, 'Feed');
        if (feed.length > 0) {
            const entry = feed[0];
            assertHasKeys(entry, ['id', 'timestamp', 'type', 'label', 'severity'], 'Feed entry missing fields');
        }
    });

    // --- PHASE 9: Commands Tests ---
    await test('Load and validate commands metadata', async () => {
        const cmds = require('../commands');
        assert(cmds.size > 0, 'No commands loaded');
        
        const requiredCmds = ['schedule-session', 'scheduled', 'cancel-scheduled', 'send-message', 'schedule-message', 'activity'];
        for (const cmdName of requiredCmds) {
            const cmd = cmds.get(cmdName);
            assert(cmd, `Missing command ${cmdName}`);
            assert(cmd.name, `${cmdName} missing name`);
            assert(cmd.description, `${cmdName} missing description`);
            assert(typeof cmd.execute === 'function', `${cmdName} missing execute`);
            assert(cmd.supportsDashboard !== undefined, `${cmdName} missing supportsDashboard`);
        }
    });

    // --- PHASE 10: Response Shape Contract Tests ---
    await test('Response shape contract validations', async () => {
        // Just verify our API standard is intact
        const res = await messageService.sendMessageNow({ guildId: null });
        assert(res.ok === false, 'Should be ok=false');
        assert(res.error, 'Should have error message');
    });

    console.log('\n==================================================');
    console.log('BOT SYSTEM TEST SUMMARY');
    console.log(`Total: ${stats.total}`);
    console.log(`Passed: ${stats.passed}`);
    console.log(`Failed: ${stats.failed}`);
    console.log(`Warnings: ${stats.warnings}`);
    console.log(`Skipped: ${stats.skipped}`);
    console.log(`Critical failures: ${stats.critical}`);
    
    if (failures.length > 0) {
        console.log('\nFailures:');
        failures.forEach(f => {
            console.log(`- ${f.name}: ${f.err.message}`);
        });
    }
    
    // Cleanup
    if (!USE_REAL_DB && fs.existsSync(testDbPath)) {
        try { fs.unlinkSync(testDbPath); } catch (e) {}
    }

    if (stats.critical > 0) {
        process.exit(1);
    } else {
        process.exit(0);
    }
}

runTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
