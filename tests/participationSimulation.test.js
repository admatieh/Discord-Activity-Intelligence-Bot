// tests/participationSimulation.test.js
const db = require('../database/db');
const sessionModel = require('../models/sessionModel');
const attendanceSummaryModel = require('../models/attendanceSummaryModel');
const voiceActivityModel = require('../models/voiceActivityModel');
const activityEventModel = require('../modules/activity/activityEventModel');
const participationSummaryModel = require('../models/participationSummaryModel');
const { computeScores } = require('../modules/participation/participationService');

console.log("====================================================");
console.log("📊 PARTICIPATION SCORING TEST");
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
const res = createSessionStmt.run('score_channel', 'admin', t0, t30, 30);
const sessionId = res.lastInsertRowid;

// Create Attendance Summary
attendanceSummaryModel.insertMany([
    // userA: ON_TIME (20), 100% speaking ratio (50 + 5 bonus = 50 clamp), interactions (4 msg=8, 1 rep=3, 1 rxn=1 = 12) -> Total: 20 + 50 + 12 = 82 (HIGHLY_ACTIVE)
    { session_id: sessionId, user_id: 'userA', status: 'ON_TIME', total_time_seconds: 1800, first_join_time: t0, last_leave_time: t30 },
    // userB: LATE (12), 0% speaking ratio (0), 0 interactions (0) -> Total: 12 + 0 + 0 = 12 (LOW)
    { session_id: sessionId, user_id: 'userB', status: 'LATE', total_time_seconds: 1200, first_join_time: t10, last_leave_time: t30 },
    // userC: LEFT_EARLY (8), 50% speaking ratio (25), max interactions (>30 clamp) -> Total: 8 + 25 + 30 = 63 (ACTIVE)
    { session_id: sessionId, user_id: 'userC', status: 'LEFT_EARLY', total_time_seconds: 900, first_join_time: t0, last_leave_time: t15 },
    // userD: ABSENT (0), 0 speaking, 0 interaction -> Total: 0 (INACTIVE)
    { session_id: sessionId, user_id: 'userD', status: 'ABSENT', total_time_seconds: 0, first_join_time: t0, last_leave_time: t0 }
]);

// Voice Activity
// userA speaks 100% (1800s in 3 segments -> get bonus but clamped to 50)
voiceActivityModel.createStart(sessionId, 'userA', t0);
voiceActivityModel.closeOpenInterval(sessionId, 'userA', t10);
voiceActivityModel.createStart(sessionId, 'userA', t10);
voiceActivityModel.closeOpenInterval(sessionId, 'userA', t20);
voiceActivityModel.createStart(sessionId, 'userA', t20);
voiceActivityModel.closeOpenInterval(sessionId, 'userA', t30);

// userC speaks 50% (900s)
voiceActivityModel.createStart(sessionId, 'userC', t0);
voiceActivityModel.closeOpenInterval(sessionId, 'userC', t15);

// Interactions
// userA: 4 msgs (8), 1 reply (3), 1 rxn (1) = 12
for(let i=0; i<4; i++) activityEventModel.insertEvent({ type: 'MESSAGE_CREATE', userId: 'userA', channelId: 'score_channel', sessionId });
activityEventModel.insertEvent({ type: 'MESSAGE_REPLY', userId: 'userA', channelId: 'score_channel', sessionId });
activityEventModel.insertEvent({ type: 'REACTION_ADD', userId: 'userA', channelId: 'score_channel', sessionId });

// userC: massive interaction spam to test clamping (20 replies = 60 pts -> clamps to 30)
for(let i=0; i<20; i++) activityEventModel.insertEvent({ type: 'MESSAGE_REPLY', userId: 'userC', channelId: 'score_channel', sessionId });

// 2. Run Scoring Service
console.log(`[SYS] Running participation scoring for session #${sessionId}...`);
computeScores(sessionId);

// 3. Validate Results
const results = participationSummaryModel.getBySession(sessionId);

console.log("\n✅ DB RESULTS:");
results.forEach(r => {
    console.log(`- ${r.user_id.padEnd(6)} | Score: ${r.score.toString().padEnd(3)} | Speaking: ${r.speaking_score.toString().padEnd(2)} | Interaction: ${r.interaction_score.toString().padEnd(2)} | Attendance: ${r.attendance_score.toString().padEnd(2)} | Label: ${r.label}`);
});

let pass = true;

const a = results.find(u => u.user_id === 'userA');
if (!a || a.score !== 82 || a.label !== 'HIGHLY_ACTIVE') {
    console.error("❌ userA scoring failed", a); pass = false;
}

const b = results.find(u => u.user_id === 'userB');
if (!b || b.score !== 12 || b.label !== 'LOW') {
    console.error("❌ userB scoring failed", b); pass = false;
}

const c = results.find(u => u.user_id === 'userC');
if (!c || c.score !== 63 || c.interaction_score !== 30 || c.label !== 'ACTIVE') {
    console.error("❌ userC scoring failed (clamping might not work)", c); pass = false;
}

const d = results.find(u => u.user_id === 'userD');
if (!d || d.score !== 0 || d.label !== 'INACTIVE') {
    console.error("❌ userD scoring failed", d); pass = false;
}

if (pass) {
    console.log("\n✅ ALL TESTS PASSED");
}
