// modules/activity/activityLogger.js
//
// Listens to voice events and logs them into the activity_events table.
// This is the ONLY place activity_events is actively written to.
// ---------------------------------------------------------------------------

const { eventBus, Events } = require('../../core/eventBus');
const activityEventModel = require('./activityEventModel');
const logger = require('../../utils/logger');

let initialized = false;

function onVoiceJoin({ userId, channelId, sessionId, timestamp }) {
    try {
        activityEventModel.insertEvent({
            type: Events.VOICE_JOIN,
            userId,
            channelId,
            sessionId: sessionId || null
        });
    } catch (error) {
        logger.error(`activityLogger VOICE_JOIN error: ${error.message}`);
    }
}

function onVoiceLeave({ userId, channelId, sessionId, timestamp }) {
    try {
        activityEventModel.insertEvent({
            type: Events.VOICE_LEAVE,
            userId,
            channelId,
            sessionId: sessionId || null
        });
    } catch (error) {
        logger.error(`activityLogger VOICE_LEAVE error: ${error.message}`);
    }
}

function register() {
    if (initialized) return;
    initialized = true;

    eventBus.on(Events.VOICE_JOIN, (payload) => {
        try { onVoiceJoin(payload); } catch (err) {
            logger.error(`activityLogger VOICE_JOIN listener crash: ${err.message}`);
        }
    });

    eventBus.on(Events.VOICE_LEAVE, (payload) => {
        try { onVoiceLeave(payload); } catch (err) {
            logger.error(`activityLogger VOICE_LEAVE listener crash: ${err.message}`);
        }
    });

    eventBus.on(Events.VOICE_MUTE, (payload) => {
        try {
            activityEventModel.insertEvent({
                type: Events.VOICE_MUTE,
                userId: payload.userId,
                channelId: payload.channelId,
                sessionId: payload.sessionId || null
            });
        } catch (err) {
            logger.error(`activityLogger VOICE_MUTE listener crash: ${err.message}`);
        }
    });

    eventBus.on(Events.VOICE_UNMUTE, (payload) => {
        try {
            activityEventModel.insertEvent({
                type: Events.VOICE_UNMUTE,
                userId: payload.userId,
                channelId: payload.channelId,
                sessionId: payload.sessionId || null
            });
        } catch (err) {
            logger.error(`activityLogger VOICE_UNMUTE listener crash: ${err.message}`);
        }
    });

    eventBus.on(Events.MESSAGE_CREATE, (payload) => {
        try {
            activityEventModel.insertEvent({
                type: Events.MESSAGE_CREATE,
                userId: payload.userId,
                channelId: payload.channelId,
                sessionId: payload.sessionId,
                metadata: payload.metadata || null
            });
        } catch (err) {
            logger.error(`activityLogger MESSAGE_CREATE listener crash: ${err.message}`);
        }
    });

    eventBus.on(Events.MESSAGE_REPLY, (payload) => {
        try {
            activityEventModel.insertEvent({
                type: Events.MESSAGE_REPLY,
                userId: payload.userId,
                channelId: payload.channelId,
                sessionId: payload.sessionId,
                metadata: payload.metadata || null
            });
        } catch (err) {
            logger.error(`activityLogger MESSAGE_REPLY listener crash: ${err.message}`);
        }
    });

    eventBus.on(Events.REACTION_ADD, (payload) => {
        try {
            activityEventModel.insertEvent({
                type: Events.REACTION_ADD,
                userId: payload.userId,
                channelId: payload.channelId,
                sessionId: payload.sessionId,
                metadata: payload.metadata || null
            });
        } catch (err) {
            logger.error(`activityLogger REACTION_ADD listener crash: ${err.message}`);
        }
    });

    logger.log('ActivityLogger registered on event bus.');
}

module.exports = { register };
