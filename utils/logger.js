const fs = require('fs');
const path = require('path');

const LOGS_DIR = path.join(__dirname, '../logs');

// Ensure directory exists
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR);

function logToFile(type, message, details = null) {
    const timestamp = new Date().toISOString();
    let fileName = 'server_logs.txt';
    if (type === 'client') fileName = 'client_logs.txt';
    if (type === 'request') fileName = 'requests.txt';
    const logFile = path.join(LOGS_DIR, fileName);

    let logEntry = `[${timestamp}] [${type.toUpperCase()}] ${message}`;
    if (details) {
        if (typeof details === 'object') {
            try {
                logEntry += `\nDetails: ${JSON.stringify(details, null, 2)}`;
            } catch (e) {
                logEntry += `\nDetails: [Circular/Unserializable]`;
            }
        } else {
            logEntry += `\nDetails: ${details}`;
        }
    }
    logEntry += '\n' + '-'.repeat(80) + '\n';

    fs.appendFile(logFile, logEntry, (err) => {
        if (err) console.error('Failed to write log:', err);
    });
}

module.exports = { logToFile };
