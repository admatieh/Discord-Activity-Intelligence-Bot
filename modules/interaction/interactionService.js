// modules/interaction/interactionService.js
//
// Responsibilities:
//   - Capture user interaction (messages, replies, reactions) during active sessions.
//   - Emit corresponding internal events via eventBus.
// ---------------------------------------------------------------------------

const { eventBus, Events } = require('../../core/eventBus');
const { safeEmit } = require('../../utils/safeEmit');
const sessionService = require('../sessions/sessionService');
const attendanceModel = require('../../models/attendanceModel');
const logger = require('../../utils/logger');

let initialized = false;

function handleMessageCreate(message) {
    try {
        if (message.author.bot) return;

        const channelId = message.channelId;
        
        if (!sessionService.isSessionActive(channelId)) return;
        const sessionId = sessionService.getSessionId(channelId);
        if (!sessionId) return;

        const userId = message.author.id;

        const isAttendee = attendanceModel.isUserAttendee(sessionId, userId);
        if (!isAttendee) {
            logger.warn(`Ignoring interaction from non-attendee ${userId} in session #${sessionId}`, {
                userId,
                sessionId,
                event: 'interaction_rejected'
            });
            return;
        }

        const timestamp = new Date().toISOString();
        const isReply = !!message.reference;

        const payload = {
            userId,
            channelId,
            sessionId,
            timestamp,
            metadata: JSON.stringify({ messageId: message.id, isReply })
        };

        if (isReply) {
            safeEmit(eventBus, Events.MESSAGE_REPLY, payload);
        } else {
            safeEmit(eventBus, Events.MESSAGE_CREATE, payload);
        }
    } catch (error) {
        logger.error(`interactionService.handleMessageCreate error: ${error.message}`);
    }
}

function handleReactionAdd(reaction, user) {
    try {
        if (user.bot) return;

        const channelId = reaction.message.channelId;
        
        if (!sessionService.isSessionActive(channelId)) return;
        const sessionId = sessionService.getSessionId(channelId);
        if (!sessionId) return;

        const userId = user.id;

        const isAttendee = attendanceModel.isUserAttendee(sessionId, userId);
        if (!isAttendee) {
            logger.warn(`Ignoring interaction from non-attendee ${userId} in session #${sessionId}`, {
                userId,
                sessionId,
                event: 'interaction_rejected'
            });
            return;
        }

        const timestamp = new Date().toISOString();

        const payload = {
            userId,
            channelId,
            sessionId,
            timestamp,
            metadata: JSON.stringify({ messageId: reaction.message.id, emoji: reaction.emoji.name })
        };

        safeEmit(eventBus, Events.REACTION_ADD, payload);
    } catch (error) {
        logger.error(`interactionService.handleReactionAdd error: ${error.message}`);
    }
}

function register() {
    if (initialized) return;
    initialized = true;
    logger.log('InteractionService registered.');
}

module.exports = {
    handleMessageCreate,
    handleReactionAdd,
    register
};
