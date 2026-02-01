const express = require('express');
const router = express.Router();
const { logToFile } = require('../utils/logger');
const {
    getConfig,
    saveConfig,
    getHistory,
    saveHistory,
    getEndpoint,
    getCachedModels,
    saveCachedModels,
    getOrRefreshAccessToken,
    fetchModelsFromEndpoint,
    tokenCache
} = require('../utils/helpers');

// Log ingestion from client
router.post('/logs', (req, res) => {
    const { level, message, details } = req.body;
    logToFile('client', `[${level || 'INFO'}] ${message}`, details);
    res.json({ success: true });
});

router.get('/endpoints', async (req, res) => {
    const config = await getConfig();
    // Return safe version
    const safeEndpoints = config.endpoints.map(e => ({
        id: e.id,
        name: e.name,
        baseUrl: e.baseUrl,
        hasKey: !!e.apiKey
    }));
    res.json({
        endpoints: safeEndpoints,
        currentEndpointId: config.currentEndpointId
    });
});

router.post('/endpoints', async (req, res) => {
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

router.delete('/endpoints/:id', async (req, res) => {
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

router.post('/endpoints/select', async (req, res) => {
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

router.get('/history', async (req, res) => {
    try {
        const chats = await getHistory();
        res.json(chats);
    } catch (error) {
        logToFile('server', 'History Read Error', error.message);
        res.status(500).json({ error: 'Failed to read history' });
    }
});

router.post('/history', async (req, res) => {
    try {
        await saveHistory(req.body);
        res.json({ success: true });
    } catch (error) {
        logToFile('server', 'History Save Error', error.message);
        res.status(500).json({ error: 'Failed to save history' });
    }
});

// --- Proxy APIs ---

router.get('/models', async (req, res) => {
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
        res.status(500).json({ error: `Model fetch failed: ${error.message}` });
    }
});

router.post('/models/refresh', async (req, res) => {
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

router.post('/chat', async (req, res) => {
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

module.exports = router;
