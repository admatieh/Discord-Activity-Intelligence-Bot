# Bot System Tests

The Discord Activity Intelligence Bot now has an automated backend test harness to validate the health of database schemas, core services, and logic workflows.

## Running Tests

Run the full bot system test suite with:

```bash
npm run test:bot-system
```

Or run the script directly:

```bash
node scripts/test-bot-system.js
```

### Modes

1. **Default Mode (Isolated)**
   By default, the test suite uses an isolated `data.test.db` SQLite database. This ensures your production database (`data.db`) is completely safe from unintended side effects and mock data inserts.
   
2. **Read-Only Mode (Production)**
   If you want to run the suite against your real database (e.g., to verify schema migrations were applied successfully), pass the `--real-db-readonly` flag:
   
   ```bash
   node scripts/test-bot-system.js --real-db-readonly
   ```
   
   *Note: In read-only mode, any tests that attempt to insert or mutate data (such as creating mock sessions or scheduled messages) will be automatically skipped to preserve data integrity.*

## Test Coverage

The test suite validates:

- **Service Imports**: Ensures all new services (`schedulerService`, `messageService`, `sessionActionService`, `reportService`, `activityFeedService`) import correctly without crashing.
- **Database Schema**: Validates that all tables exist and required columns are present (e.g., the new `scheduled_items`, `message_deliveries`, `session_reports` tables).
- **Log Model**: Verifies that the enhanced columns (`source`, `event`, `metadata_json`, etc.) can be successfully stored and queried.
- **Scheduler Service**: Validates scheduling structure, preventing invalid dates, and verifying cancellations.
- **Message Service**: Ensures proper validation (e.g., blocking empty messages or invalid channels).
- **Session Action Service**: Creates mock requests and verifies structured responses without throwing raw errors.
- **Report Service**: Validates that the report generator gracefully handles sessions with zero data.
- **Activity Feed**: Verifies the structure and severity tagging of human-readable activity logs.
- **Command Metadata**: Ensures that new bot commands correctly export metadata, descriptions, and the newly added `supportsDashboard` flag.
- **API Contracts**: Tests specific structural shapes of successes and failures to ensure standard HTTP integration points don't break.

## Understanding Output

You will see output showing `[PASS]`, `[FAIL]`, or `[SKIP]`. A test might be skipped if it performs inserts and you are running in read-only mode.

At the end of the test, a summary provides:
- **Total**: Total number of tests evaluated.
- **Passed**: Number of tests successfully passed.
- **Failed**: Number of tests with errors.
- **Skipped**: Tests bypassed for safety.
- **Critical Failures**: Any failures that would prevent the application from starting or functioning.

If a critical failure occurs, the process exits with code 1. Non-critical failures (warnings) will not fail a CI build but should be fixed.
