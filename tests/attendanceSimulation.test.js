// tests/attendanceSimulation.test.js

const sessionService = require('../modules/sessions/sessionService');
const attendanceService = require('../modules/attendance/attendanceService');
const { eventBus, Events } = require('../core/eventBus');
const db = require('../database/db');
const voiceEventModel = require('../models/voiceEventModel');

// Initialize all modules to attach event listeners
require('../modules/index').registerAll();

const channelId = 'sim_channel_' + Date.now();
const adminId = 'admin_user';

// Setup a 20-minute session to allow enough time for LATE threshold (5m)
// and MIN_ATTENDANCE (50% = 10m).
const DURATION_MINUTES = 20;
const T0 = new Date(Date.now() - DURATION_MINUTES * 60 * 1000);

function offsetMin(min) {
    return new Date(T0.getTime() + min * 60 * 1000).toISOString();
}

function join(userId, min) {
    console.log(`[${min.toString().padStart(2, '0')}m] ${userId} joins`);
    eventBus.emit(Events.VOICE_JOIN, {
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

function simulate() {
    console.log(`====================================================`);
    console.log(`🤖 ATTENDANCE SIMULATION STARTED`);
    console.log(`====================================================`);
    console.log(`Session Duration: ${DURATION_MINUTES} minutes`);
    console.log(`Late Threshold:   5 minutes`);
    console.log(`Min Attendance:   50% (${DURATION_MINUTES / 2} minutes)\n`);

    // 1. Create Session
    const startRes = sessionService.startSession(channelId, adminId, { durationMinutes: DURATION_MINUTES });
    const sessionId = startRes.sessionId;
    
    // Force start_time in DB to be T0
    db.prepare('UPDATE sessions SET start_time = ? WHERE id = ?').run(T0.toISOString(), sessionId);
    
    console.log(`[SYS] Session #${sessionId} created.\n`);

    // 2. Timeline
    join('userA', 0);
    join('userB', 0);
    join('userG', 0); // Joins early, leaves very early
    
    leave('userG', 2);
    
    join('userC', 2);
    
    join('userD', 6); // LATE ( > 5m )
    join('userE', 6); // LATE, but will leave early
    
    leave('userB', 15); // LEFT_EARLY
    
    leave('userA', 15);
    
    join('userF', 16); // Joins very late -> ABSENT
    
    join('userA', 18); // userA rejoins
    leave('userE', 18); // userE leaves early -> LEFT_EARLY
    
    // 3. End Session
    console.log(`\n[${DURATION_MINUTES}m] Session ends\n`);
    sessionService.endSession(channelId);

    // Give the event bus a tiny tick to finish synchronous listeners
    setTimeout(() => printResults(sessionId), 100);
}

function printResults(sessionId) {
    console.log(`====================================================`);
    console.log(`📊 RAW VOICE EVENTS`);
    console.log(`====================================================`);
    const events = voiceEventModel.getEventsBySession(sessionId);
    events.forEach(e => {
        // Safe string parse for display
        const joinStr = e.join_time ? new Date(e.join_time).toISOString().substring(11, 19) : 'UNKNOWN ';
        const leaveStr = e.leave_time ? new Date(e.leave_time).toISOString().substring(11, 19) : 'END     ';
        console.log(`- ${e.user_id.padEnd(8)} | Join: ${joinStr} | Leave: ${leaveStr}`);
    });

    console.log(`\n====================================================`);
    console.log(`📈 COMPUTED ATTENDANCE RESULT`);
    console.log(`====================================================`);
    const summary = attendanceService.getSessionAttendanceSummary(sessionId);
    
    if (!summary || summary.users.length === 0) {
        console.log('❌ No attendance summary found!');
        return;
    }

    summary.users.forEach(u => {
        const min = Math.floor(u.totalTimeSeconds / 60);
        console.log(`${u.userId.padEnd(8)} → ${u.status.padEnd(10)} (Total: ${min}m)`);
    });

    console.log(`\n====================================================`);
    console.log(`📋 SUMMARY COUNTS`);
    console.log(`====================================================`);
    console.log(`Total Users: ${summary.totalUsers}`);
    Object.entries(summary.counts).forEach(([status, count]) => {
        if (count > 0) {
            console.log(`- ${status.padEnd(10)}: ${count}`);
        }
    });
    console.log(`====================================================\n`);
}

simulate();
