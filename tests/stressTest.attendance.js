const sessionService = require('../modules/sessions/sessionService');
const attendanceService = require('../modules/attendance/attendanceService');
const { eventBus, Events } = require('../core/eventBus');
const db = require('../database/db');
const voiceEventModel = require('../models/voiceEventModel');
const attendanceSummaryModel = require('../models/attendanceSummaryModel');

// Initialize modules
require('../modules/index').registerAll();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function generateUsers(count) {
    const users = [];
    for (let i = 1; i <= count; i++) {
        users.push(`user${i}`);
    }
    return users;
}

const T0 = Date.now();

function getSimTime(offsetMinutes) {
    return new Date(T0 + offsetMinutes * 60000).toISOString();
}

function joinSession(userId, channelId, offsetMinutes) {
    eventBus.emit(Events.VOICE_JOIN, {
        userId,
        channelId,
        sessionId: sessionService.getSessionId(channelId),
        timestamp: getSimTime(offsetMinutes)
    });
}

function leaveSession(userId, channelId, offsetMinutes) {
    eventBus.emit(Events.VOICE_LEAVE, {
        userId,
        channelId,
        sessionId: sessionService.getSessionId(channelId),
        timestamp: getSimTime(offsetMinutes),
        remainingMembers: 1
    });
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

async function runStressTest() {
    console.log("====================================================");
    console.log("🚀 STARTING ATTENDANCE STRESS TEST");
    console.log("====================================================");

    const users = generateUsers(100);
    const eventsToEmit = [];
    let eventCount = 0;

    // Session A: 30 minutes, normal attendance pattern
    const channelA = "channel_A";
    const resA = sessionService.startSession(channelA, 'admin', { durationMinutes: 30 });
    db.prepare('UPDATE sessions SET start_time = ? WHERE id = ?').run(getSimTime(0), resA.sessionId);

    // Session B: 30 minutes, overlap A (starts at min 10), high load
    const channelB = "channel_B";
    const resB = sessionService.startSession(channelB, 'admin', { durationMinutes: 30 });
    db.prepare('UPDATE sessions SET start_time = ? WHERE id = ?').run(getSimTime(10), resB.sessionId);

    // Session C: 10 minutes, starts at min 5, heavy late joins
    const channelC = "channel_C";
    const resC = sessionService.startSession(channelC, 'admin', { durationMinutes: 10 });
    db.prepare('UPDATE sessions SET start_time = ? WHERE id = ?').run(getSimTime(5), resC.sessionId);

    console.log("✅ Sessions created.");

    // Generate chaos!
    for (let i = 0; i < users.length; i++) {
        const user = users[i];

        // Randomly assign users to sessions
        const inA = Math.random() > 0.5;
        const inB = Math.random() > 0.2; // High load
        const inC = Math.random() > 0.7;

        if (inA) {
            // Normal pattern: join early, leave near end
            eventsToEmit.push(() => joinSession(user, channelA, randomInt(0, 4)));
            if (Math.random() > 0.1) {
                eventsToEmit.push(() => leaveSession(user, channelA, randomInt(25, 30)));
            }
        }

        if (inB) {
            // High load, overlapping. Lots of spam joins/leaves, missing leaves, disconnects.
            const joinTime = randomInt(10, 15);
            eventsToEmit.push(() => joinSession(user, channelB, joinTime));
            
            // Spam joins (duplicate joins without leaving)
            if (Math.random() > 0.5) {
                eventsToEmit.push(() => joinSession(user, channelB, joinTime + 1));
                eventsToEmit.push(() => joinSession(user, channelB, joinTime + 2));
            }

            // Rapid switch
            if (Math.random() > 0.7) {
                eventsToEmit.push(() => leaveSession(user, channelB, joinTime + 3));
                eventsToEmit.push(() => joinSession(user, channelB, joinTime + 4));
            }

            // Missing leave (never leaves) 30% of the time
            if (Math.random() > 0.3) {
                eventsToEmit.push(() => leaveSession(user, channelB, randomInt(35, 40)));
            }
        }

        if (inC) {
            // Heavy late joins
            const joinTime = randomInt(11, 14); // Session starts at 5, late threshold is 5 (so >10 is late)
            eventsToEmit.push(() => joinSession(user, channelC, joinTime));
            eventsToEmit.push(() => leaveSession(user, channelC, 15));
        }
    }

    // Shuffle events to simulate race conditions and out-of-order execution slightly
    eventsToEmit.sort(() => Math.random() - 0.5);

    // Concurrently emit events
    await Promise.all(eventsToEmit.map(fn => new Promise(resolve => {
        fn();
        eventCount++;
        resolve();
    })));

    console.log(`✅ Emitted ${eventCount} events concurrently.`);

    // End sessions
    // End C at 15
    db.prepare('UPDATE sessions SET end_time = ? WHERE id = ?').run(getSimTime(15), resC.sessionId);
    eventBus.emit(Events.SESSION_ENDED, { sessionId: resC.sessionId });

    // End A at 30
    db.prepare('UPDATE sessions SET end_time = ? WHERE id = ?').run(getSimTime(30), resA.sessionId);
    eventBus.emit(Events.SESSION_ENDED, { sessionId: resA.sessionId });

    // End B at 40
    db.prepare('UPDATE sessions SET end_time = ? WHERE id = ?').run(getSimTime(40), resB.sessionId);
    eventBus.emit(Events.SESSION_ENDED, { sessionId: resB.sessionId });

    // Wait for finalization
    await new Promise(r => setTimeout(r, 1000));

    // ---------------------------------------------------------------------------
    // Validation
    // ---------------------------------------------------------------------------
    
    console.log("\n====================================================");
    console.log("📊 VALIDATING RESULTS");
    console.log("====================================================");

    let passed = true;
    const errors = [];

    function validateSession(sessionId, durationMins) {
        const summaries = attendanceSummaryModel.getBySession(sessionId);
        
        for (const sum of summaries) {
            // Check for negative durations
            if (sum.total_time_seconds < 0) {
                errors.push(`[Session ${sessionId}] User ${sum.user_id} has negative duration: ${sum.total_time_seconds}`);
                passed = false;
            }

            // Check for durations exceeding session duration
            const maxDurationSecs = durationMins * 60;
            if (sum.total_time_seconds > maxDurationSecs + 10) { // small buffer for out-of-order
                errors.push(`[Session ${sessionId}] User ${sum.user_id} duration (${sum.total_time_seconds}s) exceeds session length (${maxDurationSecs}s)!`);
                passed = false;
            }
        }
    }

    validateSession(resA.sessionId, 30);
    validateSession(resB.sessionId, 30);
    validateSession(resC.sessionId, 10);

    if (passed) {
        console.log("✅ All validations passed!");
    } else {
        console.log("❌ Validations failed. Errors detected:");
        errors.forEach(e => console.log(e));
    }
}

runStressTest();
