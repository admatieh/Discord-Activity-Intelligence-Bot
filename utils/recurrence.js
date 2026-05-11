// utils/recurrence.js
//
// Utility functions for recurring session scheduling.
// Handles weekly recurrence rules with timezone-aware next-occurrence calculation.
//
// Supported day codes: MO, TU, WE, TH, FR, SA, SU
// Recurrence rule format (JSON stored as TEXT in DB):
//   { frequency: "weekly", daysOfWeek: ["MO","TU","WE","TH"], time: "09:00", timezone: "Asia/Beirut" }
// ---------------------------------------------------------------------------

const DEFAULT_TIMEZONE = 'Asia/Beirut';
const DEFAULT_DURATION_MINUTES = 60;

// Day code → JS getDay() index (Sunday = 0)
const DAY_CODE_TO_JS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
const JS_TO_DAY_CODE = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

// Human-readable short names for display
const DAY_CODE_TO_SHORT = { MO: 'Mon', TU: 'Tue', WE: 'Wed', TH: 'Thu', FR: 'Fri', SA: 'Sat', SU: 'Sun' };

/**
 * Parse a recurrence rule from its DB TEXT representation.
 * Accepts both raw JSON string and a plain object.
 * @param {string|object} ruleText
 * @returns {{ ok: boolean, rule?: object, error?: string }}
 */
function parseRecurrenceRule(ruleText) {
    if (!ruleText) return { ok: false, error: 'No recurrence rule provided' };

    let rule;
    if (typeof ruleText === 'string') {
        try {
            rule = JSON.parse(ruleText);
        } catch {
            return { ok: false, error: 'Recurrence rule is not valid JSON' };
        }
    } else if (typeof ruleText === 'object' && ruleText !== null) {
        rule = ruleText;
    } else {
        return { ok: false, error: 'Recurrence rule must be a JSON string or object' };
    }

    // Validate
    if (rule.frequency !== 'weekly') {
        return { ok: false, error: `Unsupported frequency: ${rule.frequency}. Only "weekly" is supported.` };
    }
    if (!Array.isArray(rule.daysOfWeek) || rule.daysOfWeek.length === 0) {
        return { ok: false, error: 'daysOfWeek must be a non-empty array' };
    }
    for (const d of rule.daysOfWeek) {
        if (!DAY_CODE_TO_JS.hasOwnProperty(d)) {
            return { ok: false, error: `Invalid day code: ${d}. Valid: MO, TU, WE, TH, FR, SA, SU` };
        }
    }
    if (!rule.time || !/^\d{2}:\d{2}$/.test(rule.time)) {
        return { ok: false, error: 'time must be in HH:mm format (e.g. "09:00")' };
    }
    const [hh, mm] = rule.time.split(':').map(Number);
    if (hh < 0 || hh > 23 || mm < 0 || mm > 59) {
        return { ok: false, error: 'time values out of range (HH: 0-23, mm: 0-59)' };
    }

    return {
        ok: true,
        rule: {
            frequency: 'weekly',
            daysOfWeek: rule.daysOfWeek,
            time: rule.time,
            timezone: rule.timezone || DEFAULT_TIMEZONE
        }
    };
}

/**
 * Build a recurrence rule object ready for JSON.stringify storage.
 * @param {{ daysOfWeek: string[], time: string, timezone?: string }} input
 * @returns {{ ok: boolean, rule?: object, error?: string }}
 */
function buildWeeklyRecurrenceRule({ daysOfWeek, time, timezone }) {
    const rule = {
        frequency: 'weekly',
        daysOfWeek,
        time,
        timezone: timezone || DEFAULT_TIMEZONE
    };
    return parseRecurrenceRule(rule); // Validates and normalises
}

/**
 * Get the current local wall-clock date/time components in a given IANA timezone.
 * Uses Intl.DateTimeFormat — no external deps.
 * @param {Date} date - UTC date to convert
 * @param {string} timezone - IANA tz string
 * @returns {{ year, month (1-12), day, hour, minute, second, weekday (0=Sun) }}
 */
function getLocalComponents(date, timezone) {
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit',
        hour12: false
    });

    const parts = fmt.formatToParts(date);
    const get = (t) => parseInt(parts.find(p => p.type === t)?.value ?? '0', 10);

    // Weekday separately
    const wdFmt = new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'short' });
    const wdStr = wdFmt.format(date); // "Mon", "Tue", etc.
    const WEEKDAY_MAP = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

    return {
        year: get('year'),
        month: get('month'),
        day: get('day'),
        hour: get('hour') % 24, // handle 24 → 0
        minute: get('minute'),
        second: get('second'),
        weekday: WEEKDAY_MAP[wdStr] ?? 0
    };
}

/**
 * Convert local wall-clock date components in a timezone to UTC Date.
 * @param {number} year
 * @param {number} month - 1-indexed
 * @param {number} day
 * @param {number} hour
 * @param {number} minute
 * @param {string} timezone
 * @returns {Date} UTC Date
 */
function localToUtc(year, month, day, hour, minute, timezone) {
    // We construct an ISO string and interpret it as if it's in the target timezone.
    // We use a reference approach: find the UTC offset via Intl comparison.
    // Build candidate date string (naive, ignoring DST for iteration start)
    const pad = (n) => String(n).padStart(2, '0');
    const candidate = new Date(`${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${pad(minute)}:00.000Z`);

    // We binary-search the UTC moment whose local wall-clock in `timezone` matches
    // our target. For weekly scheduling the ±offset range is ±14 hours = 50400 seconds.
    // A simple approach: try UTC offset estimate, then correct.
    const estimatedOffset = getUtcOffsetMinutes(candidate, timezone);
    const adjusted = new Date(candidate.getTime() - estimatedOffset * 60 * 1000);
    
    // Verify and nudge by DST boundary (±1h)
    const localCheck = getLocalComponents(adjusted, timezone);
    const diffMinutes = (hour * 60 + minute) - (localCheck.hour * 60 + localCheck.minute);
    if (diffMinutes !== 0) {
        return new Date(adjusted.getTime() - diffMinutes * 60 * 1000);
    }
    return adjusted;
}

/**
 * Get UTC offset in minutes for a timezone at a given UTC moment.
 * Positive = timezone is ahead of UTC (e.g. Asia/Beirut is +180 in winter).
 */
function getUtcOffsetMinutes(utcDate, timezone) {
    const localComp = getLocalComponents(utcDate, timezone);
    const pad = (n) => String(n).padStart(2, '0');
    const naiveUtcEquiv = Date.UTC(localComp.year, localComp.month - 1, localComp.day, localComp.hour, localComp.minute, localComp.second);
    return (naiveUtcEquiv - utcDate.getTime()) / 60000;
}

/**
 * Calculate the next occurrence of a weekly recurrence rule after `fromDate`.
 * Returns a UTC Date representing the next trigger time.
 * @param {object|string} rule - parsed rule object or raw JSON string
 * @param {Date} [fromDate=new Date()] - start searching from this UTC date
 * @returns {{ ok: boolean, nextDate?: Date, error?: string }}
 */
function getNextOccurrence(rule, fromDate) {
    const parsed = typeof rule === 'string' || (typeof rule === 'object' && rule.frequency === undefined)
        ? parseRecurrenceRule(rule)
        : { ok: true, rule };

    if (!parsed.ok) return { ok: false, error: parsed.error };

    const r = parsed.rule || rule;
    const tz = r.timezone || DEFAULT_TIMEZONE;
    const [targetHour, targetMinute] = r.time.split(':').map(Number);
    const selectedJsDays = r.daysOfWeek.map(d => DAY_CODE_TO_JS[d]).sort((a, b) => a - b);

    const base = fromDate instanceof Date ? fromDate : new Date();
    const local = getLocalComponents(base, tz);

    // Search up to 8 days ahead to find next matching slot
    for (let dayOffset = 0; dayOffset <= 7; dayOffset++) {
        // Build candidate local date
        const candidateUtc = new Date(base.getTime() + dayOffset * 86400 * 1000);
        const candLocal = getLocalComponents(candidateUtc, tz);
        const candWeekday = candLocal.weekday;

        if (!selectedJsDays.includes(candWeekday)) continue;

        // Build UTC for target local time on this date
        const targetUtc = localToUtc(candLocal.year, candLocal.month, candLocal.day, targetHour, targetMinute, tz);

        // Must be strictly after fromDate (not same second)
        if (targetUtc.getTime() > base.getTime()) {
            return { ok: true, nextDate: targetUtc };
        }
        // Same day but target time already passed → keep searching
    }

    return { ok: false, error: 'Could not find next occurrence within 8 days (check daysOfWeek)' };
}

/**
 * Format a recurrence rule for human display.
 * @param {object|string} rule
 * @returns {string}
 */
function formatRecurrenceRuleHuman(rule) {
    const parsed = parseRecurrenceRule(rule);
    if (!parsed.ok) return 'Invalid recurrence rule';
    const r = parsed.rule;
    const days = r.daysOfWeek.map(d => DAY_CODE_TO_SHORT[d] || d).join(', ');
    const [h, m] = r.time.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 || 12;
    const timeStr = `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
    return `${days} at ${timeStr} ${r.timezone}`;
}

/**
 * Check if a scheduled_for time is too old to run (missed run).
 * @param {string|Date} scheduledFor - UTC ISO string or Date
 * @param {number} graceMinutes
 * @returns {boolean} true if it's too old (missed)
 */
function isMissedRunTooOld(scheduledFor, graceMinutes) {
    const scheduled = scheduledFor instanceof Date ? scheduledFor : new Date(scheduledFor);
    if (isNaN(scheduled.getTime())) return true; // invalid date = treat as missed
    const ageMs = Date.now() - scheduled.getTime();
    return ageMs > graceMinutes * 60 * 1000;
}

/**
 * Validate raw recurring session input from API/command.
 * @param {{ guildId, voiceChannelId, daysOfWeek, time, timezone, durationMinutes }} input
 * @returns {{ ok: boolean, error?: string }}
 */
function validateRecurringSessionInput({ guildId, voiceChannelId, daysOfWeek, time, timezone, durationMinutes }) {
    if (!guildId) return { ok: false, error: 'guildId is required' };
    if (!voiceChannelId) return { ok: false, error: 'voiceChannelId is required' };
    if (!Array.isArray(daysOfWeek) || daysOfWeek.length === 0) return { ok: false, error: 'daysOfWeek must be a non-empty array' };
    if (!time) return { ok: false, error: 'time is required (HH:mm)' };
    if (durationMinutes !== undefined && (isNaN(Number(durationMinutes)) || Number(durationMinutes) <= 0)) {
        return { ok: false, error: 'durationMinutes must be a positive number' };
    }

    const ruleCheck = buildWeeklyRecurrenceRule({ daysOfWeek, time, timezone: timezone || DEFAULT_TIMEZONE });
    if (!ruleCheck.ok) return ruleCheck;

    return { ok: true };
}

module.exports = {
    DEFAULT_TIMEZONE,
    DEFAULT_DURATION_MINUTES,
    DAY_CODE_TO_JS,
    DAY_CODE_TO_SHORT,
    parseRecurrenceRule,
    buildWeeklyRecurrenceRule,
    getNextOccurrence,
    formatRecurrenceRuleHuman,
    isMissedRunTooOld,
    validateRecurringSessionInput
};
