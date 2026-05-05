// commands/index.js
//
// Recursively discovers and registers all commands from:
//   - Flat .js files directly in commands/ (default category: 'general' or explicitly defined)
//   - Subfolders (infers category from folder name if not explicitly defined)
//
// Features:
//   - Duplicate command protection
//   - Alias support (safe)
//   - Category inference
// ---------------------------------------------------------------------------

const fs   = require('fs');
const path = require('path');

const commands = new Map();

/**
 * Walk a directory and collect all .js file paths along with their inferred category.
 * Ignores index.js itself.
 */
function collectCommandFiles(dir) {
    const files = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        if (entry.name === 'index.js') continue;

        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            // Recurse one level into subfolders
            const subFolderName = entry.name.toLowerCase();
            const subEntries = fs.readdirSync(fullPath, { withFileTypes: true });
            for (const sub of subEntries) {
                if (sub.isFile() && sub.name.endsWith('.js') && sub.name !== 'index.js') {
                    files.push({
                        path: path.join(fullPath, sub.name),
                        inferredCategory: subFolderName
                    });
                }
            }
        } else if (entry.isFile() && entry.name.endsWith('.js')) {
            files.push({
                path: fullPath,
                inferredCategory: 'general'
            });
        }
    }

    return files;
}

const commandFiles = collectCommandFiles(__dirname);

for (const fileObj of commandFiles) {
    try {
        const file = fileObj.path;
        const command = require(file);
        
        if (command.name && typeof command.execute === 'function') {
            const cmdName = command.name.toLowerCase();
            
            // 1. Category Resolution Priority
            command.category = command.category || fileObj.inferredCategory || 'general';
            
            // Default options array if missing
            command.options = command.options || [];

            // 2. Duplicate Command Protection
            if (commands.has(cmdName)) {
                console.warn(`[WARNING] Command "${cmdName}" already exists. Skipping duplicate from ${file}.`);
                continue;
            }

            // Register primary command
            commands.set(cmdName, command);

            // 3. Alias Support (Safe)
            if (Array.isArray(command.aliases)) {
                for (const rawAlias of command.aliases) {
                    const alias = rawAlias.toLowerCase();
                    if (commands.has(alias)) {
                        console.warn(`[WARNING] Alias "${alias}" for command "${cmdName}" conflicts with an existing command/alias. Skipping alias.`);
                        continue;
                    }
                    commands.set(alias, command);
                }
            }
        } else {
            console.warn(`[WARNING] Command file "${path.relative(__dirname, fileObj.path)}" is missing 'name' or 'execute'.`);
        }
    } catch (err) {
        console.error(`[ERROR] Failed to load command "${fileObj.path}": ${err.message}`);
    }
}

module.exports = commands;