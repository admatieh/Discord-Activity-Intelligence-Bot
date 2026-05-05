// utils/messageSender.js
//
// Utility for sending messages, including automatic splitting for long content.
// ---------------------------------------------------------------------------

/**
 * Sends a list of lines in multiple messages to avoid Discord's 2000 char limit.
 * 
 * @param {import('discord.js').Message} message The original message object to reply to.
 * @param {string} header The title/header to prepend to the first message.
 * @param {string[]} lines An array of lines to send.
 * @param {object} options
 * @param {boolean} options.useCodeBlock Whether to wrap content in a code block.
 * @param {string} options.language Language for the code block (default: '').
 * @param {number} options.limit Character limit per message (default: 1900).
 */
async function sendSplitMessage(message, header, lines, { useCodeBlock = false, language = '', limit = 1900 } = {}) {
    let currentMessage = header + '\n';
    if (useCodeBlock) currentMessage += `\`\`\`${language}\n`;

    for (const line of lines) {
        // Estimate if adding this line exceeds the limit
        // (+4 for closing ``` if needed)
        const closing = useCodeBlock ? '\n```' : '';
        if ((currentMessage.length + line.length + closing.length + 1) > limit) {
            if (useCodeBlock) currentMessage += '```';
            await message.channel.send(currentMessage);
            
            // Start new chunk
            currentMessage = useCodeBlock ? `\`\`\`${language}\n` : '';
        }
        currentMessage += line + '\n';
    }

    if (currentMessage.length > 0) {
        if (useCodeBlock && !currentMessage.endsWith('```')) {
            currentMessage += '```';
        }
        return message.channel.send(currentMessage);
    }
}

module.exports = { sendSplitMessage };
