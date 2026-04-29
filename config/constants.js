module.exports = {
    GRACE_PERIOD_MINUTES: 5,
    EMPTY_CHANNEL_GRACE_MS: 90000, // 1.5 min grace before auto-ending empty channel
    MIN_DURATION_MINUTES: 10,
    DEFAULT_SESSION_DURATION: 60,
    PARTICIPATION_THRESHOLDS: {
        active: 10,
        passive: 1
    }
};