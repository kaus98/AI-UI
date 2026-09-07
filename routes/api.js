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
    buildAiUrl,
    tokenCache
} = require('../utils/helpers');
const { searchDuckDuckGo } = require('../utils/search');
const { executeTool, setSearchEngine } = require('../utils/tools');

function sendSseDelta(res, content) {
    res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] }) }\n\n`);
}

function sendSseDone(res) {
    res.write('data: [DONE]\n\n');
    res.end();
}

async function pipeUpstreamToClient(response, res) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let streamEnded = false;

    res.on('error', (err) => {
        if (!streamEnded) {
            streamEnded = true;
            console.error('Response stream error:', err.message);
            try { reader.cancel(); } catch {}
        }
    });

    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (streamEnded) break;
        const chunk = decoder.decode(value, { stream: true });
        res.write(chunk);
        if (typeof res.flush === 'function') res.flush();
    }
    if (!streamEnded) {
        streamEnded = true;
        res.end();
    }
}

function pseudoArgsToObject(argsStr) {
    const obj = {};
    const re = /([a-zA-Z0-9_]+)\s*:\s*(?:"([^"]*)"|'([^']*)'|([^,}\s]+))/g;
    let m;
    while ((m = re.exec(argsStr)) !== null) {
        const key = m[1];
        const value = m[2] !== undefined ? m[2] : (m[3] !== undefined ? m[3] : m[4]);
        obj[key] = value;
    }
    return obj;
}

function parseCustomToolCalls(content) {
    const calls = [];
    if (!content || typeof content !== 'string') return calls;
    const re = /<\|tool_call>call:([a-zA-Z0-9_]+)\{([^}]*)\}<tool_call\|>/g;
    let m;
    let callIndex = 0;
    while ((m = re.exec(content)) !== null) {
        const name = m[1];
        const args = pseudoArgsToObject(m[2]);
        calls.push({
            id: `custom_${callIndex++}`,
            function: { name, arguments: JSON.stringify(args) }
        });
    }
    return calls;
}

// Log ingestion from client
router.post('/logs', (req, res) => {
    const { level, message, details } = req.body;
    logToFile('client', `[${level || 'INFO'}] ${message}`, details);
    res.json({ success: true });
});

router.get('/endpoints', async (req, res) => {
    const config = await getConfig();
    // Return safe version (no actual secrets)
    const safeEndpoints = config.endpoints.map(e => ({
        id: e.id,
        name: e.name,
        baseUrl: e.baseUrl,
        authType: e.authType || 'api-key',
        hasKey: !!e.apiKey,
        systemPrompt: e.systemPrompt || '',
        defaultModel: e.defaultModel || '',
        stream: e.stream !== false,
        inputCost: Number.isNaN(Number(e.inputCost)) ? 0 : Number(e.inputCost),
        outputCost: Number.isNaN(Number(e.outputCost)) ? 0 : Number(e.outputCost),
        tokenUrl: e.tokenUrl || '',
        clientId: e.clientId || '',
        hasSecret: !!e.clientSecret,
        scope: e.scope || ''
    }));
    res.json({
        endpoints: safeEndpoints,
        currentEndpointId: config.currentEndpointId
    });
});

router.post('/endpoints', async (req, res) => {
    try {
        const config = await getConfig();
        const { id, name, apiKey, baseUrl, authType, tokenUrl, clientId, clientSecret, scope, systemPrompt, defaultModel, stream, inputCost, outputCost } = req.body;

        // Normalize numeric/boolean fields
        const parsedInputCost = Number.isNaN(Number(inputCost)) ? 0 : Number(inputCost);
        const parsedOutputCost = Number.isNaN(Number(outputCost)) ? 0 : Number(outputCost);
        const parsedStream = stream !== false;

        let endpoint = config.endpoints.find(e => e.id === id);
        let resolvedId = id; // track the ID for cache clearing later

        if (endpoint) {
            // Update
            endpoint.name = name;
            endpoint.baseUrl = baseUrl;
            if (apiKey) endpoint.apiKey = apiKey; // Only overwrite key if a new one was provided
            endpoint.systemPrompt = systemPrompt || '';
            endpoint.defaultModel = defaultModel || '';
            endpoint.stream = parsedStream;
            endpoint.inputCost = parsedInputCost;
            endpoint.outputCost = parsedOutputCost;

            // OAuth updates
            endpoint.authType = authType || 'api-key';
            if (tokenUrl !== undefined) endpoint.tokenUrl = tokenUrl || null;
            if (clientId !== undefined) endpoint.clientId = clientId || null;
            if (clientSecret) endpoint.clientSecret = clientSecret; // Only overwrite if provided
            if (scope !== undefined) endpoint.scope = scope || null;

            // Reset token cache if creds change
            if (clientId || clientSecret || tokenUrl) {
                delete tokenCache[endpoint.id];
            }
            resolvedId = endpoint.id;
        } else {
            // Create
            resolvedId = id || Date.now().toString();
            config.endpoints.push({
                id: resolvedId,
                name,
                apiKey: apiKey || null,
                baseUrl,
                authType: authType || 'api-key',
                tokenUrl: tokenUrl || null,
                clientId: clientId || null,
                clientSecret: clientSecret || null,
                scope: scope || null,
                systemPrompt: systemPrompt || '',
                defaultModel: defaultModel || '',
                stream: parsedStream,
                inputCost: parsedInputCost,
                outputCost: parsedOutputCost
            });
            // If first one, set as default
            if (config.endpoints.length === 1) config.currentEndpointId = resolvedId;
        }

        await saveConfig(config);

        // Clear cached models for this endpoint so the next fetch picks up the new source
        const affectedId = resolvedId;
        const cachedModels = await getCachedModels();
        if (cachedModels[affectedId]) {
            delete cachedModels[affectedId];
            await saveCachedModels(cachedModels);
        }

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

        // Clear cached models for the deleted endpoint
        const cachedModels = await getCachedModels();
        if (cachedModels[req.params.id]) {
            delete cachedModels[req.params.id];
            await saveCachedModels(cachedModels);
        }

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
        const requestedEndpointId = req.query.endpointId || config.currentEndpointId;
        const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';

        const endpoint = getEndpoint(config, requestedEndpointId);
        if (!endpoint) throw new Error('No endpoint configured');
        const endpointId = endpoint.id;

        // 1. Try Cache First (unless force refresh)
        const cachedModels = await getCachedModels();
        if (!forceRefresh && cachedModels[endpointId] && cachedModels[endpointId].length > 0) {
            console.log(`Serving models for ${endpointId} from cache.`);
            return res.json({ object: 'list', data: cachedModels[endpointId] });
        }

        // 2. Fallback to live fetch if not in cache or force refresh
        // For better UX, let's trigger a single fetch here if missing
        console.log(`Cache miss for ${endpointId}, fetching live...`);

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

// POST version for client-side docs app (endpoint stored in browser localStorage)
router.post('/models', async (req, res) => {
    try {
        const endpoint = req.body.endpoint;
        if (!endpoint || !endpoint.baseUrl) throw new Error('No endpoint provided');

        const models = await fetchModelsFromEndpoint(endpoint, { endpoints: [endpoint] });
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
        let endpoint = null;
        if (req.body.endpoint && req.body.endpoint.baseUrl) {
            endpoint = req.body.endpoint;
        } else {
            const endpointId = req.body.endpointId || config.currentEndpointId;
            endpoint = getEndpoint(config, endpointId);
        }

        if (!endpoint) throw new Error('No endpoint configured');

        const authToken = await getOrRefreshAccessToken(endpoint, config);

        // Disable tools for localhost endpoints (local models like LLaMA don't support function calling)
        const isLocalhost = endpoint.baseUrl.includes('localhost') || endpoint.baseUrl.includes('127.0.0.1');
        let availableTools = [];
        let toolsForLLM = [];
        
        if (!isLocalhost) {
            const activeToolIds = Array.isArray(req.body.activeTools)
                ? req.body.activeTools
                : (config.tools || []).filter(t => t.enabled).map(t => t.id);
            availableTools = (config.tools || []).filter(t => activeToolIds.includes(t.id));
            toolsForLLM = availableTools.map(t => ({
                type: 'function',
                function: { name: t.name, description: t.description, parameters: t.parameters }
            }));
        } else {
            console.log('Tools disabled for localhost endpoint');
        }

        // Prepare body (remove custom fields)
        const { endpointId: _, endpoint: __, messages, activeTools, ...restBody } = req.body;

        // Sanitize messages: only send role and content to upstream APIs
        const sanitizedMessages = messages.map(msg => ({
            role: msg.role,
            content: msg.content
        }));

        let chatBody = { ...restBody, messages: sanitizedMessages };
        
        // Ensure stream parameter is preserved (default to true if not specified)
        if (chatBody.stream === undefined) {
            chatBody.stream = true;
        }

        const targetUrl = buildAiUrl(endpoint.baseUrl, '/chat/completions', config);
        console.log(`Sending chat to: ${targetUrl}`);
        
        // Force streaming for localhost endpoints (for local models like LLaMA server)
        // isLocalhost is already defined above, so we just use it here
        if (isLocalhost) {
            chatBody.stream = true;
            console.log('Forcing streaming for localhost endpoint');
        }
        
        console.log('Chat request stream setting:', chatBody.stream);

        const headers = { 'Content-Type': 'application/json' };
        if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

        // If tools are active, do a non-stream call first to detect tool calls
        if (toolsForLLM.length > 0 && !isLocalhost) {
            chatBody = { ...chatBody, tools: toolsForLLM, tool_choice: 'auto', stream: false };
            if (!chatBody.messages.some(m => m.role === 'system')) {
                chatBody.messages.unshift({
                    role: 'system',
                    content: 'You have access to the web_search tool. Use it when the question requires current, factual, or real-time information. Cite sources by number if search results are used.'
                });
            }

            const response = await fetch(targetUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify(chatBody),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
                return res.status(response.status).json(errorData);
            }

            const data = await response.json();
            const choice = data.choices && data.choices[0];
            const message = choice && choice.message;

            const rawToolCalls = (message && message.tool_calls) || [];
            const customToolCalls = parseCustomToolCalls(message && message.content);
            const calls = rawToolCalls.length ? rawToolCalls : customToolCalls;

            if (calls && calls.length) {
                const toolResults = [];
                for (const tc of calls) {
                    const tool = availableTools.find(t => t.name === tc.function.name);
                    let result = 'Tool not implemented.';
                    if (tool) {
                        const args = JSON.parse(tc.function.arguments || '{}');
                        try {
                            result = await executeTool(tool, args);
                        } catch (e) {
                            result = `Tool error: ${e.cause?.code || e.cause?.message || e.message}`;
                        }
                    }
                    toolResults.push({ id: tc.id, result });
                }

                const newMessages = [...sanitizedMessages];
                newMessages.push({
                    role: 'assistant',
                    content: customToolCalls.length ? null : (message.content || null),
                    tool_calls: calls
                });
                for (let i = 0; i < calls.length; i++) {
                    newMessages.push({
                        role: 'tool',
                        tool_call_id: toolResults[i].id,
                        content: toolResults[i].result
                    });
                }

                const finalBody = { ...restBody, messages: newMessages, stream: true };
                console.log('Tool execution complete, making final streaming call');
                const finalResponse = await fetch(targetUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify(finalBody),
                });

                if (!finalResponse.ok) {
                    const errorData = await finalResponse.json().catch(() => ({ error: 'Failed to parse error response' }));
                    return res.status(finalResponse.status).json(errorData);
                }
                await pipeUpstreamToClient(finalResponse, res);
                return;
            }

            // No tool call was made, return the answer as a single SSE
            const answer = (message && message.content) || '';
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            sendSseDelta(res, answer);
            sendSseDone(res);
            return;
        }

        // No tools: original behavior
        console.log('No tools active, using stream setting:', chatBody.stream);
        const response = await fetch(targetUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify(chatBody),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Failed to parse error response' }));
            console.error('Upstream API Error:', response.status, errorData);
            return res.status(response.status).json(errorData);
        }

        if (chatBody.stream && response.body) {
            console.log('Streaming response from upstream API');
            await pipeUpstreamToClient(response, res);
            return;
        }

        console.log('Non-streaming response from upstream API');
        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('Error in chat completion:', error.message);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to get chat completion' });
        }
    }
});

// DuckDuckGo web search
router.get('/search', async (req, res) => {
    try {
        const q = req.query.q;
        const limit = Math.min(Number(req.query.limit) || 10, 30);
        if (!q || typeof q !== 'string') {
            return res.status(400).json({ error: 'Missing q parameter' });
        }
        const results = await searchDuckDuckGo(q, limit);
        res.json({ query: q, results });
    } catch (e) {
        console.error('DuckDuckGo search error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

// Tools API
router.get('/tools', async (req, res) => {
    try {
        const config = await getConfig();
        res.json({ tools: config.tools || [], searchEngine: config.searchEngine || 'auto' });
    } catch (e) {
        console.error('Tools read error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

router.post('/tools/:id', async (req, res) => {
    try {
        const config = await getConfig();
        const tool = (config.tools || []).find(t => t.id === req.params.id);
        if (!tool) return res.status(404).json({ error: 'Tool not found' });
        if (typeof req.body.enabled === 'boolean') tool.enabled = req.body.enabled;
        await saveConfig(config);
        res.json({ tools: config.tools, searchEngine: config.searchEngine || 'auto' });
    } catch (e) {
        console.error('Tools update error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

router.post('/search-engine', async (req, res) => {
    try {
        const config = await getConfig();
        const { engine } = req.body;
        if (engine && ['auto', 'duckduckgo', 'bing', 'yahoo', 'startpage'].includes(engine)) {
            config.searchEngine = engine;
            await saveConfig(config);
            setSearchEngine(engine);
        }
        res.json({ searchEngine: config.searchEngine || 'auto' });
    } catch (e) {
        console.error('Search engine update error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

router.post('/proxy-base-url', async (req, res) => {
    try {
        const config = await getConfig();
        const { proxyBaseUrl } = req.body;
        config.proxyBaseUrl = proxyBaseUrl || '';
        await saveConfig(config);
        res.json({ proxyBaseUrl: config.proxyBaseUrl });
    } catch (e) {
        console.error('Proxy base URL update error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
