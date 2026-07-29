const CONFIG_KEY = 'aiui_config';
const CHATS_KEY = 'aiui_chats';

const state = {
    endpoints: [],
    currentEndpointId: null,
    chats: [],
    currentChatId: null,
    isGenerating: false,
    attachedImages: []
};

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
const modelSelect = document.getElementById('model-select');
const statusIndicator = document.getElementById('status-indicator');
const chatList = document.getElementById('chat-list');
const chatContainer = document.getElementById('chat-container');
const imageUpload = document.getElementById('image-upload');
const imagePreviewContainer = document.getElementById('image-preview-container');
const sendBtn = document.getElementById('send-btn');
const attachBtn = document.getElementById('attach-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const menuBtn = document.getElementById('menu-btn');
const sidebar = document.getElementById('sidebar');
const settingsModal = document.getElementById('settings-modal');
const endpointsList = document.getElementById('endpoints-list');
const endpointForm = document.getElementById('endpoint-form');

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

// Config
function loadConfig() {
    const cfg = getStorage(CONFIG_KEY, null);
    if (cfg && Array.isArray(cfg.endpoints) && cfg.endpoints.length) {
        state.endpoints = cfg.endpoints;
        state.currentEndpointId = cfg.currentEndpointId || cfg.endpoints[0].id;
        return true;
    }
    return false;
}
function saveConfig() {
    setStorage(CONFIG_KEY, { endpoints: state.endpoints, currentEndpointId: state.currentEndpointId });
}
function loadChats() { state.chats = getStorage(CHATS_KEY, []); }
function saveChats() { setStorage(CHATS_KEY, state.chats); }

function normalizeEndpoint(raw) {
    return {
        id: raw.id || generateId(),
        name: raw.name || 'Unnamed',
        baseUrl: (raw.baseUrl || raw.url || raw.base_url || '').replace(/\/$/, ''),
        authType: raw.authType || 'api-key',
        apiKey: raw.apiKey || raw.api_key || raw.key || '',
        tokenUrl: raw.tokenUrl || raw.token_url || '',
        clientId: raw.clientId || raw.client_id || '',
        clientSecret: raw.clientSecret || raw.client_secret || '',
        scope: raw.scope || ''
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
            scope: $('setup-scope').value.trim()
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
async function loadModels() {
    const ep = currentEndpoint();
    modelSelect.innerHTML = '<option value="" disabled selected>Loading models...</option>';
    statusIndicator.style.backgroundColor = '#f7630c';
    try {
        const res = await fetch('/api/models', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: ep })
        });
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
        showError('Failed to fetch models: ' + e.message);
    }
}

// Chat management
function createChat() {
    const chat = {
        id: generateId(),
        title: 'New Chat',
        endpointId: state.currentEndpointId,
        modelId: modelSelect.value,
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
        loadModels().then(() => { if (chat.modelId) modelSelect.value = chat.modelId; });
        renderChatList();
        renderMessages(chat);
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

function updateChatTitle(chat, text) {
    const first = text.trim().split(/\s+/).slice(0, 5).join(' ');
    chat.title = first.length > 24 ? first.slice(0, 24) + '...' : first || 'New Chat';
    saveChats();
    renderChatList();
}

function renderChatList() {
    chatList.innerHTML = '';
    state.chats.forEach(chat => {
        const item = document.createElement('div');
        item.className = 'chat-item' + (chat.id === state.currentChatId ? ' active' : '');
        item.innerHTML = `
            <span class="chat-item-title"></span>
            <button class="delete-chat-btn" title="Delete"><i class="fa-solid fa-trash"></i></button>
        `;
        item.querySelector('.chat-item-title').textContent = chat.title;
        item.addEventListener('click', (e) => {
            if (e.target.closest('.delete-chat-btn')) { deleteChat(chat.id); return; }
            setCurrentChat(chat.id);
        });
        chatList.appendChild(item);
    });
}

// Message rendering
function renderMessages(chat) {
    chatContainer.innerHTML = '';
    chat.messages.forEach(m => appendMessage(m.role, m.content, false));
    scrollToBottom();
}

function scrollToBottom() { chatContainer.scrollTop = chatContainer.scrollHeight; }

function appendMessage(role, content, animate = true) {
    const msg = document.createElement('div');
    msg.className = `message ${role}${animate ? '' : ''}`;
    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'user' ? 'You' : 'AI';
    const body = document.createElement('div');
    body.className = 'message-content';

    // Action buttons (copy + collapse)
    const actions = document.createElement('div');
    actions.className = 'msg-actions';
    actions.innerHTML = `<button class="msg-action-btn msg-copy-btn" title="Copy"><i class="fa-regular fa-copy"></i></button><button class="msg-action-btn msg-collapse-btn" title="Collapse"><i class="fa-solid fa-chevron-up"></i></button>`;
    body.appendChild(actions);

    // Message body wrapper
    const msgBody = document.createElement('div');
    msgBody.className = 'msg-body';
    if (role === 'user') {
        msgBody.appendChild(renderUserContent(content));
    } else {
        const md = document.createElement('div');
        md.className = 'markdown-body';
        md.innerHTML = marked.parse(content || '');
        msgBody.appendChild(md);
    }
    body.appendChild(msgBody);

    // Wire copy button
    const copyBtn = actions.querySelector('.msg-copy-btn');
    copyBtn.addEventListener('click', () => {
        navigator.clipboard.writeText(msgBody.innerText).then(() => {
            copyBtn.classList.add('copied');
            copyBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
            setTimeout(() => {
                copyBtn.classList.remove('copied');
                copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
            }, 1500);
        });
    });

    // Wire collapse button
    const collapseBtn = actions.querySelector('.msg-collapse-btn');
    collapseBtn.addEventListener('click', () => {
        const isCollapsed = body.classList.toggle('collapsed');
        collapseBtn.classList.toggle('collapsed', isCollapsed);
        collapseBtn.title = isCollapsed ? 'Expand' : 'Collapse';
        collapseBtn.innerHTML = isCollapsed
            ? '<i class="fa-solid fa-chevron-down"></i>'
            : '<i class="fa-solid fa-chevron-up"></i>';
    });

    msg.appendChild(avatar);
    msg.appendChild(body);
    chatContainer.appendChild(msg);
    scrollToBottom();
    return { msg, body };
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
    if (!text && !state.attachedImages.length) return;

    let chat = state.chats.find(c => c.id === state.currentChatId);
    if (!chat) chat = createChat();
    chat.modelId = modelSelect.value;
    chat.endpointId = state.currentEndpointId;

    const userContent = buildApiContent(text, state.attachedImages);
    chat.messages.push({ role: 'user', content: userContent });
    appendMessage('user', userContent);
    if (chat.messages.length === 1) updateChatTitle(chat, text);
    saveChats();
    easyMDE.value('');
    clearImages();

    state.isGenerating = true;
    sendBtn.disabled = true;
    statusIndicator.style.backgroundColor = '#f7630c';

    const ai = appendMessage('ai', '');
    const md = ai.body.querySelector('.markdown-body');
    let buffer = '';

    try {
        const ep = currentEndpoint();
        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                endpoint: ep,
                model: chat.modelId,
                messages: chat.messages.map(m => ({ role: m.role, content: m.content })),
                stream: true
            })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let pending = '';
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            pending += decoder.decode(value, { stream: true });
            const lines = pending.split('\n');
            pending = lines.pop();
            for (const line of lines) {
                const chunk = parseSseLine(line);
                if (chunk) {
                    const delta = chunk.choices?.[0]?.delta?.content || '';
                    if (delta) {
                        buffer += delta;
                        md.innerHTML = marked.parse(buffer);
                        scrollToBottom();
                    }
                }
            }
        }
        if (buffer) {
            md.innerHTML = marked.parse(buffer);
            chat.messages.push({ role: 'assistant', content: buffer });
            saveChats();
        } else {
            ai.msg.remove();
        }
        statusIndicator.style.backgroundColor = '#0e7a0d';
    } catch (e) {
        console.error(e);
        statusIndicator.style.backgroundColor = '#c50f1f';
        md.innerHTML = `<em style="color:var(--error)">Error: ${escapeHtml(e.message)}</em>`;
        showError('Request failed: ' + e.message);
    } finally {
        state.isGenerating = false;
        sendBtn.disabled = false;
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
    renderEndpointsList();
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
    loadModels();
    renderChatList();

    endpointSelect.addEventListener('change', () => {
        state.currentEndpointId = endpointSelect.value;
        saveConfig();
        loadModels();
    });

    modelSelect.addEventListener('change', () => {
        const chat = state.chats.find(c => c.id === state.currentChatId);
        if (chat) { chat.modelId = modelSelect.value; saveChats(); }
    });

    sendBtn.addEventListener('click', sendMessage);
    attachBtn.addEventListener('click', () => imageUpload.click());
    imageUpload.addEventListener('change', (e) => handleImageUpload(e.target.files));
    newChatBtn.addEventListener('click', createChat);
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
    $('export-config-btn').addEventListener('click', exportConfig);
    $('clear-chats-btn').addEventListener('click', clearAllChats);

    easyMDE = new EasyMDE({
        element: document.getElementById('user-input'),
        toolbar: false,
        status: false,
        autofocus: false,
        spellChecker: false,
        minHeight: '0px',
        maxHeight: '120px',
        initialValue: ''
    });
    // Force compact editor dimensions
    easyMDE.codemirror.setSize('100%', 'auto');
    const cmEl = easyMDE.codemirror.getWrapperElement();
    if (cmEl) {
        cmEl.style.height = 'auto';
        cmEl.style.minHeight = '0px';
        cmEl.style.maxHeight = '120px';
    }
    easyMDE.codemirror.refresh();
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
}

function exportConfig() {
    const data = JSON.stringify({ endpoints: state.endpoints, currentEndpointId: state.currentEndpointId }, null, 2);
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

// Bootstrap
function init() {
    loadChats();
    if (loadConfig()) {
        bootApp();
    } else {
        initSetup();
    }
}

document.addEventListener('DOMContentLoaded', init);
