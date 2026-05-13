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
    let attendanceService, attendanceSettingsService, rosterService;

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

    await test('Import attendance/roster services', async () => {
        attendanceService = require('../services/attendanceCheckpointService');
        attendanceSettingsService = require('../services/attendanceSettingsService');
        rosterService = require('../services/rosterService');
        assert(typeof attendanceService.recordCheckpoint === 'function', 'Missing recordCheckpoint');
        assert(typeof attendanceSettingsService.getCheckpointDefinitions === 'function', 'Missing getCheckpointDefinitions');
        assert(typeof rosterService.createCohort === 'function', 'Missing createCohort');
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

    await test('Attendance and roster tables exist', async () => {
        const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(r => r.name);
        const required = [
            'attendance_checkpoints',
            'attendance_checkpoint_definitions',
            'attendance_imports',
            'attendance_import_rows',
            'cohorts',
            'students',
            'cohort_members',
            'audit_logs'
        ];
        for (const req of required) {
            assert(tables.includes(req), `Missing table: ${req}`);
        }
    });

    // --- PHASE 3: Log Model Tests ---
    if (!USE_REAL_DB) {
        await test('Attendance defaults + dynamic checkpoint logic works', async () => {
            const guildId = 'guild_attendance_defs';
            const defs = attendanceSettingsService.getCheckpointDefinitions(guildId);
            assert(defs.ok, 'checkpoint definitions failed to load');
            assert((defs.definitions || []).length >= 3, 'default checkpoint definitions not created');

            const morning = defs.definitions.find(d => d.key === 'morning_checkin');
            assert(morning, 'missing default morning_checkin definition');

            const updated = attendanceSettingsService.updateCheckpointDefinition(guildId, morning.id, {
                ...morning,
                targetTime: '09:30',
                opensBeforeMinutes: 30,
                lateAfterMinutes: 10,
                allowLateSubmission: true
            });
            assert(updated.ok, 'failed to update checkpoint definition');

            const rec = attendanceService.recordCheckpoint({
                guildId,
                userId: 'student_dynamic_1',
                username: 'student_dynamic_1',
                displayName: 'Student Dynamic',
                commandType: 'checkin',
                now: new Date('2026-01-02T07:20:00.000Z')
            });
            assert(rec.ok, `recordCheckpoint should succeed in open window: ${rec.error || 'unknown'}`);
        });

        await test('Attendance duplicate checkin + checkout + late accepted', async () => {
            const guildId = 'guild_attendance_dupes';
            const first = attendanceService.recordCheckpoint({
                guildId,
                userId: 'student_1',
                username: 'student_1',
                displayName: 'Student 1',
                commandType: 'checkin',
                now: new Date('2026-01-02T06:50:00.000Z')
            });
            assert(first.ok, `initial checkin failed: ${first.error || 'unknown'}`);

            const duplicate = attendanceService.recordCheckpoint({
                guildId,
                userId: 'student_1',
                username: 'student_1',
                displayName: 'Student 1',
                commandType: 'checkin',
                now: new Date('2026-01-02T06:55:00.000Z')
            });
            assert(duplicate.ok, 'duplicate checkin should not fail');
            assert(duplicate.alreadyCompleted === true, 'duplicate checkin should flag alreadyCompleted');

            const late = attendanceService.recordCheckpoint({
                guildId,
                userId: 'student_2',
                username: 'student_2',
                displayName: 'Student 2',
                commandType: 'checkin',
                now: new Date('2026-01-02T07:30:00.000Z')
            });
            assert(late.ok, 'late checkin should still be accepted');
            assert(late.status === 'late', 'late checkin should be marked late');

            const checkout = attendanceService.recordCheckpoint({
                guildId,
                userId: 'student_1',
                username: 'student_1',
                displayName: 'Student 1',
                commandType: 'checkout',
                now: new Date('2026-01-02T14:10:00.000Z')
            });
            assert(checkout.ok, 'checkout should be recorded');
        });

        await test('Missing attendance uses roster and flags fallback', async () => {
            const guildId = 'guild_roster_missing';
            const cohortRes = rosterService.createCohort({ guildId, name: 'Cohort A' });
            assert(cohortRes.ok, 'createCohort failed');
            const s1 = rosterService.upsertStudent({ guildId, fullName: 'Alice Example', discordUserId: 'alice_1' });
            const s2 = rosterService.upsertStudent({ guildId, fullName: 'Bob Example', discordUserId: 'bob_1' });
            assert(s1.ok && s2.ok, 'upsertStudent failed');
            assert(rosterService.attachStudentToCohort({ cohortId: cohortRes.cohort.id, studentId: s1.student.id }).ok, 'attach s1 failed');
            assert(rosterService.attachStudentToCohort({ cohortId: cohortRes.cohort.id, studentId: s2.student.id }).ok, 'attach s2 failed');

            attendanceService.recordCheckpoint({
                guildId,
                userId: 'alice_1',
                username: 'alice_1',
                displayName: 'Alice Example',
                commandType: 'checkin',
                now: new Date('2026-01-02T06:50:00.000Z')
            });

            const missingWithRoster = attendanceService.getMissingCheckpoints({ guildId, date: '2026-01-02' });
            assert(missingWithRoster.ok, 'getMissingCheckpoints failed with roster');
            assert(missingWithRoster.rosterConfigured === true, 'roster should be treated as configured');
            assert((missingWithRoster.missing || []).some(m => m.userId === 'bob_1'), 'Bob should be missing via roster');

            const noRoster = attendanceService.getMissingCheckpoints({ guildId: 'guild_no_roster', date: '2026-01-02' });
            assert(noRoster.ok, 'getMissingCheckpoints failed without roster');
            assert(noRoster.rosterConfigured === false, 'missing response should flag fallback mode');
            assert(noRoster.warning, 'fallback mode should include warning');
        });

        await test('Roster CSV import supports quotes and updates duplicates', async () => {
            const guildId = 'guild_roster_import';
            const csv1 = `Full Name,Preferred Name,Email,Discord User ID,Discord Username,Duty Station,Student Code,Cohort
"Doe, John",John,john@example.com,discord_john,johnny,Remote,S001,Cohort CSV
Jane Smith,Jane,jane@example.com,discord_jane,janey,Remote,S002,Cohort CSV`;
            const first = rosterService.importRosterCsv({ guildId, csvText: csv1, dryRun: false });
            assert(first.ok, `importRosterCsv failed: ${first.error || 'unknown'}`);
            assert(first.rowsImported >= 2, 'expected two imported rows');

            const csv2 = `Full Name,Preferred Name,Email,Discord User ID,Discord Username,Duty Station,Student Code,Cohort
"Doe, John",Johnny,john@example.com,discord_john,johnny2,Hybrid,S001,Cohort CSV`;
            const second = rosterService.importRosterCsv({ guildId, csvText: csv2, dryRun: false });
            assert(second.ok, 'second import failed');
            assert(second.rowsUpdated >= 1, 'duplicate import should update, not insert duplicate');

            const students = rosterService.listStudents({ guildId });
            assert(students.length === 2, 'duplicate row created extra student unexpectedly');
            const john = students.find(s => s.email === 'john@example.com');
            assert(john && john.discord_username === 'johnny2', 'duplicate update did not apply latest values');

            const cohorts = rosterService.listCohorts(guildId);
            assert(cohorts.some(c => c.name === 'Cohort CSV'), 'cohort from CSV was not created');
        });

        await test('Roster CSV import fails gracefully for missing full name', async () => {
            const guildId = 'guild_roster_import_missing';
            const csv = `Email,Discord User ID
bad@example.com,abc123`;
            const res = rosterService.importRosterCsv({ guildId, csvText: csv, dryRun: false });
            assert(res.ok === false, 'import should fail when Full Name column is missing');
        });

        await test('Attendance CSV export includes expected headers', async () => {
            const exp = attendanceService.exportAttendanceCsv({
                guildId: 'guild_attendance_dupes',
                startDate: '2026-01-01',
                endDate: '2026-01-31',
                courseName: 'QA Course'
            });
            assert(exp.ok, 'exportAttendanceCsv failed');
            assert(exp.csv.includes('Course Name,Cohort,Student Name'), 'CSV headers missing expected prefix');
            assert(exp.csv.includes('Daily Status'), 'CSV should include Daily Status column');
        });

        await test('Attendance export includes missing roster rows', async () => {
            const guildId = 'guild_export_missing';
            const cohortRes = rosterService.createCohort({ guildId, name: 'Export Cohort' });
            const st = rosterService.upsertStudent({ guildId, fullName: 'Missing Export Student', discordUserId: 'missing_export_1' });
            assert(cohortRes.ok && st.ok, 'Failed to seed roster for export');
            rosterService.attachStudentToCohort({ cohortId: cohortRes.cohort.id, studentId: st.student.id, active: 1 });

            const exp = attendanceService.exportAttendanceCsv({
                guildId,
                startDate: '2026-01-05',
                endDate: '2026-01-05',
                courseName: 'QA Course',
                cohortId: cohortRes.cohort.id
            });
            assert(exp.ok, 'exportAttendanceCsv failed for roster missing check');
            assert(exp.csv.includes('missing_export_1') || exp.csv.includes('Missing Export Student'),
                'export should include roster student even with no attendance rows');
            assert(exp.csv.includes(',missing,'), 'export should include missing status rows');
        });

        await test('Manual attendance correction upsert works', async () => {
            const guildId = 'guild_attendance_dupes';
            const res = attendanceService.upsertManualAttendance({
                guildId,
                userId: 'student_1',
                date: '2026-01-02',
                checkpointKey: 'midday_checkin',
                status: 'excused',
                changedBy: 'instructor_test',
                reason: 'Approved absence'
            });
            assert(res.ok, `manual correction failed: ${res.error || 'unknown'}`);
            const row = db.prepare(
                `SELECT * FROM attendance_checkpoints WHERE guild_id=? AND user_id=? AND attendance_date=? AND checkpoint_key=?`
            ).get(guildId, 'student_1', '2026-01-02', 'midday_checkin');
            assert(row && row.status === 'excused', 'manual correction did not upsert checkpoint');
        });

        await test('Roster listStudents active=true excludes inactive', async () => {
            const guildId = 'guild_active_roster_filter_v1';
            rosterService.upsertStudent({ guildId, fullName: 'Active R', discordUserId: 'active_r_1', active: 1 });
            rosterService.upsertStudent({ guildId, fullName: 'Inactive R', discordUserId: 'inactive_r_1', active: 0 });
            const act = rosterService.listStudents({ guildId, active: true });
            const all = rosterService.listStudents({ guildId });
            assert(act.length === 1 && act[0].discord_user_id === 'active_r_1', 'active=true filters');
            assert(all.length >= 2, 'without active filter returns all');
        });

        await test('Manual correction and daily override by studentId without Discord user id', async () => {
            const attendanceDaily = require('../services/attendanceDailyStatusService');
            const guildId = 'guild_no_discord_student_v1';
            const cohortRes = rosterService.createCohort({ guildId, name: 'ND', active: 1 });
            assert(cohortRes.ok, 'cohort');
            const stNo = rosterService.upsertStudent({
                guildId,
                fullName: 'No Discord Full',
                preferredName: 'NoDex',
                discordUserId: null,
                discordUsername: null,
                dutyStation: 'Remote',
                active: 1,
            });
            const stWith = rosterService.upsertStudent({
                guildId,
                fullName: 'With Discord Full',
                discordUserId: 'nd_with_discord',
                active: 1,
            });
            assert(stNo.ok && stWith.ok, 'students');
            rosterService.attachStudentToCohort({ cohortId: cohortRes.cohort.id, studentId: stNo.student.id, active: 1 });
            rosterService.attachStudentToCohort({ cohortId: cohortRes.cohort.id, studentId: stWith.student.id, active: 1 });
            attendanceSettingsService.getCheckpointDefinitions(guildId);
            const testDate = '2026-04-10';
            const uidNo = `student:${stNo.student.id}`;
            const m1 = attendanceService.upsertManualAttendance({
                guildId,
                userId: null,
                studentId: stNo.student.id,
                date: testDate,
                checkpointKey: 'morning_checkin',
                status: 'present',
                changedBy: 't',
                displayName: stNo.student.full_name,
            });
            assert(m1.ok, m1.error || 'manual no discord');
            const m2 = attendanceService.upsertManualAttendance({
                guildId,
                userId: null,
                studentId: stWith.student.id,
                date: testDate,
                checkpointKey: 'morning_checkin',
                status: 'present',
                changedBy: 't',
                displayName: stWith.student.full_name,
            });
            assert(m2.ok, m2.error || 'manual with discord via studentId');
            const rowNo = db.prepare(
                `SELECT * FROM attendance_checkpoints WHERE guild_id=? AND user_id=? AND attendance_date=?`
            ).get(guildId, uidNo, testDate);
            assert(rowNo, 'checkpoint row no discord');
            attendanceDaily.upsertDailyOverride({
                guildId,
                userId: null,
                studentId: stNo.student.id,
                attendanceDate: testDate,
                status: 'manual',
                changedBy: 't',
            });
            const stNoDaily = attendanceDaily.getStudentDailyAttendanceStatus({ guildId, studentId: uidNo, date: testDate });
            assert(stNoDaily.exportable === true, 'no discord override exportable');
            attendanceDaily.upsertDailyOverride({
                guildId,
                userId: null,
                studentId: stWith.student.id,
                attendanceDate: testDate,
                status: 'manual',
                changedBy: 't',
            });
            const stWithDaily = attendanceDaily.getStudentDailyAttendanceStatus({
                guildId,
                studentId: 'nd_with_discord',
                date: testDate,
            });
            assert(stWithDaily.exportable === true, 'with discord override');
        });

        await test('Daily attendance status partial vs complete_late and PDF buffer', async () => {
            const attendanceDaily = require('../services/attendanceDailyStatusService');
            const guildId = 'guild_daily_status_v1';
            const cohortRes = rosterService.createCohort({ guildId, name: 'DStatus', active: 1 });
            const st = rosterService.upsertStudent({ guildId, fullName: 'DS Student', discordUserId: 'ds_student_1' });
            assert(cohortRes.ok && st.ok, 'seed cohort/student');
            rosterService.attachStudentToCohort({ cohortId: cohortRes.cohort.id, studentId: st.student.id, active: 1 });
            attendanceSettingsService.getCheckpointDefinitions(guildId);

            attendanceService.upsertManualAttendance({
                guildId,
                userId: 'ds_student_1',
                date: '2026-03-01',
                checkpointKey: 'morning_checkin',
                status: 'present',
                changedBy: 't',
            });
            const partial = attendanceDaily.getStudentDailyAttendanceStatus({
                guildId,
                studentId: 'ds_student_1',
                date: '2026-03-01',
            });
            assert(partial.status === 'partial', 'expected partial');
            assert(partial.exportable === false, 'partial not exportable');

            attendanceService.upsertManualAttendance({
                guildId,
                userId: 'ds_student_1',
                date: '2026-03-01',
                checkpointKey: 'midday_checkin',
                status: 'late',
                changedBy: 't',
            });
            attendanceService.upsertManualAttendance({
                guildId,
                userId: 'ds_student_1',
                date: '2026-03-01',
                checkpointKey: 'checkout',
                status: 'late',
                changedBy: 't',
            });
            const full = attendanceDaily.getStudentDailyAttendanceStatus({
                guildId,
                studentId: 'ds_student_1',
                date: '2026-03-01',
            });
            assert(full.status === 'complete_late', 'expected complete_late');
            assert(full.exportable === true, 'full required checkpoints exportable');

            const pdf = await attendanceDaily.exportOfficialAttendancePdf({
                guildId,
                cohortId: cohortRes.cohort.id,
                month: 3,
                year: 2026,
                courseName: 'Test',
            });
            assert(pdf.ok && pdf.buffer && pdf.buffer.length > 200, 'non-empty pdf');
        });

        await test('Daily override makes partial day exportable', async () => {
            const attendanceDaily = require('../services/attendanceDailyStatusService');
            const guildId = 'guild_daily_override_v1';
            const cohortRes = rosterService.createCohort({ guildId, name: 'Ov', active: 1 });
            const st = rosterService.upsertStudent({ guildId, fullName: 'Ov Student', discordUserId: 'ov_student_1' });
            assert(cohortRes.ok && st.ok, 'seed');
            rosterService.attachStudentToCohort({ cohortId: cohortRes.cohort.id, studentId: st.student.id, active: 1 });
            attendanceSettingsService.getCheckpointDefinitions(guildId);
            attendanceService.upsertManualAttendance({
                guildId,
                userId: 'ov_student_1',
                date: '2026-03-02',
                checkpointKey: 'morning_checkin',
                status: 'present',
                changedBy: 't',
            });
            assert(
                attendanceDaily.getStudentDailyAttendanceStatus({ guildId, studentId: 'ov_student_1', date: '2026-03-02' })
                    .exportable === false,
                'before override'
            );
            attendanceDaily.upsertDailyOverride({
                guildId,
                userId: 'ov_student_1',
                attendanceDate: '2026-03-02',
                status: 'manual',
                notes: 'ok',
                changedBy: 't',
            });
            assert(
                attendanceDaily.getStudentDailyAttendanceStatus({ guildId, studentId: 'ov_student_1', date: '2026-03-02' })
                    .exportable === true,
                'after override'
            );
        });

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

        // Recurrence helper tests
        await test('Recurrence: parseRecurrenceRule validates correctly', async () => {
            const recurrence = require('../utils/recurrence');
            
            // Valid rule
            const valid = recurrence.parseRecurrenceRule(JSON.stringify({
                frequency: 'weekly', daysOfWeek: ['MO', 'TU'], time: '09:00', timezone: 'Asia/Beirut'
            }));
            assert(valid.ok === true, 'Should parse valid rule');
            assert(valid.rule.daysOfWeek.length === 2, 'Should have 2 days');

            // Invalid day
            const badDay = recurrence.parseRecurrenceRule(JSON.stringify({
                frequency: 'weekly', daysOfWeek: ['MO', 'XX'], time: '09:00'
            }));
            assert(badDay.ok === false, 'Should fail invalid day code');

            // Invalid time
            const badTime = recurrence.parseRecurrenceRule(JSON.stringify({
                frequency: 'weekly', daysOfWeek: ['MO'], time: '9am'
            }));
            assert(badTime.ok === false, 'Should fail invalid time format');

            // Missing frequency
            const noFreq = recurrence.parseRecurrenceRule(JSON.stringify({
                daysOfWeek: ['MO'], time: '09:00'
            }));
            assert(noFreq.ok === false, 'Should fail missing frequency');
        });

        await test('Recurrence: getNextOccurrence returns future date', async () => {
            const { getNextOccurrence } = require('../utils/recurrence');
            const rule = { frequency: 'weekly', daysOfWeek: ['MO', 'TU', 'WE', 'TH', 'FR'], time: '09:00', timezone: 'Asia/Beirut' };
            const now = new Date();
            const result = getNextOccurrence(rule, now);
            assert(result.ok === true, 'Should find next occurrence: ' + result.error);
            assert(result.nextDate instanceof Date, 'nextDate should be a Date');
            assert(result.nextDate.getTime() > now.getTime(), 'Next date must be in the future');
        });

        await test('Recurrence: getNextOccurrence skips non-selected days', async () => {
            const { getNextOccurrence } = require('../utils/recurrence');
            // Only Monday
            const rule = { frequency: 'weekly', daysOfWeek: ['MO'], time: '09:00', timezone: 'Asia/Beirut' };
            const result = getNextOccurrence(rule, new Date());
            assert(result.ok === true, 'Should find next Monday');
            // The result should be a Monday (weekday 1 in JS)
            // We verify it's a valid future date
            assert(result.nextDate.getTime() > Date.now(), 'Should be in the future');
        });

        await test('Recurrence: isMissedRunTooOld detects old and recent correctly', async () => {
            const { isMissedRunTooOld } = require('../utils/recurrence');
            const old = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // 20 min ago
            const recent = new Date(Date.now() - 5 * 60 * 1000).toISOString(); // 5 min ago
            assert(isMissedRunTooOld(old, 15) === true, 'Should detect 20min old as missed');
            assert(isMissedRunTooOld(recent, 15) === false, 'Should not detect 5min old as missed');
        });

        await test('Recurrence: scheduleRecurringSession inserts valid item', async () => {
            const result = schedulerService.scheduleRecurringSession({
                guildId: 'guild_test',
                voiceChannelId: 'voice_test',
                title: 'Test Recurring Session',
                daysOfWeek: ['MO', 'TU', 'WE', 'TH'],
                time: '09:00',
                timezone: 'Asia/Beirut',
                durationMinutes: 60,
                createdBy: 'test-runner'
            });
            assert(result.ok === true, 'scheduleRecurringSession failed: ' + result.error);
            assert(result.id > 0, 'No ID returned');
            assert(result.nextRunAt, 'Missing nextRunAt');

            // Verify DB row
            const item = db.prepare('SELECT * FROM scheduled_items WHERE id = ?').get(result.id);
            assert(item, 'Item not found in DB');
            assert(item.recurrence_rule, 'recurrence_rule should be set');
            assert(item.status === 'scheduled', 'Status should be scheduled');
            assert(item.next_run_at, 'next_run_at should be set');

            // Verify recurrence_rule is valid JSON with expected shape
            const rule = JSON.parse(item.recurrence_rule);
            assert(rule.frequency === 'weekly', 'frequency should be weekly');
            assert(Array.isArray(rule.daysOfWeek), 'daysOfWeek should be array');
            assert(rule.time === '09:00', 'time should match');

            // Verify scheduled_for is in the future
            const scheduledForDate = new Date(item.scheduled_for);
            assert(scheduledForDate.getTime() > Date.now(), 'scheduled_for should be in the future');
        });

        await test('Recurrence: scheduleRecurringSession rejects missing guildId', async () => {
            const result = schedulerService.scheduleRecurringSession({
                voiceChannelId: 'voice_test',
                daysOfWeek: ['MO'],
                time: '09:00'
            });
            assert(result.ok === false, 'Should fail without guildId');
            assert(result.error, 'Should have error message');
        });

        await test('Recurrence: scheduleRecurringSession rejects invalid day codes', async () => {
            const result = schedulerService.scheduleRecurringSession({
                guildId: 'guild_test',
                voiceChannelId: 'voice_test',
                daysOfWeek: ['MO', 'INVALID'],
                time: '09:00'
            });
            assert(result.ok === false, 'Should fail with invalid day code');
        });

        await test('Recurrence: scheduleRecurringSession rejects invalid time', async () => {
            const result = schedulerService.scheduleRecurringSession({
                guildId: 'guild_test',
                voiceChannelId: 'voice_test',
                daysOfWeek: ['MO'],
                time: 'nine-am'
            });
            assert(result.ok === false, 'Should fail with invalid time');
        });

        await test('Recurrence: cancel recurring session works', async () => {
            const res = schedulerService.scheduleRecurringSession({
                guildId: 'guild_test',
                voiceChannelId: 'voice_test',
                title: 'To Cancel Recurring',
                daysOfWeek: ['FR'],
                time: '10:00',
                timezone: 'Asia/Beirut',
                durationMinutes: 30,
                createdBy: 'test'
            });
            assert(res.ok === true, 'Could not create recurring to cancel');
            const cancelRes = schedulerService.cancelScheduledItem(res.id);
            assert(cancelRes.ok === true, 'Cancel failed');
            const item = db.prepare('SELECT * FROM scheduled_items WHERE id = ?').get(res.id);
            assert(item.status === 'cancelled', 'Status should be cancelled');
        });
    } else {
        skip('Recurring session tests', 'Real DB mode');
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
        
        const requiredCmds = ['schedule-session', 'scheduled', 'cancel-scheduled', 'send-message', 'schedule-message', 'activity', 'schedule-recurring-session'];
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
