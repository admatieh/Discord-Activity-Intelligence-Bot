# Command System Tests

The Discord Activity Intelligence Bot now has an automated testing harness dedicated exclusively to deep command-level execution validation.

## Running Tests

Run the command test suite with:

```bash
npm run test:bot-commands
```

Or run the script directly:

```bash
node scripts/test-bot-commands.js
```

### Modes

1. **Default Mode (Isolated Mocked Context)**
   By default, the test suite boots an isolated SQLite database `data.commands.test.db`. It automatically discovers all commands in the system and spins up a simulated `Discord.js` environment containing Mocked Guilds, Mocked Text Channels, Mocked Voice Channels, and Mocked Collections/Members.

2. **Read-Only Mode (Production)**
   To verify commands against your actual database, use the read-only flag. Note that any commands that insert data (like starting sessions or scheduling messages) will skip execution in this mode to preserve your data.
   
   ```bash
   node scripts/test-bot-commands.js --real-db-readonly
   ```

## Test Coverage

The test suite systematically iterates over every single command found in the command registry (`commands/` directory).

For each discovered command, it checks:
1. **Metadata Structure**: Asserts that `name`, `description`, `execute`, and `supportsDashboard` are present and properly typed.
2. **Graceful Degradation (Context Checking)**: Asserts that commands requiring a Discord context (like `requiresGuild`) fail gracefully with an error rather than unhandled Node crashes.
3. **Empty Execution Context**: Fires each command with empty arguments using a Mock Context to ensure the system returns validation help or cleanly no-ops without throwing `TypeError`.
4. **Focused Critical Execution**: Deeply simulates specific core bot commands using mocked clients:
   - `schedule-session`: Mock inserts into database with correct time validation.
   - `send-message`: Mock captures `.send()` dispatches on `MockChannel`.
   - `session-start`: Validates graceful initiation of an empty voice channel tracking loop.
   - `session-end`: Safely terminates mock sessions gracefully.
5. **Command Executor Context**: Pushes synthetic Dashboard requests directly through `core/commandExecutor` to guarantee string parsing behavior successfully delegates to the correct command modules (e.g. `!health-check` and `!schedule-message`).

## Understanding Output

You will see output showing `[PASS]`, `[FAIL]`, or `[SKIP]`. 

If a test fails, the runner traps the execution error (even if it's a deep promise rejection) and surfaces the stack trace at the bottom of the execution run. This ensures CI pipelines fail correctly (Exit Code 1) when command logic breaks.
