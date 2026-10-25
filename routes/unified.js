const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const { logToFile } = require('../utils/logger');
const { getConfig, getOrRefreshAccessToken } = require('../utils/helpers');
const { resolveModel } = require('../utils/models');
const { pipeStream } = require('../utils/stream');

// Middleware for Unified API Token Check
async function checkUnifiedAuth(req, res, next) {
    const config = await getConfig();
    const authHeader = req.headers.authorization;

    // A unified API key is required. getConfig auto-generates one if missing,
    // so an empty key here means the configuration is not yet initialized.
    if (!config.unifiedApiKey) {
        return res.status(401).json({ error: 'Unauthorized: Unified API Key not configured' });
    }

    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
    if (!token || token.length !== config.unifiedApiKey.length) {
        return res.status(401).json({ error: 'Unauthorized: Invalid Unified API Key' });
    }

    const provided = Buffer.from(token);
    const expected = Buffer.from(config.unifiedApiKey);
    if (!crypto.timingSafeEqual(provided, expected)) {
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
                const authToken = await getOrRefreshAccessToken(endpoint);
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
                                // Prefix with Endpoint ID
                                allModels.push({
                                    id: `${endpoint.id}/${realId}`, // Format: "EndpointId/modelId"
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
        const { model, ...rest } = req.body;

        if (!model) return res.status(400).json({ error: 'Model is required' });

        const { endpoint, realModelId, error } = resolveModel(config, model);
        if (error) return res.status(error.status).json({ error: error.message });

        // Prepare Request
        const authToken = await getOrRefreshAccessToken(endpoint);
        const baseUrl = endpoint.baseUrl.replace(/\/+$/, '');

        // Sanitize messages if present: only role and content should reach upstream APIs
        if (rest.messages && Array.isArray(rest.messages)) {
            rest.messages = rest.messages.map(msg => ({ role: msg.role, content: msg.content }));
        }

        const payload = { model: realModelId, ...rest };

        // Forward
        console.log(`[Unified API] Forwarding to ${endpoint.name} (${baseUrl})...`);
        logToFile('server', `Unified API: Forwarding Request`, {
            target: endpoint.name,
            url: `${baseUrl}/chat/completions`,
            payload: payload
        });

        const headers = { 'Content-Type': 'application/json' };
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers,
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
            return await pipeStream(response, res);
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
        const { model, prompt, ...rest } = req.body;

        if (!model) return res.status(400).json({ error: 'Model is required' });

        const { endpoint, realModelId, error } = resolveModel(config, model);
        if (error) return res.status(error.status).json({ error: error.message });

        // Prepare Request
        const authToken = await getOrRefreshAccessToken(endpoint);
        const baseUrl = endpoint.baseUrl.replace(/\/+$/, '');
        const payload = { model: realModelId, prompt, ...rest };

        // Forward
        console.log(`[Unified API] Forwarding to ${endpoint.name} (${baseUrl})...`);
        logToFile('server', `Unified API: Forwarding Completion Request`, {
            target: endpoint.name,
            url: `${baseUrl}/completions`,
            payload: payload
        });

        const headers = { 'Content-Type': 'application/json' };
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

        const response = await fetch(`${baseUrl}/completions`, {
            method: 'POST',
            headers,
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
            return await pipeStream(response, res);
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
