// commands/index.js
const fs = require('fs');
const path = require('path');

const commands = new Map();

// Load all .js files in the commands folder (except this index)
const commandsPath = __dirname;
const commandFiles = fs.readdirSync(commandsPath)
    .filter(file => file.endsWith('.js') && file !== 'index.js');

for (const file of commandFiles) {
    const command = require(path.join(commandsPath, file));
    // Expect each command file to export { name, execute }
    // The 'name' property is used for matching (e.g., 'start-session', 'ping')
    if (command.name && typeof command.execute === 'function') {
        commands.set(command.name, command);
    } else {
        console.warn(`[WARNING] Command file ${file} is missing 'name' or 'execute' export.`);
    }
}

module.exports = commands;