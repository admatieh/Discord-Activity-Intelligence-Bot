// modules/sessions/sessionService.js
//
// Responsibilities (ONLY):
//   - startSession / endSession / endSessionById / endAllSessions
//   - switchSessionChannel
//   - initSessions (recover timers on bot restart)
//   - Auto-close timer scheduling
//   - Empty-channel grace timer
//   - In-memory session cache (channelId → sessionId)
//
// Emits: SESSION_STARTED, SESSION_ENDED
// Does NOT track attendance. Does NOT know about Discord objects.
// Operates purely on IDs and models.
// ---------------------------------------------------------------------------

const sessionModel = require('../../models/sessionModel');
const voiceEventModel = require('../../models/voiceEventModel');
const attendanceModel = require('../../models/attendanceModel');
const logger = require('../../utils/logger');
const { DEFAULT_SESSION_DURATION, EMPTY_CHANNEL_GRACE_MS } = require('../../config/constants');
const { eventBus, Events } = require('../../core/eventBus');
const { safeEmit } = require('../../utils/safeEmit');
const voiceActivityModel = require('../../models/voiceActivityModel');

// In-memory maps
const activeTimeouts = new Map();      // sessionId → auto-close timeout handle
const emptyGraceTimers = new Map();    // channelId → grace timeout handle
const sessionCache = new Map();        // channelId → sessionId (hot lookup cache)

// ---------------------------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------------------------

function cacheSet(channelId, sessionId) {
    sessionCache.set(channelId, sessionId);
}

function cacheRemove(channelId) {
    sessionCache.delete(channelId);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function getActiveSession(channelId) {
    return sessionModel.getActiveSessionByChannel(channelId);
}

function scheduleAutoClose(sessionId, delayMs) {
    if (delayMs <= 0) {
        endSessionById(sessionId, 'Auto-closed (timed out)');
        return;
    }

    const handle = setTimeout(() => {
        try {
            endSessionById(sessionId, 'Auto-closed (timed out)');
        } catch (error) {
            logger.error(`Auto-close trigger error for session #${sessionId}: ${error.message}`, {
                sessionId,
                error: error.message
            });
        }
    }, delayMs);

    activeTimeouts.set(sessionId, handle);
}

// ---------------------------------------------------------------------------
// startSession
// ---------------------------------------------------------------------------

function startSession(voiceChannelId, triggeredBy, options = {}) {
    const { durationMinutes = DEFAULT_SESSION_DURATION } = options;

    try {
        if (typeof voiceChannelId !== 'string' || voiceChannelId.length === 0) {
            return { success: false, message: '❌ Invalid voice channel ID.' };
        }

        if (typeof durationMinutes !== 'number' || durationMinutes <= 0 || durationMinutes > 1440) {
            return { success: false, message: '❌ Duration must be between 1 and 1440 minutes.' };
        }

        const active = getActiveSession(voiceChannelId);
        if (active) {
            return {
                success: false,
                message: '⚠️ A session is already running in your voice channel.'
            };
        }

        const startTime = new Date();
        const autoEndAt = new Date(startTime.getTime() + durationMinutes * 60000);
        const autoEndAtISO = autoEndAt.toISOString();

        const sessionId = sessionModel.createSession({
            channelId: voiceChannelId,
            triggeredBy,
            durationMinutes,
            autoEndAt: autoEndAtISO
        });

        if (!sessionId) {
            return { success: false, message: '❌ Failed to create session.' };
        }

        // Update cache
        cacheSet(voiceChannelId, sessionId);

        scheduleAutoClose(sessionId, durationMinutes * 60000);

        logger.log(
            `Session #${sessionId} started by ${triggeredBy} in channel ${voiceChannelId} for ${durationMinutes} min.`,
            { sessionId, voiceChannelId, triggeredBy, durationMinutes }
        );

        // Emit SESSION_STARTED
        safeEmit(eventBus, Events.SESSION_STARTED, {
            userId: triggeredBy,
            channelId: voiceChannelId,
            sessionId,
            timestamp: startTime.toISOString()
        });

        return {
            success: true,
            message: `✅ Voice session started for ${durationMinutes} minutes. Tracking is now active.`,
            sessionId
        };
    } catch (error) {
        logger.error(`startSession error: ${error.message}`, { voiceChannelId, error: error.message });
        return { success: false, message: '❌ An error occurred while starting the session.' };
    }
}

// ---------------------------------------------------------------------------
// endSession (by channel)
// ---------------------------------------------------------------------------

function endSession(voiceChannelId) {
    try {
        const active = getActiveSession(voiceChannelId);
        if (!active) {
            return { success: false, message: '❌ No active session to end in that voice channel.' };
        }
        return endSessionById(active.id, 'Manual end');
    } catch (error) {
        logger.error(`endSession error: ${error.message}`, { voiceChannelId, error: error.message });
        return { success: false, message: '❌ An error occurred while ending the session.' };
    }
}

// ---------------------------------------------------------------------------
// endSessionById
// ---------------------------------------------------------------------------

function endSessionById(sessionId, reason = 'Manual end') {
    try {
        const session = sessionModel.getSessionById(sessionId);

        if (!session) {
            return { success: false, message: 'Session not found.' };
        }
        if (session.end_time) {
            return { success: false, message: 'Session has already ended.' };
        }

        // Clear auto-close timer
        if (activeTimeouts.has(sessionId)) {
            clearTimeout(activeTimeouts.get(sessionId));
            activeTimeouts.delete(sessionId);
        }

        // Clear empty-channel grace timer
        cancelEmptyGrace(session.channel_id);

        // Close all open voice events
        const now = new Date().toISOString();
        const closedEvents = voiceEventModel.closeAllOpenEvents(sessionId, now);

        // Mark session as ended
        const ended = sessionModel.endSession(sessionId);
        if (!ended) {
            return { success: false, message: '❌ Failed to end session.' };
        }

        // Remove from cache
        cacheRemove(session.channel_id);

        logger.log(`Session #${sessionId} ended (${reason}). Closed ${closedEvents} open voice events.`, {
            sessionId,
            reason,
            closedEvents
        });

        // Emit SESSION_ENDED
        safeEmit(eventBus, Events.SESSION_ENDED, {
            userId: session.triggered_by,
            channelId: session.channel_id,
            sessionId,
            timestamp: now
        });

        return {
            success: true,
            message: `🧾 Session #${sessionId} ended successfully.`,
            sessionId
        };
    } catch (error) {
        logger.error(`endSessionById error: ${error.message}`, { sessionId, error: error.message });
        return { success: false, message: '❌ Error ending session.' };
    }
}

// ---------------------------------------------------------------------------
// endAllSessions
// ---------------------------------------------------------------------------

function endAllSessions() {
    try {
        const activeSessions = sessionModel.getActiveSessions();
        if (activeSessions.length === 0) {
            return { success: false, message: '❌ No active sessions to end.' };
        }

        let endedCount = 0;
        for (const session of activeSessions) {
            const result = endSessionById(session.id, 'Manual end (end-all)');
            if (result.success) endedCount++;
        }

        logger.log(`Ended ${endedCount} sessions via end-all.`, { endedCount });

        return {
            success: true,
            message: `🧾 Ended ${endedCount} active session(s).`
        };
    } catch (error) {
        logger.error(`endAllSessions error: ${error.message}`, { error: error.message });
        return { success: false, message: '❌ Error ending sessions.' };
    }
}

// ---------------------------------------------------------------------------
// switchSessionChannel
// ---------------------------------------------------------------------------

function switchSessionChannel(sessionId, newChannelId) {
    try {
        const session = sessionModel.getSessionById(sessionId);
        if (!session) {
            return { success: false, message: '❌ Session not found.' };
        }
        if (session.end_time) {
            return { success: false, message: '❌ Session has already ended.' };
        }

        // Check no active session on the target channel already
        const existing = getActiveSession(newChannelId);
        if (existing && existing.id !== sessionId) {
            return { success: false, message: '❌ Another session is already active in that channel.' };
        }

        const oldChannelId = session.channel_id;
        const now = new Date().toISOString();

        // Close open voice events from old channel
        voiceEventModel.closeAllOpenEvents(sessionId, now);

        // Cancel empty grace on old channel
        cancelEmptyGrace(oldChannelId);

        // Update channel in DB
        const updated = sessionModel.updateChannelId(sessionId, newChannelId);
        if (!updated) {
            return { success: false, message: '❌ Failed to switch channel.' };
        }

        // Update cache: remove old, add new
        cacheRemove(oldChannelId);
        cacheSet(newChannelId, sessionId);

        logger.log(`Session #${sessionId} switched from channel ${oldChannelId} to ${newChannelId}.`, {
            sessionId,
            oldChannelId,
            newChannelId
        });

        return {
            success: true,
            message: `✅ Session #${sessionId} moved to new channel. Tracking continues.`,
            sessionId
        };
    } catch (error) {
        logger.error(`switchSessionChannel error: ${error.message}`, { sessionId, newChannelId, error: error.message });
        return { success: false, message: '❌ Error switching channel.' };
    }
}

// ---------------------------------------------------------------------------
// Empty-channel grace timer
// ---------------------------------------------------------------------------

function startEmptyGrace(channelId) {
    try {
        // Already has a grace timer — don't duplicate
        if (emptyGraceTimers.has(channelId)) return;

        if (!isSessionActive(channelId)) return;

        const handle = setTimeout(() => {
            try {
                emptyGraceTimers.delete(channelId);

                // Re-check session is still active
                const session = getActiveSession(channelId);
                if (!session) return;

                endSessionById(session.id, 'Auto-ended (empty channel)');
            } catch (error) {
                logger.error(`Empty grace auto-end error for channel ${channelId}: ${error.message}`);
            }
        }, EMPTY_CHANNEL_GRACE_MS);

        emptyGraceTimers.set(channelId, handle);

        logger.log(`Empty-channel grace started for channel ${channelId} (${EMPTY_CHANNEL_GRACE_MS / 1000}s).`, {
            channelId
        });
    } catch (error) {
        logger.error(`startEmptyGrace error: ${error.message}`, { channelId });
    }
}

function cancelEmptyGrace(channelId) {
    if (emptyGraceTimers.has(channelId)) {
        clearTimeout(emptyGraceTimers.get(channelId));
        emptyGraceTimers.delete(channelId);
        logger.log(`Empty-channel grace cancelled for channel ${channelId}.`, { channelId });
    }
}

function ensureChannelState(channel) {
    try {
        if (!channel || !channel.members) return;
        const humanCount = channel.members.filter(m => !m.user.bot).size;
        if (humanCount === 0) {
            startEmptyGrace(channel.id);
        }
    } catch (error) {
        logger.error(`ensureChannelState error: ${error.message}`, { channelId: channel?.id });
    }
}

// ---------------------------------------------------------------------------
// Bootstrapping
// ---------------------------------------------------------------------------

function bootstrapChannelUsers(channel, sessionId) {
    try {
        if (!channel || !channel.members) return;
        
        const now = new Date().toISOString();
        let count = 0;
        
        for (const [, member] of channel.members) {
            if (member.user.bot) continue;
            
            const isMuted = member.voice?.selfMute || member.voice?.serverMute || false;
            
            // Prevent duplicates (check active voice intervals before emitting)
            const openInterval = voiceActivityModel.getOpenInterval(sessionId, member.id);
            const openEvent = voiceEventModel.getOpenEvent(sessionId, member.id);
            
            if (!openInterval && !openEvent) {
                safeEmit(eventBus, Events.VOICE_JOIN, {
                    userId: member.id,
                    channelId: channel.id,
                    sessionId: sessionId,
                    timestamp: now,
                    isMuted
                });
                count++;
            }
        }
        
        if (count > 0) {
            logger.log(`Bootstrapped ${count} users for session #${sessionId} in channel ${channel.id}.`);
        }
    } catch (error) {
        logger.error(`bootstrapChannelUsers error: ${error.message}`);
    }
}

// ---------------------------------------------------------------------------
// initSessions
// ---------------------------------------------------------------------------

function initSessions() {
    try {
        const now = new Date().toISOString();

        const expiredSessions = sessionModel.getExpiredSessions(now);
        for (const { id } of expiredSessions) {
            endSessionById(id, 'Auto-closed (expired during downtime)');
        }

        const activeSessions = sessionModel
            .getActiveSessions()
            .filter((s) => s.auto_end_at >= now);

        for (const session of activeSessions) {
            const remainingMs = new Date(session.auto_end_at).getTime() - Date.now();

            // Populate cache for surviving sessions
            cacheSet(session.channel_id, session.id);

            scheduleAutoClose(session.id, remainingMs);
            logger.log(
                `Restarted timer for Session #${session.id} (${Math.round(remainingMs / 60000)} min remaining)`,
                { sessionId: session.id, remainingMs }
            );
        }

        logger.log(
            `SessionManager initialized. Cleaned ${expiredSessions.length} expired, restarted ${activeSessions.length} timers.`
        );
    } catch (error) {
        logger.error(`initSessions error: ${error.message}`, { error: error.message });
    }
}

// ---------------------------------------------------------------------------
// Query helpers (use cache for hot path)
// ---------------------------------------------------------------------------

function isSessionActive(channelId) {
    // Fast path: check cache first
    if (sessionCache.has(channelId)) return true;
    // Fallback: check DB (and populate cache if found)
    const session = getActiveSession(channelId);
    if (session) {
        cacheSet(channelId, session.id);
        return true;
    }
    return false;
}

function getSessionId(channelId) {
    // Fast path: cache
    if (sessionCache.has(channelId)) return sessionCache.get(channelId);
    // Fallback: DB
    const session = getActiveSession(channelId);
    if (session) {
        cacheSet(channelId, session.id);
        return session.id;
    }
    return null;
}

function getSessionInfo(sessionId) {
    try {
        const session = sessionModel.getSessionById(sessionId);
        if (!session) return null;

        const attendeeCount = attendanceModel.getAttendeeCount(sessionId);
        const eventCount = voiceEventModel.getEventCountBySession(sessionId);

        return { ...session, attendeeCount, eventCount };
    } catch (error) {
        logger.error(`getSessionInfo error: ${error.message}`, { sessionId });
        return null;
    }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
    startSession,
    endSession,
    endSessionById,
    endAllSessions,
    switchSessionChannel,
    startEmptyGrace,
    cancelEmptyGrace,
    isSessionActive,
    getSessionId,
    getSessionInfo,
    initSessions,
    bootstrapChannelUsers,
    ensureChannelState
};
