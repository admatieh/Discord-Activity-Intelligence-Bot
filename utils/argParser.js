// utils/argParser.js
//
// Reusable argument parser for all bot commands.
// Extracts named options (--key value) from message.content.
//
// Parsing rules:
//   - Supports `--key value` syntax
//   - Resolves channel mentions (<#id>) and raw channel IDs
//   - Converts numeric strings to numbers automatically
//   - Ignores unknown/invalid flags safely
//   - Never throws — returns a safe default on any error
// ---------------------------------------------------------------------------

const PREFIX = '!';

/**
 * Parse a Discord message into a structured command + options object.
 *
 * @param {import('discord.js').Message} message - Discord message object
 * @returns {{ command: string, positional: string[], options: Record<string, any> }}
 */
function parseArgs(message) {
    const result = { command: '', positional: [], options: {} };

    try {
        const content = (message.content || '').trim();
        if (!content.startsWith(PREFIX)) return result;

        // Tokenize: respects quoted strings
        const tokens = tokenize(content.slice(PREFIX.length));
        if (tokens.length === 0) return result;

        // First token is always the command name
        result.command = tokens.shift().toLowerCase();

        let i = 0;
        while (i < tokens.length) {
            const token = tokens[i];

            // Named flag: --key [value]
            if (token.startsWith('--')) {
                const key = token.slice(2).toLowerCase();
                if (!key) { i++; continue; }

                // Peek at next token for the value
                const next = tokens[i + 1];

                // If next token is missing or is another flag, treat as boolean
                if (next === undefined || next.startsWith('--')) {
                    result.options[key] = true;
                    i++;
                    continue;
                }

                // Resolve the value
                result.options[key] = resolveValue(next, key, message);
                i += 2;
                continue;
            }

            // Positional argument (not a --flag)
            result.positional.push(token);
            i++;
        }
    } catch (_err) {
        // Fail gracefully — return whatever we have so far
    }

    return result;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Simple tokenizer that splits on whitespace but respects double-quoted strings.
 */
function tokenize(input) {
    const tokens = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < input.length; i++) {
        const char = input[i];

        if (char === '"') {
            inQuotes = !inQuotes;
            continue;
        }

        if (char === ' ' && !inQuotes) {
            if (current.length > 0) {
                tokens.push(current);
                current = '';
            }
            continue;
        }

        current += char;
    }

    if (current.length > 0) tokens.push(current);
    return tokens;
}

/**
 * Resolve a raw token value into a typed value.
 * - Channel mentions (<#id>) → resolved Channel object
 * - Numeric strings → number
 * - Everything else → string
 */
function resolveValue(raw, key, message) {
    // Channel mention: <#123456789>
    const channelMatch = raw.match(/^<#(\d+)>$/);
    if (channelMatch) {
        const channel = message.guild?.channels?.cache?.get(channelMatch[1]);
        return channel || raw;
    }

    // If the key hints at a channel, try resolving a raw ID
    if (key === 'channel') {
        if (/^\d+$/.test(raw)) {
            const channel = message.guild?.channels?.cache?.get(raw);
            if (channel) return channel;
        }
        // Try matching by name (without #)
        if (message.guild) {
            const byName = message.guild.channels.cache.find(
                c => c.name.toLowerCase() === raw.toLowerCase()
            );
            if (byName) return byName;
        }
    }

    // Numeric conversion
    if (/^-?\d+(\.\d+)?$/.test(raw)) {
        return Number(raw);
    }

    return raw;
}

module.exports = { parseArgs };
