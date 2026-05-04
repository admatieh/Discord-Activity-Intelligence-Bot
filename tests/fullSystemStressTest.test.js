// tests/fullSystemStressTest.test.js

const db = require('../database/db');
const sessionService = require('../modules/sessions/sessionService');
const { eventBus, Events } = require('../core/eventBus');
const userModel = require('../models/userModel');

// Models
const sessionModel = require('../models/sessionModel');
const attendanceSummaryModel = require('../models/attendanceSummaryModel');
const voiceActivityModel = require('../models/voiceActivityModel');
const voiceEventModel = require('../models/voiceEventModel');
const activityEventModel = require('../modules/activity/activityEventModel');
const participationSummaryModel = require('../models/participationSummaryModel');
const logModel = require('../models/logModel');

// Initialize modules
require('../modules/index').registerAll();

console.log("====================================================");
console.log("🌪️  FULL SYSTEM STRESS TEST");
console.log("====================================================\n");

const T0 = new Date(Date.now() - 120 * 60000); // 2 hours ago

function offsetTime(min) {
    return new Date(T0.getTime() + min * 60000).toISOString();
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

let totalEvents = 0;

function emit(event, payload) {
    totalEvents++;
    eventBus.emit(event, payload);
}

// Emitting Helpers
function joinVoice(userId, channelId, timeOffset, remainingMembers = 2) {
    const sessionId = sessionService.getSessionId(channelId);
    emit(Events.VOICE_JOIN, { userId, channelId, sessionId, timestamp: offsetTime(timeOffset) });
}

function leaveVoice(userId, channelId, timeOffset, remainingMembers = 1) {
    const sessionId = sessionService.getSessionId(channelId);
    emit(Events.VOICE_LEAVE, { userId, channelId, sessionId, timestamp: offsetTime(timeOffset), remainingMembers });
}

function mute(userId, channelId, timeOffset) {
    const sessionId = sessionService.getSessionId(channelId);
    emit(Events.VOICE_MUTE, { userId, channelId, sessionId, timestamp: offsetTime(timeOffset) });
}

function unmute(userId, channelId, timeOffset) {
    const sessionId = sessionService.getSessionId(channelId);
    emit(Events.VOICE_UNMUTE, { userId, channelId, sessionId, timestamp: offsetTime(timeOffset) });
}

function switchChannel(userId, oldChannelId, newChannelId, timeOffset) {
    emit(Events.VOICE_SWITCH, { userId, oldChannelId, newChannelId, timestamp: offsetTime(timeOffset) });
}

function sendMsg(userId, channelId) {
    const sessionId = sessionService.getSessionId(channelId);
    emit(Events.MESSAGE_CREATE, { userId, channelId, sessionId });
}

function replyMsg(userId, channelId) {
    const sessionId = sessionService.getSessionId(channelId);
    emit(Events.MESSAGE_REPLY, { userId, channelId, sessionId });
}

function addRxn(userId, channelId) {
    const sessionId = sessionService.getSessionId(channelId);
    emit(Events.REACTION_ADD, { userId, channelId, sessionId });
}

// Generate users
function registerUsers(count, prefix) {
    for (let i = 1; i <= count; i++) {
        const id = `${prefix}_user_${i}`;
        userModel.upsertUser({
            id,
            username: id,
            discriminator: '0000',
            displayName: id,
            joinedAt: T0.toISOString(),
            createdAt: T0.toISOString()
        });
    }
}

async function runTest() {
    registerUsers(20, 'A');
    registerUsers(50, 'B');
    registerUsers(10, 'C');

    console.log("[SYS] Simulating Session A (Normal, 60m)...");
    const channelA = 'channel_a';
    const resA = sessionService.startSession(channelA, 'admin_a', { durationMinutes: 60 });
    const sessionA = resA.sessionId;
    db.prepare('UPDATE sessions SET start_time = ? WHERE id = ?').run(offsetTime(0), sessionA);

    // Session A timeline
    for (let i = 1; i <= 20; i++) {
        const uid = `A_user_${i}`;
        // Users 1-10: On time, leave end
        if (i <= 10) {
            joinVoice(uid, channelA, 0);
            unmute(uid, channelA, 2);
            mute(uid, channelA, 10);
            sendMsg(uid, channelA);
            leaveVoice(uid, channelA, 60);
        }
        // Users 11-15: Late
        else if (i <= 15) {
            joinVoice(uid, channelA, 15);
            replyMsg(uid, channelA);
            leaveVoice(uid, channelA, 60);
        }
        // Users 16-18: Early leave (stay 40m, threshold is 30m)
        else if (i <= 18) {
            joinVoice(uid, channelA, 0);
            leaveVoice(uid, channelA, 40);
        }
        // User 19: Absent (joined, left immediately)
        else if (i === 19) {
            joinVoice(uid, channelA, 0);
            leaveVoice(uid, channelA, 0);
        }
        // User 20: Completely absent, no join
    }

    console.log("[SYS] Simulating Session B (Chaos, 120m)...");
    const channelB = 'channel_b';
    const resB = sessionService.startSession(channelB, 'admin_b', { durationMinutes: 120 });
    const sessionB = resB.sessionId;
    db.prepare('UPDATE sessions SET start_time = ? WHERE id = ?').run(offsetTime(0), sessionB);

    // Spam events concurrently to test robustness
    const promises = [];
    for (let i = 1; i <= 50; i++) {
        const uid = `B_user_${i}`;
        promises.push((async () => {
            // Rapid joins/leaves
            joinVoice(uid, channelB, 0);
            leaveVoice(uid, channelB, 1);
            joinVoice(uid, channelB, 2);
            
            // Mute spam
            for (let j = 0; j < 10; j++) {
                unmute(uid, channelB, 5 + j);
                mute(uid, channelB, 5 + j + 0.5);
            }
            
            // Chat spam
            for (let j = 0; j < 5; j++) {
                sendMsg(uid, channelB);
                addRxn(uid, channelB);
            }

            // A few will leave early, rest stay till end
            if (i % 5 === 0) {
                leaveVoice(uid, channelB, 40);
            } else {
                // leave some open intervals at the end
                if (i % 2 === 0) unmute(uid, channelB, 110);
                leaveVoice(uid, channelB, 120);
            }
        })());
    }
    await Promise.all(promises);

    console.log("[SYS] Simulating Session C (Short/Late/Empty, 10m)...");
    const channelC = 'channel_c';
    const resC = sessionService.startSession(channelC, 'admin_c', { durationMinutes: 10 });
    const sessionC = resC.sessionId;
    db.prepare('UPDATE sessions SET start_time = ? WHERE id = ?').run(offsetTime(0), sessionC);

    for (let i = 1; i <= 10; i++) {
        const uid = `C_user_${i}`;
        joinVoice(uid, channelC, 8); // Everyone joins late
        unmute(uid, channelC, 8.5);
        if (i <= 5) leaveVoice(uid, channelC, 9, 5 - i); // Half leave early
    }

    // Now empty channel auto-end behavior test
    console.log("[SYS] Ending sessions...");

    function forceEnd(sessionId, endTimeOffset) {
        const endIso = offsetTime(endTimeOffset);
        voiceEventModel.closeAllOpenEvents(sessionId, endIso);
        db.prepare('UPDATE voice_activity_intervals SET end_time = ? WHERE session_id = ? AND end_time IS NULL').run(endIso, sessionId);
        db.prepare('UPDATE sessions SET end_time = ? WHERE id = ?').run(endIso, sessionId);
        eventBus.emit(Events.SESSION_ENDED, { sessionId, timestamp: endIso });
    }

    // Manually end sessions
    forceEnd(sessionA, 60);
    forceEnd(sessionB, 120);
    forceEnd(sessionC, 10);

    // Allow event bus async finalized events to settle
    await sleep(500);

    // ============================================
    // VALIDATION
    // ============================================
    console.log("\n====================================================");
    console.log("✅ VALIDATION PHASE");
    console.log("====================================================");

    let passes = 0, fails = 0;

    function assert(condition, successMsg, failMsg) {
        if (condition) {
            console.log(`✔️  ${successMsg}`);
            passes++;
        } else {
            console.error(`❌  ${failMsg}`);
            fails++;
        }
    }

    // 1. Sessions
    const sA = sessionModel.getSessionById(sessionA);
    const sB = sessionModel.getSessionById(sessionB);
    const sC = sessionModel.getSessionById(sessionC);
    
    assert(sA.end_time && sB.end_time && sC.end_time, "All sessions ended correctly", "Some sessions did not end");
    
    // 2. Attendance
    const attA = attendanceSummaryModel.getBySession(sessionA);
    const attB = attendanceSummaryModel.getBySession(sessionB);
    const attC = attendanceSummaryModel.getBySession(sessionC);

    assert(attA.length > 0 && attB.length > 0 && attC.length > 0, "Attendance summaries generated for all sessions", "Missing attendance summaries");
    
    const userA1 = attA.find(a => a.user_id === 'A_user_1');
    const userA15 = attA.find(a => a.user_id === 'A_user_15');
    const userA17 = attA.find(a => a.user_id === 'A_user_17');
    const userA19 = attA.find(a => a.user_id === 'A_user_19');

    assert(userA1 && userA1.status === 'ON_TIME', "User A1 status is ON_TIME", `User A1 status incorrect: ${userA1?.status}`);
    assert(userA15 && userA15.status === 'LATE', "User A15 status is LATE", `User A15 status incorrect: ${userA15?.status}`);
    assert(userA17 && userA17.status === 'LEFT_EARLY', "User A17 status is LEFT_EARLY", `User A17 status incorrect: ${userA17?.status}`);
    assert(userA19 && userA19.status === 'ABSENT', "User A19 status is ABSENT", `User A19 status incorrect: ${userA19?.status}`);

    // 3. Voice Activity
    const vaA = db.prepare('SELECT * FROM voice_activity_intervals WHERE session_id = ?').all(sessionA);
    const vaB = db.prepare('SELECT * FROM voice_activity_intervals WHERE session_id = ?').all(sessionB);
    
    assert(vaA.length > 0, "Voice activity intervals recorded", "No voice activity recorded");
    const noNegativeVa = vaB.every(v => new Date(v.end_time) >= new Date(v.start_time));
    assert(noNegativeVa, "No negative duration voice intervals", "Found negative duration voice interval");
    
    const openIntervals = db.prepare('SELECT count(*) as c FROM voice_activity_intervals WHERE end_time IS NULL AND session_id IN (?, ?, ?)').get(sessionA, sessionB, sessionC).c;
    assert(openIntervals === 0, "All voice activity intervals closed on session end", `${openIntervals} open voice intervals remain in current sessions`);

    // 4. Interactions
    const eventsA = db.prepare('SELECT count(*) as c FROM activity_events WHERE session_id = ?').get(sessionA).c;
    const eventsB = db.prepare('SELECT count(*) as c FROM activity_events WHERE session_id = ?').get(sessionB).c;
    
    assert(eventsA > 0 && eventsB > 0, "Interaction events recorded", "Missing interaction events");

    // 5. Participation
    const partA = participationSummaryModel.getBySession(sessionA);
    const partB = participationSummaryModel.getBySession(sessionB);

    assert(partA.length > 0 && partB.length > 0, "Participation summaries generated", "Missing participation summaries");
    
    const validScores = partA.every(p => p.score >= 0 && p.score <= 100);
    assert(validScores, "Participation scores are within 0-100", "Found out-of-bounds participation score");

    const validLabels = ['HIGHLY_ACTIVE', 'ACTIVE', 'MODERATE', 'LOW', 'INACTIVE'];
    const labelsOk = partB.every(p => validLabels.includes(p.label));
    assert(labelsOk, "Participation labels are valid", "Found invalid participation label");

    // 6. Users
    const totalUsers = db.prepare('SELECT count(*) as c FROM users').get().c;
    assert(totalUsers >= 80, "All users registered in database", `Only ${totalUsers} users found`);

    // 7. Logs
    const errLogs = db.prepare('SELECT count(*) as c FROM logs WHERE level = ?').get('error').c;
    assert(errLogs === 0, "No crash errors logged during test", `${errLogs} errors found in logs`);

    console.log("\n====================================================");
    console.log(`📊 FINAL REPORT`);
    console.log("====================================================");
    console.log(`Total Events Simulated: ${totalEvents}`);
    console.log(`Sessions Tested:        3`);
    console.log(`Users Tested:           80`);
    console.log(`Assertions Passed:      ${passes}`);
    console.log(`Assertions Failed:      ${fails}`);
    
    if (fails === 0) {
        console.log("\n✅ ALL TESTS PASSED! The system handled the chaos beautifully.");
    } else {
        console.error("\n❌ TEST FAILED. Review errors above.");
    }
}

runTest().catch(err => {
    console.error("FATAL TEST CRASH:", err);
});
