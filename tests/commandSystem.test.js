// tests/commandSystem.test.js
//
// SYSTEM VALIDATOR
// End-to-end automated test that executes all registered commands
// to catch crashes, bad parsing, and missing metadata.
// ---------------------------------------------------------------------------

const commands = require('../commands/index');
const { parseArgs } = require('../utils/argParser');

const REPORT = {
    total: 0,
    passed: 0,
    failed: 0,
    failures: []
};

/**
 * Creates a fresh mock Discord message object
 */
function createMockMessage(content) {
    const outputs = [];
    
    // Mock channel
    const channel = {
        id: 'test_channel_123',
        name: 'test-channel',
        isVoiceBased: () => true
    };

    const roleCache = new Map([['test_role', { name: 'Instructor' }]]);
    roleCache.some = (fn) => Array.from(roleCache.values()).some(fn);

    // Mock member
    const member = {
        id: 'test_member_123',
        voice: { channel },
        permissions: { has: () => true }, // Mock instructor permissions check
        roles: { cache: roleCache } // For checkInstructor
    };

    // Mock guild
    const guild = {
        id: 'test_guild_123',
        channels: { cache: new Map([[channel.id, channel]]) },
        members: { cache: new Map([[member.id, member]]) },
        roles: { cache: new Map() }
    };

    const message = {
        content,
        author: { id: 'test_user_123', tag: 'TestUser#1234', bot: false },
        member,
        guild,
        channel,
        reply: (msg) => {
            outputs.push(msg);
            return Promise.resolve(msg); // Some commands might await reply
        }
    };

    return { message, outputs };
}

/**
 * Wrapper to run a command and capture errors/outputs safely
 */
async function runCommandTest(commandName, contentStr) {
    const { message, outputs } = createMockMessage(contentStr);
    const parsed = parseArgs(message);
    const cmd = commands.get(commandName);
    
    let error = null;
    let timedOut = false;

    if (!cmd) {
        return { success: false, error: 'Command not found in index.', outputs };
    }

    try {
        // Run with a 3-second timeout protection
        const execPromise = Promise.resolve(cmd.execute(message, [], { commands, parsed }));
        
        const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => { timedOut = true; reject(new Error('Command execution timed out (>3000ms)')); }, 3000)
        );

        await Promise.race([execPromise, timeoutPromise]);
        
    } catch (err) {
        error = err;
    }

    const hasOutput = outputs.length > 0;
    const isValidOutput = hasOutput && outputs.every(o => 
        (typeof o === 'string' && o.trim() !== '') || 
        (typeof o === 'object' && o !== null)
    );

    let success = true;
    let failureReason = '';

    if (error) {
        success = false;
        failureReason = `CRASH: ${error.message}`;
    } else if (!hasOutput) {
        success = false;
        failureReason = `NO OUTPUT`;
    } else if (!isValidOutput) {
        success = false;
        failureReason = `INVALID OUTPUT FORMAT (undefined, null, or empty string)`;
    }

    return { success, reason: failureReason, outputs };
}

// ---------------------------------------------------------------------------
// TEST RUNNER
// ---------------------------------------------------------------------------

async function runAllTests() {
    console.log('\n====================================================');
    console.log('🧪 COMMAND SYSTEM VALIDATOR');
    console.log('====================================================\n');

    // Filter unique primary commands
    const uniqueCommands = new Set();
    for (const [key, cmd] of commands.entries()) {
        if (key === cmd.name.toLowerCase()) uniqueCommands.add(cmd);
    }

    REPORT.total = uniqueCommands.size;

    for (const cmd of uniqueCommands) {
        const name = cmd.name;
        let commandPassed = true;
        const failures = [];

        // 1. Metadata check
        if (!cmd.category) failures.push('Missing category metadata');
        if (!cmd.description) failures.push('Missing description metadata');
        if (!Array.isArray(cmd.options)) failures.push('Missing or invalid options array');

        // 2. Basic execution: !command
        let res = await runCommandTest(name, `!${name}`);
        if (!res.success) failures.push(`Basic Exec: ${res.reason}`);

        // 3. Execution with standard options: !command --id 9999 --channel test_channel
        res = await runCommandTest(name, `!${name} --id 9999 --channel test_channel --latest`);
        if (!res.success) failures.push(`With Options: ${res.reason}`);

        // 4. Execution with invalid/junk input
        res = await runCommandTest(name, `!${name} --id invalid_string --unknown junk_flag`);
        if (!res.success) failures.push(`Invalid Input: ${res.reason}`);

        if (failures.length === 0) {
            console.log(`✔ ${name} → PASS`);
            REPORT.passed++;
        } else {
            console.log(`❌ ${name} → FAIL`);
            for (const f of failures) {
                console.log(`   └─ ${f}`);
            }
            REPORT.failed++;
            REPORT.failures.push({ name, failures });
        }
    }

    // -----------------------------------------------------------------------
    // SPECIAL HELP COMMAND TESTS
    // -----------------------------------------------------------------------
    console.log('\n====================================================');
    console.log('📖 HELP EXPLORER TESTS');
    console.log('====================================================\n');

    const helpTests = [
        { name: 'Root Help', input: '!help' },
        { name: 'Category Filter (session)', input: '!help --category session' },
        { name: 'Category Filter (invalid)', input: '!help --category unknown_cat_123' },
        { name: 'Command Detail (participation)', input: '!help --command participation' },
        { name: 'Command Detail (invalid)', input: '!help --command unknown_cmd_123' },
        { name: 'Alias Resolution (start)', input: '!help --command start' }
    ];

    for (const t of helpTests) {
        const res = await runCommandTest('help', t.input);
        if (res.success) {
            console.log(`✔ Help: ${t.name} → PASS`);
        } else {
            console.log(`❌ Help: ${t.name} → FAIL (${res.reason})`);
            REPORT.failed++; // Count help tests towards failures if they break
        }
    }

    // -----------------------------------------------------------------------
    // SUMMARY
    // -----------------------------------------------------------------------
    console.log('\n====================================================');
    console.log('📊 SUMMARY');
    console.log('====================================================');
    console.log(`Total Commands: ${REPORT.total}`);
    console.log(`Passed:         ${REPORT.passed}`);
    console.log(`Failed:         ${REPORT.failed}`);

    if (REPORT.failed > 0) {
        console.log('\n❌ SYSTEM VALIDATION FAILED');
        process.exit(1);
    } else {
        console.log('\n✅ ALL SYSTEMS GO — ZERO REGRESSIONS');
        process.exit(0);
    }
}

// Execute the test harness
runAllTests().catch(err => {
    console.error('CRITICAL TEST FRAMEWORK ERROR:', err);
    process.exit(1);
});
