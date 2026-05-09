// utils/parseScheduleTime.js

const chrono = require('chrono-node');

/**
 * Parses natural language and relative time strings into UTC ISO dates.
 * 
 * @param {string} input - The input time string (e.g., "today 10:10 AM", "in 30m", "2026-05-09T10:10:00")
 * @param {Object} options
 * @param {string} [options.timezone='Asia/Beirut'] - The timezone to resolve absolute times against
 * @returns {Object} { ok, scheduledFor, originalInput, timezone, displayTime, error, examples }
 */
function parseScheduleTime(input, options = {}) {
    const timezone = options.timezone || 'Asia/Beirut';
    
    // Quick sanitization
    if (typeof input !== 'string' || !input.trim()) {
        return {
            ok: false,
            error: "No time provided.",
            examples: ["today 10:10 AM", "tomorrow 2:30 PM", "in 30m", "in 1h 30m"]
        };
    }

    const cleanInput = input.trim();
    const refDate = new Date();

    // Support for abbreviations like "1h", "30m", "in 1h 30m"
    // Chrono handles "in 30 minutes" well, but might struggle with pure "30m" or "in 30m" depending on context.
    // Let's normalize common shorthand.
    let normalizedInput = cleanInput
        .replace(/\b(\d+)\s*m\b/gi, '$1 minutes')
        .replace(/\b(\d+)\s*h\b/gi, '$1 hours');
        
    // If user just typed "30m" or "1h", prefix with "in "
    if (/^\d+\s*(minutes|hours)$/i.test(normalizedInput)) {
        normalizedInput = 'in ' + normalizedInput;
    }

    // Try parsing with chrono
    let parsedDate = chrono.parseDate(normalizedInput, refDate, { timezone });

    // Fallback if chrono fails: check if it's already a valid ISO string
    if (!parsedDate) {
        const fallbackDate = new Date(cleanInput);
        if (!isNaN(fallbackDate.getTime())) {
            parsedDate = fallbackDate;
        }
    }

    if (!parsedDate) {
        return {
            ok: false,
            error: `I couldn't understand the time format: "${cleanInput}".`,
            examples: [
                "today 10:10 AM",
                "tomorrow 2:30 PM",
                "in 30m",
                "2026-05-09T10:10:00"
            ]
        };
    }

    // Ensure it's not in the past
    // Add a 10 second grace period to allow immediate schedules (like "in 1s" turning into now)
    if (parsedDate.getTime() < refDate.getTime() - 10000) {
        return {
            ok: false,
            error: "The scheduled time cannot be in the past.",
            examples: []
        };
    }

    // Format display time
    // Intl.DateTimeFormat is built-in
    let displayTime = '';
    try {
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true
        });
        displayTime = formatter.format(parsedDate);
    } catch (e) {
        // Fallback if timezone is invalid somehow
        displayTime = parsedDate.toLocaleString();
    }

    return {
        ok: true,
        scheduledFor: parsedDate.toISOString(),
        originalInput: cleanInput,
        timezone,
        displayTime
    };
}

module.exports = parseScheduleTime;
