const CONFIG_KEY = 'aiui_config';
const CHATS_KEY = 'aiui_chats';

const state = {
    endpoints: [],
    currentEndpointId: null,
    presets: [],
    currentPresetId: null,
    chats: [],
    currentChatId: null,
    isGenerating: false,
    regenerating: false,
    attachedImages: [],
    proxyBaseUrl: ''
};
const FOLDERS = ['General', 'Work', 'Personal', 'Archive'];
const DEFAULT_FOLDER = 'General';

const tokenCache = {};

let easyMDE = null;

// DOM refs
const setupScreen = document.getElementById('setup-screen');
const appScreen = document.getElementById('app');
const setupTabs = document.querySelectorAll('.setup-tab');
const setupPanels = document.querySelectorAll('.setup-panel');
const configPaste = document.getElementById('config-paste');
const setupError = document.getElementById('setup-error');
const endpointSelect = document.getElementById('endpoint-select');
const presetSelect = document.getElementById('preset-select');
const modelSelect = document.getElementById('model-select');
const statusIndicator = document.getElementById('status-indicator');
const chatList = document.getElementById('chat-list');
const chatItems = document.getElementById('chat-items');
const chatSearch = document.getElementById('chat-search');
const folderList = document.getElementById('folder-list');
const chatContainer = document.getElementById('chat-container');
const imageUpload = document.getElementById('image-upload');
const imagePreviewContainer = document.getElementById('image-preview-container');
const sendBtn = document.getElementById('send-btn');
const stopBtn = document.getElementById('stop-btn');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const attachBtn = document.getElementById('attach-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const menuBtn = document.getElementById('menu-btn');
const sidebar = document.getElementById('sidebar');
const settingsModal = document.getElementById('settings-modal');
const endpointsList = document.getElementById('endpoints-list');
const endpointForm = document.getElementById('endpoint-form');
const presetsList = document.getElementById('presets-list');
const presetForm = document.getElementById('preset-form');

// Utilities
function $(id) { return document.getElementById(id); }
function generateId() { return crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36); }
function getStorage(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
}
function setStorage(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

function showError(message) {
    let toast = document.querySelector('.error-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'error-toast';
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 4000);
}

function applyTheme(theme) {
    let resolved = theme;
    if (theme === 'system' || !theme) {
        resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.documentElement.setAttribute('data-theme', resolved);
    localStorage.setItem('aiui_theme', theme || 'system');
}

function cycleTheme() {
    const current = localStorage.getItem('aiui_theme') || 'system';
    const next = current === 'light' ? 'dark' : (current === 'dark' ? 'system' : 'light');
    applyTheme(next);
    if (themeToggleBtn) themeToggleBtn.title = `Theme: ${next}`;
}

function initTheme() {
    const saved = localStorage.getItem('aiui_theme') || 'system';
    applyTheme(saved);
    if (themeToggleBtn) themeToggleBtn.title = `Theme: ${saved}`;
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        const savedNow = localStorage.getItem('aiui_theme') || 'system';
        if (savedNow === 'system') applyTheme('system');
    });
}

async function logToServer(level, message, details = null) {
    try {
        fetch('/api/logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ level, message, details })
        }).catch(e => console.error('Log upload failed', e));
    } catch (e) {
        console.error('Log helper failed', e);
    }
}

// Config
function loadConfig() {
    const cfg = getStorage(CONFIG_KEY, null);
    if (cfg && Array.isArray(cfg.endpoints) && cfg.endpoints.length) {
        state.endpoints = cfg.endpoints;
        state.currentEndpointId = cfg.currentEndpointId || cfg.endpoints[0].id;
        state.presets = Array.isArray(cfg.presets) ? cfg.presets : [];
        state.currentPresetId = cfg.currentPresetId || null;
        state.proxyBaseUrl = cfg.proxyBaseUrl || localStorage.getItem('aiui_proxy_base') || '';
        return true;
    }
    state.proxyBaseUrl = localStorage.getItem('aiui_proxy_base') || '';
    return false;
}
function saveConfig() {
    setStorage(CONFIG_KEY, {
        endpoints: state.endpoints,
        currentEndpointId: state.currentEndpointId,
        presets: state.presets,
        currentPresetId: state.currentPresetId,
        proxyBaseUrl: state.proxyBaseUrl
    });
}
function loadChats() { state.chats = getStorage(CHATS_KEY, []); }
function saveChats() { setStorage(CHATS_KEY, state.chats); }

function normalizeEndpoint(raw) {
    return {
        id: raw.id || generateId(),
        name: raw.name || 'Unnamed',
        baseUrl: (raw.baseUrl || raw.url || raw.base_url || '').replace(/\/+$/, ''),
        proxyBaseUrl: (raw.proxyBaseUrl || raw.proxy_url || '').replace(/\/+$/, ''),
        authType: raw.authType || 'api-key',
        apiKey: raw.apiKey || raw.api_key || raw.key || '',
        tokenUrl: raw.tokenUrl || raw.token_url || '',
        clientId: raw.clientId || raw.client_id || '',
        clientSecret: raw.clientSecret || raw.client_secret || '',
        scope: raw.scope || '',
        systemPrompt: raw.systemPrompt || raw.system_prompt || '',
        defaultModel: raw.defaultModel || raw.default_model || '',
        stream: raw.stream !== false,
        inputCost: parseFloat(raw.inputCost) || 0,
        outputCost: parseFloat(raw.outputCost) || 0
    };
}
function normalizePreset(raw) {
    return {
        id: raw.id || generateId(),
        name: raw.name || 'Unnamed Agent',
        endpointId: raw.endpointId || raw.endpoint_id || '',
        modelId: raw.modelId || raw.model_id || '',
        systemPrompt: raw.systemPrompt || raw.system_prompt || '',
        tags: Array.isArray(raw.tags) ? raw.tags : []
    };
}

// Setup flow
function initSetup() {
    setupTabs.forEach(tab => tab.addEventListener('click', () => {
        setupTabs.forEach(t => t.classList.remove('active'));
        setupPanels.forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`setup-${tab.dataset.tab}`).classList.add('active');
        setupError.classList.add('hidden');
    }));

    $('setup-authtype').addEventListener('change', (e) => {
        const isOauth = e.target.value === 'oauth2';
        $('setup-apikey-group').classList.toggle('hidden', isOauth);
        $('setup-oauth-group').classList.toggle('hidden', !isOauth);
    });

    $('load-config-btn').addEventListener('click', () => {
        try {
            const text = configPaste.value.trim();
            if (!text) throw new Error('Paste a config first');
            const parsed = JSON.parse(text);
            const arr = parsed.endpoints || (Array.isArray(parsed) ? parsed : [parsed]);
            if (!arr.length) throw new Error('No endpoints found');
            state.endpoints = arr.map(normalizeEndpoint);
            state.currentEndpointId = state.endpoints[0].id;
            state.presets = Array.isArray(parsed.presets) ? parsed.presets.map(normalizePreset) : state.presets;
            state.proxyBaseUrl = parsed.proxyBaseUrl || state.proxyBaseUrl || '';
            saveConfig();
            loadChats();
            bootApp();
        } catch (e) {
            setupError.textContent = 'Invalid config: ' + e.message;
            setupError.classList.remove('hidden');
        }
    });

    $('add-setup-endpoint-btn').addEventListener('click', () => {
        const ep = {
            name: $('setup-name').value.trim(),
            baseUrl: $('setup-baseurl').value.trim(),
            authType: $('setup-authtype').value,
            apiKey: $('setup-key').value,
            tokenUrl: $('setup-tokenurl').value.trim(),
            clientId: $('setup-clientid').value.trim(),
            clientSecret: $('setup-clientsecret').value,
            scope: $('setup-scope').value.trim(),
            systemPrompt: $('setup-system-prompt').value.trim(),
            defaultModel: $('setup-default-model').value.trim()
        };
        if (!ep.name || !ep.baseUrl) {
            setupError.textContent = 'Name and Base URL are required';
            setupError.classList.remove('hidden');
            return;
        }
        state.endpoints = [normalizeEndpoint(ep)];
        state.currentEndpointId = state.endpoints[0].id;
        saveConfig();
        loadChats();
        bootApp();
    });
}

function bootApp() {
    setupScreen.classList.add('hidden');
    appScreen.classList.remove('hidden');
    initApp();
}

// Auth
async function fetchOAuthToken(endpoint) {
    if (tokenCache[endpoint.id] && tokenCache[endpoint.id].expiry > Date.now()) {
        return { Authorization: `Bearer ${tokenCache[endpoint.id].token}` };
    }
    const params = new URLSearchParams();
    params.set('grant_type', 'client_credentials');
    params.set('client_id', endpoint.clientId);
    params.set('client_secret', endpoint.clientSecret);
    if (endpoint.scope) params.set('scope', endpoint.scope);

    const res = await fetch(endpoint.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
    });
    if (!res.ok) throw new Error(`OAuth token failed: ${res.status}`);
    const data = await res.json();
    tokenCache[endpoint.id] = {
        token: data.access_token,
        expiry: Date.now() + (data.expires_in ? data.expires_in * 1000 : 3600000)
    };
    return { Authorization: `Bearer ${data.access_token}` };
}

async function getAuthHeaders(endpoint) {
    const headers = { 'Content-Type': 'application/json' };
    if (endpoint.authType === 'oauth2') {
        const auth = await fetchOAuthToken(endpoint);
        Object.assign(headers, auth);
    } else if (endpoint.apiKey) {
        headers['Authorization'] = `Bearer ${endpoint.apiKey}`;
    }
    return headers;
}

function currentEndpoint() {
    return state.endpoints.find(e => e.id === state.currentEndpointId) || state.endpoints[0];
}

// Models
function getProxyUrl(ep, path) {
    const proxyBase = (ep.proxyBaseUrl || state.proxyBaseUrl || '').replace(/\/+$/, '');
    if (!proxyBase) return `${ep.baseUrl.replace(/\/+$/, '')}${path}`;
    return `${proxyBase}${path}?target=${encodeURIComponent(ep.baseUrl.replace(/\/+$/, ''))}`;
}

async function fetchViaProxy(ep, path, options = {}) {
    const proxyUrl = getProxyUrl(ep, path);
    const directUrl = `${ep.baseUrl.replace(/\/+$/, '')}${path}`;
    const useProxy = proxyUrl !== directUrl;
    if (!useProxy) return fetch(directUrl, options);
    try {
        const res = await fetch(proxyUrl, options);
        if (res.status < 500) return res;
    } catch (e) {
        // proxy unreachable or CORS blocked, fall through to direct
    }
    return fetch(directUrl, options);
}

async function loadModels() {
    const ep = currentEndpoint();
    modelSelect.innerHTML = '<option value="" disabled selected>Loading models...</option>';
    statusIndicator.style.backgroundColor = '#f7630c';
    try {
        const headers = await getAuthHeaders(ep);
        const res = await fetchViaProxy(ep, '/models', { headers });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const models = (data.data || data.models || []).map(m => typeof m === 'string' ? { id: m } : m);
        modelSelect.innerHTML = '';
        if (!models.length) {
            modelSelect.innerHTML = '<option value="" disabled>No models</option>';
        } else {
            models.forEach(m => {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.textContent = m.id;
                modelSelect.appendChild(opt);
            });
            modelSelect.value = models[0].id;
        }
        statusIndicator.style.backgroundColor = '#0e7a0d';
        statusIndicator.title = 'Connected';
    } catch (e) {
        console.error(e);
        statusIndicator.style.backgroundColor = '#c50f1f';
        statusIndicator.title = 'Connection Failed';
        if (e instanceof TypeError && e.message.includes('fetch')) {
            showError('CORS blocked by this provider. Use a CORS-friendly endpoint (e.g. Google Gemini).');
        } else {
            showError('Failed to fetch models: ' + e.message);
        }
    }
}

// Chat management
function createChat(presetId = null) {
    presetId = presetId || state.currentPresetId || null;
    let ep = currentEndpoint();
    let modelId = ep?.defaultModel || '';
    let systemPrompt = ep?.systemPrompt || '';
    let tags = [];
    let title = 'New Chat';
    let folder = DEFAULT_FOLDER;
    if (presetId) {
        const preset = state.presets.find(p => p.id === presetId);
        if (preset) {
            if (preset.endpointId && state.endpoints.find(e => e.id === preset.endpointId)) {
                state.currentEndpointId = preset.endpointId;
                ep = currentEndpoint();
            }
            modelId = preset.modelId || modelId;
            systemPrompt = preset.systemPrompt || systemPrompt;
            tags = (preset.tags || []).map(t => t.trim()).filter(Boolean);
            title = preset.name;
        }
    }
    const chat = {
        id: generateId(),
        title: title,
        folder: folder,
        tags: tags,
        endpointId: ep?.id || state.currentEndpointId,
        modelId: modelId,
        systemPrompt: systemPrompt,
        pinned: false,
        messages: []
    };
    state.chats.unshift(chat);
    state.currentChatId = chat.id;
    saveChats();
    renderChatList();
    renderMessages(chat);
    return chat;
}

function setCurrentChat(id) {
    state.currentChatId = id;
    const chat = state.chats.find(c => c.id === id);
    if (chat) {
        state.currentEndpointId = chat.endpointId;
        endpointSelect.value = chat.endpointId;
        loadModels().then(() => { if (chat.modelId && modelSelect.querySelector(`option[value="${chat.modelId}"]`)) modelSelect.value = chat.modelId; });
        renderChatList();
        renderMessages(chat);
    }
    if (window.innerWidth <= 768) {
        sidebar.classList.remove('open');
        const overlay = $('sidebar-overlay');
        if (overlay) overlay.classList.remove('show');
    }
}

function applyPreset(presetId) {
    if (!presetId) return;
    state.currentPresetId = presetId;
    saveConfig();
    const preset = state.presets.find(p => p.id === presetId);
    if (!preset) return;
    if (preset.endpointId && state.endpoints.find(e => e.id === preset.endpointId)) {
        state.currentEndpointId = preset.endpointId;
        endpointSelect.value = preset.endpointId;
        loadModels().then(() => { if (preset.modelId) modelSelect.value = preset.modelId; });
    } else if (preset.modelId && modelSelect.querySelector(`option[value="${preset.modelId}"]`)) {
        modelSelect.value = preset.modelId;
    }
    const active = state.chats.find(c => c.id === state.currentChatId);
    if (preset.systemPrompt && active && !active.messages.length) {
        active.systemPrompt = preset.systemPrompt;
    }
}

function deleteChat(id) {
    state.chats = state.chats.filter(c => c.id !== id);
    if (state.currentChatId === id) state.currentChatId = null;
    saveChats();
    renderChatList();
    if (!state.currentChatId) chatContainer.innerHTML = `
        <div class="welcome-message"><h2>Welcome</h2><p>Select a model and start chatting.</p></div>`;
}

function togglePinChat(id) {
    const chat = state.chats.find(c => c.id === id);
    if (!chat) return;
    chat.pinned = !chat.pinned;
    saveChats();
    renderChatList();
}

let currentFolder = 'All';
let searchQuery = '';

function updateChatTitle(chat, text) {
    if (chat.title && chat.title !== 'New Chat') return;
    const first = text.trim().split(/\s+/).slice(0, 7).join(' ');
    chat.title = first.length > 28 ? first.slice(0, 28) + '...' : first || 'New Chat';
    saveChats();
    renderChatList();
}

function renderChatList() {
    const filtered = state.chats.filter(chat => {
        const matchesFolder = currentFolder === 'All' || chat.folder === currentFolder;
        const q = searchQuery.toLowerCase();
        const matchesSearch = !q ||
            (chat.title || '').toLowerCase().includes(q) ||
            (chat.tags || []).some(t => t.toLowerCase().includes(q)) ||
            (chat.messages || []).some(m => getMessageText(m.content).toLowerCase().includes(q));
        return matchesFolder && matchesSearch;
    }).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0));

    chatItems.innerHTML = '';
    if (!state.chats.length) {
        chatItems.innerHTML = '<div class="empty-state" style="padding:1rem;opacity:.6;font-size:.85rem;">No chats yet</div>';
    } else if (!filtered.length) {
        chatItems.innerHTML = '<div class="empty-state" style="padding:1rem;opacity:.6;font-size:.85rem;">No matching chats</div>';
    }

    filtered.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'chat-item' + (chat.id === state.currentChatId ? ' active' : '');
        const tagsHtml = (chat.tags || []).map(t => `<span class="chat-tag">${escapeHtml(t)}</span>`).join('');
        item.innerHTML = `
            <button class="pin-chat-btn" title="${chat.pinned ? 'Unpin' : 'Pin'}"><i class="fa-solid fa-thumbtack"></i></button>
            <div class="chat-item-main">
                <span class="chat-item-title"></span>
                <span class="chat-item-tags">${tagsHtml}</span>
            </div>
            <button class="delete-chat-btn" title="Delete"><i class="fa-solid fa-trash"></i></button>
        `;
        const pinBtn = item.querySelector('.pin-chat-btn');
        if (chat.pinned) pinBtn.classList.add('pinned');
        item.querySelector('.chat-item-title').textContent = chat.title;
        item.querySelector('.chat-item-title').title = `Folder: ${chat.folder || DEFAULT_FOLDER}`;
        item.addEventListener('click', (e) => {
            if (e.target.closest('.delete-chat-btn')) { deleteChat(chat.id); return; }
            if (e.target.closest('.pin-chat-btn')) { togglePinChat(chat.id); return; }
            setCurrentChat(chat.id);
        });
        chatItems.appendChild(item);
    });

    Array.from(folderList.children).forEach(pill => {
        pill.classList.toggle('active', pill.dataset.folder === currentFolder);
    });
}

function setChatFolder(id, folder) {
    const chat = state.chats.find(c => c.id === id);
    if (!chat) return;
    chat.folder = folder;
    saveChats();
    renderChatList();
}

function addChatTag(id, tag) {
    const chat = state.chats.find(c => c.id === id);
    if (!chat || !tag) return;
    if (!chat.tags) chat.tags = [];
    const t = tag.trim();
    if (t && !chat.tags.includes(t)) chat.tags.push(t);
    saveChats();
    renderChatList();
}

// Message rendering
function renderMessages(chat) {
    chatContainer.innerHTML = '';
    if (!chat) {
        chatContainer.innerHTML = `<div class="welcome-message"><h2>Welcome</h2><p>Select a model and start chatting.</p></div>`;
        return;
    }
    chat.messages.forEach((m, idx) => appendMessage(m.role, m.content, false, chat, idx, m.createdAt));
    scrollToBottom();
}

function scrollToBottom() {
    requestAnimationFrame(() => chatContainer.scrollTop = chatContainer.scrollHeight);
}

function appendMessage(role, content, animate = true, chat = null, msgIndex = -1, timestamp = null) {
    const msg = document.createElement('div');
    msg.className = `message ${role}`;
    msg.dataset.index = msgIndex;
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'user' ? 'You' : 'AI';
    const body = document.createElement('div');
    body.className = 'message-content markdown-body';
    if (timestamp) body.dataset.timestamp = timestamp;

    const actions = document.createElement('div');
    actions.className = 'msg-actions';
    actions.innerHTML = `
        <button class="msg-action-btn msg-copy-btn" title="Copy"><i class="fa-regular fa-copy"></i></button>
        ${role === 'user' ? '<button class="msg-action-btn msg-edit-btn" title="Edit"><i class="fa-solid fa-pen"></i></button>' : ''}
        ${role === 'ai' || role === 'assistant' ? '<button class="msg-action-btn msg-regen-btn" title="Regenerate"><i class="fa-solid fa-rotate"></i></button>' : ''}
        <button class="msg-action-btn msg-collapse-btn" title="Collapse"><i class="fa-solid fa-chevron-up"></i></button>
    `;
    body.appendChild(actions);

    const msgBody = document.createElement('div');
    msgBody.className = 'msg-body';
    if (role === 'user') {
        msgBody.appendChild(renderUserContent(content));
    } else {
        msgBody.innerHTML = marked.parse(content || '');
    }
    body.appendChild(msgBody);
    if (timestamp) {
        const timeEl = document.createElement('div');
        timeEl.className = 'message-time';
        timeEl.textContent = formatTimestamp(timestamp);
        body.appendChild(timeEl);
    }
    if ((role === 'ai' || role === 'assistant') && chat && msgIndex >= 0 && chat.messages[msgIndex]?.usage) {
        const u = chat.messages[msgIndex].usage;
        const usageEl = document.createElement('div');
        usageEl.className = 'msg-usage';
        usageEl.textContent = `${u.totalTokens.toLocaleString()} tokens · $${u.totalCost.toFixed(4)}`;
        body.appendChild(usageEl);
    }

    // Copy
    const copyBtn = actions.querySelector('.msg-copy-btn');
    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(msgBody.innerText).then(() => {
            copyBtn.classList.add('copied');
            copyBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
            setTimeout(() => { copyBtn.classList.remove('copied'); copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>'; }, 1500);
        });
    });

    // Collapse
    const collapseBtn = actions.querySelector('.msg-collapse-btn');
    collapseBtn.addEventListener('click', () => {
        const isCollapsed = body.classList.toggle('collapsed');
        collapseBtn.classList.toggle('collapsed', isCollapsed);
        collapseBtn.title = isCollapsed ? 'Expand' : 'Collapse';
        collapseBtn.innerHTML = isCollapsed ? '<i class="fa-solid fa-chevron-down"></i>' : '<i class="fa-solid fa-chevron-up"></i>';
    });

    // Edit user message
    if (role === 'user') {
        const editBtn = actions.querySelector('.msg-edit-btn');
        editBtn.addEventListener('click', () => {
            const text = getMessageText(content);
            easyMDE.value(text);
            if (chat && msgIndex >= 0) {
                chat.messages = chat.messages.slice(0, msgIndex);
                renderMessages(chat);
                saveChats();
            }
        });
    }

    // Regenerate AI message
    if ((role === 'ai' || role === 'assistant') && chat && msgIndex >= 0) {
        const regenBtn = actions.querySelector('.msg-regen-btn');
        regenBtn.addEventListener('click', () => {
            chat.messages = chat.messages.slice(0, msgIndex);
            saveChats();
            state.regenerating = true;
            sendMessage();
        });
    }

    msg.appendChild(avatar);
    msg.appendChild(body);
    chatContainer.appendChild(msg);
    scrollToBottom();
    return { msg, body };
}

function getMessageText(content) {
    if (Array.isArray(content)) {
        const textPart = content.find(p => p.type === 'text');
        return textPart ? textPart.text : '';
    }
    return content || '';
}

function renderUserContent(content) {
    const wrap = document.createElement('div');
    if (Array.isArray(content)) {
        content.forEach(part => {
            if (part.type === 'text') {
                const p = document.createElement('p');
                p.textContent = part.text;
                wrap.appendChild(p);
            } else if (part.type === 'image_url') {
                const img = document.createElement('img');
                img.src = part.image_url.url;
                img.style.maxWidth = '200px';
                img.style.borderRadius = '8px';
                img.style.marginTop = '0.5rem';
                wrap.appendChild(img);
            }
        });
    } else {
        const p = document.createElement('p');
        p.textContent = content;
        wrap.appendChild(p);
    }
    return wrap;
}

function buildApiContent(text, images) {
    if (!images.length) return text;
    const parts = [{ type: 'text', text }];
    images.forEach(url => parts.push({ type: 'image_url', image_url: { url } }));
    return parts;
}

// Streaming API
async function sendMessage() {
    if (state.isGenerating) return;
    const text = easyMDE.value().trim();
    const isRegen = state.regenerating;
    if (!isRegen && !text && !state.attachedImages.length) return;

    let chat = state.chats.find(c => c.id === state.currentChatId);
    if (!chat) chat = createChat();

    // Apply preset if currently selected for a new chat with no messages
    if (!isRegen && !chat.messages.length && state.currentPresetId) {
        const preset = state.presets.find(p => p.id === state.currentPresetId);
        if (preset) {
            if (preset.endpointId && state.endpoints.find(e => e.id === preset.endpointId)) {
                state.currentEndpointId = preset.endpointId;
                endpointSelect.value = preset.endpointId;
            }
            if (preset.modelId) chat.modelId = preset.modelId;
            chat.systemPrompt = preset.systemPrompt || chat.systemPrompt || '';
            chat.tags = (preset.tags || []).map(t => t.trim()).filter(Boolean);
        }
    }

    chat.modelId = modelSelect.value;
    chat.endpointId = state.currentEndpointId;

    // Inject system prompt if first message
    if (!chat.messages.length && chat.systemPrompt && chat.systemPrompt.trim()) {
        chat.messages.push({ role: 'system', content: chat.systemPrompt.trim() });
    }

    if (!isRegen) {
        const userContent = buildApiContent(text, state.attachedImages);
        chat.messages.push({ role: 'user', content: userContent, createdAt: new Date().toISOString() });
        appendMessage('user', userContent, true, chat, chat.messages.length - 1, chat.messages[chat.messages.length - 1].createdAt);
        if (chat.messages.length <= 2) updateChatTitle(chat, text);
        saveChats();
        easyMDE.value('');
        clearImages();
    }

    state.isGenerating = true;
    sendBtn.disabled = true;
    statusIndicator.style.backgroundColor = '#f7630c';

    const assistantCreatedAt = new Date().toISOString();
    const ai = appendMessage('ai', '', true, null, -1, assistantCreatedAt);
    const msgBody = ai.body.querySelector('.msg-body');
    let answerBuffer = '';
    let reasoningBuffer = '';
    let rawText = '';
    let hasReceivedData = false;
    let reasoningEl = null;
    let answerEl = null;
    let chunkCount = 0;
    let deltaCount = 0;
    let streamStart = performance.now();

    function ensureStreamingContainer() {
        if (hasReceivedData) return;
        msgBody.innerHTML = '';

        reasoningEl = document.createElement('details');
        reasoningEl.className = 'reasoning-content';
        reasoningEl.open = false;
        reasoningEl.style.cssText = 'margin-bottom:0.75rem;color:var(--text-secondary);font-size:0.9em;font-style:italic;border-left:2px solid var(--border-color);padding-left:0.75rem;';
        const summary = document.createElement('summary');
        summary.textContent = 'Thinking';
        summary.style.cssText = 'cursor:pointer;font-weight:500;color:var(--text-secondary);';
        reasoningEl.appendChild(summary);
        const reasoningBody = document.createElement('div');
        reasoningBody.className = 'reasoning-body';
        reasoningBody.style.whiteSpace = 'pre-wrap';
        reasoningEl.appendChild(reasoningBody);
        msgBody.appendChild(reasoningEl);

        answerEl = document.createElement('div');
        answerEl.className = 'answer-content';
        answerEl.style.whiteSpace = 'pre-wrap';
        msgBody.appendChild(answerEl);

        hasReceivedData = true;
    }

    function estimateTokens(text) {
        return Math.ceil(text.length / 4);
    }

    function appendReasoning(text) {
        ensureStreamingContainer();
        reasoningBuffer += text;
        const body = reasoningEl.querySelector('.reasoning-body');
        if (body) {
            body.textContent = reasoningBuffer;
            const summary = reasoningEl.querySelector('summary');
            if (summary) summary.textContent = `Thinking (${estimateTokens(reasoningBuffer)} tokens)`;
            scrollToBottom();
        }
    }

    function appendAnswer(text) {
        ensureStreamingContainer();
        answerBuffer += text;
        if (answerEl) {
            answerEl.textContent = answerBuffer;
            scrollToBottom();
        }
    }

    let ep = null;
    let usage = null;

    function finalizeDisplay(usageData = null) {
        const finalContent = answerBuffer || reasoningBuffer || '';
        if (!finalContent) {
            ai.msg.remove();
            return;
        }
        msgBody.innerHTML = marked.parse(finalContent);

        const usage = calculateUsageCost(usageData, ep, chat.messages, finalContent);
        const msg = { role: 'assistant', content: finalContent, createdAt: assistantCreatedAt, usage };
        chat.messages.push(msg);

        const usageFooter = document.createElement('div');
        usageFooter.className = 'msg-usage';
        usageFooter.textContent = `${usage.totalTokens.toLocaleString()} tokens · $${usage.totalCost.toFixed(4)}`;
        const contentDiv = ai.msg.querySelector('.message-content');
        if (contentDiv) contentDiv.appendChild(usageFooter);
    }

    try {
        ep = currentEndpoint();
        const headers = await getAuthHeaders(ep);
        const useStream = ep ? ep.stream !== false : true;
        const body = {
            model: chat.modelId,
            messages: chat.messages.map(m => ({ role: m.role, content: m.content })),
            stream: useStream
        };
        logToServer('INFO', 'Sending Message', { model: body.model, endpointId: chat.endpointId, stream: useStream });
        const controller = new AbortController();
        if (stopBtn) {
            stopBtn.hidden = false;
            sendBtn.hidden = true;
            stopBtn.addEventListener('click', () => controller.abort(), { once: true });
        }

        const res = await fetchViaProxy(ep, '/chat/completions', {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: controller.signal
        });
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error(getApiError(err, res.status));
        }

        if (!useStream) {
            const data = await res.json();
            const message = data.choices?.[0]?.message || {};
            answerBuffer = message.content || '';
            reasoningBuffer = message.reasoning_content || message.reasoning || '';
            usage = data.usage || null;
            finalizeDisplay(usage);
            saveChats();
            logToServer('INFO', 'Message Received', { len: answerBuffer.length || reasoningBuffer.length });
            statusIndicator.style.backgroundColor = '#0e7a0d';
            statusIndicator.title = 'Connected';
            return;
        }

        if (!res.body) {
            throw new Error('Streaming not supported by this browser or endpoint');
        }
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let pending = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunkCount++;
            const decoded = decoder.decode(value, { stream: true });
            pending += decoded;
            rawText += decoded;
            const lines = pending.split('\n');
            pending = lines.pop();
            for (const line of lines) {
                const chunk = parseSseLine(line);
                if (chunk) {
                    if (chunk.usage) usage = chunk.usage;
                    const delta = chunk.choices?.[0]?.delta || {};
                    const contentDelta = delta.content || '';
                    const reasoningDelta = delta.reasoning_content || '';
                    if (reasoningDelta) {
                        appendReasoning(reasoningDelta);
                        deltaCount++;
                    }
                    if (contentDelta) {
                        appendAnswer(contentDelta);
                        deltaCount++;
                    }
                }
            }
            // Yield to the browser's main thread so the UI can paint
            if (chunkCount % 5 === 0) {
                await new Promise(r => setTimeout(r, 0));
            }
        }
        logToServer('DEBUG', 'Stream done', { chunkCount, deltaCount, elapsedMs: Math.round(performance.now() - streamStart), answerLen: answerBuffer.length, reasoningLen: reasoningBuffer.length });

        finalizeDisplay(usage);
        saveChats();
        logToServer('INFO', 'Message Received', { len: answerBuffer.length || reasoningBuffer.length });
        statusIndicator.style.backgroundColor = '#0e7a0d';
        statusIndicator.title = 'Connected';
    } catch (e) {
        if (e.name === 'AbortError') {
            logToServer('INFO', 'Stream aborted by user', { len: answerBuffer.length || reasoningBuffer.length });
            if (answerBuffer || reasoningBuffer) {
                finalizeDisplay();
                saveChats();
            } else if (ai.msg) {
                ai.msg.remove();
            }
        } else {
            console.error(e);
            statusIndicator.style.backgroundColor = '#c50f1f';
            msgBody.innerHTML = `<em style="color:var(--error)">Error: ${escapeHtml(e.message)}</em>`;
            showError('Request failed: ' + e.message);
            logToServer('ERROR', 'Message Send Failed', e.message);
        }
    } finally {
        state.isGenerating = false;
        state.regenerating = false;
        sendBtn.disabled = false;
        if (stopBtn) stopBtn.hidden = true;
        sendBtn.hidden = false;
        scrollToBottom();
    }
}

function parseSseLine(line) {
    const s = line.trim();
    if (!s || s === 'data: [DONE]') return null;
    if (s.startsWith('data: ')) {
        try { return JSON.parse(s.slice(6)); } catch { return null; }
    }
    return null;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function formatTimestamp(iso) {
    if (!iso) return '';
    try {
        const d = new Date(iso);
        return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return '';
    }
}

function estimateTokens(text) {
    return Math.ceil((typeof text === 'string' ? text : getMessageText(text)).length / 4);
}

function calculateUsageCost(usage, endpoint, messagesBefore, outputText) {
    let promptTokens = 0;
    let completionTokens = 0;
    if (usage && typeof usage === 'object') {
        promptTokens = usage.prompt_tokens || 0;
        completionTokens = usage.completion_tokens || 0;
    } else {
        promptTokens = (messagesBefore || []).reduce((sum, m) => sum + estimateTokens(m.content), 0);
        completionTokens = estimateTokens(outputText);
    }
    const totalTokens = promptTokens + completionTokens;
    const inputCost = ((endpoint && endpoint.inputCost) || 0) * promptTokens / 1e6;
    const outputCost = ((endpoint && endpoint.outputCost) || 0) * completionTokens / 1e6;
    const totalCost = inputCost + outputCost;
    return { promptTokens, completionTokens, totalTokens, totalCost };
}

function getApiError(err, status) {
    let msg = `Error ${status}`;
    if (err.error) {
        if (typeof err.error === 'string') msg = err.error;
        else if (typeof err.error === 'object') {
            if (err.error.message) msg = err.error.message;
            else if (err.error.detail) msg = err.error.detail;
            else msg = JSON.stringify(err.error);
        }
    } else if (err.detail) {
        msg = typeof err.detail === 'string' ? err.detail : JSON.stringify(err.detail);
    } else if (err.message) {
        msg = err.message;
    }
    return msg;
}

// Images
function handleImageUpload(files) {
    Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            state.attachedImages.push(e.target.result);
            renderImagePreviews();
        };
        reader.readAsDataURL(file);
    });
    imageUpload.value = '';
}

function renderImagePreviews() {
    imagePreviewContainer.innerHTML = '';
    if (!state.attachedImages.length) {
        imagePreviewContainer.classList.add('hidden');
        return;
    }
    imagePreviewContainer.classList.remove('hidden');
    state.attachedImages.forEach((url, i) => {
        const item = document.createElement('div');
        item.className = 'image-preview-item';
        item.innerHTML = `<img src="${url}"><button class="remove-image-btn">&times;</button>`;
        item.querySelector('button').addEventListener('click', () => {
            state.attachedImages.splice(i, 1);
            renderImagePreviews();
        });
        imagePreviewContainer.appendChild(item);
    });
}

function clearImages() {
    state.attachedImages = [];
    renderImagePreviews();
}

// Settings
function openSettings() {
    settingsModal.classList.add('show');
    endpointForm.classList.add('hidden');
    presetForm.classList.add('hidden');
    renderEndpointsList();
    renderPresetsList();
    const proxyInput = $('proxy-base-url');
    if (proxyInput) proxyInput.value = state.proxyBaseUrl || '';
}
function closeSettings() { settingsModal.classList.remove('show'); }

function renderEndpointsList() {
    endpointsList.innerHTML = '';
    state.endpoints.forEach(ep => {
        const item = document.createElement('div');
        item.className = 'endpoint-item';
        item.innerHTML = `
            <div class="endpoint-info">
                <h4></h4>
                <p></p>
            </div>
            <div class="endpoint-actions">
                <button class="edit-btn" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button class="delete-btn" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        item.querySelector('h4').textContent = ep.name;
        item.querySelector('p').textContent = ep.baseUrl;
        item.querySelector('.edit-btn').addEventListener('click', () => editEndpoint(ep.id));
        item.querySelector('.delete-btn').addEventListener('click', () => {
            if (confirm('Delete this endpoint?')) {
                state.endpoints = state.endpoints.filter(e => e.id !== ep.id);
                if (state.currentEndpointId === ep.id) {
                    state.currentEndpointId = state.endpoints[0]?.id || null;
                }
                saveConfig();
                renderEndpointsList();
                if (state.endpoints.length === 1 && settingsModal.classList.contains('show')) {
                    endpointForm.classList.add('hidden');
                }
            }
        });
        endpointsList.appendChild(item);
    });
}

function resetEndpointForm() {
    $('edit-id').value = '';
    $('form-title').textContent = 'Add Endpoint';
    $('edit-name').value = '';
    $('edit-url').value = '';
    $('edit-auth-type').value = 'api-key';
    $('edit-key').value = '';
    $('edit-system-prompt').value = '';
    $('edit-default-model').value = '';
    $('edit-stream').checked = true;
    $('edit-input-cost').value = '';
    $('edit-output-cost').value = '';
    $('edit-token-url').value = '';
    $('edit-client-id').value = '';
    $('edit-client-secret').value = '';
    $('edit-scope').value = '';
    $('edit-apikey-group').classList.remove('hidden');
    $('edit-oauth-group').classList.add('hidden');
    endpointForm.classList.remove('hidden');
}

function editEndpoint(id) {
    const ep = state.endpoints.find(e => e.id === id);
    if (!ep) return;
    $('edit-id').value = ep.id;
    $('form-title').textContent = 'Edit Endpoint';
    $('edit-name').value = ep.name;
    $('edit-url').value = ep.baseUrl;
    $('edit-auth-type').value = ep.authType;
    $('edit-key').value = ep.apiKey || '';
    $('edit-system-prompt').value = ep.systemPrompt || '';
    $('edit-default-model').value = ep.defaultModel || '';
    $('edit-stream').checked = ep.stream !== false;
    $('edit-input-cost').value = ep.inputCost || '';
    $('edit-output-cost').value = ep.outputCost || '';
    $('edit-token-url').value = ep.tokenUrl || '';
    $('edit-client-id').value = ep.clientId || '';
    $('edit-client-secret').value = ep.clientSecret || '';
    $('edit-scope').value = ep.scope || '';
    toggleOAuthFields();
    endpointForm.classList.remove('hidden');
}

function toggleOAuthFields() {
    const isOauth = $('edit-auth-type').value === 'oauth2';
    $('edit-apikey-group').classList.toggle('hidden', isOauth);
    $('edit-oauth-group').classList.toggle('hidden', !isOauth);
}

function saveEndpointFromForm() {
    const raw = {
        id: $('edit-id').value || undefined,
        name: $('edit-name').value.trim(),
        baseUrl: $('edit-url').value.trim(),
        authType: $('edit-auth-type').value,
        apiKey: $('edit-key').value,
        systemPrompt: $('edit-system-prompt').value.trim(),
        defaultModel: $('edit-default-model').value.trim(),
        stream: $('edit-stream').checked,
        inputCost: $('edit-input-cost').value,
        outputCost: $('edit-output-cost').value,
        tokenUrl: $('edit-token-url').value.trim(),
        clientId: $('edit-client-id').value.trim(),
        clientSecret: $('edit-client-secret').value,
        scope: $('edit-scope').value.trim()
    };
    if (!raw.name || !raw.baseUrl) { showError('Name and Base URL required'); return; }
    const ep = normalizeEndpoint(raw);
    const idx = state.endpoints.findIndex(e => e.id === ep.id);
    if (idx >= 0) state.endpoints[idx] = ep;
    else state.endpoints.push(ep);
    if (!state.currentEndpointId) state.currentEndpointId = ep.id;
    saveConfig();
    endpointForm.classList.add('hidden');
    renderEndpointsList();
    renderEndpointSelect();
}

// Preset / Agent management
function renderPresetSelect() {
    presetSelect.innerHTML = '<option value="">No Agent</option>';
    state.presets.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        presetSelect.appendChild(opt);
    });
    presetSelect.value = state.currentPresetId || '';
}

function renderPresetsList() {
    presetsList.innerHTML = '';
    if (!state.presets.length) {
        presetsList.innerHTML = '<div style="padding:0.5rem 0;opacity:.6;font-size:.85rem;">No agents yet</div>';
        return;
    }
    state.presets.forEach(p => {
        const item = document.createElement('div');
        item.className = 'endpoint-item';
        item.innerHTML = `
            <div class="endpoint-info"><h4></h4><p></p></div>
            <div class="endpoint-actions">
                <button class="edit-preset-btn" title="Edit"><i class="fa-solid fa-pen"></i></button>
                <button class="delete-preset-btn" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        item.querySelector('h4').textContent = p.name;
        const epName = (state.endpoints.find(e => e.id === p.endpointId) || {}).name || p.endpointId || 'Current endpoint';
        item.querySelector('p').textContent = `${epName} • ${p.modelId || 'default model'}`;
        item.querySelector('.edit-preset-btn').addEventListener('click', () => editPreset(p.id));
        item.querySelector('.delete-preset-btn').addEventListener('click', () => {
            if (confirm('Delete this agent?')) {
                state.presets = state.presets.filter(x => x.id !== p.id);
                if (state.currentPresetId === p.id) state.currentPresetId = null;
                saveConfig();
                renderPresetsList();
                renderPresetSelect();
            }
        });
        presetsList.appendChild(item);
    });
}

function resetPresetForm() {
    $('preset-edit-id').value = '';
    $('preset-form-title').textContent = 'Add Agent';
    $('preset-name').value = '';
    renderPresetEndpointOptions();
    $('preset-model').value = '';
    $('preset-prompt').value = '';
    $('preset-tags').value = '';
    presetForm.classList.remove('hidden');
}

function renderPresetEndpointOptions() {
    const sel = $('preset-endpoint');
    sel.innerHTML = '';
    state.endpoints.forEach(ep => {
        const opt = document.createElement('option');
        opt.value = ep.id;
        opt.textContent = ep.name;
        sel.appendChild(opt);
    });
    sel.value = state.currentEndpointId || state.endpoints[0]?.id || '';
}

function editPreset(id) {
    const p = state.presets.find(x => x.id === id);
    if (!p) return;
    $('preset-edit-id').value = p.id;
    $('preset-form-title').textContent = 'Edit Agent';
    $('preset-name').value = p.name;
    renderPresetEndpointOptions();
    $('preset-endpoint').value = p.endpointId || state.currentEndpointId || '';
    $('preset-model').value = p.modelId || '';
    $('preset-prompt').value = p.systemPrompt || '';
    $('preset-tags').value = (p.tags || []).join(', ');
    presetForm.classList.remove('hidden');
}

function savePresetFromForm() {
    const raw = {
        id: $('preset-edit-id').value || undefined,
        name: $('preset-name').value.trim(),
        endpointId: $('preset-endpoint').value,
        modelId: $('preset-model').value.trim(),
        systemPrompt: $('preset-prompt').value.trim(),
        tags: $('preset-tags').value.split(',').map(t => t.trim()).filter(Boolean)
    };
    if (!raw.name) { showError('Agent name required'); return; }
    const preset = normalizePreset(raw);
    const idx = state.presets.findIndex(p => p.id === preset.id);
    if (idx >= 0) state.presets[idx] = preset;
    else state.presets.push(preset);
    saveConfig();
    presetForm.classList.add('hidden');
    renderPresetsList();
    renderPresetSelect();
}

// Export / Import chats
function exportChats() {
    const data = JSON.stringify(state.chats, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `aiui-chats-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importChats(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const parsed = JSON.parse(e.target.result);
            if (!Array.isArray(parsed)) throw new Error('Invalid chats file');
            state.chats = parsed.map(c => ({
                id: c.id || generateId(),
                title: c.title || 'Imported Chat',
                folder: c.folder || DEFAULT_FOLDER,
                tags: Array.isArray(c.tags) ? c.tags : [],
                endpointId: c.endpointId,
                modelId: c.modelId,
                systemPrompt: c.systemPrompt || '',
                messages: Array.isArray(c.messages) ? c.messages : []
            }));
            state.currentChatId = state.chats[0]?.id || null;
            saveChats();
            renderChatList();
            if (state.currentChatId) setCurrentChat(state.currentChatId);
            else chatContainer.innerHTML = `<div class="welcome-message"><h2>Welcome</h2><p>Select a model and start chatting.</p></div>`;
            showError('Chats imported successfully');
        } catch (err) {
            showError('Import failed: ' + err.message);
        }
    };
    reader.readAsText(file);
}

function renderEndpointSelect() {
    endpointSelect.innerHTML = '';
    state.endpoints.forEach(ep => {
        const opt = document.createElement('option');
        opt.value = ep.id;
        opt.textContent = ep.name;
        endpointSelect.appendChild(opt);
    });
    endpointSelect.value = state.currentEndpointId;
}

// Init
function initApp() {
    renderEndpointSelect();
    renderPresetSelect();
    loadModels().then(() => {
        const active = state.chats.find(c => c.id === state.currentChatId);
        if (active && active.modelId && modelSelect.querySelector(`option[value="${active.modelId}"]`)) {
            modelSelect.value = active.modelId;
        } else if (state.currentPresetId) {
            const preset = state.presets.find(p => p.id === state.currentPresetId);
            if (preset && preset.modelId && modelSelect.querySelector(`option[value="${preset.modelId}"]`)) modelSelect.value = preset.modelId;
        }
    });
    renderChatList();

    endpointSelect.addEventListener('change', () => {
        state.currentEndpointId = endpointSelect.value;
        state.currentPresetId = null;
        presetSelect.value = '';
        saveConfig();
        loadModels();
    });

    presetSelect.addEventListener('change', () => {
        state.currentPresetId = presetSelect.value || null;
        saveConfig();
        applyPreset(state.currentPresetId);
    });

    modelSelect.addEventListener('change', () => {
        const chat = state.chats.find(c => c.id === state.currentChatId);
        if (chat) { chat.modelId = modelSelect.value; saveChats(); }
    });

    chatSearch.addEventListener('input', (e) => {
        searchQuery = e.target.value.trim().toLowerCase();
        renderChatList();
    });

    folderList.addEventListener('click', (e) => {
        const pill = e.target.closest('.folder-pill');
        if (!pill) return;
        currentFolder = pill.dataset.folder;
        renderChatList();
    });

    sendBtn.addEventListener('click', sendMessage);
    if (themeToggleBtn) themeToggleBtn.addEventListener('click', cycleTheme);
    attachBtn.addEventListener('click', () => imageUpload.click());
    imageUpload.addEventListener('change', (e) => handleImageUpload(e.target.files));
    newChatBtn.addEventListener('click', () => createChat(state.currentPresetId));
    const sidebarOverlay = $('sidebar-overlay');
    menuBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        sidebarOverlay.classList.toggle('show');
    });
    sidebarOverlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('show');
    });
    $('refresh-models-btn').addEventListener('click', loadModels);
    $('settings-btn').addEventListener('click', openSettings);
    document.querySelector('#settings-modal .close-btn').addEventListener('click', closeSettings);
    settingsModal.addEventListener('click', (e) => { if (e.target === settingsModal) closeSettings(); });
    $('add-endpoint-btn').addEventListener('click', resetEndpointForm);
    $('cancel-edit-btn').addEventListener('click', () => endpointForm.classList.add('hidden'));
    $('save-endpoint-btn').addEventListener('click', saveEndpointFromForm);
    $('edit-auth-type').addEventListener('change', toggleOAuthFields);
    $('add-preset-btn').addEventListener('click', () => { renderPresetEndpointOptions(); resetPresetForm(); });
    $('cancel-preset-btn').addEventListener('click', () => presetForm.classList.add('hidden'));
    $('save-preset-btn').addEventListener('click', savePresetFromForm);
    $('export-config-btn').addEventListener('click', exportConfig);
    $('export-chats-btn').addEventListener('click', exportChats);
    $('import-chats-btn').addEventListener('click', () => $('import-chats-input').click());
    $('import-chats-input').addEventListener('change', (e) => { if (e.target.files[0]) { importChats(e.target.files[0]); e.target.value = ''; } });
    $('clear-chats-btn').addEventListener('click', clearAllChats);
    $('clear-cache-btn').addEventListener('click', clearAllCaches);
    $('save-proxy-btn').addEventListener('click', () => {
        const input = $('proxy-base-url');
        state.proxyBaseUrl = (input.value || '').trim().replace(/\/+$/, '');
        saveConfig();
        showError('Proxy URL saved');
    });

    easyMDE = new EasyMDE({
        element: document.getElementById('user-input'),
        toolbar: false,
        status: false,
        autofocus: false,
        spellChecker: false,
        placeholder: 'Type a message...',
        minHeight: '24px',
        maxHeight: '120px',
        initialValue: ''
    });
    // Force compact editor dimensions
    const cm = easyMDE.codemirror;
    cm.setSize('100%', 'auto');
    const cmEl = cm.getWrapperElement();
    cmEl.style.height = 'auto';
    cmEl.style.minHeight = '0';
    cmEl.style.maxHeight = '120px';
    cmEl.style.padding = '0';
    const scrollEl = cmEl.querySelector('.CodeMirror-scroll');
    if (scrollEl) {
        scrollEl.style.minHeight = '24px';
        scrollEl.style.maxHeight = '120px';
        scrollEl.style.padding = '0';
        scrollEl.style.margin = '0';
    }
    const sizerEl = cmEl.querySelector('.CodeMirror-sizer');
    if (sizerEl) {
        sizerEl.style.minHeight = '0';
        sizerEl.style.padding = '0';
    }
    cm.refresh();
    easyMDE.codemirror.on('keydown', (cm, e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    marked.setOptions({
        gfm: true,
        breaks: true,
        headerIds: false,
        mangle: false,
        highlight: (code, lang) => {
            if (lang && hljs.getLanguage(lang)) return hljs.highlight(code, { language: lang }).value;
            return hljs.highlightAuto(code).value;
        }
    });

    // Escape raw HTML in model output to avoid XSS
    marked.use({
        renderer: {
            html(token) {
                const text = typeof token === 'string' ? token : (token.text || token.raw || '');
                return escapeHtml(text);
            }
        }
    });
}

function exportConfig() {
    const data = JSON.stringify({
        endpoints: state.endpoints,
        currentEndpointId: state.currentEndpointId,
        presets: state.presets,
        currentPresetId: state.currentPresetId,
        proxyBaseUrl: state.proxyBaseUrl
    }, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'ai-chat-config.json';
    a.click();
    URL.revokeObjectURL(url);
}

function clearAllChats() {
    if (!confirm('Delete all chats?')) return;
    state.chats = [];
    state.currentChatId = null;
    saveChats();
    renderChatList();
    chatContainer.innerHTML = `
        <div class="welcome-message"><h2>Welcome</h2><p>Select a model and start chatting.</p></div>`;
}

function clearAllCaches() {
    if (!confirm('Delete all AI-UI browser caches and reload?')) return;
    try {
        Object.keys(localStorage)
            .filter(k => k.startsWith('aiui_'))
            .forEach(k => localStorage.removeItem(k));
    } catch (e) {}
    location.reload();
}

// Bootstrap
function init() {
    initTheme();
    loadChats();
    if (loadConfig()) {
        bootApp();
    } else {
        initSetup();
    }
}

document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter to send
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        sendMessage();
        return;
    }
    // / focuses chat search when not typing in an input
    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName) && !e.target.isContentEditable) {
        e.preventDefault();
        chatSearch.focus();
        return;
    }
    // Esc closes modals/sidebar
    if (e.key === 'Escape') {
        closeSettings();
        if (sidebar) sidebar.classList.remove('open');
        const overlay = $('sidebar-overlay');
        if (overlay) overlay.classList.remove('show');
    }
});

document.addEventListener('DOMContentLoaded', init);
