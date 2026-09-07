const path = require('path');
const fsPromises = require('fs').promises;
const fs = require('fs');
const crypto = require('crypto');
const { logToFile } = require('./logger');

// Config Paths
const CONFIG_FILE = path.join(__dirname, '../config.json');
const DATA_DIR = path.join(__dirname, '../data');
const CHATS_FILE = path.join(DATA_DIR, 'chats.json');
const MODELS_FILE = path.join(DATA_DIR, 'models.json');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

// Optional Cloudflare proxy for outbound AI calls
const PROXY_BASE_URL = (process.env.CLOUDFLARE_PROXY_BASE_URL || process.env.PROXY_BASE_URL || '').replace(/\/+$/, '');

// --- Config Configuration ---

function generateUnifiedApiKey() {
    return 'ag-' + crypto.randomBytes(32).toString('hex');
}

async function getConfig() {
    let config;
    let configExisted = false;
    let isNewConfig = false;
    try {
        const data = await fsPromises.readFile(CONFIG_FILE, 'utf8');
        config = JSON.parse(data);
        configExisted = true;
    } catch (e) {
        console.error('Failed to load config.json:', e.message);
        config = { endpoints: [], currentEndpointId: null, unifiedApiKey: null };
        isNewConfig = true;
        if (e.code !== 'ENOENT') {
            // Back up a corrupt config file before we overwrite it.
            try {
                await fsPromises.rename(CONFIG_FILE, `${CONFIG_FILE}.bak`);
            } catch (backupErr) {
                console.error('Failed to back up corrupt config.json:', backupErr.message);
            }
        }
    }

    // Ensure structure
    if (!config.endpoints) config.endpoints = [];

    // Normalize IDs and endpoint defaults
    if (config.currentEndpointId != null) config.currentEndpointId = String(config.currentEndpointId);
    config.endpoints.forEach(e => {
        if (e.id != null) e.id = String(e.id);
        if (e.authType == null) e.authType = 'api-key';
        if (e.systemPrompt == null) e.systemPrompt = '';
        if (e.defaultModel == null) e.defaultModel = '';
        if (e.stream == null) e.stream = true;
        if (e.inputCost == null) e.inputCost = 0;
        if (e.outputCost == null) e.outputCost = 0;
        if (e.apiKey == null) e.apiKey = null;
        if (e.clientSecret == null) e.clientSecret = null;
        if (e.tokenUrl == null) e.tokenUrl = null;
        if (e.clientId == null) e.clientId = null;
        if (e.scope == null) e.scope = null;
    });

    // Ensure tools list exists with defaults
    if (!Array.isArray(config.tools)) config.tools = [];
    const defaultTools = [
        {
            id: 'web_search',
            name: 'web_search',
            description: 'Search the web for current, factual, or real-time information.',
            enabled: true,
            handler: 'web_search',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'The search query.' }
                },
                required: ['query']
            }
        },
        {
            id: 'url_fetch',
            name: 'url_fetch',
            description: 'Fetch and read the text content of any public webpage. Falls back to Selenium if direct HTTP fails.',
            enabled: true,
            handler: 'url_fetch',
            parameters: {
                type: 'object',
                properties: {
                    url: { type: 'string', description: 'The full URL of the webpage to fetch.' }
                },
                required: ['url']
            }
        },
        {
            id: 'wikipedia',
            name: 'wikipedia',
            description: 'Search Wikipedia for a topic and return a short summary.',
            enabled: true,
            handler: 'wikipedia',
            parameters: {
                type: 'object',
                properties: {
                    query: { type: 'string', description: 'The topic to search on Wikipedia.' }
                },
                required: ['query']
            }
        }
    ];
    const knownIds = new Set(config.tools.map(t => t.id));
    let addedTool = false;
    for (const tool of defaultTools) {
        if (!knownIds.has(tool.id)) {
            config.tools.push(tool);
            addedTool = true;
        }
    }
    if (addedTool) {
        try { await saveConfig(config); } catch (e) { console.error('Failed to save default tools:', e); }
    }

    // Ensure search engine setting exists
    if (!config.searchEngine) config.searchEngine = 'auto';

    // Ensure a cryptographically secure Unified API Key exists
    if (!config.unifiedApiKey) {
        config.unifiedApiKey = generateUnifiedApiKey();
        console.log('Generated Unified API Key:', config.unifiedApiKey);
        try {
            await saveConfig(config);
        } catch (saveErr) {
            console.error('Failed to save generated unified API key:', saveErr);
        }
    }

    return config;
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
    const searchId = id != null ? String(id) : String(config.currentEndpointId);
    return config.endpoints.find(e => String(e.id) === searchId) || (id ? null : config.endpoints[0]);
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
        return endpoint.apiKey || null;
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

// Build a direct or Cloudflare-proxied URL for an OpenAI-style path
function buildAiUrl(baseUrl, openaiPath, config = null) {
    const base = baseUrl.replace(/\/+$/, '');
    const needsV1 = !base.endsWith('/v1');
    const fullPath = needsV1 ? `/v1${openaiPath}` : openaiPath;
    const proxyBaseUrl = (config && config.proxyBaseUrl) ? config.proxyBaseUrl.replace(/\/+$/, '') : PROXY_BASE_URL;
    if (proxyBaseUrl) return `${proxyBaseUrl}${fullPath}?target=${encodeURIComponent(base)}`;
    return `${base}${fullPath}`;
}

// Helper to fetch from a single endpoint
async function fetchModelsFromEndpoint(endpoint, config) {
    const authToken = await getOrRefreshAccessToken(endpoint, config);
    const targetUrl = buildAiUrl(endpoint.baseUrl, '/models', config);

    logToFile('server', `Fetching models from ${endpoint.name}`, { url: targetUrl });

    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

    const response = await fetch(targetUrl, {
        method: 'GET',
        headers,
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
    buildAiUrl,
    // Export cache if needed, though usually internal
    tokenCache
};
