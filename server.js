const express = require('express');
const path = require('path');
const fs = require('fs').promises;

// We'll read config dynamically now
const CONFIG_FILE = path.join(__dirname, 'config.json');
const DATA_FILE = path.join(__dirname, 'data', 'chats.json');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// --- Config Configuration ---

async function getConfig() {
    try {
        const data = await fs.readFile(CONFIG_FILE, 'utf8');
        const config = JSON.parse(data);
        // Ensure structure
        if (!config.endpoints) config.endpoints = [];
        return config;
    } catch (e) {
        return { endpoints: [], currentEndpointId: null };
    }
}

async function saveConfig(config) {
    await fs.writeFile(CONFIG_FILE, JSON.stringify(config, null, 2));
}

function getEndpoint(config, id) {
    if (!config.endpoints) return null;
    if (id) return config.endpoints.find(e => e.id === id);
    return config.endpoints.find(e => e.id === config.currentEndpointId) || config.endpoints[0];
}

// --- Config API ---

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
        const data = await fs.readFile(DATA_FILE, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        if (error.code === 'ENOENT') return res.json([]);
        res.status(500).json({ error: 'Failed to read history' });
    }
});

app.post('/api/history', async (req, res) => {
    try {
        await fs.writeFile(DATA_FILE, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (error) {
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
        const endpoint = getEndpoint(config, req.query.endpointId);

        if (!endpoint) throw new Error('No endpoint configured');

        // Resolve Auth Token
        const authToken = await getOrRefreshAccessToken(endpoint, config);

        const baseUrl = endpoint.baseUrl.replace(/\/+$/, '');
        console.log(`Fetching models from: ${baseUrl}/models`);

        const response = await fetch(`${baseUrl}/models`, {
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

        // Filter for chat models only
        if (data.data && Array.isArray(data.data)) {
            data.data = data.data.filter(model => {
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

        res.json(data);
    } catch (error) {
        console.error('Error fetching models:', error.message);
        if (error.cause && error.cause.code === 'ECONNREFUSED') {
            return res.status(502).json({ error: `Could not connect to ${error.cause.address}:${error.cause.port}. Is the local server running?` });
        }
        res.status(500).json({ error: error.message });
    }
});

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
        const { endpointId: _, ...chatBody } = req.body;

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
            const errorData = await response.json().catch(() => ({}));
            return res.status(response.status).json(errorData);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error in chat completion:', error.message);
        res.status(500).json({ error: 'Failed to get chat completion' });
    }
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
