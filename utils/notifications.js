const path = require('path');
const crypto = require('crypto');
const fsPromises = require('fs').promises;
const { withFileLock, writeJsonAtomic } = require('./helpers');

const NOTIFICATIONS_FILE = path.join(__dirname, '../data/notifications.json');
const MAX_NOTIFICATIONS = 500;
const MAX_MESSAGE_LENGTH = 1000;
const LEVELS = ['error', 'warning', 'info', 'success'];

async function getNotifications() {
    try {
        return JSON.parse(await fsPromises.readFile(NOTIFICATIONS_FILE, 'utf8'));
    } catch (e) {
        return [];
    }
}

function addNotification({ level, source = 'server', message, details = null }) {
    const entry = {
        id: crypto.randomUUID(),
        timestamp: new Date().toISOString(),
        level: LEVELS.includes(level) ? level : 'info',
        source,
        message: String(message).slice(0, MAX_MESSAGE_LENGTH),
        details
    };
    return withFileLock(NOTIFICATIONS_FILE, async () => {
        const list = await getNotifications();
        list.push(entry);
        await writeJsonAtomic(NOTIFICATIONS_FILE, list.slice(-MAX_NOTIFICATIONS));
        return entry;
    });
}

function clearNotifications() {
    return withFileLock(NOTIFICATIONS_FILE, () => writeJsonAtomic(NOTIFICATIONS_FILE, []));
}

module.exports = { addNotification, getNotifications, clearNotifications };
