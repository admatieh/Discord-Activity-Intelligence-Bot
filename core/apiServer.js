// core/apiServer.js
const http = require('http');
const url = require('url');
const { executeCommand } = require('./commandExecutor');
const commands = require('../commands');
const db = require('../database/db');
const sessionModel = require('../models/sessionModel');
const logger = require('../utils/logger');

const PORT = process.env.BOT_API_PORT || 4000;
const API_KEY = process.env.BOT_API_KEY || 'local_dashboard_key_123';

function startApiServer(client) {
    global.client = client; // Expose client globally for MockMessage channel resolving

    const server = http.createServer(async (req, res) => {
        const reqUrl = url.parse(req.url, true);
        const method = req.method;

        // Security check
        const providedKey = req.headers['x-api-key'];
        if (providedKey !== API_KEY) {
            res.writeHead(401, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: false, error: 'Unauthorized' }));
        }

        if (reqUrl.pathname === '/api/execute' && method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk.toString(); });
            req.on('end', async () => {
                try {
                    const data = JSON.parse(body);
                    const { command, args, requestId } = data;
                    
                    let commandString = '';
                    if (command.startsWith('!')) {
                        commandString = command;
                    } else {
                        commandString = `!\${command}`;
                        if (args) {
                            for (const [key, value] of Object.entries(args)) {
                                if (value === true) commandString += ` --\${key}`;
                                else if (value !== false) commandString += ` --\${key} "\${value}"`;
                            }
                        }
                    }

                    const context = {
                        source: 'dashboard',
                        user: { id: 'dashboard', username: 'Dashboard Admin' }
                    };

                    const result = await executeCommand(commandString, context);
                    
                    res.writeHead(result.exitCode === 0 ? 200 : 400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: result.exitCode === 0,
                        requestId: requestId || `exec_\${Date.now()}`,
                        data: result,
                        error: result.exitCode === 0 ? null : result.output
                    }));
                } catch (err) {
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: err.message }));
                }
            });
            return;
        }

        if (reqUrl.pathname === '/api/commands' && method === 'GET') {
            const registry = Array.from(commands.values()).map(c => ({
                name: c.name,
                description: c.description || '',
                usage: c.usage || '',
                category: c.category || 'general',
                aliases: c.aliases || [],
                options: c.options || []
            }));
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ success: true, data: registry }));
        }

        if (reqUrl.pathname === '/api/system/runtime' && method === 'GET') {
            const memory = process.memoryUsage();
            const activeSessions = sessionModel.getActiveSessions().length;
            
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({
                success: true,
                data: {
                    uptime: process.uptime(),
                    memory: {
                        rss: Math.round(memory.rss / 1024 / 1024) + ' MB',
                        heapTotal: Math.round(memory.heapTotal / 1024 / 1024) + ' MB',
                        heapUsed: Math.round(memory.heapUsed / 1024 / 1024) + ' MB'
                    },
                    discordState: client.isReady() ? 'CONNECTED' : 'DISCONNECTED',
                    activeSessions,
                    version: process.env.npm_package_version || '1.0.0'
                }
            }));
        }

        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: 'Not Found' }));
    });

    server.listen(PORT, '127.0.0.1', () => {
        logger.log(`[API] Internal server running on http://127.0.0.1:\${PORT}`);
    });

    return server;
}

module.exports = { startApiServer };
