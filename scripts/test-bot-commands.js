// scripts/test-bot-commands.js

const fs = require('fs');
const path = require('path');

// ============================================================================
// ENVIRONMENT SETUP
// ============================================================================
const args = process.argv.slice(2);
const USE_REAL_DB = args.includes('--real-db-readonly');
const LIVE_DISCORD = process.env.RUN_LIVE_DISCORD_TESTS === 'true';
const CONFIRM_SEND = process.env.CONFIRM_SEND_TEST_MESSAGE === 'true';
const TEST_TEXT_CHANNEL_ID = process.env.TEST_TEXT_CHANNEL_ID;

let testDbPath = path.join(__dirname, '..', 'data.commands.test.db');

if (USE_REAL_DB) {
    console.log('[ENV] Using REAL database in read-only mode (data.db)');
    process.env.DATABASE_PATH = path.join(__dirname, '..', 'data.db');
} else {
    console.log('[ENV] Using isolated test database (data.commands.test.db)');
    process.env.DATABASE_PATH = testDbPath;
    if (fs.existsSync(testDbPath)) {
        try { fs.unlinkSync(testDbPath); } catch (e) { }
    }
}

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
        failures.push({ name, err, options, stack: err.stack });
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

// ============================================================================
// MOCK DISCORD ENVIRONMENT
// ============================================================================
class MockCollection extends Map {
    filter(fn) {
        const result = new MockCollection();
        for (const [key, val] of this) {
            if (fn(val, key, this)) result.set(key, val);
        }
        return result;
    }
    map(fn) {
        const result = [];
        for (const [key, val] of this) {
            result.push(fn(val, key, this));
        }
        return result;
    }
    find(fn) {
        for (const [key, val] of this) {
            if (fn(val, key, this)) return val;
        }
        return undefined;
    }
    first() {
        return this.values().next().value;
    }
    some(fn) {
        for (const [key, val] of this) {
            if (fn(val, key, this)) return true;
        }
        return false;
    }
    toJSON() {
        return [...this.values()];
    }
}

class MockUser {
    constructor(id, username, bot = false) {
        this.id = id;
        this.username = username;
        this.tag = `${username}#1234`;
        this.bot = bot;
        this.sends = [];
        this.failDMs = false;
    }
    displayAvatarURL() { return 'http://avatar.url'; }
    async send(payload) {
        if (this.failDMs) throw new Error('DM disabled');
        this.sends.push(payload);
        return payload;
    }
}

class MockMember {
    constructor(user, roleType = 'admin') {
        this.id = user.id;
        this.user = user;
        this.displayName = user.username;
        this.voice = { channel: null };
        this.roles = { cache: new MockCollection() };
        this._roleType = roleType;

        // Setup permissions based on roleType
        if (roleType === 'instructor') {
            // Mock instructor role name
            this.roles.cache.set('inst_1', { name: 'Instructor' });
        }

        this.permissions = {
            has: (perm) => {
                if (perm === 'Administrator') return this._roleType === 'admin';
                return true;
            }
        };
    }
}

class MockChannel {
    constructor(id, name, isText) {
        this.id = id;
        this.name = name;
        this._isText = isText;
        this.members = new MockCollection();
        this.messages = { cache: new MockCollection() };
        this.sends = [];
    }
    isTextBased() { return this._isText; }
    isVoiceBased() { return !this._isText; }
    permissionsFor() { return { has: () => true }; }
    async send(content) {
        this.sends.push(content);
        return { id: `mock_msg_${Date.now()}`, content };
    }
}

class MockGuild {
    constructor(id, name) {
        this.id = id;
        this.name = name;
        this.channels = { cache: new MockCollection() };
        this.members = { cache: new MockCollection() };
    }
}

class MockMessage {
    constructor(content, guild, channel, authorMember) {
        this.content = content;
        this.guild = guild;
        this.channel = channel;
        this.member = authorMember;
        this.author = authorMember ? authorMember.user : null;
        this.replies = [];
        this.reactions = { cache: new MockCollection() };
        this.createdTimestamp = Date.now();
        this.mentions = {
            users: new MockCollection(),
            channels: new MockCollection(),
            roles: new MockCollection()
        };
    }
    async reply(payload) {
        this.replies.push(payload);
        return payload;
    }
    async react(emoji) {
        return true;
    }
}

function createMockEnv(roleType = 'admin') {
    const guild = new MockGuild('guild_test', 'Test Guild');
    const textChannel = new MockChannel('text_test', 'general', true);
    const voiceChannel = new MockChannel('voice_test', 'Voice 1', false);

    guild.channels.cache.set(textChannel.id, textChannel);
    guild.channels.cache.set(voiceChannel.id, voiceChannel);

    const user = new MockUser('user_test', 'tester');
    const member = new MockMember(user, roleType);
    member.voice.channel = voiceChannel;
    guild.members.cache.set(member.id, member);

    // Add mock members to voice channel
    voiceChannel.members.set(member.id, member);

    const client = {
        guilds: {
            cache: new MockCollection([[guild.id, guild]])
        },
        isReady: () => true
    };

    return { guild, textChannel, voiceChannel, member, user, client };
}

// Normalize command execution to capture replies, returns, and throws safely
async function safeExecute(command, message, argsObj, parsedContext) {
    const result = {
        threw: false,
        error: null,
        returned: undefined,
        replies: message.replies,
        sends: message.channel ? message.channel.sends : [],
        dms: message.author?.sends || [],
        okLike: false
    };
    try {
        const val = await Promise.resolve(command.execute(message, argsObj, parsedContext));
        result.returned = val;

        // Detect basic ok/success pattern
        if (val && typeof val === 'object') {
            result.okLike = val.ok === true || val.success === true;
        } else if (typeof val === 'string' || message.replies.length > 0) {
            result.okLike = true;
        }
    } catch (err) {
        result.threw = true;
        result.error = err;
    }
    return result;
}

// ============================================================================
// MAIN RUNNER
// ============================================================================
async function runTests() {
    console.log('\n==================================================');
    console.log('COMMAND TESTS STARTED');
    console.log('==================================================\n');

    const db = require('../database/db');
    const commands = require('../commands');
    const commandExecutor = require('../core/commandExecutor');
    const messageService = require('../services/messageService');
    const sessionActionService = require('../services/sessionActionService');

    const baseEnv = createMockEnv();
    messageService.setClient(baseEnv.client);
    sessionActionService.setClient(baseEnv.client);

    const commandList = Array.from(commands.values());
    console.log(`Discovered ${commandList.length} commands.\n`);

    const categories = new Set(commandList.map(c => c.category).filter(Boolean));

    // Phase 1: General execution testing per command
    for (const command of commandList) {
        const cmdName = command.name;

        // A. Metadata
        await test(`[${cmdName}] Metadata validation`, async () => {
            assert(command.name, 'Missing name');
            assert(command.description, 'Missing description');
            assert(typeof command.execute === 'function', 'Missing execute function');
            if (command.supportsDashboard !== undefined) {
                assert(typeof command.supportsDashboard === 'boolean', 'supportsDashboard must be boolean');
            }
        });

        // Setup mock environment for this command iteration
        const env = createMockEnv();

        // B. Missing Guild Context
        if (command.requiresGuild) {
            await test(`[${cmdName}] Missing guild context fails gracefully`, async () => {
                const msg = new MockMessage(`!${cmdName}`, null, env.textChannel, env.member);
                const res = await safeExecute(command, msg, {}, { parsed: { options: {} }, commands });
                assert(!res.threw, 'Threw error instead of failing gracefully: ' + (res.error && res.error.message));
            }, { critical: false });
        }

        // C. Empty Args / Basic Mock Execution
        await test(`[${cmdName}] Execute with empty args / mock context`, async () => {
            const msg = new MockMessage(`!${cmdName}`, env.guild, env.textChannel, env.member);
            const res = await safeExecute(command, msg, {}, { parsed: { options: {} }, commands });
            assert(!res.threw, `Crashed with error: ${res.error ? res.error.message : 'unknown'}`);
        }, { critical: false });
    }

    // Phase 2: Focused tests on critical commands
    console.log('\n--- FOCUSED COMMAND TESTS ---');

    if (!USE_REAL_DB) {
        // schedule-session
        await test('[schedule-session] valid future schedule', async () => {
            const env = createMockEnv();
            const cmd = commands.get('schedule-session');
            const msg = new MockMessage('!schedule-session', env.guild, env.textChannel, env.member);
            const args = {
                channel: env.voiceChannel.id,
                at: new Date(Date.now() + 60000).toISOString(),
                duration: 45,
                title: 'Focused Test Session'
            };
            const res = await safeExecute(cmd, msg, args, { parsed: { options: args }, commands });
            assert(!res.threw, 'Command crashed: ' + (res.error && res.error.stack));

            // Should have returned string or replied
            assert(res.okLike || res.returned || res.replies.length > 0, 'No positive response');
        });

        await test('[schedule-session] relative time (in 30m)', async () => {
            const env = createMockEnv();
            const cmd = commands.get('schedule-session');
            const msg = new MockMessage('!schedule-session', env.guild, env.textChannel, env.member);
            const args = { channel: env.voiceChannel.id, in: '30m', duration: 45, title: 'In 30m Test' };
            const res = await safeExecute(cmd, msg, args, { parsed: { options: args }, commands });
            assert(!res.threw, 'Command crashed: ' + (res.error && res.error.stack));
            assert(res.returned && res.returned.includes('✅'), 'Did not return success for in 30m');
        });

        await test('[schedule-session] tomorrow absolute time', async () => {
            const env = createMockEnv();
            const cmd = commands.get('schedule-session');
            const msg = new MockMessage('!schedule-session', env.guild, env.textChannel, env.member);
            const args = { channel: env.voiceChannel.id, at: 'tomorrow 2:30 PM', duration: 45 };
            const res = await safeExecute(cmd, msg, args, { parsed: { options: args }, commands });
            assert(!res.threw, 'Command crashed: ' + (res.error && res.error.stack));
            assert(res.returned && res.returned.includes('✅'), 'Did not return success for tomorrow 2:30 PM');
        });

        await test('[schedule-session] past time gracefully fails', async () => {
            const env = createMockEnv();
            const cmd = commands.get('schedule-session');
            const msg = new MockMessage('!schedule-session', env.guild, env.textChannel, env.member);
            const args = { channel: env.voiceChannel.id, at: 'yesterday 2:30 PM' };
            const res = await safeExecute(cmd, msg, args, { parsed: { options: args }, commands });
            assert(!res.threw, 'Command crashed: ' + (res.error && res.error.stack));
            assert(res.returned && res.returned.includes('❌'), 'Did not fail for past time');
            assert(res.returned.includes('past'), 'Did not specify past time error');
        });

        await test('[schedule-session] invalid time gracefully fails', async () => {
            const env = createMockEnv();
            const cmd = commands.get('schedule-session');
            const msg = new MockMessage('!schedule-session', env.guild, env.textChannel, env.member);
            const args = { channel: env.voiceChannel.id, at: 'fjsldkfjdslk' };
            const res = await safeExecute(cmd, msg, args, { parsed: { options: args }, commands });
            assert(!res.threw, 'Command crashed: ' + (res.error && res.error.stack));
            assert(res.returned && res.returned.includes('❌'), 'Did not fail for invalid time');
            assert(res.returned.includes('understand'), 'Did not specify understand time error');
        });

        // send-message
        await test('[send-message] valid mock send', async () => {
            const env = createMockEnv();
            messageService.setClient(env.client);
            const cmd = commands.get('send-message');
            const msg = new MockMessage('!send-message', env.guild, env.textChannel, env.member);
            const args = {
                channel: env.textChannel.id,
                content: 'Test message sending'
            };
            const res = await safeExecute(cmd, msg, args, { parsed: { options: args }, commands });
            assert(!res.threw, 'Command crashed: ' + (res.error && res.error.stack));
            assert(res.returned && res.returned.includes('✅'), 'No positive response: ' + res.returned);
        });

        await test('[send-message] raw channel mention', async () => {
            const env = createMockEnv();
            messageService.setClient(env.client);
            const cmd = commands.get('send-message');
            const msg = new MockMessage('!send-message', env.guild, env.textChannel, env.member);
            const args = { channel: `<#${env.textChannel.id}>`, content: 'Hello' };
            const res = await safeExecute(cmd, msg, args, { parsed: { options: args }, commands });
            assert(res.returned && res.returned.includes('✅'), 'Did not resolve <#id> mention');
        });

        await test('[voice-user] raw user mention', async () => {
            const env = createMockEnv();
            const cmd = commands.get('voice-user');
            const msg = new MockMessage('!voice-user', env.guild, env.textChannel, env.member);
            const args = { user: `<@${env.member.user.id}>` };
            const res = await safeExecute(cmd, msg, args, { parsed: { options: args }, commands });
            assert(!res.threw, 'Command crashed');
            assert(!res.returned || !res.returned.includes('⚠️ Could not resolve user'), 'Failed to parse mention');
        });

        await test('[voice-user] raw user ID', async () => {
            const env = createMockEnv();
            const cmd = commands.get('voice-user');
            const msg = new MockMessage('!voice-user', env.guild, env.textChannel, env.member);
            const args = { user: env.member.user.id };
            const res = await safeExecute(cmd, msg, args, { parsed: { options: args }, commands });
            assert(!res.threw, 'Command crashed');
            assert(!res.returned || !res.returned.includes('⚠️ Could not resolve user'), 'Failed to parse raw ID');
        });

        await test('[participation-top] invalid limit falls back', async () => {
            const env = createMockEnv();

            // Insert dummy session & record to pass the 'No participation data' early return
            const db = require('./../database/db');
            db.prepare("INSERT OR IGNORE INTO sessions (id, guild_id, voice_channel_id, status) VALUES (1, ?, ?, 'COMPLETED')").run(env.guild.id, env.voiceChannel.id);
            const psm = require('./../models/participationSummaryModel');
            psm.insertMany([{ session_id: 1, user_id: 'test', score: 100, speaking_score: 50, interaction_score: 30, attendance_score: 20, label: 'HIGHLY_ACTIVE' }]);

            const cmd = commands.get('participation-top');
            const msg = new MockMessage('!participation-top', env.guild, env.textChannel, env.member);
            const args = { limit: 'invalid' };
            const res = await safeExecute(cmd, msg, args, { parsed: { options: args }, commands });
            assert(!res.threw, 'Command crashed');
            assert(res.returned && res.returned.includes('Top 15'), 'Did not fallback to default limit: ' + res.returned); // DEFAULT is 15 based on config
        });

        await test('[participation-top] over-max limit gets capped', async () => {
            const env = createMockEnv();
            const cmd = commands.get('participation-top');
            const msg = new MockMessage('!participation-top', env.guild, env.textChannel, env.member);
            const args = { limit: '999999' };
            const res = await safeExecute(cmd, msg, args, { parsed: { options: args }, commands });
            assert(!res.threw, 'Command crashed');
            assert(res.returned && res.returned.includes('Top 100'), 'Did not cap at max limit: ' + res.returned); // MAX is 100 based on config
        });

        // ==========================================
        // NEW COMMAND TESTS (General / System)
        // ==========================================

        await test('[whoami] valid mock execution', async () => {
            const env = createMockEnv();
            const cmd = commands.get('whoami');
            const msg = new MockMessage('!whoami', env.guild, env.textChannel, env.member);
            const res = await safeExecute(cmd, msg, {}, { parsed: {}, commands });
            assert(!res.threw, 'Command crashed');
            assert(res.returned && res.returned.includes('You are'), 'Missing expected response output: ' + res.returned);
        });

        await test('[my-attendance] valid mock execution', async () => {
            const env = createMockEnv();
            const cmd = commands.get('my-attendance');
            const msg = new MockMessage('!my-attendance', env.guild, env.textChannel, env.member);
            const res = await safeExecute(cmd, msg, {}, { parsed: {}, commands });
            assert(!res.threw, 'Command crashed');
            assert(res.returned && (res.returned.includes('Your Attendance') || res.returned.includes('don\'t have any')), 'Missing expected response');
        });

        await test('[my-participation] valid mock execution', async () => {
            const env = createMockEnv();
            const cmd = commands.get('my-participation');
            const msg = new MockMessage('!my-participation', env.guild, env.textChannel, env.member);
            const res = await safeExecute(cmd, msg, {}, { parsed: {}, commands });
            assert(!res.threw, 'Command crashed');
            assert(res.returned && (res.returned.includes('Your Participation') || res.returned.includes('don\'t have any')), 'Missing expected response');
        });

        await test('[add-instructor] missing user handled', async () => {
            const env = createMockEnv();
            const cmd = commands.get('add-instructor');
            const msg = new MockMessage('!add-instructor', env.guild, env.textChannel, env.member);
            const res = await safeExecute(cmd, msg, {}, { parsed: {}, commands });
            assert(!res.threw, 'Command crashed');
            // Mock member has "Administrator" so it passes perm check but fails on missing user args
            assert(res.returned && res.returned.includes('Please mention a user'), 'Missing user not handled properly: ' + res.returned);
        });

        await test('[remove-instructor] missing user handled', async () => {
            const env = createMockEnv();
            const cmd = commands.get('remove-instructor');
            const msg = new MockMessage('!remove-instructor', env.guild, env.textChannel, env.member);
            const res = await safeExecute(cmd, msg, {}, { parsed: {}, commands });
            assert(!res.threw, 'Command crashed');
            assert(res.returned && res.returned.includes('Please mention a user'), 'Missing user not handled properly: ' + res.returned);
        });

        // session-start
        await test('[session-start] valid start', async () => {
            const env = createMockEnv();
            const cmd = commands.get('session-start');
            const msg = new MockMessage('!session-start', env.guild, env.textChannel, env.member);
            const args = {
                channel: env.voiceChannel,
                duration: 10
            };
            const res = await safeExecute(cmd, msg, args, { parsed: { options: args }, commands });
            assert(!res.threw, 'Command crashed: ' + (res.error && res.error.stack));
            assert(res.replies.length > 0 || res.returned, 'Command did not reply or return');
        });

        // session-end
        await test('[session-end] graceful no-session handling', async () => {
            const env = createMockEnv();
            const cmd = commands.get('session-end');
            const msg = new MockMessage('!session-end', env.guild, env.textChannel, env.member);
            const args = {};
            const res = await safeExecute(cmd, msg, args, { parsed: { options: args }, commands });
            assert(!res.threw, 'Command crashed: ' + (res.error && res.error.stack));
            // Ensure no crash on ending nonexistent session
        });

        // ==========================================
        // PERMISSION AUDIT TESTS
        // ==========================================
        console.log('\n--- PERMISSION AUDIT TESTS ---');

        const PUBLIC_WHITELIST = ['help', 'whoami', 'my-attendance', 'my-participation', 'checkin', 'checkout'];

        // Test 1 & 2: requiredPermission validation
        await test('[permissions] validate requiredPermission metadata', async () => {
            for (const cmd of commandList) {
                assert(cmd.requiredPermission, `Command ${cmd.name} missing requiredPermission metadata`);
                assert(['public', 'instructor', 'admin'].includes(cmd.requiredPermission), `Command ${cmd.name} has invalid requiredPermission: ${cmd.requiredPermission}`);

                if (cmd.requiredPermission === 'public') {
                    assert(PUBLIC_WHITELIST.includes(cmd.name), `Command ${cmd.name} is public but not in the whitelist!`);
                } else {
                    assert(!PUBLIC_WHITELIST.includes(cmd.name), `Command ${cmd.name} is in public whitelist but marked as ${cmd.requiredPermission}!`);
                }
            }
        });

        // Test 3: student denied for non-public commands
        await test('[permissions] student denied on non-public commands', async () => {
            const env = createMockEnv('student');
            for (const cmd of commandList) {
                if (cmd.requiredPermission !== 'public') {
                    const msg = new MockMessage(`!${cmd.name}`, env.guild, env.textChannel, env.member);
                    const res = await safeExecute(cmd, msg, {}, { parsed: { options: {} }, commands });
                    assert(!res.threw, `Command ${cmd.name} crashed for student`);

                    const reply = res.replies[0] || '';
                    assert(reply.includes('❌ You need') || reply.includes('❌ You must be'),
                        `Command ${cmd.name} failed to block student. Reply was: ${reply}`);
                }
            }
        });

        // Test 4 & 5: vulnerable commands and aliases
        await test('[permissions] check known vulnerable commands and aliases', async () => {
            const env = createMockEnv('student');
            const vulnerableNames = ['report', 'session-report', 'generate-report', 'session-info', 'session-summary'];

            for (const name of vulnerableNames) {
                const cmd = commands.get(name);
                assert(cmd, `Command/alias ${name} not found`);

                const msg = new MockMessage(`!${name}`, env.guild, env.textChannel, env.member);
                const res = await safeExecute(cmd, msg, {}, { parsed: { options: {} }, commands });

                const reply = res.replies[0] || '';
                assert(reply.includes('❌ You need'), `Alias/Command ${name} allowed student access! Reply: ${reply}`);
            }
        });

        // Test 6: instructor mock user allowed
        await test('[permissions] instructor mock user allowed for instructor commands', async () => {
            const env = createMockEnv('instructor');
            for (const cmd of commandList) {
                if (cmd.requiredPermission === 'instructor') {
                    const msg = new MockMessage(`!${cmd.name}`, env.guild, env.textChannel, env.member);
                    const res = await safeExecute(cmd, msg, {}, { parsed: { options: {} }, commands });
                    // It can fail later, but it shouldn't fail with the permission message
                    const reply = res.replies[0] || '';
                    assert(!reply.includes('❌ You need the **Instructor** role'), `Instructor blocked from ${cmd.name}`);
                }
            }
        });

        // Test 7: admin-only commands
        await test('[permissions] admin-only commands enforced', async () => {
            for (const cmd of commandList) {
                if (cmd.requiredPermission === 'admin') {
                    // Student
                    const studentEnv = createMockEnv('student');
                    const studentMsg = new MockMessage(`!${cmd.name}`, studentEnv.guild, studentEnv.textChannel, studentEnv.member);
                    const studentRes = await safeExecute(cmd, studentMsg, {}, { parsed: { options: {} }, commands });
                    assert((studentRes.replies[0] || '').includes('❌ You must be'), `Student bypassed admin check on ${cmd.name}`);

                    // Instructor
                    const instEnv = createMockEnv('instructor');
                    const instMsg = new MockMessage(`!${cmd.name}`, instEnv.guild, instEnv.textChannel, instEnv.member);
                    const instRes = await safeExecute(cmd, instMsg, {}, { parsed: { options: {} }, commands });
                    assert((instRes.replies[0] || '').includes('❌ You must be'), `Instructor bypassed admin check on ${cmd.name}`);

                    // Admin
                    const adminEnv = createMockEnv('admin');
                    const adminMsg = new MockMessage(`!${cmd.name}`, adminEnv.guild, adminEnv.textChannel, adminEnv.member);
                    const adminRes = await safeExecute(cmd, adminMsg, {}, { parsed: { options: {} }, commands });
                    assert(!(adminRes.replies[0] || '').includes('❌ You must be'), `Admin blocked on ${cmd.name}`);
                }
            }
        });

        await test('[permissions] student can run checkin and checkout', async () => {
            const env = createMockEnv('student');
            for (const name of ['checkin', 'checkout']) {
                const cmd = commands.get(name);
                assert(cmd, `Missing ${name} command`);
                const msg = new MockMessage(`!${name}`, env.guild, env.textChannel, env.member);
                const res = await safeExecute(cmd, msg, {}, { parsed: { options: {} }, commands });
                assert(!res.threw, `${name} crashed for student`);
                const reply = String(res.replies[0] || '');
                assert(!reply.includes('❌ You need') && !reply.includes('❌ You must be'),
                    `${name} should be public but was denied: ${reply}`);
            }
        });

        await test('[permissions] student denied on instructor attendance commands', async () => {
            const env = createMockEnv('student');
            const deniedCommands = ['attendance-today', 'attendance-week', 'attendance-missing'];
            for (const name of deniedCommands) {
                const cmd = commands.get(name);
                assert(cmd, `Missing ${name} command`);
                const msg = new MockMessage(`!${name}`, env.guild, env.textChannel, env.member);
                const res = await safeExecute(cmd, msg, {}, { parsed: { options: {} }, commands });
                assert(!res.threw, `${name} crashed for student`);
                const reply = String(res.replies[0] || '');
                assert(reply.includes('❌ You need') || reply.includes('❌ You must be'),
                    `${name} failed to block student: ${reply}`);
            }
        });

        // Test 8: help visibility
        await test('[permissions] help visibility correctly filtered', async () => {
            const helpCmd = commands.get('help');

            // Student
            const studentEnv = createMockEnv('student');
            const studentMsg = new MockMessage('!help', studentEnv.guild, studentEnv.textChannel, studentEnv.member);
            const studentRes = await safeExecute(helpCmd, studentMsg, {}, { parsed: { options: {} }, commands });
            const studentOutput = [...studentRes.replies, ...studentRes.sends].join('\n');
            assert(!studentOutput.includes('session-start'), 'Student can see instructor commands in help');
            assert(!studentOutput.includes('add-instructor'), 'Student can see admin commands in help');
            assert(studentOutput.includes('my-attendance'), 'Student cannot see public commands');

            // Instructor
            const instEnv = createMockEnv('instructor');
            const instMsg = new MockMessage('!help', instEnv.guild, instEnv.textChannel, instEnv.member);
            const instRes = await safeExecute(helpCmd, instMsg, {}, { parsed: { options: {} }, commands });
            const instOutput = [...instRes.replies, ...instRes.sends].join('\n');
            assert(instOutput.includes('session-start'), 'Instructor cannot see instructor commands in help');
            assert(!instOutput.includes('add-instructor'), 'Instructor can see admin commands in help');
        });

    } else {
        skip('Focused tests', 'Real DB mode (read-only)');
    }

    // Phase 3: Command Executor (Dashboard Context)
    // ==========================================
    // RESPONSE HELPER TESTS
    // ==========================================
    console.log('\n--- RESPONSE HELPER TESTS ---');

    await test('[response] public mode replies publicly', async () => {
        const env = createMockEnv('instructor');
        const cmd = commands.get('report');
        const msg = new MockMessage('!report', env.guild, env.textChannel, env.member);
        const res = await safeExecute(cmd, msg, { latest: true }, { parsed: { options: { latest: true } }, commands });
        assert(res.replies.length > 0, 'Did not reply publicly');
        assert(res.dms.length === 0, 'Should not DM');
    });

    await test('[response] private mode DMs author and sends public confirmation', async () => {
        const env = createMockEnv('instructor');
        const cmd = commands.get('report');
        const msg = new MockMessage('!report', env.guild, env.textChannel, env.member);
        const res = await safeExecute(cmd, msg, { latest: true, private: true }, { parsed: { options: { latest: true, private: true } }, commands });
        assert(res.dms.length > 0, 'Did not DM author');
        assert(res.replies.some(r => typeof r === 'string' && r.includes('Sent privately')), 'Did not send public confirmation');
    }, { critical: false });

    await test('[response] private mode handles DM failure', async () => {
        const env = createMockEnv('instructor');
        env.user.failDMs = true;
        const cmd = commands.get('report');
        const msg = new MockMessage('!report', env.guild, env.textChannel, env.member);
        const res = await safeExecute(cmd, msg, { latest: true, private: true }, { parsed: { options: { latest: true, private: true } }, commands });
        assert(res.dms.length === 0, 'Should not have DMd');
        assert(res.replies.some(r => typeof r === 'string' && r.includes('Failed to send DM')), 'Did not handle DM failure gracefully');
    }, { critical: false });

    await test('[response] quiet mode sends short confirmation on success', async () => {
        const env = createMockEnv('instructor');
        const cmd = commands.get('schedule-session');
        const msg = new MockMessage('!schedule-session', env.guild, env.textChannel, env.member);
        const args = { channel: env.voiceChannel.id, at: new Date(Date.now() + 60000).toISOString(), duration: 45, quiet: true };
        const res = await safeExecute(cmd, msg, args, { parsed: { options: args }, commands });
        const quietOut = [...res.replies, res.returned].filter(Boolean).join('\n');
        assert(quietOut.includes('✅'), 'Did not send success-like quiet response');
    });

    await test('[response] quiet mode sends short failure on failure', async () => {
        const env = createMockEnv('instructor');
        const cmd = commands.get('report');
        const msg = new MockMessage('!report', env.guild, env.textChannel, env.member);
        const args = { id: 999999, quiet: true }; // Invalid ID
        const res = await safeExecute(cmd, msg, args, { parsed: { options: args }, commands });
        const quietOut = [...res.replies, res.returned].filter(Boolean).join('\n');
        assert(quietOut.includes('Session #999999 not found'), 'Did not send failure message in quiet mode');
    }, { critical: false });

    await test('[response] silent mode sends no public reply', async () => {
        const env = createMockEnv('instructor');
        const cmd = commands.get('schedule-session');
        const msg = new MockMessage('!schedule-session', env.guild, env.textChannel, env.member);
        const args = { channel: env.voiceChannel.id, at: new Date(Date.now() + 60000).toISOString(), duration: 45, silent: true };
        const res = await safeExecute(cmd, msg, args, { parsed: { options: args }, commands });
        assert(res.replies.length === 0, 'Sent public reply in silent mode');
    });

    await test('[response] activity --private test', async () => {
        const env = createMockEnv('instructor');
        const cmd = commands.get('activity');
        const msg = new MockMessage('!activity', env.guild, env.textChannel, env.member);
        const args = { private: true };
        const res = await safeExecute(cmd, msg, args, { parsed: { options: args }, commands });
        assert(res.dms.length > 0, 'Did not DM activity');
        assert(res.replies.some(r => typeof r === 'string' && r.includes('Sent privately')), 'Did not confirm');
    }, { critical: false });

    await test('[response] send-message --quiet test', async () => {
        const env = createMockEnv('instructor');
        messageService.setClient(env.client); // Needed for send-message
        const cmd = commands.get('send-message');
        const msg = new MockMessage('!send-message', env.guild, env.textChannel, env.member);
        const args = { channel: env.textChannel.id, content: 'Test quiet', quiet: true };
        const res = await safeExecute(cmd, msg, args, { parsed: { options: args }, commands });
        const quietOut = [...res.replies, res.returned].filter(Boolean).join('\n');
        assert(quietOut.includes('✅'), 'Did not send quiet success message');
        assert(res.sends.length > 0, 'Did not actually send the message to the channel');
    });

    console.log('\n--- COMMAND EXECUTOR TESTS ---');
    if (!USE_REAL_DB) {
        await test('[commandExecutor] Execute health-check', async () => {
            const context = { source: 'dashboard', user: { id: 'test', username: 'tester' }, guild: createMockEnv().guild };
            const res = await commandExecutor.executeCommand('!health-check', context);
            assert(res.exitCode === 0, 'Command failed: ' + res.output);
            assert(res.output.length > 0, 'No output');
        });

        await test('[commandExecutor] Execute schedule-message', async () => {
            const env = createMockEnv();
            const context = { source: 'dashboard', user: { id: 'test', username: 'tester' }, guild: env.guild };
            const res = await commandExecutor.executeCommand(`!schedule-message --channel <#${env.textChannel.id}> --content "Hello" --at "${new Date(Date.now() + 100000).toISOString()}"`, context);
            assert(res.exitCode === 0, 'Command failed: ' + res.output);
            assert(!res.output.includes('Error'), 'Output indicates error: ' + res.output);
        });
    } else {
        skip('Command Executor tests', 'Real DB mode');
    }

    console.log('\n==================================================');
    console.log('COMMAND TEST SUMMARY');
    console.log(`Total Commands Discovered: ${commandList.length}`);
    console.log(`Categories: ${Array.from(categories).join(', ')}`);
    console.log(`\nTest Cases Evaluated: ${stats.total}`);
    console.log(`Passed: ${stats.passed}`);
    console.log(`Failed: ${stats.failed}`);
    console.log(`Warnings: ${stats.warnings}`);
    console.log(`Skipped: ${stats.skipped}`);
    console.log(`Critical failures: ${stats.critical}`);

    if (failures.length > 0) {
        console.log('\nFailures Details:');
        failures.forEach(f => {
            console.log(`\n[FAIL] ${f.name}`);
            console.log(`Reason: ${f.err.message}`);
            if (f.stack) console.log(f.stack.split('\n').slice(0, 3).join('\n'));
        });
    }

    // Cleanup
    if (!USE_REAL_DB && fs.existsSync(testDbPath)) {
        try { fs.unlinkSync(testDbPath); } catch (e) { }
    }

    if (stats.critical > 0) process.exit(1);
    process.exit(0);
}

runTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
