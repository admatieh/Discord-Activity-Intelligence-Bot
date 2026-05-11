const fs = require('fs');
const path = require('path');

const commandsDir = path.join(__dirname, '../commands');

function processFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const basename = path.basename(filePath, '.js');
    if (basename === 'index' || basename === 'help' || basename === 'whoami') return;

    // We need to inject the `requireInstructor` or `requireBotAdmin` check
    // Determine the permission from the file content
    let targetPerm = 'instructor';
    if (content.includes("requiredPermission: 'admin'")) targetPerm = 'admin';
    if (content.includes("requiredPermission: 'public'")) targetPerm = 'public';

    if (targetPerm !== 'public') {
        const permCall = targetPerm === 'admin' ? 'requireBotAdmin' : 'requireInstructor';
        const permBlock = `
        const permission = await ${permCall}(message);
        if (!permission.allowed) return message.reply(permission.message);
`;
        
        // Find if we already injected it
        if (!content.includes(permBlock.trim())) {
            // Find `async execute(` or `execute(`
            const executeRegex = /(execute\s*\([^)]+\)\s*\{)([\s\S]*)/;
            const match = content.match(executeRegex);
            if (match) {
                // If the function is not async, we MUST make it async to use `await requireInstructor`
                if (!content.includes('async execute')) {
                    content = content.replace(/execute\s*\([^)]+\)\s*\{/, (m) => `async ${m}`);
                }
                
                content = content.replace(/(async\s+execute\s*\([^)]+\)\s*\{)/, `$1${permBlock}`);
            }
        }
    }

    fs.writeFileSync(filePath, content, 'utf8');
}

function scanDir(dir) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
        const fullPath = path.join(dir, item);
        if (fs.statSync(fullPath).isDirectory()) {
            scanDir(fullPath);
        } else if (item.endsWith('.js')) {
            processFile(fullPath);
        }
    }
}

scanDir(commandsDir);
console.log('Done injecting proper permission checks.');
