require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { startApiServer } = require('./core/apiServer');
const db = require('./database/db');
const logger = require('./utils/logger');

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

// Start internal API server for Dashboard execution bridge
const apiServer = startApiServer(client);

client.login(process.env.TOKEN);

process.on('uncaughtException', (err) => {
    console.error('UNCAUGHT EXCEPTION:', err);
});

process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION:', err);
});

// Graceful shutdown handling
function shutdown(signal) {
    logger.log(`\n[SYSTEM] Received ${signal}, initiating graceful shutdown...`);
    
    // Close HTTP Server
    if (apiServer) {
        apiServer.close(() => {
            logger.log('[API] Internal server closed.');
        });
    }

    // Close Database Handles safely
    try {
        db.close();
        logger.log('[DATABASE] SQLite connection closed.');
    } catch (err) {
        logger.error(`[DATABASE] Error closing SQLite: ${err.message}`);
    }

    // Destroy Discord Client
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