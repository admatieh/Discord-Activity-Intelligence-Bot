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
        try { fs.unlinkSync(testDbPath); } catch (e) {}
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
    }
    displayAvatarURL() { return 'http://avatar.url'; }
}

class MockMember {
    constructor(user) {
        this.id = user.id;
        this.user = user;
        this.displayName = user.username;
        this.voice = { channel: null };
        this.roles = { cache: new MockCollection() };
        this.permissions = {
            has: () => true
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

function createMockEnv() {
    const guild = new MockGuild('guild_test', 'Test Guild');
    const textChannel = new MockChannel('text_test', 'general', true);
    const voiceChannel = new MockChannel('voice_test', 'Voice 1', false);
    
    guild.channels.cache.set(textChannel.id, textChannel);
    guild.channels.cache.set(voiceChannel.id, voiceChannel);

    const user = new MockUser('user_test', 'tester');
    const member = new MockMember(user);
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
            assert(env.textChannel.sends.includes('Test message sending'), 'Message not sent to channel');
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
    } else {
        skip('Focused tests', 'Real DB mode (read-only)');
    }

    // Phase 3: Command Executor (Dashboard Context)
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
        try { fs.unlinkSync(testDbPath); } catch (e) {}
    }

    if (stats.critical > 0) process.exit(1);
    process.exit(0);
}

runTests().catch(err => {
    console.error('Fatal test error:', err);
    process.exit(1);
});
