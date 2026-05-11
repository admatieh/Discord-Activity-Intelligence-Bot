const logger = require('./logger');

/**
 * Handle sending a response based on options: --private, --quiet, --silent
 * @param {import('discord.js').Message} message
 * @param {string|object} content The full content to send
 * @param {object} options Parsed command options
 * @param {string} [successPrefix='✅ Done.'] Prefix/message for quiet mode
 * @returns {Promise<any>}
 */
async function sendResponse(message, content, options = {}, successPrefix = '✅ Done.') {
    try {
        const { private: isPrivate, quiet: isQuiet, silent: isSilent } = options;

        let contentStr = typeof content === 'object' ? content.content || JSON.stringify(content) : content;
        const isError = contentStr && (contentStr.startsWith('❌') || contentStr.startsWith('⚠️') || contentStr.startsWith('📊')); // 📊 for no data?

        // If it's an error, quiet mode should send a short failure.
        let quietContent = isError ? contentStr : successPrefix;
        
        // Chunk handling for long content if it's sent publicly without quiet
        const sendLong = async (target, payload) => {
            let str = typeof payload === 'object' ? payload.content : payload;
            if (str && str.length > 1900) {
                const chunks = [];
                let current = '';
                for (const line of str.split('\n')) {
                    if (current.length + line.length + 1 > 1900) {
                        chunks.push(current);
                        current = line;
                    } else {
                        current += (current ? '\n' : '') + line;
                    }
                }
                if (current) chunks.push(current);

                let firstRes;
                for (let i = 0; i < chunks.length; i++) {
                    const ch = chunks[i];
                    if (i === 0) {
                        firstRes = typeof target.reply === 'function' ? await target.reply(ch) : await target.send(ch);
                    } else {
                        // For DMs, channel might not exist, use send. For public, use channel.send
                        if (target.channel) {
                            await target.channel.send(ch);
                        } else {
                            await target.send(ch); // DM
                        }
                    }
                }
                return firstRes;
            }
            return typeof target.reply === 'function' ? target.reply(payload) : target.send(payload);
        };

        if (isPrivate) {
            try {
                // Send full content privately
                await sendLong(message.author, content);
                // Send short confirmation publicly unless silent
                if (!isSilent) {
                    return await message.reply(isError ? '❌ Check your DMs for details.' : '✅ Sent privately.');
                }
                return;
            } catch (err) {
                logger.warn(`Failed to DM user ${message.author.id}: ${err.message}`);
                // DM failed
                if (!isSilent) {
                    return await message.reply('❌ Failed to send DM. Your DMs might be disabled.');
                }
                return;
            }
        }

        if (isQuiet) {
            if (!isSilent) {
                return await message.reply(quietContent);
            }
            return;
        }

        // Default: public full
        if (!isSilent) {
            return await sendLong(message, content);
        }
    } catch (error) {
        logger.error(`sendResponse error: ${error.message}`);
    }
}

module.exports = { sendResponse };
