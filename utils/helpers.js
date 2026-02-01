const path = require('path');
const fsPromises = require('fs').promises;
const fs = require('fs');
const { logToFile } = require('./logger');

// Config Paths
const CONFIG_FILE = path.join(__dirname, '../config.json');
const DATA_DIR = path.join(__dirname, '../data');
const CHATS_FILE = path.join(DATA_DIR, 'chats.json');
const MODELS_FILE = path.join(DATA_DIR, 'models.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// --- Config Configuration ---

async function getConfig() {
    try {
        const data = await fsPromises.readFile(CONFIG_FILE, 'utf8');
        const config = JSON.parse(data);
        // Ensure structure
        if (!config.endpoints) config.endpoints = [];

        // Ensure Unified API Key exists
        if (!config.unifiedApiKey) {
            config.unifiedApiKey = 'ag-' + Date.now().toString(36) + Math.random().toString(36).substr(2);
            await saveConfig(config); // Save immediately
            console.log('Generated Unified API Key:', config.unifiedApiKey);
        }

        return config;
    } catch (e) {
        return { endpoints: [], currentEndpointId: null, unifiedApiKey: null };
    }
}

async function saveConfig(config) {
    await fsPromises.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// --- History Configuration ---
async function getHistory() {
    try {
        const data = await fsPromises.readFile(CHATS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return [];
    }
}

async function saveHistory(chats) {
    await fsPromises.writeFile(CHATS_FILE, JSON.stringify(chats, null, 2));
}

function getEndpoint(config, id) {
    if (!config.endpoints) return null;
    if (id) return config.endpoints.find(e => e.id === id);
    return config.endpoints.find(e => e.id === config.currentEndpointId) || config.endpoints[0];
}

// --- Models Configuration ---
async function getCachedModels() {
    try {
        const data = await fsPromises.readFile(MODELS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        return {}; // Map<endpointId, modelList[]>
    }
}

async function saveCachedModels(models) {
    await fsPromises.writeFile(MODELS_FILE, JSON.stringify(models, null, 2));
}

// --- OAuth Logic ---

// In-memory token cache (lost on server restart, ensuring fresh session tokens)
const tokenCache = {}; // Map<endpointId, { token, expiresAt }>

async function getOrRefreshAccessToken(endpoint, config) {
    // 1. If not OAuth, return API key (shim)
    if (endpoint.authType !== 'oauth2') {
        return endpoint.apiKey;
    }

    // 2. Check if current token is valid (with 5 min buffer)
    const now = Date.now();
    const cached = tokenCache[endpoint.id];

    if (cached && cached.expiresAt > (now + 300000)) {
        return cached.token;
    }

    // 3. Refresh/Fetch Token
    console.log(`Refreshing OAuth token for ${endpoint.name}...`);
    try {
        const body = new URLSearchParams();
        body.append('grant_type', 'client_credentials');
        body.append('client_id', endpoint.clientId);
        body.append('client_secret', endpoint.clientSecret);
        if (endpoint.scope) body.append('scope', endpoint.scope);

        const res = await fetch(endpoint.tokenUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: body
        });

        if (!res.ok) {
            const txt = await res.text();
            throw new Error(`OAuth Failed: ${res.status} ${txt}`);
        }

        const data = await res.json();

        const accessToken = data.access_token;
        // expires_in is usually seconds. Default to 1 hour if missing.
        const expiresIn = data.expires_in || 3600;
        const expiresAt = now + (expiresIn * 1000);

        // Save to memory cache only
        tokenCache[endpoint.id] = { token: accessToken, expiresAt: expiresAt };

        return accessToken;
    } catch (e) {
        console.error('Token fetch failed:', e);
        throw e;
    }
}

// Helper to fetch from a single endpoint
async function fetchModelsFromEndpoint(endpoint, config) {
    const authToken = await getOrRefreshAccessToken(endpoint, config);
    const baseUrl = endpoint.baseUrl.replace(/\/+$/, '');
    const targetUrl = `${baseUrl}/models`;

    logToFile('server', `Fetching models from ${endpoint.name}`, { url: targetUrl });

    const response = await fetch(targetUrl, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${authToken}`,
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        throw new Error(`Upstream Error: ${response.status}`);
    }

    const data = await response.json();
    let models = [];

    if (data.data && Array.isArray(data.data)) {
        // Normalize
        data.data.forEach(m => {
            if (!m.id && m.model) m.id = m.model;
        });

        models = data.data.filter(model => {
            if (!model.id) return false;
            const id = model.id.toLowerCase();
            return !id.includes('embed') &&
                !id.includes('audio') &&
                !id.includes('tts') &&
                !id.includes('whisper') &&
                !id.includes('dall-e') &&
                !id.includes('moderation') &&
                !id.includes('realtime');
        });
    }
    return models;
}

module.exports = {
    getConfig,
    saveConfig,
    getHistory,
    saveHistory,
    getEndpoint,
    getCachedModels,
    saveCachedModels,
    getOrRefreshAccessToken,
    fetchModelsFromEndpoint,
    // Export cache if needed, though usually internal
    tokenCache
};
