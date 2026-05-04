// tests/interactionSimulation.test.js
const sessionService = require('../modules/sessions/sessionService');
const { eventBus, Events } = require('../core/eventBus');
const interactionService = require('../modules/interaction/interactionService');
const db = require('../database/db');

// Initialize modules
require('../modules/index').registerAll();

const channelId = 'sim_interaction_' + Date.now();
const adminId = 'admin_user';

function simulate() {
    console.log(`====================================================`);
    console.log(`💬 INTERACTION SIMULATION STARTED`);
    console.log(`====================================================\n`);

    // 1. Create Session
    const startRes = sessionService.startSession(channelId, adminId, { durationMinutes: 10 });
    const sessionId = startRes.sessionId;
    console.log(`[SYS] Session #${sessionId} created in channel ${channelId}.\n`);

    function join(userId, min) {
        console.log(`[${min.toString().padStart(2, '0')}m] ${userId} joins`);
        eventBus.emit(Events.VOICE_JOIN, {
            userId,
            channelId,
            sessionId: sessionService.getSessionId(channelId),
            timestamp: new Date().toISOString()
        });
    }

    // 1.5 Simulate Voice Joins (Attendance Creation)
    join('user_A', 0);
    join('user_B', 0);
    join('user_C', 0);
    console.log('');

    // 2. Simulate Discord Events (Mocking Discord objects)
    const mockMessage = {
        id: 'msg_100',
        author: { id: 'user_A', bot: false },
        channelId: channelId,
        content: 'Hello world!',
        reference: null
    };

    const mockReply = {
        id: 'msg_101',
        author: { id: 'user_B', bot: false },
        channelId: channelId,
        content: 'Hi User A!',
        reference: { messageId: 'msg_100' }
    };

    const mockReaction = {
        message: { id: 'msg_100', channelId: channelId },
        emoji: { name: '👍' }
    };

    const mockReactionUser = { id: 'user_C', bot: false };

    // Emit normal message
    console.log(`[user_A] Sends normal message`);
    interactionService.handleMessageCreate(mockMessage);

    // Emit reply message
    console.log(`[user_B] Sends reply`);
    interactionService.handleMessageCreate(mockReply);

    // Emit reaction
    console.log(`[user_C] Adds reaction`);
    interactionService.handleReactionAdd(mockReaction, mockReactionUser);

    // Test a message outside of a session (should be ignored)
    const outOfSessionMessage = {
        id: 'msg_102',
        author: { id: 'user_A', bot: false },
        channelId: 'other_channel',
        content: 'Should be ignored',
        reference: null
    };
    interactionService.handleMessageCreate(outOfSessionMessage);

    // Test a message from a non-attendee inside the session (should be rejected)
    console.log(`[user_D] Sends message (Non-attendee)`);
    const nonAttendeeMessage = {
        id: 'msg_103',
        author: { id: 'user_D', bot: false },
        channelId: channelId,
        content: 'I did not join voice!',
        reference: null
    };
    interactionService.handleMessageCreate(nonAttendeeMessage);

    // 3. End Session
    console.log(`\n[SYS] Session #${sessionId} ends\n`);
    sessionService.endSession(channelId);

    // Wait a tick for eventBus processing
    setTimeout(() => validate(sessionId), 100);
}

function validate(sessionId) {
    console.log(`====================================================`);
    console.log(`📊 DB RESULTS`);
    console.log(`====================================================\n`);

    const events = db.prepare(`SELECT type, user_id, session_id, metadata FROM activity_events WHERE session_id = ? ORDER BY id ASC`).all(sessionId);

    if (events.length === 0) {
        console.log(`❌ FAIL: No events recorded for session ${sessionId}`);
    } else {
        events.forEach(e => {
            console.log(`- Type: ${e.type.padEnd(16)} | User: ${e.user_id.padEnd(8)} | Session: ${e.session_id} | Metadata: ${e.metadata}`);
        });

        const hasMsg = events.some(e => e.type === Events.MESSAGE_CREATE);
        const hasReply = events.some(e => e.type === Events.MESSAGE_REPLY);
        const hasReact = events.some(e => e.type === Events.REACTION_ADD);

        console.log(`\nValidation:`);
        console.log(`MESSAGE_CREATE found: ${hasMsg ? '✅' : '❌'}`);
        console.log(`MESSAGE_REPLY  found: ${hasReply ? '✅' : '❌'}`);
        console.log(`REACTION_ADD   found: ${hasReact ? '✅' : '❌'}`);

        const invalid = db.prepare(`
            SELECT DISTINCT user_id 
            FROM activity_events 
            WHERE session_id = ?
            AND user_id NOT IN (
                SELECT user_id FROM attendees WHERE session_id = ?
            )
        `).all(sessionId, sessionId);

        if (invalid.length > 0) {
            console.error('\n❌ Found interactions from non-attendees:', invalid);
        } else {
            console.log('\n✅ All interactions belong to valid attendees');
        }
    }
}

simulate();
