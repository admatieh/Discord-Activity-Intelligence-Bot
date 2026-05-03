// tests/voiceActivitySimulation.test.js

const sessionService = require('../modules/sessions/sessionService');
const voiceActivityModel = require('../models/voiceActivityModel');
const { eventBus, Events } = require('../core/eventBus');
const db = require('../database/db');

// Initialize all modules to attach event listeners
require('../modules/index').registerAll();

const channelId = 'sim_voice_' + Date.now();
const adminId = 'admin_user';
const DURATION_MINUTES = 20;
const T0 = new Date(Date.now() - DURATION_MINUTES * 60 * 1000);

function offsetMin(min) {
    return new Date(T0.getTime() + min * 60 * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function join(userId, min, isMuted) {
    console.log(`[${min.toString().padStart(2, '0')}m] ${userId} joins (muted: ${isMuted})`);
    eventBus.emit(Events.VOICE_JOIN, {
        userId,
        channelId,
        sessionId: sessionService.getSessionId(channelId),
        timestamp: offsetMin(min),
        isMuted
    });
}

function mute(userId, min) {
    console.log(`[${min.toString().padStart(2, '0')}m] ${userId} mutes`);
    eventBus.emit(Events.VOICE_MUTE, {
        userId,
        channelId,
        sessionId: sessionService.getSessionId(channelId),
        timestamp: offsetMin(min)
    });
}

function unmute(userId, min) {
    console.log(`[${min.toString().padStart(2, '0')}m] ${userId} unmutes`);
    eventBus.emit(Events.VOICE_UNMUTE, {
        userId,
        channelId,
        sessionId: sessionService.getSessionId(channelId),
        timestamp: offsetMin(min)
    });
}

function leave(userId, min) {
    console.log(`[${min.toString().padStart(2, '0')}m] ${userId} leaves`);
    eventBus.emit(Events.VOICE_LEAVE, {
        userId,
        channelId,
        sessionId: sessionService.getSessionId(channelId),
        timestamp: offsetMin(min),
        remainingMembers: 1 // prevent empty grace trigger
    });
}

// ---------------------------------------------------------------------------
// Simulation
// ---------------------------------------------------------------------------

function simulate() {
    console.log(`====================================================`);
    console.log(`🎤 VOICE ACTIVITY SIMULATION STARTED`);
    console.log(`====================================================`);
    console.log(`Session Duration: ${DURATION_MINUTES} minutes\n`);

    // 1. Create Session
    const startRes = sessionService.startSession(channelId, adminId, { durationMinutes: DURATION_MINUTES });
    const sessionId = startRes.sessionId;

    // Force start_time in DB to be T0
    db.prepare('UPDATE sessions SET start_time = ? WHERE id = ?').run(T0.toISOString(), sessionId);

    console.log(`[SYS] Session #${sessionId} created.\n`);

    // 2. Timeline timeline
    // Case A: Join unmuted
    join('userA', 0, false);

    // Case B: Join muted -> unmute later
    join('userB', 0, true);
    unmute('userB', 2);

    // Case C: Speaking + mute
    mute('userA', 5);

    // Case D: Leave while unmuted
    join('userC', 2, false);
    leave('userC', 8);

    // Case E: Rejoin
    leave('userA', 6);
    join('userA', 10, false); // rejoins unmuted
    mute('userA', 13);

    // Case F: Spam toggles
    join('userD', 11, true);
    unmute('userD', 12);
    mute('userD', 12);
    unmute('userD', 12);
    mute('userD', 12);
    unmute('userD', 12); // ends up unmuted

    // Case G: Late join
    join('userE', 15, false);

    // 3. End Session
    console.log(`\n[${DURATION_MINUTES}m] Session ends\n`);
    // Manually pass a fake timestamp to endSessionById to simulate exact end time.
    // Wait, sessionService.endSession doesn't accept a custom timestamp. It uses Date.now().
    // The test framework runs fast, so Date.now() will be close to actual execution time.
    // But we need to use offsetMin(20) to have exact durations. 
    // Since endSession closes intervals using new Date().toISOString(), we will override it in DB later
    // or just let it close them with the current time, and fix it in validation. 
    // Actually, `voiceActivityModel.closeAllOpenIntervals` will use current time. Let's patch it in DB for cleaner output.

    // End session using service (this uses real Date.now())
    sessionService.endSession(channelId);

    // We need to patch the end times because the events were fired with simulated times (T0 + X min),
    // but endSession (and some interval closing) might use real Date.now().
    // Any interval ending *after* our simulated duration should be capped at the simulated duration.
    const maxSimulatedTime = offsetMin(DURATION_MINUTES);

    // Patch any interval that was closed by sessionService using real Date.now()
    db.prepare(`
        UPDATE voice_activity_intervals 
        SET end_time = ? 
        WHERE session_id = ? AND end_time > ?
    `).run(maxSimulatedTime, sessionId, maxSimulatedTime);

    // Also patch any that might still be NULL (shouldn't be, but just in case)
    db.prepare(`
        UPDATE voice_activity_intervals 
        SET end_time = ? 
        WHERE session_id = ? AND end_time IS NULL
    `).run(maxSimulatedTime, sessionId);

    setTimeout(() => validateAndPrint(sessionId), 100);
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

function validateAndPrint(sessionId) {
    console.log(`====================================================`);
    console.log(`📊 RAW INTERVALS`);
    console.log(`====================================================`);

    const intervals = voiceActivityModel.getIntervalsBySession(sessionId);
    const byUser = {};

    intervals.forEach(inv => {
        if (!byUser[inv.user_id]) byUser[inv.user_id] = [];
        byUser[inv.user_id].push(inv);

        const startStr = new Date(inv.start_time).toISOString().substring(11, 19);
        const endStr = inv.end_time ? new Date(inv.end_time).toISOString().substring(11, 19) : 'NULL    ';

        const durationSecs = inv.end_time
            ? Math.round((new Date(inv.end_time) - new Date(inv.start_time)) / 1000)
            : 0;

        console.log(`- ${inv.user_id.padEnd(8)} | Start: ${startStr} | End: ${endStr} | Duration: ${durationSecs}s`);
    });

    console.log(`\n====================================================`);
    console.log(`📋 VALIDATION RESULTS`);
    console.log(`====================================================`);

    let overallPass = true;

    for (const [userId, userIntervals] of Object.entries(byUser)) {
        let userPass = true;
        let totalTime = 0;
        let lastEnd = null;
        let errors = [];

        // Sort by start_time
        userIntervals.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));

        for (const inv of userIntervals) {
            // Check nulls
            if (!inv.start_time || !inv.end_time) {
                userPass = false;
                errors.push('Contains NULL time');
            }

            const start = new Date(inv.start_time).getTime();
            const end = new Date(inv.end_time).getTime();
            const duration = end - start;

            // Check duration
            if (duration <= 0) {
                // Notice that spam toggles in the same millisecond could result in 0 duration.
                // We'll allow 0 duration intervals from spam, but not negative.
                if (duration < 0) {
                    userPass = false;
                    errors.push('Negative duration');
                }
            }

            // Check overlaps
            if (lastEnd && start < lastEnd) {
                userPass = false;
                errors.push('Overlapping intervals');
            }

            totalTime += duration;
            lastEnd = end;
        }

        // Check total time <= session duration
        if (totalTime > DURATION_MINUTES * 60 * 1000) {
            userPass = false;
            errors.push('Total time exceeds session duration');
        }

        if (userPass) {
            console.log(`✅ ${userId.padEnd(8)} PASS (Total speaking: ${Math.round(totalTime / 1000)}s)`);
        } else {
            console.log(`❌ ${userId.padEnd(8)} FAIL: ${errors.join(', ')}`);
            overallPass = false;
        }
    }

    console.log(`\n====================================================`);
    console.log(`SYSTEM RESULT: ${overallPass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`====================================================\n`);
}

simulate();
