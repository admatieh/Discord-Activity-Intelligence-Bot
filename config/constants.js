module.exports = {
    GRACE_PERIOD_MINUTES: 5,
    EMPTY_CHANNEL_GRACE_MS: 90000, // 1.5 min grace before auto-ending empty channel
    MIN_DURATION_MINUTES: 10,
    DEFAULT_SESSION_DURATION: 60,
    PARTICIPATION_THRESHOLDS: {
        active: 10,
        passive: 1
    },
    ATTENDANCE: {
        LATE_THRESHOLD_MIN: 5,         // Minutes after session start to be considered late
        MIN_ATTENDANCE_RATIO: 0.5,     // Minimum fraction of session duration to not be marked absent
        GRACE_REJOIN_MIN: 3            // Grace period for brief disconnects (unused for now, future-proof)
    }
};