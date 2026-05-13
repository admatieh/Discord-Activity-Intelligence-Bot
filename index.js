require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { startApiServer } = require('./core/apiServer');
const db = require('./database/db');
const logger = require('./utils/logger');
const { initScheduler, stopScheduler } = require('./services/schedulerService');
const messageService = require('./services/messageService');
const sessionActionService = require('./services/sessionActionService');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions
    ],
});

// Dynamically load event handlers
const eventsPath = path.join(__dirname, 'events');
const eventFiles = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));

for (const file of eventFiles) {
    const event = require(path.join(eventsPath, file));
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

// Start internal API server
const apiServer = startApiServer(client);

// When bot is ready: wire services + start scheduler
client.once('ready', () => {
    logger.log(`[SYSTEM] Bot ready as ${client.user.tag}`);

    // Wire Discord client into services
    messageService.setClient(client);
    sessionActionService.setClient(client);
    sessionActionService.registerListeners();

    // Start scheduler (will execute due jobs on startup too)
    initScheduler(client);

    logger.log('[SYSTEM] All services initialized.');
});

// Retry login with backoff — Discord gateway sometimes returns 503 briefly
async function loginWithRetry(retries = 5, delayMs = 15000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            await client.login(process.env.TOKEN);
            return; // success
        } catch (err) {
            const isRetryable = err.status === 503 || err.status === 429 || err.code === 'ECONNRESET';
            console.error(`[LOGIN] Attempt ${attempt}/${retries} failed: ${err.message}`);
            if (attempt < retries && isRetryable) {
                console.log(`[LOGIN] Retrying in ${delayMs / 1000}s...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            } else {
                console.error('[LOGIN] Could not connect to Discord. Check your TOKEN and internet connection.');
                // Keep API server alive even if Discord is down
            }
        }
    }
}

loginWithRetry();


process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (err) => {
    // Don't crash on Discord gateway 503 — loginWithRetry handles those
    if (err && (err.status === 503 || err.status === 429)) {
        console.error(`[DISCORD] Gateway error (${err.status}) — retry logic will handle this.`);
        return;
    }
    console.error('UNHANDLED REJECTION:', err);
});


function shutdown(signal) {
    logger.log(`\n[SYSTEM] Received ${signal}, initiating graceful shutdown...`);

    stopScheduler();

    if (apiServer) {
        apiServer.close(() => {
            logger.log('[API] Internal server closed.');
        });
    }

    try {
        db.close();
        logger.log('[DATABASE] SQLite connection closed.');
    } catch (err) {
        logger.error(`[DATABASE] Error closing SQLite: ${err.message}`);
    }

    if (client) {
        client.destroy();
        logger.log('[DISCORD] Client destroyed.');
    }

    setTimeout(() => {
        logger.log('[SYSTEM] Process exiting gracefully.');
        process.exit(0);
    }, 1000);
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));