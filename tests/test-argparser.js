// tests/test-argparser.js
// Quick smoke test for the argument parser

const { parseArgs } = require('../utils/argParser');

const tests = [
    { content: '!session-start --duration 60' },
    { content: '!session-start' },
    { content: '!session-end --target all' },
    { content: '!session-end --id 42' },
    { content: '!help session-start' },
    { content: '!session-info --view open' },
    { content: '!session-start --duration 120 --channel 123456' },
    { content: '!ping' },
    { content: '!session-end --channel <#999888777>' },
    { content: '!session-start --duration abc' }, // invalid num → stays string
    { content: '!unknown-cmd --foo bar' },
];

tests.forEach((t, i) => {
    const msg = { content: t.content, guild: null };
    const r = parseArgs(msg);
    console.log(`Test ${i + 1}: "${t.content}"`);
    console.log(`  command: ${r.command}`);
    console.log(`  options: ${JSON.stringify(r.options)}`);
    console.log(`  positional: ${JSON.stringify(r.positional)}`);
    console.log('');
});

console.log('All tests completed.');
