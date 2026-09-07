const modelSelect = document.getElementById('model-select');
const refreshModelsBtn = document.getElementById('refresh-models-btn');
const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const stopBtn = document.getElementById('stop-btn');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const statusIndicator = document.getElementById('status-indicator');
const chatListDiv = document.getElementById('chat-list');
const newChatBtn = document.getElementById('new-chat-btn');
const menuBtn = document.getElementById('menu-btn');
const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebar-overlay');

// Image Upload Elements
const imageUploadInput = document.getElementById('image-upload');
const attachBtn = document.getElementById('attach-btn');
const imagePreviewContainer = document.getElementById('image-preview-container');

// State for images
let draftImages = []; // Array of base64 strings

// Settings Elements
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeBtn = document.querySelector('.close-btn');
const endpointSelect = document.getElementById('endpoint-select');
const endpointsList = document.getElementById('endpoints-list');
const addEndpointBtn = document.getElementById('add-endpoint-btn');
const endpointForm = document.getElementById('endpoint-form');
const saveEndpointBtn = document.getElementById('save-endpoint-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');

// Form Inputs
const editId = document.getElementById('edit-id');
const editName = document.getElementById('edit-name');
const editUrl = document.getElementById('edit-url');
const editKey = document.getElementById('edit-key');
const editAuthType = document.getElementById('edit-auth-type');
const editDefaultModel = document.getElementById('edit-default-model');
const editStream = document.getElementById('edit-stream');
const editInputCost = document.getElementById('edit-input-cost');
const editOutputCost = document.getElementById('edit-output-cost');
const editSystemPrompt = document.getElementById('edit-system-prompt');
const authApiKeyGroup = document.getElementById('auth-api-key');
const authOauthGroup = document.getElementById('auth-oauth');
const editTokenUrl = document.getElementById('edit-token-url');
const editClientId = document.getElementById('edit-client-id');
const editClientSecret = document.getElementById('edit-client-secret');
const editScope = document.getElementById('edit-scope');

const presetSelect = document.getElementById('preset-select');
const chatSearch = document.getElementById('chat-search');
const folderList = document.getElementById('folder-list');
const chatItems = document.getElementById('chat-items');
const presetsList = document.getElementById('presets-list');
const presetForm = document.getElementById('preset-form');
const exportChatsBtn = document.getElementById('export-chats-btn');
const importChatsBtn = document.getElementById('import-chats-btn');
const importChatsInput = document.getElementById('import-chats-input');
const addPresetBtn = document.getElementById('add-preset-btn');
const cancelPresetBtn = document.getElementById('cancel-preset-btn');
const savePresetBtn = document.getElementById('save-preset-btn');


// crypto.randomUUID polyfill for Safari 15.3 and below
if (!crypto.randomUUID) {
    crypto.randomUUID = function() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    };
}


// ... (renderChatList update) ...

function renderChatList() {
    chatItems.innerHTML = '';
    const q = searchQuery.toLowerCase();
    const filtered = state.chats.filter(chat => {
        const inFolder = currentFolder === 'All' || chat.folder === currentFolder || (currentFolder === DEFAULT_FOLDER && !chat.folder);
        if (!q) return inFolder;
        const hay = `${chat.title || ''} ${(chat.tags || []).join(' ')} ${chat.messages.map(m => getMessageText(m.content)).join(' ')}`.toLowerCase();
        return inFolder && hay.includes(q);
    }).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.timestamp - a.timestamp);

    filtered.forEach(chat => {
        const div = document.createElement('div');
        div.className = 'chat-item';
        if (chat.id === state.currentChatId) {
            div.classList.add('active');
        }

        const endpoint = state.endpoints.find(e => e.id === chat.endpointId);
        const endpointName = endpoint ? endpoint.name : (chat.endpointId ? 'Unknown' : 'No Endpoint');
        const modelName = chat.modelId || 'No Model';
        const dateStr = new Date(chat.timestamp).toLocaleString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const contentDiv = document.createElement('div');
        contentDiv.className = 'chat-content';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'chat-title';
        titleDiv.textContent = chat.title || 'New Chat';

        const tagsDiv = document.createElement('div');
        tagsDiv.className = 'chat-item-tags';
        if (chat.tags && chat.tags.length) {
            chat.tags.slice(0, 4).forEach(tag => {
                const span = document.createElement('span');
                span.className = 'chat-tag';
                span.textContent = tag;
                tagsDiv.appendChild(span);
            });
        }

        const metaDiv = document.createElement('div');
        metaDiv.className = 'chat-meta';
        metaDiv.textContent = `${endpointName} • ${modelName} • ${chat.folder || DEFAULT_FOLDER} • ${dateStr}`;

        contentDiv.appendChild(titleDiv);
        if (chat.tags && chat.tags.length) contentDiv.appendChild(tagsDiv);
        contentDiv.appendChild(metaDiv);

        const pinBtn = document.createElement('button');
        pinBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="${chat.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2 4h4l-2 2 1 6-5 5-5-5 1-6-2-2h4z"></path></svg>`;
        pinBtn.className = 'pin-chat-btn';
        pinBtn.title = chat.pinned ? 'Unpin' : 'Pin';
        pinBtn.onclick = (e) => { e.stopPropagation(); togglePinChat(chat.id); };

        const delBtn = document.createElement('button');
        delBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
        delBtn.className = 'delete-chat-btn';
        delBtn.onclick = (e) => { e.stopPropagation(); deleteChat(chat.id); };

        div.onclick = () => setCurrentChat(chat.id);
        div.appendChild(contentDiv);
        div.appendChild(pinBtn);
        div.appendChild(delBtn);
        chatItems.appendChild(div);
    });

    // Update folder pills UI
    Array.from(folderList.children).forEach(pill => {
        pill.classList.toggle('active', pill.dataset.folder === currentFolder);
    });
}

// ... (renderEndpointsList update) ...

function renderEndpointsList() {
    endpointsList.innerHTML = '';
    state.endpoints.forEach(ep => {
        const item = document.createElement('div');
        item.className = 'endpoint-item';
        item.innerHTML = `
            <div class="endpoint-info">
                <h4></h4>
            </div>
            <div class="endpoint-actions">
                <button class="edit-ep-btn icon-btn" title="Edit">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="delete-ep-btn icon-btn delete-btn" title="Delete">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;
        item.querySelector('h4').textContent = ep.name;
        item.querySelector('.edit-ep-btn').addEventListener('click', () => window.editEndpoint(ep.id));
        item.querySelector('.delete-ep-btn').addEventListener('click', () => window.deleteEndpoint(ep.id));
        endpointsList.appendChild(item);
    });
}

// ... (editEndpoint update) ...

window.editEndpoint = (id) => {
    const ep = state.endpoints.find(e => e.id === id);
    if (!ep) return;
    editId.value = ep.id;
    editName.value = ep.name;
    editUrl.value = ep.baseUrl;
    editDefaultModel.value = ep.defaultModel || '';
    editStream.checked = ep.stream !== false;
    editInputCost.value = ep.inputCost != null ? ep.inputCost : '';
    editOutputCost.value = ep.outputCost != null ? ep.outputCost : '';
    editSystemPrompt.value = ep.systemPrompt || '';

    // Auth Fields
    editAuthType.value = ep.authType || 'api-key';
    toggleAuthFields();

    editKey.value = '';
    editKey.placeholder = ep.hasKey ? 'Leave blank to keep current key' : 'sk-...';

    // OAuth Fields
    editTokenUrl.value = ep.tokenUrl || '';
    editClientId.value = ep.clientId || '';
    editClientSecret.value = '';
    editClientSecret.placeholder = ep.hasSecret ? 'Leave blank to keep current secret' : 'Client Secret';
    editScope.value = ep.scope || '';

    // Attempt to guess preset
    if (ep.baseUrl.includes('api.openai.com')) editPreset.value = 'openai';
    else if (ep.baseUrl.includes('googleapis.com')) editPreset.value = 'google';
    else if (ep.baseUrl.includes('api.groq.com')) editPreset.value = 'groq';
    else if (ep.baseUrl.includes('api.nvidia.com')) editPreset.value = 'nvidia';
    else if (ep.baseUrl.includes(':1234')) editPreset.value = 'lm-studio';
    else if (ep.baseUrl.includes(':11434')) editPreset.value = 'ollama';
    else if (ep.baseUrl.includes(':8080')) editPreset.value = 'localai';
    else editPreset.value = 'custom';

    endpointForm.classList.remove('hidden');
    addEndpointBtn.classList.add('hidden');
};

// State
let state = {
    chats: [],
    currentChatId: null,
    isGenerating: false,
    endpoints: [],
    currentEndpointId: null,
    presets: [],
    currentPresetId: null,
    proxyBaseUrl: '',
    tools: [],
    searchEngine: 'auto'
};

const DEFAULT_FOLDER = 'General';
let currentFolder = 'All';
let searchQuery = '';

// --- Proxy / API base helpers ---
function getApiUrl(path) {
    const base = (state.proxyBaseUrl || '').replace(/\/+$/, '');
    return base ? `${base}${path}` : path;
}

async function apiFetch(path, options = {}) {
    const proxyUrl = getApiUrl(path);
    if (proxyUrl === path) return fetch(path, options);
    try {
        const res = await fetch(proxyUrl, options);
        if (res.status < 500) return res;
    } catch (e) {
        // Proxy unreachable or CORS blocked; fall through to direct
    }
    return fetch(path, options);
}

// --- Logging Helper ---
async function logToServer(level, message, details = null) {
    try {
        // Don't await strictly to avoid blocking UI
        fetch(getApiUrl('/api/logs'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ level, message, details })
        }).catch(e => console.error('Log upload failed', e));
    } catch (e) {
        console.error('Log helper failed', e);
    }
}

// --- API Client ---

async function fetchEndpoints() {
    try {
        const res = await apiFetch('/api/endpoints');
        if (!res.ok) throw new Error('Failed to load settings');
        const data = await res.json();
        state.endpoints = data.endpoints.map(e => ({ ...e, id: String(e.id), authType: e.authType || 'api-key', systemPrompt: e.systemPrompt || '', defaultModel: e.defaultModel || '', stream: e.stream !== false, inputCost: e.inputCost || 0, outputCost: e.outputCost || 0, tokenUrl: e.tokenUrl || '', clientId: e.clientId || '', hasSecret: !!e.hasSecret, scope: e.scope || '' }));
        state.currentEndpointId = data.currentEndpointId != null ? String(data.currentEndpointId) : null;
        renderEndpointSelect();
        renderEndpointsList();
        renderPresetSelect();
        renderPresetEndpointOptions();
    } catch (e) {
        console.error('Failed to fetch endpoints', e);
        showError('Failed to load endpoints: ' + e.message);
        logToServer('ERROR', 'Failed to fetch endpoints', e.message);
    }
}

async function fetchTools() {
    try {
        const res = await apiFetch('/api/tools');
        if (!res.ok) throw new Error('Failed to load tools');
        const data = await res.json();
        state.tools = data.tools.map(t => ({ ...t, id: String(t.id), enabled: t.enabled !== false }));
        state.searchEngine = data.searchEngine || 'auto';
    } catch (e) {
        console.error('Failed to fetch tools', e);
        state.tools = [];
    }
}

async function toggleTool(id, enabled) {
    try {
        const res = await apiFetch('/api/tools/' + encodeURIComponent(id), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ enabled })
        });
        if (!res.ok) throw new Error('Failed to update tool');
        const data = await res.json();
        state.tools = data.tools.map(t => ({ ...t, id: String(t.id), enabled: t.enabled !== false }));
        renderTools();
    } catch (e) {
        console.error('Failed to toggle tool', e);
        showError('Failed to update tool: ' + e.message);
    }
}

function getToolIcon(id) {
    const color = 'currentColor';
    switch (id) {
        case 'web_search':
            return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"></circle><path d="M21 21l-4.35-4.35"></path></svg>`;
        case 'url_fetch':
            return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>`;
        case 'wikipedia':
            return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="${color}" stroke="none" aria-hidden="true"><path d="M4 4l4 16h2l3-10 3 10h2l4-16h-2l-3 12-3-12h-2l-3 12-3-12z"></path></svg>`;
        default:
            return `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
    }
}

function renderTools() {
    const main = document.getElementById('tools-bar');
    const settings = document.getElementById('settings-tools-list');
    const searchSelect = document.getElementById('search-engine-select');
    if (searchSelect) searchSelect.value = state.searchEngine || 'auto';
    [main, settings].forEach(container => {
        if (!container) return;
        container.innerHTML = '';
        if (!state.tools.length) {
            container.innerHTML = '<span class="tool-empty">No tools available</span>';
            return;
        }
        if (container.id === 'tools-bar') {
            state.tools.forEach(tool => {
                const label = document.createElement('label');
                label.className = 'tool-toggle';
                label.title = tool.description || '';
                const cb = document.createElement('input');
                cb.type = 'checkbox';
                cb.checked = tool.enabled;
                cb.onchange = () => toggleTool(tool.id, cb.checked);
                cb.setAttribute('aria-label', tool.name);
                const span = document.createElement('span');
                span.innerHTML = getToolIcon(tool.id);
                span.setAttribute('aria-hidden', 'true');
                label.appendChild(cb);
                label.appendChild(span);
                container.appendChild(label);
            });
            return;
        }

        // Settings panel: OpenWebUI-style rows with switch
        state.tools.forEach(tool => {
            const row = document.createElement('fieldset');
            row.className = 'tool-row';

            const info = document.createElement('div');
            info.className = 'tool-row-info';
            const icon = document.createElement('span');
            icon.className = 'tool-row-icon';
            icon.innerHTML = getToolIcon(tool.id);
            icon.setAttribute('aria-hidden', 'true');
            const text = document.createElement('div');
            text.className = 'tool-row-text';
            const name = document.createElement('span');
            name.className = 'tool-row-name';
            name.textContent = tool.name;
            text.appendChild(name);
            info.appendChild(icon);
            info.appendChild(text);

            const switchLabel = document.createElement('label');
            switchLabel.className = 'switch';
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.role = 'switch';
            cb.setAttribute('role', 'switch');
            cb.checked = tool.enabled;
            cb.setAttribute('aria-checked', String(tool.enabled));
            cb.setAttribute('aria-label', `Enable ${tool.name}`);
            cb.onchange = () => toggleTool(tool.id, cb.checked);
            const slider = document.createElement('span');
            slider.className = 'switch-slider';
            switchLabel.appendChild(cb);
            switchLabel.appendChild(slider);

            row.appendChild(info);
            row.appendChild(switchLabel);
            container.appendChild(row);
        });
    });
    // Set search engine select in Search tab
    if (searchSelect) searchSelect.value = state.searchEngine || 'auto';
}

async function fetchModels(forceRefresh = false) {
    // Always wipe the dropdown before a fetch so stale models are never shown
    modelSelect.innerHTML = '';

    try {
        let url = state.currentEndpointId
            ? `/api/models?endpointId=${state.currentEndpointId}`
            : '/api/models';
        if (forceRefresh) url += (url.includes('?') ? '&' : '?') + 'refresh=1';

        const response = await apiFetch(url);

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `Error ${response.status}`);
        }

        const data = await response.json();
        logToServer('INFO', 'Fetched Models', { count: data.data ? data.data.length : 0 });

        modelSelect.innerHTML = '';
        if (data.data && Array.isArray(data.data) && data.data.length > 0) {
            data.data.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.id;

                // Store capability check
                // Trust explicit capability first, then fallback to known IDs if missing
                let hasVision = false;
                if (model.capabilities) {
                    hasVision = model.capabilities.supports_vision;
                } else {
                    // Fallback heuristics for models without explicit capabilities in the list
                    const id = model.id.toLowerCase();
                    hasVision = id.includes('gpt-4o') ||
                        id.includes('vision') ||
                        id.includes('claude-3-5-sonnet') ||
                        id.includes('gemini-1.5-pro') ||
                        id.includes('gemini-1.5-flash');
                }

                option.dataset.vision = hasVision;
                modelSelect.appendChild(option);
            });
            // Choose the best initial model value
            const ep = state.endpoints.find(e => e.id === state.currentEndpointId);
            const chat = getCurrentChat();
            const preset = state.currentPresetId ? state.presets.find(p => p.id === state.currentPresetId) : null;
            let selected = data.data[0].id;
            const options = Array.from(modelSelect.options).map(o => o.value);
            if (chat && chat.modelId && options.includes(chat.modelId)) {
                selected = chat.modelId;
            } else if (preset && preset.modelId && options.includes(preset.modelId)) {
                selected = preset.modelId;
            } else if (ep && ep.defaultModel && options.includes(ep.defaultModel)) {
                selected = ep.defaultModel;
            }
            modelSelect.value = selected;

            statusIndicator.style.backgroundColor = '#0e7a0d';
            statusIndicator.title = 'Connected';

            // Initial check
            updateAttachButtonState();
        }
    } catch (e) {
        console.error(e);
        statusIndicator.style.backgroundColor = '#c50f1f';
        statusIndicator.title = 'Connection Failed';
        showError('Failed to fetch models: ' + e.message);
        logToServer('ERROR', 'Failed to fetch models', e.message);
    }
}

// --- Storage (History) ---

async function saveChatState() {
    try {
        await apiFetch('/api/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(state.chats)
        });
    } catch (e) {
        console.error('Failed to save state:', e);
        showError('Warning: Failed to save chat history');
    }
}

async function loadChatState() {
    try {
        const response = await apiFetch('/api/history');
        if (response.ok) {
            const data = await response.json();
            state.chats = Array.isArray(data) ? data : [];
            state.chats.forEach(c => {
                if (c.endpointId != null) c.endpointId = String(c.endpointId);
                if (c.modelId != null) c.modelId = String(c.modelId);
            });
        } else {
            state.chats = [];
        }
    } catch (e) {
        state.chats = [];
    }
}

// --- Chat Logic ---

async function createNewChat(presetId = null) {
    presetId = presetId || state.currentPresetId || null;
    const id = Date.now().toString();
    let endpointId = state.currentEndpointId;
    let modelId = '';
    let systemPrompt = '';
    let tags = [];
    let folder = DEFAULT_FOLDER;

    if (presetId) {
        const preset = state.presets.find(p => p.id === presetId);
        if (preset) {
            if (preset.endpointId && state.endpoints.find(e => e.id === preset.endpointId)) endpointId = preset.endpointId;
            modelId = preset.modelId || '';
            systemPrompt = preset.systemPrompt || '';
            tags = (preset.tags || []).slice();
        }
    }

    const ep = state.endpoints.find(e => e.id === endpointId);
    if (ep) {
        if (!modelId) modelId = ep.defaultModel || '';
        if (!systemPrompt && ep.systemPrompt) systemPrompt = ep.systemPrompt;
    }

    const newChat = {
        id,
        title: 'New Chat',
        folder,
        tags,
        endpointId,
        modelId,
        systemPrompt,
        messages: [],
        pinned: false,
        timestamp: Date.now()
    };
    state.chats.unshift(newChat);
    await saveChatState();
    return id;
}

function getCurrentChat() {
    return state.chats.find(c => c.id === state.currentChatId);
}

async function setCurrentChat(id) {
    state.currentChatId = id;
    const chat = getCurrentChat();

    // Clear any staged draft images when switching chats
    draftImages = [];
    renderImagePreviews();

    // Restore endpoint/model from chat/preset when no active messages yet
    if (chat) {
        if (chat.endpointId && state.endpoints.find(e => e.id === chat.endpointId)) {
            if (chat.endpointId !== state.currentEndpointId) {
                state.currentEndpointId = chat.endpointId;
                endpointSelect.value = chat.endpointId;
                await fetchModels(true);
            }
        }
        if (chat.modelId && !modelSelect.querySelector(`option[value="${chat.modelId}"]`)) {
            await fetchModels(true);
        }
        if (chat.modelId) {
            if (modelSelect.querySelector(`option[value="${chat.modelId}"]`)) {
                modelSelect.value = chat.modelId;
            }
        }
    }

    // UI Locking Logic - Allow model/endpoint changes with confirmation
    if (chat && chat.messages.length > 0) {
        modelSelect.disabled = false;
        endpointSelect.disabled = false;
        sendBtn.disabled = false;
        if (window.easyMDE) window.easyMDE.codemirror.setOption('readOnly', false);
    } else {
        modelSelect.disabled = false;
        endpointSelect.disabled = false;
        sendBtn.disabled = false;
        if (window.easyMDE) window.easyMDE.codemirror.setOption('readOnly', false);
    }

    renderChatList();
    renderMessages();
    if (window.innerWidth <= 768) sidebar.classList.remove('open');
}

function updateChatTitle(chat, firstMessage) {
    if (!chat.title || chat.title === 'New Chat') {
        chat.title = firstMessage.length > 30 ? firstMessage.substring(0, 30) + '...' : firstMessage;
        renderChatList();
    }
}

// --- UI Rendering ---

// (renderChatList is already defined above)

window.deleteChat = async (id) => {
    if (!confirm('Delete this chat?')) return;

    // Remove from state
    state.chats = state.chats.filter(c => c.id !== id);

    // Sync with server
    await saveChatState();

    // Reset selection if active chat deleted
    if (state.currentChatId === id) {
        if (state.chats.length > 0) {
            await setCurrentChat(state.chats[0].id);
        } else {
            const newId = await createNewChat();
            await setCurrentChat(newId);
        }
    } else {
        renderChatList();
    }
};

window.togglePinChat = async (id) => {
    const chat = state.chats.find(c => c.id === id);
    if (!chat) return;
    chat.pinned = !chat.pinned;
    await saveChatState();
    renderChatList();
};

function renderMessages() {
    chatContainer.innerHTML = '';
    const chat = getCurrentChat();
    if (!chat || chat.messages.length === 0) {
        const sysPrompt = chat
            ? (chat.systemPromptDraft !== undefined ? chat.systemPromptDraft : (chat.systemPrompt || ''))
            : '';
        const temperature = chat
            ? (chat.temperatureDraft !== undefined ? chat.temperatureDraft : (chat.temperature !== undefined ? chat.temperature : '0.7'))
            : '0.7';
        chatContainer.innerHTML = `
            <div class="welcome-message">
                <h2>Welcome</h2>
                <p>Select a model and start chatting.</p>

                <!-- System Prompt -->
                <div class="config-section" style="margin-top: 20px; max-width: 600px; margin-left: auto; margin-right: auto; text-align: left;">
                    <label style="display:block; margin-bottom: 8px; font-weight: 500;">System Prompt</label>
                    <textarea
                        id="system-prompt-input"
                        class="system-prompt-input"
                        placeholder="Enter the system prompt text..."
                        style="width: 100%; padding: 10px; border-radius: 6px; border: 1px solid var(--border-color); background: var(--card-bg); color: var(--text-primary); min-height: 80px; resize: vertical;"
                    >${escapeHtml(String(sysPrompt))}</textarea>

                    <!-- Temperature -->
                    <div style="margin-top: 20px;">
                        <label style="display:flex; justify-content:space-between; margin-bottom: 8px; font-weight: 500;">
                            <span>Temperature</span>
                            <span id="temp-display">${escapeHtml(String(temperature))}</span>
                        </label>
                        <input
                            type="range"
                            id="temperature-input"
                            min="0" max="2" step="0.1"
                            value="${escapeHtml(String(temperature))}"
                            style="width: 100%; cursor: pointer;"
                        >
                        <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 5px;">
                            Lower values (0.2) for precise answers, higher values (1.0+) for creativity.
                        </p>
                    </div>
                </div>
            </div>`;

        if (chat) {
            // System Prompt Listener
            const spInput = document.getElementById('system-prompt-input');
            spInput.addEventListener('input', (e) => {
                chat.systemPromptDraft = e.target.value;
                saveChatState();
            });

            // Temperature Listener
            const tempInput = document.getElementById('temperature-input');
            const tempDisplay = document.getElementById('temp-display');

            tempInput.addEventListener('input', (e) => {
                const val = parseFloat(e.target.value);
                tempDisplay.textContent = val;
                chat.temperatureDraft = val;
                saveChatState();
            });
        }
        return;
    }
    chat.messages.forEach((msg, idx) => {
        if (msg.role === 'system') return; // Don't render system prompts as bubbles
        // Always render from content; ignore any persisted html to avoid XSS from imported chats
        appendMessageDiv(msg.role === 'user' ? 'User' : 'AI', msg.content, msg.role === 'user' ? 'user' : 'ai', null, chat, idx, msg.createdAt);
    });
    scrollToBottom();
}

// --- Theme management
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

// --- Markdown Configuration ---
// Configure Marked
// 1. Sanitize HTML (prevent injection)
// 2. Disable indented code blocks (prevent fragmentation of pasted code)
const renderer = {
    html(chunk) {
        // Handle case where marked passes a token object instead of a string
        const text = typeof chunk === 'string' ? chunk : (chunk.text || chunk.raw || '');
        // Escape raw HTML tags so they render as text
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
};

const tokenizer = {
    // Disable indented code blocks (4 spaces). 
    // This forces users to use backticks for code blocks, preventing accidental splitting.
    code(src) {
        return false;
    },
    // Also disable lists and blockquotes if we want strictly "text unless backticks"
    // This often causes code with dashes or > to be split into lists/quotes
    list(src) { return false; },
    blockquote(src) { return false; },
    // Disable HTML parsing entirely. Treat <tags> as plain text.
    html(src) { return false; }
};

try {
    marked.use({ renderer, tokenizer, breaks: true, gfm: true });
} catch (e) {
    console.error('Failed to configure marked', e);
}

function appendMessageDiv(role, content, type, preRendered = null, chat = null, msgIndex = -1, timestamp = null) {
    const welcome = document.querySelector('.welcome-message');
    if (welcome) welcome.remove();
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;
    if (timestamp) msgDiv.dataset.timestamp = timestamp;

    let htmlContent = '';

    if (preRendered) {
        htmlContent = preRendered;
    } else if (Array.isArray(content)) {
        // Handle array content (Text + Images)
        content.forEach(part => {
            if (part.type === 'text') {
                htmlContent += marked.parse(part.text);
            } else if (part.type === 'image_url') {
                htmlContent += `<img src="${part.image_url.url}" style="max-width: 100%; border-radius: 8px; margin-top: 10px; display: block;">`;
            }
        });
    } else {
        // Handle legacy string content
        htmlContent = marked.parse(content || '');
    }

    const isUser = type === 'user';
    const extraActions = isUser
        ? `<button class="msg-action-btn msg-edit-btn" title="Edit"><i class="fa-solid fa-pen"></i></button>`
        : `<button class="msg-action-btn msg-regenerate-btn" title="Regenerate"><i class="fa-solid fa-rotate-right"></i></button>`;
    const timeHtml = timestamp ? `<div class="message-time">${formatTimestamp(timestamp)}</div>` : '';
    const usage = (chat && msgIndex >= 0 && chat.messages[msgIndex]?.usage) ? chat.messages[msgIndex].usage : null;
    const usageHtml = (usage && !isUser) ? `<div class="msg-usage">${usage.totalTokens.toLocaleString()} tokens · $${usage.totalCost.toFixed(4)}</div>` : '';

    msgDiv.innerHTML = `<div class="message-content markdown-body"><div class="msg-actions">${extraActions}<button class="msg-action-btn msg-copy-btn" title="Copy"><i class="fa-regular fa-copy"></i></button><button class="msg-action-btn msg-collapse-btn" title="Collapse"><i class="fa-solid fa-chevron-up"></i></button></div><div class="msg-body">${htmlContent}</div>${timeHtml}${usageHtml}</div>`;

    // Wire up copy button
    const copyBtn = msgDiv.querySelector('.msg-copy-btn');
    copyBtn.addEventListener('click', () => {
        const text = msgDiv.querySelector('.msg-body').innerText;
        navigator.clipboard.writeText(text).then(() => {
            copyBtn.classList.add('copied');
            copyBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
            setTimeout(() => {
                copyBtn.classList.remove('copied');
                copyBtn.innerHTML = '<i class="fa-regular fa-copy"></i>';
            }, 1500);
        });
    });

    // Wire up collapse button
    const collapseBtn = msgDiv.querySelector('.msg-collapse-btn');
    collapseBtn.addEventListener('click', () => {
        const contentEl = msgDiv.querySelector('.message-content');
        const isCollapsed = contentEl.classList.toggle('collapsed');
        collapseBtn.classList.toggle('collapsed', isCollapsed);
        collapseBtn.title = isCollapsed ? 'Expand' : 'Collapse';
        collapseBtn.innerHTML = isCollapsed
            ? '<i class="fa-solid fa-chevron-down"></i>'
            : '<i class="fa-solid fa-chevron-up"></i>';
    });

    // Wire up edit user message
    if (isUser && chat && msgIndex >= 0) {
        msgDiv.querySelector('.msg-edit-btn').addEventListener('click', () => editUserMessage(chat, msgIndex, msgDiv));
    }

    // Wire up regenerate assistant message
    if (!isUser && chat && msgIndex >= 0) {
        msgDiv.querySelector('.msg-regenerate-btn').addEventListener('click', () => regenerateAssistantMessage(chat, msgIndex, msgDiv));
    }

    chatContainer.appendChild(msgDiv);
    return msgDiv;
}

function scrollToBottom() {
    requestAnimationFrame(() => chatContainer.scrollTop = chatContainer.scrollHeight);
}

function renderEndpointSelect() {
    endpointSelect.innerHTML = '';
    state.endpoints.forEach(ep => {
        const option = document.createElement('option');
        option.value = ep.id;
        option.textContent = ep.name;
        endpointSelect.appendChild(option);
    });
    if (state.currentEndpointId) endpointSelect.value = state.currentEndpointId;
}

// (renderEndpointsList is already defined above)

// --- Settings Logic ---

const editPreset = document.getElementById('edit-preset');

// (editEndpoint is already defined above)

window.deleteEndpoint = async (id) => {
    try {
        if (!confirm('Delete this endpoint?')) return;
        logToServer('INFO', 'Deleting Endpoint', { id });
        const res = await apiFetch(`/api/endpoints/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete');
        await fetchEndpoints();
    } catch (e) {
        showError('Delete failed: ' + e.message);
        logToServer('ERROR', 'Delete endpoint failed', e.message);
    }
};

addEndpointBtn.addEventListener('click', () => {
    editId.value = '';
    editName.value = '';
    editUrl.value = '';
    editKey.value = '';
    editKey.placeholder = 'sk-...';
    editAuthType.value = 'api-key';
    toggleAuthFields();
    editTokenUrl.value = '';
    editClientId.value = '';
    editClientSecret.value = '';
    editScope.value = '';
    editPreset.value = 'custom';
    endpointForm.classList.remove('hidden');
    addEndpointBtn.classList.add('hidden');
});

editPreset.addEventListener('change', () => {
    const val = editPreset.value;
    switch (val) {
        case 'openai':
            editName.value = 'OpenAI';
            editUrl.value = 'https://api.openai.com/v1';
            editKey.placeholder = 'sk-...';
            break;
        case 'google':
            editName.value = 'Google Gemini';
            editUrl.value = 'https://generativelanguage.googleapis.com/v1beta/openai';
            editKey.placeholder = 'Gemini API Key';
            break;
        case 'groq':
            editName.value = 'Groq';
            editUrl.value = 'https://api.groq.com/openai/v1';
            editKey.placeholder = 'gsk_...';
            break;
        case 'nvidia':
            editName.value = 'NVIDIA';
            editUrl.value = 'https://integrate.api.nvidia.com/v1';
            editKey.placeholder = 'nvapi-...';
            break;
        case 'lm-studio':
            editName.value = 'LM Studio';
            editUrl.value = 'http://localhost:1234/v1';
            editKey.value = 'not-needed';
            break;
        case 'ollama':
            editName.value = 'Ollama';
            editUrl.value = 'http://localhost:11434/v1';
            editKey.value = 'ollama';
            break;
        case 'localai':
            editName.value = 'LocalAI';
            editUrl.value = 'http://localhost:8080/v1';
            editKey.value = 'not-needed';
            break;
    }
});

function toggleAuthFields() {
    if (editAuthType.value === 'oauth2') {
        authApiKeyGroup.classList.add('hidden');
        authOauthGroup.classList.remove('hidden');
    } else {
        authApiKeyGroup.classList.remove('hidden');
        authOauthGroup.classList.add('hidden');
    }
}

editAuthType.addEventListener('change', toggleAuthFields);

async function saveEndpoint() {
    try {
        const data = {
            id: editId.value || null,
            name: editName.value,
            baseUrl: editUrl.value,
            apiKey: editKey.value || null,
            authType: editAuthType.value,
            systemPrompt: editSystemPrompt.value,
            defaultModel: editDefaultModel.value,
            stream: editStream.checked,
            inputCost: editInputCost.value,
            outputCost: editOutputCost.value,
            tokenUrl: editTokenUrl.value,
            clientId: editClientId.value,
            clientSecret: editClientSecret.value || null,
            scope: editScope.value
        };

        const res = await apiFetch('/api/endpoints', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!res.ok) throw new Error('Failed to save');

        logToServer('INFO', 'Saved Endpoint', { name: data.name, url: data.baseUrl });
        endpointForm.classList.add('hidden');
        addEndpointBtn.classList.remove('hidden');
        await fetchEndpoints();
        if (state.currentEndpointId) await fetchModels(true);

        const chat = getCurrentChat();
        if (chat && chat.messages.length === 0 && state.currentEndpointId && chat.endpointId !== state.currentEndpointId) {
            chat.endpointId = state.currentEndpointId;
            chat.modelId = null;
            await saveChatState();
        }

        if (state.currentChatId) await setCurrentChat(state.currentChatId);
    } catch (e) {
        showError('Save failed: ' + e.message);
        logToServer('ERROR', 'Save endpoint failed', e.message);
    }
}

// --- Interaction ---

async function init() {
    initTheme();
    loadPresets();
    try {
        state.proxyBaseUrl = localStorage.getItem('aiui_proxy_base') || '';
    } catch (e) {}
    await fetchEndpoints(); // Load endpoints first
    await fetchTools();     // Load tools
    renderTools();
    await loadChatState();  // Load history

    if (state.currentEndpointId) {
        await fetchModels(true);
    }

    if (state.currentPresetId) {
        applyPreset(state.currentPresetId);
    }

    if (state.chats.length === 0) {
        const id = await createNewChat();
        state.currentChatId = id;
    } else if (!state.currentChatId) {
        state.currentChatId = state.chats[0].id;
    }

    renderChatList();
    renderMessages();
    await setCurrentChat(state.currentChatId);
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

function getMessageText(content) {
    if (!content) return '';
    if (typeof content === 'string') return content;
    if (Array.isArray(content)) {
        return content.map(c => (c.type === 'text' ? c.text : (c.image_url?.url ? '[image]' : ''))).join(' ');
    }
    return String(content);
}

function editUserMessage(chat, msgIndex, msgDiv) {
    const body = msgDiv.querySelector('.msg-body');
    const original = getMessageText(chat.messages[msgIndex].content);
    body.innerHTML = '';

    const ta = document.createElement('textarea');
    ta.className = 'edit-textarea';
    ta.style.cssText = 'width:100%;min-height:60px;padding:8px;border-radius:6px;border:1px solid var(--border-color);background:var(--card-bg);color:var(--text-primary);resize:vertical;';
    ta.value = original;

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.5rem;';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'ghost-btn cancel-edit';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => renderMessages());

    const saveBtn = document.createElement('button');
    saveBtn.className = 'primary-btn save-edit';
    saveBtn.textContent = 'Save';
    saveBtn.addEventListener('click', async () => {
        const newText = ta.value.trim();
        if (!newText) return;
        chat.messages[msgIndex].content = newText;
        chat.messages.splice(msgIndex + 1);
        await saveChatState();
        renderMessages();
    });

    btnRow.append(cancelBtn, saveBtn);
    body.append(ta, btnRow);
    ta.focus();
}

async function regenerateAssistantMessage(chat, msgIndex, msgDiv) {
    if (state.isGenerating) return;
    // Truncate messages at the user message preceding this assistant
    let cutIndex = msgIndex;
    for (let i = msgIndex - 1; i >= 0; i--) {
        if (chat.messages[i].role === 'user') { cutIndex = i + 1; break; }
    }
    chat.messages.splice(cutIndex);
    // Allow switching endpoint/model before regenerating
    chat.endpointId = state.currentEndpointId;
    chat.modelId = modelSelect.value;
    await saveChatState();
    renderMessages();
    await generateAssistantResponse(chat);
}

async function generateAssistantResponse(chat) {
    state.isGenerating = true;
    sendBtn.disabled = true;
    statusIndicator.style.backgroundColor = '#f7630c';
    const assistantCreatedAt = new Date().toISOString();
    const aiMsgDiv = appendMessageDiv('AI', '', 'ai', null, null, -1, assistantCreatedAt);
    const aiBodyDiv = aiMsgDiv.querySelector('.msg-body');
    aiBodyDiv.innerHTML = '<div class="typing-indicator"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';
    scrollToBottom();

    let answerBuffer = '';
    let reasoningBuffer = '';
    let rawText = '';
    let hasReceivedData = false;
    let ep = null;
    let usage = null;
    let reasoningEl = null;
    let answerEl = null;
    let chunkCount = 0;
    let deltaCount = 0;
    let streamStart = performance.now();

    function ensureStreamingContainer() {
        if (hasReceivedData) return;
        aiBodyDiv.innerHTML = '';

        // Reasoning / thinking panel
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
        aiBodyDiv.appendChild(reasoningEl);

        // Answer panel
        answerEl = document.createElement('div');
        answerEl.className = 'answer-content';
        answerEl.style.whiteSpace = 'pre-wrap';
        aiBodyDiv.appendChild(answerEl);

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

    function finalizeDisplay(usageData = null) {
        const finalContent = answerBuffer || reasoningBuffer || '';
        if (!finalContent) {
            aiMsgDiv.remove();
            return;
        }
        aiBodyDiv.innerHTML = marked.parse(finalContent);

        const assistantIndex = chat.messages.length;
        const usage = calculateUsageCost(usageData, ep, chat.messages, finalContent);
        const msg = { role: 'assistant', content: finalContent, createdAt: assistantCreatedAt, usage };
        chat.messages.push(msg);

        const usageFooter = document.createElement('div');
        usageFooter.className = 'msg-usage';
        usageFooter.textContent = `${usage.totalTokens.toLocaleString()} tokens · $${usage.totalCost.toFixed(4)}`;
        const contentDiv = aiMsgDiv.querySelector('.message-content');
        if (contentDiv) contentDiv.appendChild(usageFooter);

        if (chat) {
            const regenerateBtn = aiMsgDiv.querySelector('.msg-regenerate-btn');
            if (regenerateBtn) regenerateBtn.addEventListener('click', () => regenerateAssistantMessage(chat, assistantIndex, aiMsgDiv));
        }
    }

    try {
        ep = state.endpoints.find(e => e.id === (chat.endpointId || state.currentEndpointId));
        const useStream = ep ? ep.stream !== false : true;
        const activeTools = state.tools.filter(t => t.enabled).map(t => t.id);
        const payload = {
            endpointId: chat.endpointId || state.currentEndpointId,
            model: chat.modelId || modelSelect.value,
            messages: chat.messages,
            temperature: chat.temperature || 0.7,
            stream: useStream,
            activeTools
        };
        logToServer('INFO', 'Sending Message', { model: payload.model, endpointId: payload.endpointId, stream: useStream });

        const controller = new AbortController();
        if (stopBtn) {
            stopBtn.hidden = false;
            sendBtn.hidden = true;
            stopBtn.addEventListener('click', () => controller.abort(), { once: true });
        }

        const response = await apiFetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(getApiError(err, response.status));
        }

        if (!useStream) {
            const data = await response.json();
            const message = data.choices?.[0]?.message || {};
            answerBuffer = message.content || '';
            reasoningBuffer = message.reasoning_content || message.reasoning || '';
            usage = data.usage || null;
            finalizeDisplay(usage);
            await saveChatState();
            statusIndicator.style.backgroundColor = '#0e7a0d';
            statusIndicator.title = 'Connected';
            return;
        }

        if (!response.body) {
            throw new Error('Streaming not supported by this browser or endpoint');
        }

        const reader = response.body.getReader();
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

        // Apply markdown formatting and persist message
        finalizeDisplay(usage);
        await saveChatState();
        logToServer('INFO', 'Message Received', { len: answerBuffer.length || reasoningBuffer.length });
        statusIndicator.style.backgroundColor = '#0e7a0d';
        statusIndicator.title = 'Connected';
    } catch (error) {
        if (error.name === 'AbortError') {
            logToServer('INFO', 'Stream aborted by user', { len: answerBuffer.length || reasoningBuffer.length });
            if (answerBuffer || reasoningBuffer) {
                finalizeDisplay();
                await saveChatState();
            } else if (aiMsgDiv) {
                aiMsgDiv.remove();
            }
        } else {
            if (aiMsgDiv) {
                aiMsgDiv.remove();
            }
            console.error(error);
            showError(error.message || 'Failed to send message');
            logToServer('ERROR', 'Message Send Failed', error.message);
            appendMessageDiv('System', `Error: ${escapeHtml(error.message)}`, 'ai');
        }
    } finally {
        state.isGenerating = false;
        sendBtn.disabled = false;
        if (stopBtn) stopBtn.hidden = true;
        sendBtn.hidden = false;
        scrollToBottom();
    }
}

async function sendMessage() {
    if (state.isGenerating) return;
    const text = getInputText().trim();
    if (!text) return;
    if (!modelSelect.value) { alert('Select a model'); return; }

    const chat = getCurrentChat();
    if (!chat) return;

    // LOCKING LOGIC: Bind chat to model/endpoint on first message
    if (chat.messages.length === 0) {
        chat.modelId = modelSelect.value;
        chat.endpointId = state.currentEndpointId;

        // Inject endpoint system prompt if present and no chat override
        const ep = state.endpoints.find(e => e.id === state.currentEndpointId);
        const sys = chat.systemPromptDraft !== undefined
            ? chat.systemPromptDraft.trim()
            : (chat.systemPrompt || (ep?.systemPrompt || ''));
        if (sys) {
            chat.messages.push({ role: 'system', content: sys });
            chat.systemPrompt = sys;
            delete chat.systemPromptDraft; // Clear draft after using
        }

        // Lock Temperature
        if (chat.temperatureDraft !== undefined) {
            chat.temperature = chat.temperatureDraft;
            delete chat.temperatureDraft;
        } else {
            chat.temperature = 0.7; // Default
        }

        // Re-run setCurrentChat to lock UI immediately
        await setCurrentChat(chat.id);
    }

    // Prepare content for UI and API
    let apiContent = text;
    let uiContent = text;

    if (draftImages.length > 0) {
        // Construct API payload with images
        apiContent = [
            { type: "text", text: text },
            ...draftImages.map(img => ({
                type: "image_url",
                image_url: { url: img }
            }))
        ];

        // Construct UI content (append images to bottom)
        const imagesHtml = draftImages.map(img => `<img src="${img}" style="max-width: 100%; border-radius: 8px; margin-top: 10px; display: block;">`).join('');
        uiContent = `${marked.parse(text)}<div class="message-images">${imagesHtml}</div>`;

        // Clear drafts
        draftImages = [];
        renderImagePreviews();
    } else {
        // Just text, keep as string or wrap in array if preferred (keeping string for broad compatibility if no images)
        uiContent = marked.parse(text);
    }

    // appendMessageDiv handles raw HTML for user messages now if we pass specific flag or just use content
    // We'll update appendMessageDiv to handle the 'messages' array format if reading from history, 
    // but for immediate display we pre-render.

    chat.messages.push({ role: 'user', content: apiContent, createdAt: new Date().toISOString() }); // Store full structure
    const userMsgIndex = chat.messages.length - 1;
    appendMessageDiv('User', null, 'user', uiContent, chat, userMsgIndex, chat.messages[userMsgIndex].createdAt);

    updateChatTitle(chat, text);
    await saveChatState();
    scrollToBottom();

    clearInput();

    await generateAssistantResponse(chat);
}

// --- Presets / Agents ---
function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2, 5); }

function normalizePreset(raw) {
    return {
        id: raw.id || generateId(),
        name: (raw.name || 'Unnamed Agent').trim(),
        endpointId: raw.endpointId || '',
        modelId: (raw.modelId || '').trim(),
        systemPrompt: (raw.systemPrompt || '').trim(),
        tags: Array.isArray(raw.tags) ? raw.tags.filter(Boolean) : ((raw.tags || '').split(',').map(t => t.trim()).filter(Boolean))
    };
}

function loadPresets() {
    try {
        const raw = localStorage.getItem('aiui_public_presets');
        state.presets = raw ? JSON.parse(raw) : [];
        const current = localStorage.getItem('aiui_public_current_preset');
        state.currentPresetId = current && state.presets.find(p => p.id === current) ? current : null;
    } catch (e) {
        state.presets = [];
        state.currentPresetId = null;
    }
}

function savePresets() {
    localStorage.setItem('aiui_public_presets', JSON.stringify(state.presets));
    localStorage.setItem('aiui_public_current_preset', state.currentPresetId || '');
}

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
            <div class="endpoint-info"><h4></h4></div>
            <div class="endpoint-actions">
                <button class="edit-preset-btn icon-btn" title="Edit">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button class="delete-preset-btn icon-btn delete-btn" title="Delete">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </button>
            </div>
        `;
        item.querySelector('h4').textContent = p.name;
        item.querySelector('.edit-preset-btn').addEventListener('click', () => editPresetById(p.id));
        item.querySelector('.delete-preset-btn').addEventListener('click', () => {
            if (confirm('Delete this agent?')) {
                state.presets = state.presets.filter(x => x.id !== p.id);
                if (state.currentPresetId === p.id) state.currentPresetId = null;
                savePresets();
                renderPresetsList();
                renderPresetSelect();
            }
        });
        presetsList.appendChild(item);
    });
}

function resetPresetForm() {
    document.getElementById('preset-edit-id').value = '';
    document.getElementById('preset-form-title').textContent = 'Add Agent';
    document.getElementById('preset-name').value = '';
    renderPresetEndpointOptions();
    document.getElementById('preset-model').value = '';
    document.getElementById('preset-prompt').value = '';
    document.getElementById('preset-tags').value = '';
    presetForm.classList.remove('hidden');
}

function renderPresetEndpointOptions() {
    const sel = document.getElementById('preset-endpoint');
    sel.innerHTML = '';
    state.endpoints.forEach(ep => {
        const opt = document.createElement('option');
        opt.value = ep.id;
        opt.textContent = ep.name;
        sel.appendChild(opt);
    });
    sel.value = state.currentEndpointId || state.endpoints[0]?.id || '';
}

function editPresetById(id) {
    const p = state.presets.find(x => x.id === id);
    if (!p) return;
    document.getElementById('preset-edit-id').value = p.id;
    document.getElementById('preset-form-title').textContent = 'Edit Agent';
    document.getElementById('preset-name').value = p.name;
    renderPresetEndpointOptions();
    document.getElementById('preset-endpoint').value = p.endpointId || state.currentEndpointId || '';
    document.getElementById('preset-model').value = p.modelId || '';
    document.getElementById('preset-prompt').value = p.systemPrompt || '';
    document.getElementById('preset-tags').value = (p.tags || []).join(', ');
    presetForm.classList.remove('hidden');
}

async function savePresetFromForm() {
    const raw = {
        id: document.getElementById('preset-edit-id').value,
        name: document.getElementById('preset-name').value.trim(),
        endpointId: document.getElementById('preset-endpoint').value,
        modelId: document.getElementById('preset-model').value.trim(),
        systemPrompt: document.getElementById('preset-prompt').value.trim(),
        tags: document.getElementById('preset-tags').value.split(',').map(t => t.trim()).filter(Boolean)
    };
    if (!raw.name) { showError('Agent name required'); return; }
    const preset = normalizePreset(raw);
    const idx = state.presets.findIndex(p => p.id === preset.id);
    if (idx >= 0) state.presets[idx] = preset;
    else state.presets.push(preset);
    savePresets();
    presetForm.classList.add('hidden');
    renderPresetsList();
    renderPresetSelect();
}

function applyPreset(presetId) {
    if (!presetId) return;
    state.currentPresetId = presetId;
    savePresets();
    const preset = state.presets.find(p => p.id === presetId);
    if (!preset) return;
    if (preset.endpointId && state.endpoints.find(e => e.id === preset.endpointId)) {
        state.currentEndpointId = preset.endpointId;
        endpointSelect.value = preset.endpointId;
    }
    const chat = getCurrentChat();
    if (chat && chat.messages.length === 0) {
        chat.endpointId = state.currentEndpointId;
        chat.modelId = preset.modelId || null;
        if (preset.systemPrompt) chat.systemPrompt = preset.systemPrompt;
        saveChatState();
    }

    if (preset.modelId) fetchModels(true).then(() => {
        if (modelSelect.querySelector(`option[value="${preset.modelId}"]`)) modelSelect.value = preset.modelId;
    });
    if (preset.systemPrompt && chat && !chat.messages.length) {
        renderMessages();
    }
}

// --- Export / Import Chats ---
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

async function importChats(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
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
                messages: Array.isArray(c.messages) ? c.messages : [],
                timestamp: c.timestamp || Date.now()
            }));
            state.currentChatId = state.chats[0]?.id || null;
            await saveChatState();
            renderChatList();
            if (state.currentChatId) await setCurrentChat(state.currentChatId);
            else renderMessages();
            showError('Chats imported successfully');
        } catch (err) {
            showError('Import failed: ' + err.message);
        }
    };
    reader.readAsText(file);
}

// Listeners
// userInput auto-resize and Enter logic replaced by EasyMDE keymaps

// Setup EasyMDE
function getInputText() {
    if (window.easyMDE) return window.easyMDE.value();
    return userInput ? userInput.value : '';
}

function clearInput() {
    if (window.easyMDE) {
        window.easyMDE.value('');
    } else if (userInput) {
        userInput.value = '';
    }
}

function initEasyMDE() {
    window.easyMDE = new EasyMDE({
        element: document.getElementById('user-input'),
        autoDownloadFontAwesome: true, // Needed for icons
        status: false,
        spellChecker: false,
        toolbar: false,
        forceSync: true,
        placeholder: "Message AI...",
        minHeight: "0px",
        maxHeight: "120px",
        shortcuts: {
            "togglePreview": null, // Keep preview button but maybe disable shortcut if it conflicts
        },
    });

    // Force compact CodeMirror height
    window.easyMDE.codemirror.setSize('100%', 'auto');
    const cm = window.easyMDE.codemirror.getWrapperElement();
    if (cm) {
        cm.style.height = 'auto';
        cm.style.minHeight = '0px';
        cm.style.maxHeight = '120px';
    }
    window.easyMDE.codemirror.refresh();

    // Custom Key Handler for Enter to Send
    window.easyMDE.codemirror.setOption("extraKeys", {
        "Enter": function (cm) {
            sendMessage();
        },
        "Shift-Enter": function (cm) {
            cm.replaceSelection("\n");
        }
    });

    // Update Send Button state on input
    window.easyMDE.codemirror.on("change", () => {
        const val = window.easyMDE.value().trim();
        sendBtn.disabled = val === '';
    });
}

// Global listeners
sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

document.addEventListener('keydown', (e) => {
    // Ctrl/Cmd + Enter to send
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        sendMessage();
        return;
    }
    // / focuses search when not typing in an input
    if (e.key === '/' && !['INPUT', 'TEXTAREA'].includes(e.target.tagName) && !e.target.isContentEditable) {
        e.preventDefault();
        chatSearch.focus();
        return;
    }
    // Esc closes modals/sidebar
    if (e.key === 'Escape') {
        settingsModal.style.display = 'none';
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    }
});

newChatBtn.addEventListener('click', async () => {
    const id = await createNewChat();
    await setCurrentChat(id);
});
menuBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('active');
});
sidebarOverlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
});

// Touch gesture support for mobile sidebar
let touchStartX = 0;
let touchEndX = 0;
const SWIPE_THRESHOLD = 50;

document.addEventListener('touchstart', (e) => {
    touchStartX = e.changedTouches[0].screenX;
}, { passive: true });

document.addEventListener('touchend', (e) => {
    touchEndX = e.changedTouches[0].screenX;
    handleSwipe();
}, { passive: true });

function handleSwipe() {
    const diff = touchStartX - touchEndX;
    
    // Swipe left - close sidebar
    if (diff > SWIPE_THRESHOLD && sidebar.classList.contains('open')) {
        sidebar.classList.remove('open');
        sidebarOverlay.classList.remove('active');
    }
    // Swipe right - open sidebar
    else if (diff < -SWIPE_THRESHOLD && !sidebar.classList.contains('open')) {
        sidebar.classList.add('open');
        sidebarOverlay.classList.add('active');
    }
}

// Settings Listeners
themeToggleBtn.addEventListener('click', cycleTheme);

settingsBtn.addEventListener('click', () => {
    settingsModal.style.display = 'block';
    renderPresetsList();
    renderPresetEndpointOptions();
    document.getElementById('proxy-base-url').value = state.proxyBaseUrl || localStorage.getItem('aiui_proxy_base') || '';
    document.getElementById('search-engine-select').value = state.searchEngine || 'auto';
});
closeBtn.addEventListener('click', () => settingsModal.style.display = 'none');
window.onclick = (e) => { if (e.target === settingsModal) settingsModal.style.display = 'none'; };

document.getElementById('save-proxy-btn').addEventListener('click', () => {
    const input = document.getElementById('proxy-base-url');
    const url = (input.value || '').trim().replace(/\/+$/, '');
    state.proxyBaseUrl = url;
    localStorage.setItem('aiui_proxy_base', url);
    showError('Proxy URL saved');
});

document.getElementById('save-search-engine-btn').addEventListener('click', async () => {
    const select = document.getElementById('search-engine-select');
    const engine = select.value;
    try {
        const res = await apiFetch('/api/search-engine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ engine })
        });
        if (!res.ok) throw new Error('Failed to save search engine');
        const data = await res.json();
        state.searchEngine = data.searchEngine || 'auto';
        showError('Search engine saved');
    } catch (e) {
        console.error('Failed to save search engine', e);
        showError('Failed to save search engine: ' + e.message);
    }
});

// Collapsible settings sections
document.querySelectorAll('.settings-section-header').forEach(header => {
    header.addEventListener('click', () => {
        const targetId = header.dataset.target;
        const content = document.getElementById(targetId);
        if (!content) return;
        const isOpen = content.classList.contains('open');
        content.classList.toggle('open');
        header.setAttribute('aria-expanded', String(!isOpen));
    });
});

// Expand Endpoints section by default
const endpointsHeader = document.querySelector('.settings-section-header[data-target="endpoints-section"]');
if (endpointsHeader) {
    const endpointsContent = document.getElementById('endpoints-section');
    if (endpointsContent) {
        endpointsContent.classList.add('open');
        endpointsHeader.setAttribute('aria-expanded', 'true');
    }
}

document.getElementById('clear-cache-btn').addEventListener('click', () => {
    if (!confirm('Delete all AI-UI browser caches and reload?')) return;
    try {
        Object.keys(localStorage)
            .filter(k => k.startsWith('aiui_'))
            .forEach(k => localStorage.removeItem(k));
    } catch (e) {}
    location.reload();
});

refreshModelsBtn.addEventListener('click', async () => {
    try {
        refreshModelsBtn.classList.add('spinning');
        refreshModelsBtn.disabled = true;

        const res = await apiFetch('/api/models/refresh', { method: 'POST' });
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || 'Refresh failed');

        logToServer('INFO', 'Refreshed Models', data.results);
        await fetchModels(); // Reload list

    } catch (e) {
        showError('Refresh failed: ' + e.message);
    } finally {
        refreshModelsBtn.classList.remove('spinning');
        refreshModelsBtn.disabled = false;
    }
});

endpointSelect.addEventListener('change', async () => {
    const id = endpointSelect.value;
    const chat = getCurrentChat();
    
    // Confirm if changing endpoint in middle of chat
    if (chat && chat.messages.length > 0 && chat.endpointId !== id) {
        const oldEndpoint = state.endpoints.find(e => e.id === chat.endpointId);
        const newEndpoint = state.endpoints.find(e => e.id === id);
        const oldName = oldEndpoint ? oldEndpoint.name : 'Unknown';
        const newName = newEndpoint ? newEndpoint.name : 'Unknown';
        
        const confirmed = confirm(
            `You are changing the model provider from "${oldName}" to "${newName}".\n\n` +
            `This will change the endpoint for the current chat. Continue?`
        );
        
        if (!confirmed) {
            // Revert to original endpoint
            endpointSelect.value = chat.endpointId;
            return;
        }
    }
    
    await apiFetch('/api/endpoints/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    });
    state.currentEndpointId = id;
    state.currentPresetId = null;
    presetSelect.value = '';
    savePresets();

    // Update chat's endpoint
    if (chat) {
        chat.endpointId = id;
        await saveChatState();
    }

    await fetchModels(true);
    if (state.currentChatId) await setCurrentChat(state.currentChatId);
});

presetSelect.addEventListener('change', () => {
    state.currentPresetId = presetSelect.value || null;
    savePresets();
    applyPreset(state.currentPresetId);
});

chatSearch.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderChatList();
});

folderList.addEventListener('click', (e) => {
    if (e.target.classList.contains('folder-pill')) {
        currentFolder = e.target.dataset.folder;
        renderChatList();
    }
});

exportChatsBtn.addEventListener('click', exportChats);
importChatsBtn.addEventListener('click', () => importChatsInput.click());
importChatsInput.addEventListener('change', (e) => {
    if (e.target.files[0]) importChats(e.target.files[0]);
    importChatsInput.value = '';
});

addPresetBtn.addEventListener('click', resetPresetForm);
cancelPresetBtn.addEventListener('click', () => presetForm.classList.add('hidden'));
savePresetBtn.addEventListener('click', savePresetFromForm);

// addEndpointBtn listener moved up to Settings Logic section

cancelEditBtn.addEventListener('click', () => {
    endpointForm.classList.add('hidden');
    addEndpointBtn.classList.remove('hidden');
});

saveEndpointBtn.addEventListener('click', saveEndpoint);

// Resize
window.addEventListener('resize', () => {
    document.body.style.height = `${window.innerHeight}px`;
    if (window.innerWidth > 768) sidebar.classList.remove('open');
});

// Start
try {
    initEasyMDE();
} catch (e) {
    console.error('initEasyMDE failed', e);
}

try {
    init();
} catch (e) {
    console.error('init failed', e);
}

// --- Image Upload Logic ---

function updateAttachButtonState() {
    const option = modelSelect.selectedOptions[0];
    if (!option) return;

    const hasVision = option.dataset.vision === 'true';
    attachBtn.disabled = !hasVision;
    attachBtn.style.opacity = hasVision ? '1' : '0.5';
    attachBtn.style.cursor = hasVision ? 'pointer' : 'not-allowed';
    attachBtn.title = hasVision ? 'Attach Image' : 'Selected model does not support image input';

    // Hide preview if model is switched to non-vision while images are staged
    if (!hasVision && draftImages.length > 0) {
        if (confirm('The selected model does not support images. Clear attached images?')) {
            draftImages = [];
            renderImagePreviews();
        }
    }
}

modelSelect.addEventListener('change', async (e) => {
    updateAttachButtonState();
    
    const chat = getCurrentChat();
    if (chat && chat.messages.length > 0) {
        const newModel = e.target.value;
        const oldModel = chat.modelId;
        
        if (newModel !== oldModel) {
            const confirmed = confirm(
                `You are changing the model from "${oldModel || 'None'}" to "${newModel}".\n\n` +
                `This will change the model for the current chat. Continue?`
            );
            
            if (confirmed) {
                chat.modelId = newModel;
                await saveChatState();
                renderChatList();
            } else {
                // Revert to original model
                e.target.value = oldModel;
                updateAttachButtonState();
            }
        }
    }
});

attachBtn.addEventListener('click', () => {
    imageUploadInput.click();
});

imageUploadInput.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    for (const file of files) {
        try {
            const base64 = await convertFileToBase64(file);
            draftImages.push(base64);
        } catch (err) {
            console.error('Error converting file', err);
            showError('Failed to load image');
        }
    }

    // Reset input so same file can be selected again
    imageUploadInput.value = '';
    renderImagePreviews();
});

function convertFileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
}

function renderImagePreviews() {
    imagePreviewContainer.innerHTML = '';

    if (draftImages.length === 0) {
        imagePreviewContainer.classList.add('hidden');
        return;
    }

    imagePreviewContainer.classList.remove('hidden');

    draftImages.forEach((imgSrc, index) => {
        const div = document.createElement('div');
        div.className = 'image-preview-item';

        const img = document.createElement('img');
        img.src = imgSrc;

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-image-btn';
        removeBtn.innerHTML = '&times;';
        removeBtn.onclick = () => {
            draftImages.splice(index, 1);
            renderImagePreviews();
        };

        div.appendChild(img);
        div.appendChild(removeBtn);
        imagePreviewContainer.appendChild(div);
    });
}

// --- Global Error Handling ---

function showError(message) {
    let toast = document.querySelector('.error-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'error-toast';
        toast.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"></circle>
                <line x1="12" y1="8" x2="12" y2="12"></line>
                <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
            <span id="error-msg"></span>
        `;
        document.body.appendChild(toast);
    }

    toast.querySelector('#error-msg').textContent = message;

    // Force reflow
    void toast.offsetWidth;

    toast.classList.add('show');

    // Auto hide
    setTimeout(() => {
        toast.classList.remove('show');
    }, 4000);
}
