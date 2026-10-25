// --- Default system prompts ---
const DEFAULT_SYSTEM_PROMPTS = [
    { id: 'none', label: 'None (no system prompt)', text: '' },
    { id: 'general', label: 'General assistant', text: 'You are a helpful, accurate assistant. Answer clearly and directly, and say so when you are unsure.' },
    { id: 'concise', label: 'Concise answers', text: 'Answer in as few words as possible while staying accurate. Use short sentences and bullet points only when they help.' },
    { id: 'engineer', label: 'Senior software engineer', text: 'You are a senior software engineer. Give correct, idiomatic, production-quality code with brief explanations. Point out edge cases, security issues, and performance concerns. Ask for missing context instead of guessing.' },
    { id: 'reviewer', label: 'Code reviewer', text: 'You are a meticulous code reviewer. Identify bugs, security risks, unclear naming, and missing tests. For each issue, state the problem, why it matters, and a concrete fix.' },
    { id: 'teacher', label: 'Patient teacher', text: 'You are a patient teacher. Explain concepts step by step, start from what the learner likely knows, and check understanding with a short example or question at the end.' },
    { id: 'writer', label: 'Writing editor', text: 'You are a professional editor. Improve clarity, grammar, and flow while keeping the author\'s voice. Explain significant changes briefly.' },
    { id: 'translator', label: 'Translator', text: 'You are a professional translator. Translate the user\'s text faithfully and naturally into the requested language. Preserve formatting, names, and technical terms, and output only the translation unless asked for notes.' },
    { id: 'summarizer', label: 'Summarizer', text: 'You summarize text accurately. Give a short summary first, then the key points as a bulleted list. Do not add information that is not in the source.' },
    { id: 'analyst', label: 'Data analyst', text: 'You are a careful data analyst. State your assumptions, show the reasoning behind each conclusion, and flag when the data is insufficient to answer.' },
    { id: 'brainstorm', label: 'Brainstorm partner', text: 'You are a creative brainstorming partner. Offer varied, specific ideas, build on the user\'s suggestions, and avoid judging them too early.' }
];

// --- Notifications ---
const NOTIFICATIONS_SEEN_KEY = 'notificationsLastSeen';
const notificationsBtn = document.getElementById('notifications-btn');
const notificationsPanel = document.getElementById('notifications-panel');
const notificationsWrapper = document.getElementById('notifications-wrapper');
const notificationsBadge = document.getElementById('notifications-badge');
const notificationsList = document.getElementById('notifications-list');
const clearNotificationsBtn = document.getElementById('clear-notifications-btn');
let notifications = [];
const liveGenerations = new Map(); // chatId -> { jobId, controller, stopped } for generations streaming now

function recordNotification(level, message, details = null) {
    notifications.push({ timestamp: new Date().toISOString(), level, source: 'client', message, details });
    updateNotificationBadge();
    if (!notificationsPanel.classList.contains('hidden')) renderNotifications();
    apiFetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level, message, details })
    }).catch(() => {});
}

function updateNotificationBadge() {
    const seen = localStorage.getItem(NOTIFICATIONS_SEEN_KEY) || '';
    const unread = notifications.filter(n => n.timestamp > seen).length;
    notificationsBadge.textContent = unread > 99 ? '99+' : String(unread);
    notificationsBadge.classList.toggle('hidden', unread === 0);
}

function renderNotifications() {
    notificationsList.innerHTML = '';
    if (!notifications.length) {
        const empty = document.createElement('div');
        empty.className = 'notif-empty';
        empty.textContent = 'No notifications yet';
        notificationsList.appendChild(empty);
        return;
    }
    [...notifications].reverse().forEach(n => {
        const item = document.createElement('div');
        item.className = `notif-item notif-${n.level}`;

        const head = document.createElement('div');
        head.className = 'notif-head';
        const msg = document.createElement('span');
        msg.className = 'notif-msg';
        msg.textContent = n.message;
        const time = document.createElement('time');
        time.className = 'notif-time';
        time.dateTime = n.timestamp;
        time.textContent = new Date(n.timestamp).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
        head.append(msg, time);

        const meta = document.createElement('div');
        meta.className = 'notif-meta';
        meta.textContent = `${n.level} · ${n.source}`;

        item.append(head, meta);
        if (n.details) {
            const details = document.createElement('pre');
            details.className = 'notif-details';
            details.textContent = JSON.stringify(n.details, null, 2);
            item.appendChild(details);
        }
        notificationsList.appendChild(item);
    });
}

async function loadNotifications() {
    try {
        const res = await apiFetch('/api/notifications');
        if (!res.ok) throw new Error(`Status ${res.status}`);
        notifications = await res.json();
    } catch (e) {
        console.error('Failed to load notifications', e);
    }
    updateNotificationBadge();
}

notificationsBtn.addEventListener('click', async (e) => {
    e.stopPropagation();
    const opening = notificationsPanel.classList.contains('hidden');
    notificationsPanel.classList.toggle('hidden', !opening);
    notificationsBtn.setAttribute('aria-expanded', String(opening));
    if (!opening) return;
    await loadNotifications();
    renderNotifications();
    localStorage.setItem(NOTIFICATIONS_SEEN_KEY, new Date().toISOString());
    updateNotificationBadge();
});

document.addEventListener('click', (e) => {
    if (!notificationsWrapper.contains(e.target) && !notificationsPanel.classList.contains('hidden')) {
        notificationsPanel.classList.add('hidden');
        notificationsBtn.setAttribute('aria-expanded', 'false');
    }
});

clearNotificationsBtn.addEventListener('click', async () => {
    try {
        const res = await apiFetch('/api/notifications', { method: 'DELETE' });
        if (!res.ok) throw new Error(`Status ${res.status}`);
        notifications = [];
        renderNotifications();
        updateNotificationBadge();
    } catch (err) {
        showError('Failed to clear notifications: ' + err.message);
    }
});

window.addEventListener('error', (e) => {
    recordNotification('error', e.message || 'Unexpected error', { file: e.filename, line: e.lineno });
});

window.addEventListener('unhandledrejection', (e) => {
    recordNotification('error', `Unhandled promise rejection: ${e.reason?.message || e.reason}`);
});

const modelSelect = document.getElementById('model-select');
const refreshModelsBtn = document.getElementById('refresh-models-btn');
const chatContainer = document.getElementById('chat-container');
const sendBtn = document.getElementById('send-btn');
const stopBtn = document.getElementById('stop-btn');
const themeToggleBtn = document.getElementById('theme-toggle-btn');
const statusIndicator = document.getElementById('status-indicator');
const newChatBtn = document.getElementById('new-chat-btn');
const incognitoChatBtn = document.getElementById('incognito-chat-btn');
const regenerateTitlesBtn = document.getElementById('regenerate-titles-btn');
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

// Comparison Elements
const compareBtn = document.getElementById('compare-btn');
const comparisonModal = document.getElementById('comparison-modal');
const compareChat1 = document.getElementById('compare-chat-1');
const compareChat2 = document.getElementById('compare-chat-2');
const startCompareBtn = document.getElementById('start-compare-btn');
const mergeBranchBtn = document.getElementById('merge-branch-btn');
const comparisonResults = document.getElementById('comparison-results');
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
    
    // Add timeline class to chat list if in timeline view
    if (currentFolder === 'Timeline') {
        chatItems.classList.add('timeline-view');
    } else {
        chatItems.classList.remove('timeline-view');
    }
    
    const q = searchQuery.toLowerCase();
    const filtered = state.chats.filter(chat => {
        // Timeline view: show branch relationships
        if (currentFolder === 'Timeline') {
            return chat.isBranch || chat.parentBranchId || state.chats.some(c => c.parentBranchId === chat.id);
        }
        
        const inFolder = currentFolder === 'All' || chat.folder === currentFolder || (currentFolder === DEFAULT_FOLDER && !chat.folder);
        if (!q) return inFolder;
        const hay = `${chat.title || ''} ${(chat.tags || []).join(' ')} ${chat.messages.map(m => getMessageText(m.content)).join(' ')}`.toLowerCase();
        return inFolder && hay.includes(q);
    }).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.timestamp - a.timestamp);

    filtered.forEach(chat => {
        const div = document.createElement('div');
        div.className = `chat-item${chat.isIncognito ? ' incognito-chat-item' : ''}`;
        if (chat.id === state.currentChatId) {
            div.classList.add('active');
        }

        const endpoint = state.endpoints.find(e => e.id === chat.endpointId);
        const endpointName = endpoint ? endpoint.name : (chat.endpointId ? 'Unknown' : 'No Endpoint');
        const modelName = chat.modelId || 'No Model';
        const dateStr = new Date(chat.timestamp).toLocaleString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });
        
        // Branch and privacy indicators
        const branchIndicator = chat.isBranch ? '<span class="branch-indicator">🌿</span>' : '';
        const incognitoIndicator = chat.isIncognito ? '<span class="incognito-indicator" title="This chat is not saved">Private</span>' : '';
        
        // Timeline visual indicators (always calculate but only show in Timeline view)
        let timelineIndicator = '';
        if (chat.parentBranchId) {
            const parentChat = state.chats.find(c => c.id === chat.parentBranchId);
            timelineIndicator = `<span class="timeline-child" title="Branch of: ${parentChat?.title || 'Unknown'}">└─</span>`;
        } else if (state.chats.some(c => c.parentBranchId === chat.id)) {
            timelineIndicator = `<span class="timeline-parent" title="Has branches">┬</span>`;
        }

        const contentDiv = document.createElement('div');
        contentDiv.className = 'chat-content';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'chat-title';
        titleDiv.innerHTML = `${timelineIndicator}${branchIndicator}${chat.title || 'New Chat'}${incognitoIndicator}`;
        titleDiv.title = 'Double-click to rename';
        titleDiv.ondblclick = (e) => {
            e.stopPropagation();
            const newTitle = prompt('Enter a new name for this chat:', chat.title || 'New Chat');
            if (newTitle && newTitle.trim()) {
                chat.title = newTitle.trim();
                saveChatState();
                renderChatList();
            }
        };

        contentDiv.appendChild(titleDiv);

        // Create menu button
        const menuBtn = document.createElement('button');
        menuBtn.className = 'chat-menu-btn';
        menuBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"></circle><circle cx="12" cy="5" r="1"></circle><circle cx="12" cy="19" r="1"></circle></svg>`;
        menuBtn.title = 'Chat options';
        menuBtn.onclick = (e) => {
            e.stopPropagation();
            toggleChatMenu(chat.id, menuBtn);
        };

        // Create menu dropdown
        const menuDropdown = document.createElement('div');
        menuDropdown.className = 'chat-menu-dropdown';
        menuDropdown.id = `chat-menu-${chat.id}`;

        // Add meta info to dropdown
        const metaDiv = document.createElement('div');
        metaDiv.className = 'chat-menu-meta';
        metaDiv.innerHTML = `
            <div class="chat-menu-meta-item"><strong>Endpoint:</strong> ${endpointName}</div>
            <div class="chat-menu-meta-item"><strong>Model:</strong> ${modelName}</div>
            <div class="chat-menu-meta-item"><strong>Folder:</strong> ${chat.folder || DEFAULT_FOLDER}</div>
            <div class="chat-menu-meta-item"><strong>Date:</strong> ${dateStr}</div>
        `;
        menuDropdown.appendChild(metaDiv);

        // Add tags to dropdown if present
        if (chat.tags && chat.tags.length) {
            const tagsDiv = document.createElement('div');
            tagsDiv.className = 'chat-menu-tags';
            tagsDiv.innerHTML = '<strong>Tags:</strong>';
            chat.tags.slice(0, 4).forEach(tag => {
                const span = document.createElement('span');
                span.className = 'chat-tag';
                span.textContent = tag;
                tagsDiv.appendChild(span);
            });
            menuDropdown.appendChild(tagsDiv);
        }

        // Add action buttons to dropdown
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'chat-menu-actions';

        const pinAction = document.createElement('button');
        pinAction.className = 'chat-menu-action';
        pinAction.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="${chat.pinned ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l2 4h4l-2 2 1 6-5 5-5-5 1-6-2-2h4z"></path></svg> ${chat.pinned ? 'Unpin' : 'Pin'}`;
        pinAction.onclick = (e) => {
            e.stopPropagation();
            window.togglePinChat(chat.id);
            toggleChatMenu(chat.id, menuBtn);
        };

        const renameAction = document.createElement('button');
        renameAction.className = 'chat-menu-action';
        renameAction.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg> Rename`;
        renameAction.onclick = (e) => {
            e.stopPropagation();
            const newTitle = prompt('Enter a new name for this chat:', chat.title || 'New Chat');
            if (newTitle && newTitle.trim()) {
                chat.title = newTitle.trim();
                saveChatState();
                renderChatList();
            }
            toggleChatMenu(chat.id, menuBtn);
        };

        const regenerateTitleAction = document.createElement('button');
        regenerateTitleAction.className = 'chat-menu-action';
        regenerateTitleAction.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path><path d="M3 3v5h5"></path><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"></path><path d="M16 21h5v-5"></path></svg> Regenerate title`;
        regenerateTitleAction.onclick = (e) => {
            e.stopPropagation();
            toggleChatMenu(chat.id, menuBtn);
            generateChatTitle(chat);
        };

        const folderAction = document.createElement('button');
        folderAction.className = 'chat-menu-action';
        folderAction.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg> Change folder`;
        folderAction.onclick = (e) => {
            e.stopPropagation();
            toggleChatMenu(chat.id, menuBtn);
            // Use a timeout to let the menu close before opening folder menu
            setTimeout(() => {
                const rect = folderAction.getBoundingClientRect();
                showFolderMenu(chat.id, { getBoundingClientRect: () => rect });
            }, 50);
        };

        const deleteAction = document.createElement('button');
        deleteAction.className = 'chat-menu-action chat-menu-action-danger';
        deleteAction.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg> Delete`;
        deleteAction.onclick = (e) => {
            e.stopPropagation();
            window.deleteChat(chat.id);
        };

        actionsDiv.appendChild(pinAction);
        actionsDiv.appendChild(renameAction);
        actionsDiv.appendChild(regenerateTitleAction);
        actionsDiv.appendChild(folderAction);
        actionsDiv.appendChild(deleteAction);
        menuDropdown.appendChild(actionsDiv);

        div.onclick = (e) => {
            // Close menu if clicking on the chat item (not menu button or dropdown)
            if (!e.target.closest('.chat-menu-btn') && !e.target.closest('.chat-menu-dropdown')) {
                setCurrentChat(chat.id);
            }
        };
        div.appendChild(contentDiv);
        div.appendChild(menuBtn);
        div.appendChild(menuDropdown);
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
    // In the Node.js frontend, API calls always go to the current origin's backend.
    // The "Proxy Base URL" setting configures the backend's upstream proxy,
    // so we do NOT prepend it to frontend /api/... paths.
    return path;
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
        // Silently fail on logging errors to not affect user experience
        fetch(getApiUrl('/api/logs'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ level, message, details })
        }).catch(() => {
            // Silently ignore logging errors - they're non-critical
        });
    } catch (e) {
        // Silently ignore all logging errors
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
        const persistentChats = state.chats.filter(chat => !chat.isIncognito);
        await apiFetch('/api/history', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(persistentChats)
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
            state.chats = Array.isArray(data) ? data.filter(chat => !chat.isIncognito) : [];
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

async function createNewChat(presetId = null, incognito = false) {
    presetId = presetId || state.currentPresetId || null;
    const id = Date.now().toString();
    let endpointId = state.currentEndpointId;
    let modelId = '';
    let systemPrompt = '';
    let tags = [];
    let folder = DEFAULT_FOLDER;
    
    // Regular new chat
    if (presetId) {
        const preset = state.presets.find(p => p.id === presetId);
        if (preset) {
            endpointId = preset.endpointId;
            modelId = preset.modelId || '';
            systemPrompt = preset.systemPrompt || '';
            tags = preset.tags ? preset.tags.split(',').map(t => t.trim()) : [];
        }
    }
    
    const newChat = {
        id,
        title: 'New Chat',
        endpointId,
        modelId,
        systemPrompt,
        messages: [],
        tags,
        folder,
        timestamp: Date.now(),
        isIncognito: incognito
    };
    
    state.chats.unshift(newChat);
    state.currentChatId = id;
    if (!incognito) await saveChatState();
    renderChatList();
    renderMessages();
    return id;
}

async function createIncognitoChat() {
    const id = await createNewChat(null, true);
    const chat = getCurrentChat();
    if (chat) {
        chat.title = 'Incognito Chat';
        chat.folder = DEFAULT_FOLDER;
    }
    renderChatList();
    await setCurrentChat(id);
    showSuccess('Incognito chat started. It will not be saved.');
    return id;
}

async function createBranchFromPoint(chat, msgIndex) {
    try {
        const branchName = prompt('Enter a name for this branch:', `Branch from message ${msgIndex + 1}`);
        if (!branchName) return;
        
        // Create branch directly without using createNewChat to avoid parameter issues
        const id = Date.now().toString();
        const branchMessages = chat.messages.slice(0, msgIndex + 1);
        
        const newChat = {
            id,
            title: branchName,
            endpointId: chat.endpointId,
            modelId: chat.modelId,
            systemPrompt: chat.systemPrompt || '',
            messages: branchMessages,
            tags: [...(chat.tags || [])],
            folder: chat.folder || DEFAULT_FOLDER,
            timestamp: Date.now(),
            parentBranchId: chat.id,
            branchPoint: msgIndex,
            isBranch: true,
            isIncognito: !!chat.isIncognito
        };
        
        state.chats.push(newChat);
        state.currentChatId = id;
        await saveChatState();
        renderChatList();
        renderMessages();
        updateCompareButtonVisibility();
        
        showSuccess('Branch created successfully');
    } catch (e) {
        console.error('Failed to create branch:', e);
        showError('Failed to create branch: ' + e.message);
    }
}

function getCurrentChat() {
    return state.chats.find(c => c.id === state.currentChatId);
}

function updateCompareButtonVisibility() {
    const hasBranches = state.chats.some(c => c.isBranch || c.parentBranchId);
    compareBtn.style.display = hasBranches ? 'flex' : 'none';
}

async function mergeBranch(sourceChatId, targetChatId) {
    try {
        const sourceChat = state.chats.find(c => c.id === sourceChatId);
        const targetChat = state.chats.find(c => c.id === targetChatId);
        
        if (!sourceChat || !targetChat) {
            showError('One or more conversations not found');
            return;
        }
        
        if (!confirm(`Merge "${sourceChat.title}" into "${targetChat.title}"? This will append all messages from the source to the target.`)) {
            return;
        }
        
        // Append messages from source to target
        targetChat.messages = [...targetChat.messages, ...sourceChat.messages];
        
        // Update metadata
        targetChat.timestamp = Date.now();
        targetChat.mergedFrom = sourceChatId;
        
        // Remove source chat
        state.chats = state.chats.filter(c => c.id !== sourceChatId);
        
        if (state.currentChatId === sourceChatId) {
            state.currentChatId = targetChatId;
        }
        
        await saveChatState();
        renderChatList();
        renderMessages();
        updateCompareButtonVisibility();
        
        showSuccess('Branch merged successfully');
    } catch (e) {
        console.error('Failed to merge branch:', e);
        showError('Failed to merge branch: ' + e.message);
    }
}

function chatModelLabel(chat) {
    const ep = state.endpoints.find(e => e.id === chat.endpointId);
    return `${chat.modelId || 'No model'}${ep ? ` · ${ep.name}` : ''}`;
}

function populateComparisonSelects() {
    compareChat1.innerHTML = '<option value="">Select conversation</option>';
    compareChat2.innerHTML = '<option value="">Select conversation</option>';

    state.chats.forEach(chat => {
        const option = document.createElement('option');
        option.value = chat.id;
        option.textContent = `${chat.title || 'New Chat'} (${chatModelLabel(chat)})`;
        compareChat1.appendChild(option.cloneNode(true));
        compareChat2.appendChild(option);
    });
}

// Pair each user question with the answer that follows it
function buildTurns(chat) {
    const turns = [];
    chat.messages.forEach(msg => {
        if (msg.role === 'user') turns.push({ prompt: msg, answer: null });
        else if (msg.role === 'assistant' && turns.length) turns[turns.length - 1].answer = msg;
    });
    return turns;
}

function renderAnswerCell(chat, msg) {
    const cell = document.createElement('div');
    cell.className = 'compare-cell';

    const meta = document.createElement('div');
    meta.className = 'compare-meta';
    const usageText = msg?.usage ? ` · ${msg.usage.totalTokens.toLocaleString()} tokens · $${msg.usage.totalCost.toFixed(4)}` : '';
    meta.textContent = `${chatModelLabel(chat)}${usageText}`;

    const body = document.createElement('div');
    body.className = 'compare-body markdown-body';
    if (msg) {
        body.innerHTML = parseMarkdownWithMath(getMessageText(msg.content));
    } else {
        body.textContent = 'No answer in this conversation for this question.';
        body.classList.add('compare-empty');
    }

    cell.append(meta, body);
    return cell;
}

function startComparison() {
    const chat1Id = compareChat1.value;
    const chat2Id = compareChat2.value;

    if (!chat1Id || !chat2Id || chat1Id === chat2Id) {
        showError('Please select two different conversations to compare');
        return;
    }

    const chat1 = state.chats.find(c => c.id === chat1Id);
    const chat2 = state.chats.find(c => c.id === chat2Id);

    if (!chat1 || !chat2) {
        showError('One or more conversations not found');
        return;
    }

    // Show merge button if one is a branch
    const isBranchRelationship = (chat1.isBranch || chat1.parentBranchId) || (chat2.isBranch || chat2.parentBranchId);
    mergeBranchBtn.style.display = isBranchRelationship ? 'inline-block' : 'none';

    const turns1 = buildTurns(chat1);
    const turns2 = buildTurns(chat2);
    const rowCount = Math.max(turns1.length, turns2.length);

    comparisonResults.innerHTML = '';
    if (!rowCount) {
        const empty = document.createElement('div');
        empty.className = 'compare-empty';
        empty.textContent = 'Neither conversation has any messages yet.';
        comparisonResults.appendChild(empty);
        comparisonResults.classList.remove('hidden');
        return;
    }

    const head = document.createElement('div');
    head.className = 'compare-head';
    [chat1, chat2].forEach(chat => {
        const title = document.createElement('div');
        title.className = 'compare-head-title';
        title.textContent = chat.title || 'New Chat';
        head.appendChild(title);
    });
    comparisonResults.appendChild(head);

    for (let i = 0; i < rowCount; i++) {
        const row = document.createElement('div');
        row.className = 'compare-row';

        const prompt = document.createElement('div');
        prompt.className = 'compare-prompt';
        const promptSource = (turns1[i] || turns2[i]).prompt;
        prompt.textContent = `Q${i + 1}: ${getMessageText(promptSource.content)}`;

        const grid = document.createElement('div');
        grid.className = 'compare-grid';
        grid.append(renderAnswerCell(chat1, turns1[i]?.answer), renderAnswerCell(chat2, turns2[i]?.answer));

        row.append(prompt, grid);
        comparisonResults.appendChild(row);
    }

    comparisonResults.classList.remove('hidden');
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
    const composerInput = getComposerInput();
    if (composerInput) {
        composerInput.placeholder = chat?.isIncognito ? 'Private message — this chat is not saved' : 'Message your AI...';
    }
    activateComposer({ focus: true });
    if (window.innerWidth <= 768) sidebar.classList.remove('open');
    reattachPendingMessage(chat);
    syncComposerState();
}

async function generateChatTitle(chat) {
    if (chat.titleGenerating || chat.isIncognito) return;
    try {
        const firstUserMessage = chat.messages.find(m => m.role === 'user');
        if (!firstUserMessage) return;

        const messageText = getMessageText(firstUserMessage.content);
        if (!messageText || messageText.length < 10) return;

        const endpointId = chat.endpointId || state.currentEndpointId;
        const ep = state.endpoints.find(e => e.id === endpointId);
        const model = chat.modelId || ep?.defaultModel || modelSelect.value;
        if (!endpointId || !model) {
            console.warn('Cannot generate title: missing endpoint or model');
            // Fallback: use first few words of message
            const fallbackTitle = messageText.split(' ').slice(0, 4).join(' ') + '...';
            chat.title = fallbackTitle.substring(0, 50);
            await saveChatState();
            renderChatList();
            return;
        }

        chat.titleGenerating = true;
        const titlePrompt = `Generate a short, concise title of no more than 5 words for this conversation. Return only the title, with no quotes, explanation, or punctuation.

First message: "${messageText.substring(0, 500)}"`;
        
        // Use streaming to match server behavior for localhost endpoints
        const response = await apiFetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                endpointId,
                model,
                messages: [{ role: 'user', content: titlePrompt }],
                temperature: 0.3,
                stream: true,
                activeTools: []
            })
        });

        if (!response.ok) {
            console.warn('Failed to generate title: API response not OK', response.status);
            const errorText = await response.text();
            console.warn('Error response:', errorText);
            // Fallback: use first few words of message
            const fallbackTitle = messageText.split(' ').slice(0, 4).join(' ') + '...';
            chat.title = fallbackTitle.substring(0, 50);
            await saveChatState();
            renderChatList();
            return;
        }

        // Handle streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';
        
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;
                    
                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.choices?.[0]?.delta?.content) {
                            fullContent += parsed.choices[0].delta.content;
                        }
                    } catch (e) {
                        // Ignore parse errors for SSE chunks
                    }
                }
            }
        }

        const generatedTitle = fullContent.trim().replace(/^["']|["']$/g, '').replace(/[.!?]+$/, '').substring(0, 50);

        if (generatedTitle.length > 2) {
            chat.title = generatedTitle;
            await saveChatState();
            renderChatList();
            console.log('Generated chat title:', generatedTitle);
        } else {
            console.warn('Generated title too short or invalid:', fullContent);
            // Fallback: use first few words of message
            const fallbackTitle = messageText.split(' ').slice(0, 4).join(' ') + '...';
            chat.title = fallbackTitle.substring(0, 50);
            await saveChatState();
            renderChatList();
        }
    } catch (e) {
        console.warn('Failed to generate chat title:', e);
        // Fallback: use first few words of message
        const firstUserMessage = chat.messages.find(m => m.role === 'user');
        if (firstUserMessage) {
            const messageText = getMessageText(firstUserMessage.content);
            if (messageText) {
                const fallbackTitle = messageText.split(' ').slice(0, 4).join(' ') + '...';
                chat.title = fallbackTitle.substring(0, 50);
                await saveChatState();
                renderChatList();
            }
        }
    } finally {
        delete chat.titleGenerating;
    }
}

// Function to regenerate titles for all chats with "New Chat"
async function regenerateAllUntitledChats() {
    const untitledChats = state.chats.filter(c => !c.title || c.title === 'New Chat');
    if (untitledChats.length === 0) {
        alert('No chats need title regeneration.');
        return;
    }
    
    if (!confirm(`Regenerate titles for ${untitledChats.length} chat(s)? This will use your API quota.`)) {
        return;
    }
    
    for (const chat of untitledChats) {
        await generateChatTitle(chat);
        // Small delay between requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    alert(`Regenerated titles for ${untitledChats.length} chat(s).`);
}

function updateChatTitle(chat) {
    // Use AI to generate a meaningful title
    if (!chat.title || chat.title === 'New Chat') {
        console.log('Triggering title generation for chat:', chat.id);
        generateChatTitle(chat);
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

async function changeChatFolder(chatId, newFolder) {
    const chat = state.chats.find(c => c.id === chatId);
    if (!chat) return;
    chat.folder = newFolder;
    await saveChatState();
    renderChatList();
    showSuccess(`Chat moved to ${newFolder}`);
}

function toggleChatMenu(chatId, triggerBtn) {
    // Close all other open menus first
    document.querySelectorAll('.chat-menu-dropdown.open').forEach(menu => {
        if (menu.id !== `chat-menu-${chatId}`) {
            menu.classList.remove('open');
        }
    });

    const menu = document.getElementById(`chat-menu-${chatId}`);
    if (!menu) return;

    const isOpen = menu.classList.contains('open');
    menu.classList.toggle('open');

    if (!isOpen) {
        // Move menu to body for proper positioning
        document.body.appendChild(menu);
        const rect = triggerBtn.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.top = `${rect.bottom + 4}px`;
        menu.style.right = `${window.innerWidth - rect.right}px`;
        menu.style.zIndex = '1001';
    }
}

function showFolderMenu(chatId, triggerBtn) {
    const chat = state.chats.find(c => c.id === chatId);
    if (!chat) return;

    const menu = document.createElement('div');
    menu.className = 'folder-menu';
    menu.innerHTML = `
        <div class="folder-menu-header">Move to folder</div>
        <div class="folder-menu-items">
            <button data-folder="General" class="folder-menu-item">General</button>
            <button data-folder="Work" class="folder-menu-item">Work</button>
            <button data-folder="Personal" class="folder-menu-item">Personal</button>
            <button data-folder="Archive" class="folder-menu-item">Archive</button>
        </div>
    `;

    const rect = triggerBtn.getBoundingClientRect();
    menu.style.position = 'absolute';
    menu.style.top = `${rect.bottom + 4}px`;
    menu.style.right = `${window.innerWidth - rect.right}px`;
    menu.style.zIndex = '1002';

    document.body.appendChild(menu);

    menu.querySelectorAll('.folder-menu-item').forEach(item => {
        if (item.dataset.folder === chat.folder) {
            item.classList.add('active');
        }
        item.addEventListener('click', () => {
            changeChatFolder(chatId, item.dataset.folder);
            menu.remove();
        });
    });

    const closeMenu = (e) => {
        if (!menu.contains(e.target) && e.target !== triggerBtn) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        }
    };

    setTimeout(() => document.addEventListener('click', closeMenu), 0);
}

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

                <div class="chat-settings">
                    <section class="settings-card" aria-labelledby="system-prompt-title">
                        <div class="settings-card-header">
                            <span id="system-prompt-title" class="settings-card-title">System prompt</span>
                            <span id="system-prompt-preview" class="settings-card-preview"></span>
                            <button type="button" id="system-prompt-toggle" class="settings-toggle" aria-expanded="false" aria-controls="system-prompt-body">Edit</button>
                        </div>
                        <div class="preset-chips" role="group" aria-label="Default system prompts">
                            ${DEFAULT_SYSTEM_PROMPTS.map(p => `<button type="button" class="preset-chip" data-preset-id="${p.id}">${escapeHtml(p.label)}</button>`).join('')}
                        </div>
                        <div id="system-prompt-body" class="settings-card-body hidden">
                            <textarea id="system-prompt-input" class="system-prompt-input" placeholder="Enter the system prompt text...">${escapeHtml(String(sysPrompt))}</textarea>
                            <div class="settings-card-footer">
                                <span id="system-prompt-count"></span>
                                <button type="button" id="system-prompt-reset" class="ghost-btn">Reset</button>
                            </div>
                        </div>
                    </section>

                    <section class="settings-card" aria-labelledby="temperature-title">
                        <div class="settings-card-header">
                            <span id="temperature-title" class="settings-card-title">Temperature</span>
                            <span id="temp-display" class="temp-badge">${escapeHtml(String(temperature))}</span>
                        </div>
                        <div class="preset-chips" role="group" aria-label="Temperature presets">
                            <button type="button" class="preset-chip" data-temp="0.2">Precise</button>
                            <button type="button" class="preset-chip" data-temp="0.7">Balanced</button>
                            <button type="button" class="preset-chip" data-temp="1">Creative</button>
                        </div>
                        <input type="range" id="temperature-input" min="0" max="2" step="0.1" value="${escapeHtml(String(temperature))}" aria-label="Temperature">
                        <p id="temp-hint" class="settings-card-hint"></p>
                    </section>
                </div>
            </div>`;

        if (chat) {
            const spInput = document.getElementById('system-prompt-input');
            const spBody = document.getElementById('system-prompt-body');
            const spToggle = document.getElementById('system-prompt-toggle');
            const spPreview = document.getElementById('system-prompt-preview');
            const spCount = document.getElementById('system-prompt-count');
            const spReset = document.getElementById('system-prompt-reset');
            const chipButtons = [...document.querySelectorAll('.preset-chip[data-preset-id]')];
            const tempInput = document.getElementById('temperature-input');
            const tempDisplay = document.getElementById('temp-display');
            const tempHint = document.getElementById('temp-hint');
            const tempChips = [...document.querySelectorAll('.preset-chip[data-temp]')];

            const presetFor = (text) => (DEFAULT_SYSTEM_PROMPTS.find(p => p.text === text.trim()) || { id: 'custom' }).id;
            let chosenPresetId = presetFor(spInput.value) === 'custom' ? 'none' : presetFor(spInput.value);

            const refreshSystemPrompt = () => {
                const text = spInput.value;
                const trimmed = text.trim();
                const activeId = presetFor(text);
                chipButtons.forEach(b => b.classList.toggle('active', b.dataset.presetId === activeId));
                spPreview.textContent = trimmed ? (trimmed.length > 70 ? `${trimmed.slice(0, 70)}…` : trimmed) : 'None';
                spCount.textContent = `${text.length.toLocaleString()} characters`;
            };

            const setSystemPromptText = (text) => {
                spInput.value = text;
                chat.systemPromptDraft = text;
                saveChatState();
                refreshSystemPrompt();
            };

            chipButtons.forEach(btn => btn.addEventListener('click', () => {
                const preset = DEFAULT_SYSTEM_PROMPTS.find(p => p.id === btn.dataset.presetId);
                if (!preset) return;
                chosenPresetId = preset.id;
                setSystemPromptText(preset.text);
            }));

            spInput.addEventListener('input', () => setSystemPromptText(spInput.value));

            spToggle.addEventListener('click', () => {
                const open = spBody.classList.toggle('hidden') === false;
                spToggle.textContent = open ? 'Collapse' : 'Edit';
                spToggle.setAttribute('aria-expanded', String(open));
                if (open) spInput.focus();
            });

            spReset.addEventListener('click', () => {
                const preset = DEFAULT_SYSTEM_PROMPTS.find(p => p.id === chosenPresetId) || DEFAULT_SYSTEM_PROMPTS[0];
                setSystemPromptText(preset.text);
            });

            const temperatureHint = (t) => (t < 0.5 ? 'Focused and predictable' : t < 1.2 ? 'Balanced' : 'Creative and varied');
            const setTemperature = (value, save = true) => {
                const t = Math.round(Number(value) * 10) / 10;
                tempInput.value = t;
                tempDisplay.textContent = t.toFixed(1);
                tempHint.textContent = temperatureHint(t);
                tempChips.forEach(b => b.classList.toggle('active', Number(b.dataset.temp) === t));
                if (save) {
                    chat.temperatureDraft = t;
                    saveChatState();
                }
            };
            tempInput.addEventListener('input', () => setTemperature(tempInput.value));
            tempChips.forEach(b => b.addEventListener('click', () => setTemperature(b.dataset.temp)));

            refreshSystemPrompt();
            setTemperature(tempInput.value, false);
        }
        return;
    }
    chat.messages.forEach((msg, idx) => {
        if (msg.role === 'system') return; // Don't render system prompts as bubbles
        // Always render from content; ignore any persisted html to avoid XSS from imported chats
        const div = appendMessageDiv(msg.role === 'user' ? 'User' : 'AI', msg.content, msg.role === 'user' ? 'user' : 'ai', null, chat, idx, msg.createdAt);
        if (msg.jobId) div.dataset.jobId = msg.jobId;
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
    code() {
        return false;
    },
    // Also disable lists and blockquotes if we want strictly "text unless backticks"
    // This often causes code with dashes or > to be split into lists/quotes
    list() { return false; },
    blockquote() { return false; },
    // Disable HTML parsing entirely. Treat <tags> as plain text.
    html() { return false; }
};

try {
    marked.use({ renderer, tokenizer, breaks: true, gfm: true });
} catch (e) {
    console.error('Failed to configure marked', e);
}

// Simple math rendering using KaTeX renderToString with HTML-only output
function renderMath(text, mathHtml) {
    if (typeof katex === 'undefined') return text;

    const render = (content, displayMode) => {
        try {
            const html = katex.renderToString(content, {
                displayMode,
                throwOnError: false,
                output: 'html'
            });
            const index = mathHtml.push(html) - 1;
            return `MATH_PLACEHOLDER_${index}_END`;
        } catch (e) {
            return content;
        }
    };

    return text
        .replace(/\$\$([^$]+)\$\$/g, (_, content) => render(content, true))
        .replace(/\$([^$]+)\$/g, (_, content) => render(content, false))
        .replace(/\\\(([^)]+)\\\)/g, (_, content) => render(content, false))
        .replace(/\\\[([^]]+)\\\]/g, (_, content) => render(content, true));
}

function parseMarkdownWithMath(content) {
    const mathHtml = [];
    const mathRendered = renderMath(content || '', mathHtml);

    // Parse markdown while protecting KaTeX HTML from being escaped.
    let html = marked.parse(mathRendered);
    mathHtml.forEach((math, index) => {
        html = html.replace(`MATH_PLACEHOLDER_${index}_END`, math);
    });
    return html;
}

function enhanceCodeBlocks(container) {
    container.querySelectorAll('pre').forEach(pre => {
        if (pre.parentElement?.classList.contains('code-block')) return;
        const codeEl = pre.querySelector('code');
        const lang = (codeEl?.className.match(/language-(\S+)/) || [])[1] || 'text';

        const wrapper = document.createElement('div');
        wrapper.className = 'code-block';
        wrapper.innerHTML = `<div class="code-block-header"><span class="code-block-lang"></span><button type="button" class="code-copy-btn" title="Copy code"><i class="fa-regular fa-copy"></i><span>Copy</span></button></div>`;
        wrapper.querySelector('.code-block-lang').textContent = lang;

        pre.parentNode.insertBefore(wrapper, pre);
        wrapper.appendChild(pre);

        const btn = wrapper.querySelector('.code-copy-btn');
        btn.addEventListener('click', () => {
            navigator.clipboard.writeText(codeEl ? codeEl.textContent : pre.textContent).then(() => {
                btn.classList.add('copied');
                btn.innerHTML = '<i class="fa-solid fa-check"></i><span>Copied</span>';
                setTimeout(() => {
                    btn.classList.remove('copied');
                    btn.innerHTML = '<i class="fa-regular fa-copy"></i><span>Copy</span>';
                }, 1500);
            });
        });
    });
}

function addFadeInEffects(container) {
    enhanceCodeBlocks(container);

    // Add fade-in effect to code blocks
    const codeBlocks = container.querySelectorAll('pre');
    codeBlocks.forEach((block, index) => {
        block.style.opacity = '0';
        block.style.transform = 'translateY(10px)';
        block.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        
        setTimeout(() => {
            block.style.opacity = '1';
            block.style.transform = 'translateY(0)';
        }, 100 + (index * 100));
    });

    // Add fade-in effect to images
    const images = container.querySelectorAll('img');
    images.forEach((img, index) => {
        img.style.opacity = '0';
        img.style.transform = 'scale(0.95)';
        img.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        
        setTimeout(() => {
            img.style.opacity = '1';
            img.style.transform = 'scale(1)';
        }, 200 + (index * 100));
    });
}

function appendMessageDiv(role, content, type, preRendered = null, chat = null, msgIndex = -1, timestamp = null) {
    const welcome = document.querySelector('.welcome-message');
    if (welcome) welcome.remove();
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;
    if (timestamp) msgDiv.dataset.timestamp = timestamp;

    let htmlContent = '';
    let reasoningHtml = '';

    if (preRendered) {
        htmlContent = preRendered;
    } else if (Array.isArray(content)) {
        // Handle array content (Text + Images)
        content.forEach(part => {
            if (part.type === 'text') {
                htmlContent += parseMarkdownWithMath(part.text);
            } else if (part.type === 'image_url') {
                htmlContent += `<img src="${part.image_url.url}" style="max-width: 100%; border-radius: 8px; margin-top: 10px; display: block;">`;
            }
        });
    } else {
        // Handle legacy string content
        htmlContent = parseMarkdownWithMath(content || '');
    }
    
    // Handle reasoning content from message metadata
    if (chat && msgIndex >= 0 && chat.messages[msgIndex] && chat.messages[msgIndex].reasoning_content) {
        const reasoningContent = chat.messages[msgIndex].reasoning_content;
        reasoningHtml = parseMarkdownWithMath(reasoningContent);
    }

    const isUser = type === 'user';
    const extraActions = isUser
        ? `<button class="msg-action-btn msg-edit-btn" title="Edit"><i class="fa-solid fa-pen"></i></button>`
        : `<button class="msg-action-btn msg-regenerate-btn" title="Regenerate"><i class="fa-solid fa-rotate-right"></i></button><button class="msg-action-btn msg-ask-models-btn" title="Ask other models"><i class="fa-solid fa-layer-group"></i></button>`;
    
    // Add branch button for all messages if chat exists
    const branchAction = chat && msgIndex >= 0 
        ? `<button class="msg-action-btn msg-branch-btn" title="Branch from here"><i class="fa-solid fa-code-branch"></i></button>`
        : '';
    
    const allActions = `${extraActions}${branchAction}<button class="msg-action-btn msg-copy-btn" title="Copy"><i class="fa-regular fa-copy"></i></button><button class="msg-action-btn msg-collapse-btn" title="Collapse"><i class="fa-solid fa-chevron-up"></i></button>`;
    const timeHtml = timestamp ? `<div class="message-time">${formatTimestamp(timestamp)}</div>` : '';
    const usage = (chat && msgIndex >= 0 && chat.messages[msgIndex]?.usage) ? chat.messages[msgIndex].usage : null;
    const usageHtml = (usage && !isUser) ? `<div class="msg-usage">${usage.totalTokens.toLocaleString()} tokens · $${usage.totalCost.toFixed(4)}</div>` : '';

    msgDiv.innerHTML = `<div class="message-content markdown-body"><div class="msg-actions">${allActions}</div>${reasoningHtml ? `<details class="reasoning-content" style="margin-bottom:0.75rem;color:var(--text-secondary);font-size:0.9em;font-style:italic;border-left:2px solid var(--border-color);padding-left:0.75rem;"><summary>Thinking</summary><div class="reasoning-body">${reasoningHtml}</div></details>` : ''}<div class="msg-body">${htmlContent}</div>${timeHtml}${usageHtml}</div>`;

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
        msgDiv.querySelector('.msg-regenerate-btn').addEventListener('click', () => regenerateAssistantMessage(chat, msgIndex));
        msgDiv.querySelector('.msg-ask-models-btn').addEventListener('click', () => openModelBranchModal(chat, msgIndex));
    }
    
    // Wire up branch button
    if (chat && msgIndex >= 0) {
        msgDiv.querySelector('.msg-branch-btn').addEventListener('click', () => createBranchFromPoint(chat, msgIndex));
    }
    
    // Show compare button if there are branches
    updateCompareButtonVisibility();

    // Add fade-in effects for rendered content
    if (!preRendered) {
        const msgBody = msgDiv.querySelector('.msg-body');
        addFadeInEffects(msgBody);
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
    await loadNotifications();
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
    ta.style.cssText = 'width:100%;min-height:60px;padding:8px;border-radius:6px;border:1px solid var(--border-color);background:var(--card-bg);color:var(--text-primary);resize:vertical;font-size:16px;';
    ta.value = original;

    const btnRow = document.createElement('div');
    btnRow.style.cssText = 'display:flex;gap:0.5rem;justify-content:flex-end;margin-top:0.5rem;';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'ghost-btn cancel-edit';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.addEventListener('click', () => renderMessages());

    const saveBtn = document.createElement('button');
    saveBtn.className = 'primary-btn save-edit';
    saveBtn.textContent = 'Save & Regenerate';
    saveBtn.addEventListener('click', async () => {
        const newText = ta.value.trim();
        if (!newText) return;
        
        // Update the message
        chat.messages[msgIndex].content = newText;
        
        // Remove all messages after this one (including AI response)
        chat.messages.splice(msgIndex + 1);
        
        // Update title if this is the first message
        if (msgIndex === 0) {
            updateChatTitle(chat);
        }
        
        await saveChatState();
        renderMessages();
        
        // Regenerate AI response
        await generateAssistantResponse(chat);
    });

    btnRow.append(cancelBtn, saveBtn);
    body.append(ta, btnRow);
    ta.focus();
}

async function regenerateAssistantMessage(chat, msgIndex) {
    if (isChatGenerating(getCurrentChat())) return;
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

// Reads a generation job's SSE stream. If the connection drops, it reconnects and resumes
// from the last received character offset, so no output is lost.
async function consumeJobStream({ jobId, start, signal, onEvent }) {
    let offset = 0;
    let pending = '';
    let attempt = 0;

    const readStream = async (response) => {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
            const { done, value } = await reader.read();
            if (done) return null;
            const text = decoder.decode(value, { stream: true });
            offset += text.length;
            pending += text;
            const lines = pending.split('\n');
            pending = lines.pop();
            for (const line of lines) {
                if (line.trim() === 'event: end') return 'done';
                const chunk = parseSseLine(line);
                if (!chunk) continue;
                if (chunk.error) {
                    const err = new Error(chunk.error.message || 'Generation failed');
                    err.fatal = true;
                    throw err;
                }
                onEvent(chunk);
            }
        }
    };

    while (true) {
        let result = null;
        try {
            const response = attempt === 0 && start
                ? await start()
                : await apiFetch(`/api/jobs/${encodeURIComponent(jobId)}/stream?offset=${offset}`, { signal });
            if (response.status === 404) return 'interrupted';
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                const fatal = new Error(getApiError(err, response.status));
                fatal.fatal = true;
                throw fatal;
            }
            result = await readStream(response);
        } catch (err) {
            if (err.name === 'AbortError' || err.fatal) throw err;
            console.warn('Stream connection lost, reconnecting:', err.message);
        }
        if (result === 'done') return 'done';
        if (++attempt > 30) throw new Error('Connection lost and the response could not be resumed');
        await new Promise(r => setTimeout(r, Math.min(500 * attempt, 3000)));
    }
}

function stopGeneration() {
    const gen = liveGenerations.get(getCurrentChat()?.id);
    if (!gen) return;
    gen.stopped = true;
    gen.controller.abort();
    apiFetch(`/api/jobs/${encodeURIComponent(gen.jobId)}/cancel`, { method: 'POST' }).catch(() => {});
}

function isChatGenerating(chat) {
    return !!chat && liveGenerations.has(chat.id);
}

// Composer buttons reflect the chat that is on screen; other chats can keep generating in the background
function syncComposerState() {
    const busy = isChatGenerating(getCurrentChat());
    sendBtn.disabled = busy || getInputText().trim() === '';
    sendBtn.hidden = busy;
    if (stopBtn) stopBtn.hidden = !busy;
    statusIndicator.style.backgroundColor = liveGenerations.size ? '#f7630c' : '#0e7a0d';
}

// After a reload or chat switch, reattach to a response that was still streaming when the page was left.
function reattachPendingMessage(chat) {
    if (!chat) return;
    const index = chat.messages.findIndex(m => m.pending);
    if (index === -1) return;
    const existing = liveGenerations.get(chat.id);
    // Stop this tab's old stream for the chat; the server job keeps running and is replayed below
    if (existing) existing.controller.abort();
    generateAssistantResponse(chat, { resumeIndex: index });
}

async function generateAssistantResponse(chat, { resumeIndex = null } = {}) {
    const controller = new AbortController();
    const gen = { jobId: null, controller, stopped: false };
    liveGenerations.set(chat.id, gen);
    syncComposerState();

    const ep = state.endpoints.find(e => e.id === (chat.endpointId || state.currentEndpointId));
    let start = null;
    let placeholder;
    if (resumeIndex !== null) {
        placeholder = chat.messages[resumeIndex];
        document.querySelectorAll(`[data-job-id="${placeholder.jobId}"]`).forEach(el => el.remove());
    } else {
        const useStream = ep ? ep.stream !== false : true;
        const payload = {
            endpointId: chat.endpointId || state.currentEndpointId,
            model: chat.modelId || modelSelect.value,
            messages: chat.messages.slice(),
            temperature: chat.temperature || 0.7,
            stream: useStream,
            activeTools: state.tools.filter(t => t.enabled).map(t => t.id)
        };
        const jobId = crypto.randomUUID();
        placeholder = { role: 'assistant', content: '', reasoning_content: null, createdAt: new Date().toISOString(), pending: true, jobId };
        chat.messages.push(placeholder);
        await saveChatState();
        logToServer('INFO', 'Sending Message', { model: payload.model, endpointId: payload.endpointId, stream: useStream });
        start = () => apiFetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, jobId }),
            signal: controller.signal
        });
    }
    gen.jobId = placeholder.jobId;
    const assistantCreatedAt = placeholder.createdAt;

    const aiMsgDiv = appendMessageDiv('AI', '', 'ai', null, null, -1, assistantCreatedAt);
    aiMsgDiv.dataset.jobId = gen.jobId;
    // Only the chat on screen gets a visible bubble; background branches update their data only
    if (getCurrentChat() !== chat) aiMsgDiv.remove();
    const aiBodyDiv = aiMsgDiv.querySelector('.msg-body');
    aiBodyDiv.innerHTML = '<div class="typing-indicator"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>';
    scrollToBottom();

    let answerBuffer = '';
    let reasoningBuffer = '';
    let hasReceivedData = false;
    let usage = null;
    let reasoningEl = null;
    let answerEl = null;
    let lastPersist = 0;

    function removePlaceholder() {
        const i = chat.messages.indexOf(placeholder);
        if (i >= 0) chat.messages.splice(i, 1);
    }

    // Save partial text now and then, so a crash or restart loses at most a few seconds
    function persistPartial() {
        const now = Date.now();
        if (now - lastPersist < 1500) return;
        lastPersist = now;
        placeholder.content = answerBuffer;
        placeholder.reasoning_content = reasoningBuffer || null;
        saveChatState();
    }

    function ensureStreamingContainer() {
        if (hasReceivedData) return;
        aiBodyDiv.innerHTML = '';

        // Add progress indicator initially
        const progressIndicator = document.createElement('div');
        progressIndicator.className = 'streaming-progress';
        progressIndicator.id = 'streaming-progress';
        progressIndicator.innerHTML = `
            <div class="progress-bar">
                <div class="progress-fill"></div>
            </div>
            <div class="progress-text">Generating response...</div>
        `;
        aiBodyDiv.appendChild(progressIndicator);

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
        persistPartial();
    }

    function appendAnswer(text) {
        ensureStreamingContainer();
        answerBuffer += text;
        if (answerEl) {
            answerEl.textContent = answerBuffer;

            // Remove progress indicator once content starts appearing
            const progressIndicator = aiBodyDiv.querySelector('#streaming-progress');
            if (progressIndicator && answerBuffer.length > 0) {
                progressIndicator.remove();
            }

            scrollToBottom();
        }
        persistPartial();
    }

    function finalizeDisplay(usageData = null) {
        const finalContent = answerBuffer || reasoningBuffer || '';
        if (!finalContent) {
            aiMsgDiv.remove();
            removePlaceholder();
            return;
        }

        // Preserve reasoning panel if it exists and has content
        if (reasoningEl && reasoningBuffer) {
            // Keep the reasoning panel visible and formatted
            const reasoningBody = reasoningEl.querySelector('.reasoning-body');
            if (reasoningBody) {
                reasoningBody.innerHTML = parseMarkdownWithMath(reasoningBuffer);
                const summary = reasoningEl.querySelector('summary');
                if (summary) {
                    summary.textContent = `Thinking (${estimateTokens(reasoningBuffer)} tokens) - Click to expand/collapse`;
                }
                // Auto-expand reasoning panel to show the thinking process
                reasoningEl.open = true;
            }
        }

        // Apply markdown formatting to the main answer
        if (answerEl) {
            answerEl.innerHTML = parseMarkdownWithMath(answerBuffer);
            addFadeInEffects(answerEl);
        } else if (!reasoningEl || !reasoningBuffer) {
            // If no reasoning, just format the content directly
            aiBodyDiv.innerHTML = parseMarkdownWithMath(finalContent);
            addFadeInEffects(aiBodyDiv);
        }

        const priorMessages = chat.messages.slice(0, chat.messages.indexOf(placeholder));
        const costed = calculateUsageCost(usageData, ep, priorMessages, finalContent);

        // Save both reasoning and answer content separately
        Object.assign(placeholder, {
            content: answerBuffer || finalContent,
            reasoning_content: reasoningBuffer || null,
            usage: costed,
            pending: false
        });
        delete placeholder.jobId;

        const usageFooter = document.createElement('div');
        usageFooter.className = 'msg-usage';
        usageFooter.textContent = `${costed.totalTokens.toLocaleString()} tokens · $${costed.totalCost.toFixed(4)}`;
        const contentDiv = aiMsgDiv.querySelector('.message-content');
        if (contentDiv) contentDiv.appendChild(usageFooter);

        const regenerateBtn = aiMsgDiv.querySelector('.msg-regenerate-btn');
        if (regenerateBtn) regenerateBtn.addEventListener('click', () => regenerateAssistantMessage(chat, chat.messages.indexOf(placeholder)));
        const askBtn = aiMsgDiv.querySelector('.msg-ask-models-btn');
        if (askBtn) askBtn.addEventListener('click', () => openModelBranchModal(chat, chat.messages.indexOf(placeholder)));
    }

    const onEvent = (chunk) => {
        if (chunk.usage) usage = chunk.usage;
        const delta = chunk.choices?.[0]?.delta || {};
        if (delta.reasoning_content) appendReasoning(delta.reasoning_content);
        if (delta.content) appendAnswer(delta.content);
    };

    try {
        const outcome = await consumeJobStream({ jobId: gen.jobId, start, signal: controller.signal, onEvent });
        if (liveGenerations.get(chat.id) !== gen) return;

        finalizeDisplay(usage);
        if (outcome === 'interrupted') {
            appendMessageDiv('System', 'This response was interrupted (the server restarted or the response expired). Partial text was kept.', 'ai');
        }
        await saveChatState();
        logToServer('INFO', 'Message Received', { len: answerBuffer.length || reasoningBuffer.length });
    } catch (error) {
        if (liveGenerations.get(chat.id) !== gen) return;
        if (error.name === 'AbortError' || gen.stopped) {
            logToServer('INFO', 'Stream stopped by user', { len: answerBuffer.length || reasoningBuffer.length });
        } else {
            console.error(error);
            showError(error.message || 'Failed to send message');
            logToServer('ERROR', 'Message Send Failed', error.message);
            appendMessageDiv('System', `Error: ${escapeHtml(error.message)}`, 'ai');
        }
        if (answerBuffer || reasoningBuffer) {
            finalizeDisplay(usage);
        } else {
            aiMsgDiv.remove();
            removePlaceholder();
        }
        await saveChatState();
    } finally {
        if (liveGenerations.get(chat.id) === gen) {
            liveGenerations.delete(chat.id);
            syncComposerState();
        }
        scrollToBottom();
    }
}

// --- Ask other models: branch from a question and answer it with several models in parallel ---

const MODEL_BRANCH_LIMIT = 6;
const modelBranchModal = document.getElementById('model-branch-modal');
const modelBranchList = document.getElementById('model-branch-list');
const modelBranchEstimate = document.getElementById('model-branch-estimate');
const modelBranchSubmit = document.getElementById('model-branch-submit');
let modelBranchContext = null; // { chat, cutIndex } where cutIndex is just after the question

// Index just after the user message that prompted the assistant message at assistantIndex
function findTurnEnd(chat, assistantIndex) {
    for (let i = assistantIndex - 1; i >= 0; i--) {
        if (chat.messages[i].role === 'user') return i + 1;
    }
    return -1;
}

function openModelBranchModal(chat, assistantIndex) {
    const cutIndex = findTurnEnd(chat, assistantIndex);
    if (cutIndex < 1) {
        showError('There is no question before this answer to branch from');
        return;
    }
    modelBranchContext = { chat, cutIndex };
    modelBranchModal.style.display = 'block';
    loadModelsForBranching();
    updateModelBranchEstimate();
}

function closeModelBranchModal() {
    modelBranchModal.style.display = 'none';
    modelBranchContext = null;
}

function getSelectedModelBranchTargets() {
    return [...modelBranchList.querySelectorAll('input[type=checkbox]:checked')]
        .map(cb => ({ endpointId: cb.dataset.endpoint, modelId: cb.dataset.model }));
}

function loadModelsForBranching() {
    modelBranchList.innerHTML = '';
    const sourceChat = modelBranchContext?.chat;
    state.endpoints.forEach(ep => {
        const group = document.createElement('div');
        group.className = 'model-branch-group';
        const title = document.createElement('div');
        title.className = 'model-branch-group-title';
        title.textContent = ep.name;
        const status = document.createElement('div');
        status.className = 'model-branch-status';
        status.textContent = 'Loading models...';
        group.append(title, status);
        modelBranchList.appendChild(group);

        apiFetch(`/api/models?endpointId=${encodeURIComponent(ep.id)}`)
            .then(async res => {
                const data = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(data.error || `Status ${res.status}`);
                return data.data || [];
            })
            .then(models => {
                status.remove();
                if (!models.length) {
                    status.textContent = 'No models available';
                    group.appendChild(status);
                    return;
                }
                models.forEach(m => {
                    const label = document.createElement('label');
                    label.className = 'model-branch-option';
                    const cb = document.createElement('input');
                    cb.type = 'checkbox';
                    cb.dataset.endpoint = ep.id;
                    cb.dataset.model = m.id;
                    const text = document.createElement('span');
                    const isCurrent = sourceChat && sourceChat.endpointId === ep.id && sourceChat.modelId === m.id;
                    text.textContent = isCurrent ? `${m.id} (current)` : m.id;
                    label.append(cb, text);
                    group.appendChild(label);
                });
            })
            .catch(err => {
                status.textContent = `Failed to load models: ${err.message}`;
                if (!status.isConnected) group.appendChild(status);
            });
    });
}

function updateModelBranchEstimate() {
    const selected = getSelectedModelBranchTargets();
    modelBranchSubmit.disabled = selected.length === 0;
    if (!selected.length || !modelBranchContext) {
        modelBranchEstimate.textContent = 'Select one or more models';
        return;
    }
    const { chat, cutIndex } = modelBranchContext;
    const tokens = chat.messages.slice(0, cutIndex).reduce((sum, m) => sum + estimateTokens(m.content), 0);
    const cost = selected.reduce((sum, t) => {
        const ep = state.endpoints.find(e => e.id === t.endpointId);
        return sum + ((ep?.inputCost || 0) * tokens / 1e6);
    }, 0);
    modelBranchEstimate.textContent = `${selected.length} selected · about ${tokens.toLocaleString()} input tokens each · about $${cost.toFixed(4)} input cost (output not included)`;
}

async function createModelBranches() {
    if (!modelBranchContext) return;
    const { chat: source, cutIndex } = modelBranchContext;
    const targets = getSelectedModelBranchTargets();
    if (!targets.length) return;
    closeModelBranchModal();

    const branches = targets.map(t => ({
        id: crypto.randomUUID(),
        title: `${source.title || 'New Chat'} · ${t.modelId}`,
        endpointId: t.endpointId,
        modelId: t.modelId,
        systemPrompt: source.systemPrompt || '',
        temperature: source.temperature,
        messages: JSON.parse(JSON.stringify(source.messages.slice(0, cutIndex))),
        tags: [...(source.tags || [])],
        folder: source.folder || DEFAULT_FOLDER,
        pinned: false,
        timestamp: Date.now(),
        parentBranchId: source.id,
        branchPoint: cutIndex - 1,
        isBranch: true,
        isIncognito: !!source.isIncognito
    }));
    state.chats.push(...branches);
    await saveChatState();
    renderChatList();
    updateCompareButtonVisibility();
    await setCurrentChat(branches[0].id);
    branches.forEach(b => generateAssistantResponse(b));
    showSuccess(`Started ${branches.length} answer${branches.length > 1 ? 's' : ''} in parallel. Use Compare to view them side by side.`);
}

modelBranchList.addEventListener('change', (e) => {
    if (!e.target.matches('input[type=checkbox]')) return;
    if (getSelectedModelBranchTargets().length > MODEL_BRANCH_LIMIT) {
        e.target.checked = false;
        showError(`Choose at most ${MODEL_BRANCH_LIMIT} models at once`);
    }
    updateModelBranchEstimate();
});
document.getElementById('model-branch-cancel').addEventListener('click', closeModelBranchModal);
document.getElementById('model-branch-close').addEventListener('click', closeModelBranchModal);
modelBranchSubmit.addEventListener('click', createModelBranches);
modelBranchModal.addEventListener('click', (e) => { if (e.target === modelBranchModal) closeModelBranchModal(); });
if (stopBtn) stopBtn.addEventListener('click', stopGeneration);

async function sendMessage() {
    if (isChatGenerating(getCurrentChat())) return;
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
        uiContent = `${parseMarkdownWithMath(text)}<div class="message-images">${imagesHtml}</div>`;

        // Clear drafts
        draftImages = [];
        renderImagePreviews();
    } else {
        // Just text, keep as string or wrap in array if preferred (keeping string for broad compatibility if no images)
        uiContent = parseMarkdownWithMath(text);
    }

    // appendMessageDiv handles raw HTML for user messages now if we pass specific flag or just use content
    // We'll update appendMessageDiv to handle the 'messages' array format if reading from history, 
    // but for immediate display we pre-render.

    chat.messages.push({ role: 'user', content: apiContent, createdAt: new Date().toISOString() }); // Store full structure
    const userMsgIndex = chat.messages.length - 1;
    appendMessageDiv('User', null, 'user', uiContent, chat, userMsgIndex, chat.messages[userMsgIndex].createdAt);

    updateChatTitle(chat);
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
    const data = JSON.stringify(state.chats.filter(chat => !chat.isIncognito), null, 2);
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
function getComposerInput() {
    return document.getElementById('user-input');
}

function getInputText() {
    const input = getComposerInput();
    if (window.easyMDE) return window.easyMDE.value();
    return input ? input.value : '';
}

function clearInput() {
    const input = getComposerInput();
    if (window.easyMDE) {
        window.easyMDE.value('');
    } else if (input) {
        input.value = '';
        input.style.height = 'auto';
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

function activateComposer({ focus = false } = {}) {
    const input = getComposerInput();
    if (!input) return;
    input.disabled = false;
    input.removeAttribute('readonly');
    sendBtn.disabled = getInputText().trim() === '';
    if (focus) requestAnimationFrame(() => input.focus());
}

function initEasyMDE() {
    // Always use simple textarea for better reliability
    console.log('Using simple textarea instead of EasyMDE');
    setupSimpleTextarea();
}

function setupSimpleTextarea() {
    // Fallback to simple textarea if EasyMDE fails
    const textarea = document.getElementById('user-input');
    if (!textarea) {
        console.error('user-input textarea not found');
        return;
    }
    
    // Remove EasyMDE wrapper if it exists
    const easymdeWrapper = document.querySelector('.EasyMDEContainer');
    if (easymdeWrapper) {
        easymdeWrapper.remove();
        // Recreate the textarea
        const newTextarea = document.createElement('textarea');
        newTextarea.id = 'user-input';
        newTextarea.placeholder = 'Message AI...';
        newTextarea.rows = 1;
        newTextarea.ariaLabel = 'Message input';
        const inputRow = document.querySelector('.input-row');
        if (inputRow) {
            inputRow.insertBefore(newTextarea, inputRow.firstChild);
        }
    }
    
    // Add event listeners for simple textarea
    const simpleInput = document.getElementById('user-input');
    if (simpleInput) {
        if (simpleInput.dataset.composerBound === 'true') {
            activateComposer();
            return;
        }

        console.log('Setting up simple textarea listeners');
        simpleInput.dataset.composerBound = 'true';
        const charCount = document.getElementById('input-char-count');
        const maxLength = Number(simpleInput.maxLength) || 12000;

        const resizeInput = () => {
            const maxHeight = parseFloat(getComputedStyle(simpleInput).maxHeight) || 240;
            simpleInput.style.height = 'auto';
            simpleInput.style.height = `${Math.min(simpleInput.scrollHeight, maxHeight)}px`;
        };

        const updateInputState = () => {
            const value = simpleInput.value;
            const trimmedValue = value.trim();
            sendBtn.disabled = trimmedValue === '';
            resizeInput();

            if (charCount) {
                charCount.textContent = `${value.length.toLocaleString()} / ${maxLength.toLocaleString()}`;
                charCount.classList.toggle('near-limit', value.length >= maxLength * 0.9);
                charCount.classList.toggle('at-limit', value.length >= maxLength);
            }
        };

        simpleInput.addEventListener('input', updateInputState);
        window.addEventListener('resize', resizeInput, { passive: true });
        
        // Keyboard handling
        simpleInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        
        // Ensure textarea is editable
        simpleInput.removeAttribute('readonly');
        simpleInput.disabled = false;
        
        // Initial state and responsive resize
        updateInputState();
    }
}

// Global listeners
sendBtn.addEventListener('click', sendMessage);
document.querySelectorAll('.prompt-card').forEach(card => {
    card.addEventListener('click', () => {
        const input = getComposerInput();
        if (!input) return;
        input.value = card.dataset.prompt || '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
        activateComposer({ focus: true });
    });
});

// Close chat menus when clicking outside
document.addEventListener('click', (e) => {
    if (!e.target.closest('.chat-menu-btn') && !e.target.closest('.chat-menu-dropdown')) {
        document.querySelectorAll('.chat-menu-dropdown.open').forEach(menu => {
            menu.classList.remove('open');
        });
    }
    // Close folder menu if clicking outside
    const folderMenu = document.querySelector('.folder-menu');
    if (folderMenu && !e.target.closest('.folder-menu') && !e.target.closest('.chat-menu-action')) {
        folderMenu.remove();
    }
});

// Action bar listeners
const actionCopy = document.getElementById('action-copy');
const actionRegenerate = document.getElementById('action-regenerate');
const actionBranch = document.getElementById('action-branch');

if (actionCopy) {
    actionCopy.addEventListener('click', () => {
        const lastMessage = document.querySelector('.message.ai:last-of-type .message-content');
        if (lastMessage) {
            navigator.clipboard.writeText(lastMessage.innerText);
            const originalText = actionCopy.innerHTML;
            actionCopy.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
            setTimeout(() => {
                actionCopy.innerHTML = originalText;
            }, 1500);
        }
    });
}

if (actionRegenerate) {
    actionRegenerate.addEventListener('click', () => {
        const currentChat = getCurrentChat();
        if (currentChat && currentChat.messages.length > 0) {
            const lastMsgIndex = currentChat.messages.length - 1;
            if (currentChat.messages[lastMsgIndex].role === 'assistant') {
                regenerateAssistantMessage(currentChat, lastMsgIndex);
            }
        }
    });
}

if (actionBranch) {
    actionBranch.addEventListener('click', () => {
        const currentChat = getCurrentChat();
        if (currentChat && currentChat.messages.length > 0) {
            createBranchFromPoint(currentChat, currentChat.messages.length - 1);
        }
    });
}

// Note: EasyMDE handles Enter key via its extraKeys configuration

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

incognitoChatBtn.addEventListener('click', async () => {
    await createIncognitoChat();
});

if (regenerateTitlesBtn) {
    regenerateTitlesBtn.addEventListener('click', async () => {
        await regenerateAllUntitledChats();
    });
}

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

// Comparison modal close button
if (comparisonModal) {
    const comparisonCloseBtn = comparisonModal.querySelector('.close-btn');
    if (comparisonCloseBtn) {
        comparisonCloseBtn.addEventListener('click', () => {
            comparisonModal.style.display = 'none';
        });
    }
}

// Comparison modal event listeners
if (compareBtn) {
    compareBtn.addEventListener('click', () => {
        populateComparisonSelects();
        comparisonResults.classList.add('hidden');
        if (comparisonModal) comparisonModal.style.display = 'block';
    });
}

// Handle backdrop clicks for both modals
window.onclick = (e) => { 
    if (e.target === settingsModal) settingsModal.style.display = 'none';
    if (comparisonModal && e.target === comparisonModal) comparisonModal.style.display = 'none';
};

if (startCompareBtn) {
    startCompareBtn.addEventListener('click', startComparison);
}

if (mergeBranchBtn) {
    mergeBranchBtn.addEventListener('click', () => {
        const chat1Id = compareChat1.value;
        const chat2Id = compareChat2.value;
        
        if (!chat1Id || !chat2Id || chat1Id === chat2Id) {
            showError('Please select two different conversations to merge');
            return;
        }
        
        // Determine which is the branch (has parentBranchId or isBranch)
        const chat1 = state.chats.find(c => c.id === chat1Id);
        const chat2 = state.chats.find(c => c.id === chat2Id);
        
        let sourceChat, targetChat;
        if (chat1.isBranch || chat1.parentBranchId) {
            sourceChat = chat1;
            targetChat = chat2;
        } else if (chat2.isBranch || chat2.parentBranchId) {
            sourceChat = chat2;
            targetChat = chat1;
        } else {
            // Neither is a branch, ask user which to merge
            const choice = confirm(`Merge "${chat1.title}" into "${chat2.title}"?`);
            if (choice) {
                sourceChat = chat1;
                targetChat = chat2;
            } else {
                sourceChat = chat2;
                targetChat = chat1;
            }
        }
        
        mergeBranch(sourceChat.id, targetChat.id);
        comparisonModal.style.display = 'none';
    });
}

document.getElementById('save-proxy-btn').addEventListener('click', async () => {
    const input = document.getElementById('proxy-base-url');
    const url = (input.value || '').trim().replace(/\/+$/, '');
    state.proxyBaseUrl = url;
    localStorage.setItem('aiui_proxy_base', url);
    
    try {
        const res = await apiFetch('/api/proxy-base-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ proxyBaseUrl: url })
        });
        if (res.ok) {
            showError('Proxy URL saved locally and in config.json');
            return;
        }
    } catch (e) {}
    showError('Proxy URL saved locally');
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
    recordNotification('error', message);
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

function showSuccess(message) {
    recordNotification('success', message);
    let toast = document.querySelector('.success-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.className = 'success-toast';
        toast.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
            </svg>
            <span id="success-msg"></span>
        `;
        document.body.appendChild(toast);
    }

    toast.querySelector('#success-msg').textContent = message;

    // Force reflow
    void toast.offsetWidth;

    toast.classList.add('show');

    // Auto hide
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
