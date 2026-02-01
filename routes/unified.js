const express = require('express');
const router = express.Router();
const { logToFile } = require('../utils/logger');
const { getConfig, getOrRefreshAccessToken } = require('../utils/helpers');
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
router.get('/models', checkUnifiedAuth, async (req, res) => {
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
router.post('/chat/completions', checkUnifiedAuth, async (req, res) => {
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

// 3. Unified Legacy Completions Endpoint (Text Completion)
router.post('/completions', checkUnifiedAuth, async (req, res) => {
    try {
        const config = await getConfig();
        let { model, prompt, ...rest } = req.body;

        if (!model) return res.status(400).json({ error: 'Model is required' });

        // Parse Endpoint and Real Model ID
        const parts = model.split('/');
        if (parts.length < 2) {
            return res.status(400).json({ error: 'Invalid model format. Expected "EndpointName/ModelID"' });
        }

        const endpointName = parts[0];
        const realModelId = parts.slice(1).join('/');

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
        const payload = { model: realModelId, prompt, ...rest };

        // Forward
        console.log(`[Unified API] Forwarding to ${endpoint.name} (${baseUrl})...`);
        logToFile('server', `Unified API: Forwarding Completion Request`, {
            target: endpoint.name,
            url: `${baseUrl}/completions`,
            payload: payload
        });

        const response = await fetch(`${baseUrl}/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
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

            if (response.body) {
                const reader = response.body.getReader();
                const decoder = new TextDecoder();

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

        // Standard JSON proxy
        const data = await response.json();
        if (data.model) data.model = model;
        res.json(data);

    } catch (error) {
        console.error('Unified API Error:', error);
        res.status(500).json({ error: 'Internal Gateway Error' });
    }
});

module.exports = router;
