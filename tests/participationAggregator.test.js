// tests/participationAggregator.test.js
const db = require('../database/db');
const sessionModel = require('../models/sessionModel');
const attendanceSummaryModel = require('../models/attendanceSummaryModel');
const voiceActivityModel = require('../models/voiceActivityModel');
const activityEventModel = require('../modules/activity/activityEventModel');
const { aggregateSession } = require('../modules/participation/participationAggregator');

console.log("====================================================");
console.log("📊 PARTICIPATION AGGREGATOR TEST");
console.log("====================================================\n");

// 1. Mock Data Setup
const now = Date.now();
const t0 = new Date(now - 30 * 60000).toISOString(); // 30 mins ago
const t10 = new Date(now - 20 * 60000).toISOString();
const t15 = new Date(now - 15 * 60000).toISOString();
const t20 = new Date(now - 10 * 60000).toISOString();
const t30 = new Date(now).toISOString();

// Create Session
const createSessionStmt = db.prepare('INSERT INTO sessions (channel_id, triggered_by, start_time, end_time, duration_minutes) VALUES (?, ?, ?, ?, ?)');
const res = createSessionStmt.run('agg_channel', 'admin', t0, t30, 30);
const sessionId = res.lastInsertRowid;

// Create Attendance Summary
attendanceSummaryModel.insertMany([
    { session_id: sessionId, user_id: 'userA', status: 'ON_TIME', total_time_seconds: 1800, first_join_time: t0, last_leave_time: t30 },
    { session_id: sessionId, user_id: 'userB', status: 'LATE', total_time_seconds: 1200, first_join_time: t10, last_leave_time: t30 },
    { session_id: sessionId, user_id: 'userC', status: 'LEFT_EARLY', total_time_seconds: 900, first_join_time: t0, last_leave_time: t15 },
]);

// Create Voice Activity (Speaking intervals)
voiceActivityModel.createStart(sessionId, 'userA', t0);
voiceActivityModel.closeOpenInterval(sessionId, 'userA', t10); // 10 mins (600s)

voiceActivityModel.createStart(sessionId, 'userA', t15);
voiceActivityModel.closeOpenInterval(sessionId, 'userA', t20); // 5 mins (300s) -> Total userA: 900s, 2 segments

voiceActivityModel.createStart(sessionId, 'userB', t10);
voiceActivityModel.closeOpenInterval(sessionId, 'userB', t30); // 20 mins (1200s), 1 segment

// Create Interactions
activityEventModel.insertEvent({ type: 'MESSAGE_CREATE', userId: 'userA', channelId: 'agg_channel', sessionId });
activityEventModel.insertEvent({ type: 'MESSAGE_CREATE', userId: 'userA', channelId: 'agg_channel', sessionId });
activityEventModel.insertEvent({ type: 'REACTION_ADD', userId: 'userA', channelId: 'agg_channel', sessionId });
// userA: 2 msgs, 1 reaction

activityEventModel.insertEvent({ type: 'MESSAGE_REPLY', userId: 'userB', channelId: 'agg_channel', sessionId });
activityEventModel.insertEvent({ type: 'MESSAGE_REPLY', userId: 'userB', channelId: 'agg_channel', sessionId });
// userB: 2 replies

activityEventModel.insertEvent({ type: 'REACTION_ADD', userId: 'userC', channelId: 'agg_channel', sessionId });
activityEventModel.insertEvent({ type: 'REACTION_ADD', userId: 'userC', channelId: 'agg_channel', sessionId });
activityEventModel.insertEvent({ type: 'REACTION_ADD', userId: 'userC', channelId: 'agg_channel', sessionId });
// userC: 3 reactions

// Interaction from non-attendee (should be ignored by aggregator)
activityEventModel.insertEvent({ type: 'MESSAGE_CREATE', userId: 'userD', channelId: 'agg_channel', sessionId });


// 2. Run Aggregator
console.log(`[SYS] Running aggregation for session #${sessionId}...`);
const result = aggregateSession(sessionId);

// 3. Print Results
console.log("\n✅ Resulting Object:");
console.log(JSON.stringify(result, null, 2));

// 4. Validate
let pass = true;
const userA = result.users.find(u => u.userId === 'userA');
if (userA.speakingTimeSeconds !== 900 || userA.speakingSegments !== 2 || userA.messageCount !== 2 || userA.reactionCount !== 1) {
    console.error("❌ userA aggregation failed", userA);
    pass = false;
}

const userB = result.users.find(u => u.userId === 'userB');
if (userB.speakingTimeSeconds !== 1200 || userB.speakingSegments !== 1 || userB.replyCount !== 2) {
    console.error("❌ userB aggregation failed", userB);
    pass = false;
}

const userC = result.users.find(u => u.userId === 'userC');
if (userC.reactionCount !== 3 || userC.speakingTimeSeconds !== 0) {
    console.error("❌ userC aggregation failed", userC);
    pass = false;
}

const userD = result.users.find(u => u.userId === 'userD');
if (userD) {
    console.error("❌ userD (non-attendee) should not be in the output");
    pass = false;
}

if (pass) {
    console.log("\n✅ ALL TESTS PASSED");
}
