const crypto = require('crypto');
const express = require('express');
const router = express.Router();
const { logToFile } = require('../utils/logger');
const {
    getConfig,
    updateConfig,
    getHistory,
    saveHistory,
    getEndpoint,
    getCachedModels,
    updateCachedModels,
    getOrRefreshAccessToken,
    fetchModelsFromEndpoint,
    buildAiUrl,
    tokenCache
} = require('../utils/helpers');
const { searchDuckDuckGo } = require('../utils/search');
const { executeTool, setSearchEngine } = require('../utils/tools');
const { createJob, getJob, appendToJob, finishJob, cancelJob, pipeUpstreamToJob, streamJob, sseData } = require('../utils/jobs');
const { addNotification, getNotifications, clearNotifications } = require('../utils/notifications');

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
        const { id, name, apiKey, baseUrl, authType, tokenUrl, clientId, clientSecret, scope, systemPrompt, defaultModel, stream, inputCost, outputCost } = req.body;

        // Normalize numeric/boolean fields
        const parsedInputCost = Number.isNaN(Number(inputCost)) ? 0 : Number(inputCost);
        const parsedOutputCost = Number.isNaN(Number(outputCost)) ? 0 : Number(outputCost);
        const parsedStream = stream !== false;

        const resolvedId = await updateConfig(config => {
            const endpoint = config.endpoints.find(e => e.id === id);

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
                return endpoint.id;
            }

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
                scope: scope || null,
                systemPrompt: systemPrompt || '',
                defaultModel: defaultModel || '',
                stream: parsedStream,
                inputCost: parsedInputCost,
                outputCost: parsedOutputCost
            });
            // If first one, set as default
            if (config.endpoints.length === 1) config.currentEndpointId = newId;
            return newId;
        });

        // Clear cached models for this endpoint so the next fetch picks up the new source
        await updateCachedModels(cachedModels => {
            if (cachedModels[resolvedId]) delete cachedModels[resolvedId];
        });

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.delete('/endpoints/:id', async (req, res) => {
    try {
        await updateConfig(config => {
            config.endpoints = config.endpoints.filter(e => e.id !== req.params.id);
            if (config.currentEndpointId === req.params.id) {
                config.currentEndpointId = config.endpoints.length > 0 ? config.endpoints[0].id : null;
            }
        });

        // Clear cached models for the deleted endpoint
        await updateCachedModels(cachedModels => {
            if (cachedModels[req.params.id]) delete cachedModels[req.params.id];
        });

        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

router.post('/endpoints/select', async (req, res) => {
    try {
        await updateConfig(config => {
            config.currentEndpointId = req.body.id;
        });
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});


// --- Notifications API ---

router.get('/notifications', async (req, res) => {
    try {
        res.json(await getNotifications());
    } catch (e) {
        res.status(500).json({ error: 'Failed to read notifications' });
    }
});

router.post('/notifications', async (req, res) => {
    const { level, message, details } = req.body || {};
    if (!message || typeof message !== 'string') return res.status(400).json({ error: 'message is required' });
    try {
        res.json(await addNotification({ level, source: 'client', message, details }));
    } catch (e) {
        res.status(500).json({ error: 'Failed to save notification' });
    }
});

router.delete('/notifications', async (req, res) => {
    try {
        await clearNotifications();
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Failed to clear notifications' });
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
        await updateCachedModels(cache => {
            cache[endpointId] = models;
        });

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
        const fresh = {};
        const results = {};

        console.log('Refreshing all models...');

        // Parallel fetch for all endpoints
        await Promise.all(config.endpoints.map(async (endpoint) => {
            try {
                const models = await fetchModelsFromEndpoint(endpoint, config);
                fresh[endpoint.id] = models;
                results[endpoint.name] = 'Success';
            } catch (e) {
                console.error(`Failed to refresh ${endpoint.name}:`, e.message);
                results[endpoint.name] = `Failed: ${e.message}`;
            }
        }));

        await updateCachedModels(cachedModels => Object.assign(cachedModels, fresh));
        res.json({ success: true, results });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

function upstreamErrorMessage(status, errorData) {
    const detail = errorData?.error?.message || errorData?.error || errorData?.message || 'Request failed';
    return `Upstream error ${status}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`;
}

function sseDelta(job, delta, extra = {}) {
    appendToJob(job, sseData({ choices: [{ delta }], ...extra }));
}

function appendCompletion(job, data) {
    const message = data.choices?.[0]?.message || {};
    const delta = { content: message.content || '' };
    const reasoning = message.reasoning_content || message.reasoning;
    if (reasoning) delta.reasoning_content = reasoning;
    sseDelta(job, delta, data.usage ? { usage: data.usage } : {});
}

async function generateChat(job, body) {
    const config = await getConfig();
    let endpoint = null;
    if (body.endpoint && body.endpoint.baseUrl) {
        endpoint = body.endpoint;
    } else {
        const endpointId = body.endpointId || config.currentEndpointId;
        endpoint = getEndpoint(config, endpointId);
    }

    if (!endpoint) throw new Error('No endpoint configured');
    const signal = job.controller.signal;

    const authToken = await getOrRefreshAccessToken(endpoint);

    // Disable tools for localhost endpoints (local models like LLaMA don't support function calling)
    const isLocalhost = endpoint.baseUrl.includes('localhost') || endpoint.baseUrl.includes('127.0.0.1');
    let availableTools = [];
    let toolsForLLM = [];

    if (!isLocalhost) {
        const activeToolIds = Array.isArray(body.activeTools)
            ? body.activeTools
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
    const { endpointId: _, endpoint: __, jobId: ___, messages, activeTools, ...restBody } = body;

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
            signal
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(upstreamErrorMessage(response.status, errorData));
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
                    try {
                        result = await executeTool(tool, JSON.parse(tc.function.arguments || '{}'));
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
                signal
            });

            if (!finalResponse.ok) {
                const errorData = await finalResponse.json().catch(() => ({}));
                throw new Error(upstreamErrorMessage(finalResponse.status, errorData));
            }
            await pipeUpstreamToJob(finalResponse, job);
            return;
        }

        // No tool call was made, return the answer as a single delta
        sseDelta(job, { content: (message && message.content) || '' });
        return;
    }

    // No tools: original behavior
    console.log('No tools active, using stream setting:', chatBody.stream);
    const response = await fetch(targetUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify(chatBody),
        signal
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Upstream API Error:', response.status, errorData);
        throw new Error(upstreamErrorMessage(response.status, errorData));
    }

    if (chatBody.stream && response.body) {
        console.log('Streaming response from upstream API');
        await pipeUpstreamToJob(response, job);
        return;
    }

    console.log('Non-streaming response from upstream API');
    appendCompletion(job, await response.json());
}

async function runChatJob(job, body) {
    try {
        await generateChat(job, body);
        finishJob(job, 'done');
    } catch (error) {
        if (job.controller.signal.aborted) return finishJob(job, 'cancelled');
        console.error('Error in chat completion:', error.message);
        finishJob(job, 'error', error.message || 'Failed to get chat completion');
    }
}

// Generations run as jobs: the upstream call continues even if this HTTP connection drops.
router.post('/chat', (req, res) => {
    const jobId = req.body.jobId || crypto.randomUUID();
    if (getJob(jobId)) return res.status(409).json({ error: 'A generation with this job ID already exists' });
    const job = createJob(jobId);
    runChatJob(job, req.body);
    streamJob(job, res, 0);
});

router.get('/jobs/:id/stream', (req, res) => {
    const job = getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    streamJob(job, res, Number(req.query.offset) || 0);
});

router.post('/jobs/:id/cancel', (req, res) => {
    const job = getJob(req.params.id);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    cancelJob(job);
    res.json({ status: job.status });
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
        const result = await updateConfig(config => {
            const tool = (config.tools || []).find(t => t.id === req.params.id);
            if (!tool) return null;
            if (typeof req.body.enabled === 'boolean') tool.enabled = req.body.enabled;
            return { tools: config.tools, searchEngine: config.searchEngine || 'auto' };
        });
        if (!result) return res.status(404).json({ error: 'Tool not found' });
        res.json(result);
    } catch (e) {
        console.error('Tools update error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

router.post('/search-engine', async (req, res) => {
    try {
        const { engine } = req.body;
        const valid = !!engine && ['auto', 'duckduckgo', 'bing', 'yahoo', 'startpage'].includes(engine);
        const searchEngine = await updateConfig(config => {
            if (valid) config.searchEngine = engine;
            return config.searchEngine || 'auto';
        });
        if (valid) setSearchEngine(engine);
        res.json({ searchEngine });
    } catch (e) {
        console.error('Search engine update error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

router.post('/proxy-base-url', async (req, res) => {
    try {
        const { proxyBaseUrl } = req.body;
        const saved = await updateConfig(config => {
            config.proxyBaseUrl = proxyBaseUrl || '';
            return config.proxyBaseUrl;
        });
        res.json({ proxyBaseUrl: saved });
    } catch (e) {
        console.error('Proxy base URL update error:', e.message);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
