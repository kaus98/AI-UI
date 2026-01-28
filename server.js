const express = require('express');
const cors = require('cors'); // Ensure cors is required if used, otherwise remove
const path = require('path');
const fsPromises = require('fs').promises;
const fs = require('fs'); // Need sync/stream for logging

// Disable SSL Verification (Self-signed cert support)
// process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

// Config
const CONFIG_FILE = path.join(__dirname, 'config.json');
const DATA_DIR = path.join(__dirname, 'data');
const CHATS_FILE = path.join(DATA_DIR, 'chats.json');
const MODELS_FILE = path.join(DATA_DIR, 'models.json');
const LOGS_DIR = path.join(__dirname, 'logs');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR);

// Logging Helper
function logToFile(type, message, details = null) {
    const timestamp = new Date().toISOString();
    const logFile = path.join(LOGS_DIR, type === 'client' ? 'client_logs.txt' : 'server_logs.txt');

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

const app = express();
const PORT = 3000;

// Middleware
const favicon = require('serve-favicon');
app.use(favicon(path.join(__dirname, 'public', 'favicon.png')));
app.use(express.json({ limit: '50mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Global Request Logger Middleware
app.use((req, res, next) => {
    // Skip logging for log endpoint to prevent loop
    if (req.url === '/api/logs') return next();

    logToFile('server', `Incoming Request: ${req.method} ${req.url}`, {
        body: req.body,
        query: req.query,
        headers: {
            'user-agent': req.headers['user-agent']
        }
    });
    next();
});

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

// --- Config API ---

// Log ingestion from client
app.post('/api/logs', (req, res) => {
    const { level, message, details } = req.body;
    logToFile('client', `[${level || 'INFO'}] ${message}`, details);
    res.json({ success: true });
});

app.get('/api/endpoints', async (req, res) => {
    const config = await getConfig();
    // Return safe version (mask keys if you want, but for local app maybe ok to return)
    const safeEndpoints = config.endpoints.map(e => ({
        id: e.id,
        name: e.name,
        baseUrl: e.baseUrl,
        // masking key for UI to show only presence
        hasKey: !!e.apiKey
    }));
    res.json({
        endpoints: safeEndpoints,
        currentEndpointId: config.currentEndpointId
    });
});

app.post('/api/endpoints', async (req, res) => {
    try {
        const config = await getConfig();
        const { id, name, apiKey, baseUrl, authType, tokenUrl, clientId, clientSecret, scope } = req.body;

        let endpoint = config.endpoints.find(e => e.id === id);

        if (endpoint) {
            // Update
            endpoint.name = name;
            endpoint.baseUrl = baseUrl;
            endpoint.apiKey = apiKey || null; // Allow clearing key

            // OAuth updates
            endpoint.authType = authType || 'api-key';
            endpoint.tokenUrl = tokenUrl || null;
            endpoint.clientId = clientId || null;
            endpoint.clientSecret = clientSecret || null; // Allow clearing secret
            endpoint.scope = scope || null;

            // Reset token cache if creds change
            if (clientId || clientSecret || tokenUrl) {
                delete tokenCache[endpoint.id];
            }
        } else {
            // Create
            const newId = id || Date.now().toString();
            config.endpoints.push({
                id: newId,
                name,
                apiKey: apiKey || null,
                baseUrl,
                authType: authType || 'api-key',
                tokenUrl: tokenUrl || null,
                clientId: clientId || null,
                clientSecret: clientSecret || null,
                scope: scope || null
            });
            // If first one, set as default
            if (config.endpoints.length === 1) config.currentEndpointId = newId;
        }

        await saveConfig(config);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.delete('/api/endpoints/:id', async (req, res) => {
    try {
        const config = await getConfig();
        config.endpoints = config.endpoints.filter(e => e.id !== req.params.id);
        if (config.currentEndpointId === req.params.id) {
            config.currentEndpointId = config.endpoints.length > 0 ? config.endpoints[0].id : null;
        }
        await saveConfig(config);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/endpoints/select', async (req, res) => {
    try {
        const config = await getConfig();
        config.currentEndpointId = req.body.id;
        await saveConfig(config);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// --- History API ---

app.get('/api/history', async (req, res) => {
    try {
        const chats = await getHistory();
        res.json(chats);
    } catch (error) {
        logToFile('server', 'History Read Error', error.message);
        res.status(500).json({ error: 'Failed to read history' });
    }
});

app.post('/api/history', async (req, res) => {
    try {
        await saveHistory(req.body);
        res.json({ success: true });
    } catch (error) {
        logToFile('server', 'History Save Error', error.message);
        res.status(500).json({ error: 'Failed to save history' });
    }
});


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

// --- Proxy APIs ---

app.get('/api/models', async (req, res) => {
    try {
        const config = await getConfig();
        const endpointId = req.query.endpointId || config.currentEndpointId;

        // 1. Try Cache First
        const cachedModels = await getCachedModels();
        if (cachedModels[endpointId] && cachedModels[endpointId].length > 0) {
            console.log(`Serving models for ${endpointId} from cache.`);
            return res.json({ object: 'list', data: cachedModels[endpointId] });
        }

        // 2. Fallback to live fetch if not in cache (optional, or force user to refresh)
        // For better UX, let's trigger a single fetch here if missing
        console.log(`Cache miss for ${endpointId}, fetching live...`);
        const endpoint = getEndpoint(config, endpointId);
        if (!endpoint) throw new Error('No endpoint configured');

        const models = await fetchModelsFromEndpoint(endpoint, config);

        // Save to cache
        cachedModels[endpointId] = models;
        await saveCachedModels(cachedModels);

        res.json({ object: 'list', data: models });
    } catch (error) {
        console.error('Error fetching models:', error.message);
        // Return empty list on failure rather than 500 if it's just a fetch error, 
        // but let's keep consistent error reporting
        res.status(500).json({ error: `Model fetch failed: ${error.message}` });
    }
});

app.post('/api/models/refresh', async (req, res) => {
    try {
        const config = await getConfig();
        const cachedModels = await getCachedModels();
        const results = {};

        console.log('Refreshing all models...');

        // Parallel fetch for all endpoints
        await Promise.all(config.endpoints.map(async (endpoint) => {
            try {
                const models = await fetchModelsFromEndpoint(endpoint, config);
                cachedModels[endpoint.id] = models;
                results[endpoint.name] = 'Success';
            } catch (e) {
                console.error(`Failed to refresh ${endpoint.name}:`, e.message);
                results[endpoint.name] = `Failed: ${e.message}`;
            }
        }));

        await saveCachedModels(cachedModels);
        res.json({ success: true, results });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

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

app.post('/api/chat', async (req, res) => {
    try {
        const config = await getConfig();
        // Client can pass endpointId optionally, otherwise verify active
        const endpointId = req.body.endpointId || config.currentEndpointId;
        const endpoint = getEndpoint(config, endpointId);

        let endpointName = 'Endpoint';
        if (endpoint) endpointName = endpoint.name;

        if (!endpoint) throw new Error('No endpoint configured');

        // Resolve Auth Token
        const authToken = await getOrRefreshAccessToken(endpoint, config);

        // Prepare body (remove custom fields)
        const { endpointId: _, messages, ...restBody } = req.body;

        // Sanitize messages: remove 'html' and other internal fields
        const sanitizedMessages = messages.map(msg => {
            const { html, ...restMsg } = msg;
            return restMsg;
        });

        const chatBody = { ...restBody, messages: sanitizedMessages };

        const baseUrl = endpoint.baseUrl.replace(/\/+$/, '');
        console.log(`Sending chat to: ${baseUrl}/chat/completions`);

        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(chatBody),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
            console.error('Upstream API Error:', response.status, errorData);
            logToFile('server', 'Upstream Chat Error', {
                status: response.status,
                url: `${baseUrl}/chat/completions`,
                error: errorData
            });
            return res.status(response.status).json(errorData);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error in chat completion:', error.message);
        res.status(500).json({ error: 'Failed to get chat completion' });
    }
});

// --- Unified OpenAI-Compatible API ---

// Middleware for Unified API Token Check
async function checkUnifiedAuth(req, res, next) {
    const config = await getConfig();
    const authHeader = req.headers.authorization;

    // Allow if no key is configured (dev mode) or matches
    if (!config.unifiedApiKey) return next();

    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader.split(' ')[1] !== config.unifiedApiKey) {
        return res.status(401).json({ error: 'Unauthorized: Invalid Unified API Key' });
    }
    next();
}

// 1. Unified Models Endpoint
app.get('/unified/v1/models', checkUnifiedAuth, async (req, res) => {
    console.log('[Unified API] Fetching models...');
    logToFile('server', 'Unified API: Fetching Models');
    try {
        const config = await getConfig();
        const allModels = [];

        // Fetch from all endpoints in parallel
        await Promise.all(config.endpoints.map(async (endpoint) => {
            try {
                // Get Token
                const authToken = await getOrRefreshAccessToken(endpoint, config);
                const baseUrl = endpoint.baseUrl.replace(/\/+$/, '');

                const headers = {};
                if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

                const response = await fetch(`${baseUrl}/models`, { headers });

                if (response.ok) {
                    const data = await response.json();
                    let count = 0;
                    if (data.data && Array.isArray(data.data)) {
                        data.data.forEach(m => {
                            // Normalize ID
                            let realId = m.id || m.model;
                            if (realId) {
                                // Prefix with Endpoint Name
                                allModels.push({
                                    id: `${endpoint.name}/${realId}`, // Format: "EndpointName/modelId"
                                    object: 'model',
                                    created: m.created || Date.now(),
                                    owned_by: endpoint.name
                                });
                                count++;
                            }
                        });
                    }
                    console.log(`[Unified API] Fetched ${count} models from ${endpoint.name}`);
                    logToFile('server', `Unified API: Fetched ${count} models from ${endpoint.name}`);
                } else {
                    console.error(`[Unified API] Failed to fetch from ${endpoint.name}: Status ${response.status}`);
                    logToFile('server', `Unified API: Failed to fetch from ${endpoint.name}`, { status: response.status });
                }
            } catch (err) {
                console.error(`[Unified API] Error fetching from ${endpoint.name}:`, err.message);
                logToFile('server', `Unified API: Error fetching from ${endpoint.name}`, err.message);
                // Continue even if one fails
            }
        }));

        res.json({ object: 'list', data: allModels });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Unified Chat Completion Endpoint
app.post('/unified/v1/chat/completions', checkUnifiedAuth, async (req, res) => {
    try {
        const config = await getConfig();
        let { model, ...rest } = req.body;

        if (!model) return res.status(400).json({ error: 'Model is required' });

        // Parse Endpoint and Real Model ID
        // Expected format: "EndpointName/RealModelID"
        const parts = model.split('/');
        if (parts.length < 2) {
            return res.status(400).json({ error: 'Invalid model format. Expected "EndpointName/ModelID"' });
        }

        const endpointName = parts[0];
        const realModelId = parts.slice(1).join('/'); // Rejoin rest in case model ID has slashes

        // Find Endpoint
        const endpoint = config.endpoints.find(e =>
            e.name.toLowerCase() === endpointName.toLowerCase()
        );

        if (!endpoint) {
            return res.status(404).json({ error: `Endpoint '${endpointName}' not found` });
        }

        // Prepare Request
        const authToken = await getOrRefreshAccessToken(endpoint, config);
        const baseUrl = endpoint.baseUrl.replace(/\/+$/, '');
        const payload = { model: realModelId, ...rest };

        // Forward
        console.log(`[Unified API] Forwarding to ${endpoint.name} (${baseUrl})...`);
        logToFile('server', `Unified API: Forwarding Request`, {
            target: endpoint.name,
            url: `${baseUrl}/chat/completions`,
            payload: payload
        });

        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            // Forward upstream error
            const errData = await response.json().catch(() => ({}));
            console.error(`[Unified API] Upstream Error from ${endpoint.name}:`, response.status, errData);
            return res.status(response.status).json(errData);
        }

        // Handle Streaming
        if (payload.stream) {
            console.log(`[Unified API] Streaming response from ${endpoint.name}...`);
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');

            // Pipe response body directly to client
            if (response.body) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();

                // Read stream
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    const chunk = decoder.decode(value, { stream: true });
                    res.write(chunk);
                }
                res.end();
            } else {
                res.end();
            }
            return;
        }

        // Standard JSON proxy:
        const data = await response.json();

        // Optionally rewrite model in response to match request
        if (data.model) data.model = model;

        res.json(data);

    } catch (error) {
        console.error('Unified API Error:', error);
        res.status(500).json({ error: 'Internal Gateway Error' });
    }
});
app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
