const modelSelect = document.getElementById('model-select');
const chatContainer = document.getElementById('chat-container');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const statusIndicator = document.getElementById('status-indicator');
const chatListDiv = document.getElementById('chat-list');
const newChatBtn = document.getElementById('new-chat-btn');
const menuBtn = document.getElementById('menu-btn');
const sidebar = document.getElementById('sidebar');

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
const authApiKeyGroup = document.getElementById('auth-api-key');
const authOauthGroup = document.getElementById('auth-oauth');
const editTokenUrl = document.getElementById('edit-token-url');
const editClientId = document.getElementById('edit-client-id');
const editClientSecret = document.getElementById('edit-client-secret');
const editScope = document.getElementById('edit-scope');


// ... (renderChatList update) ...

function renderChatList() {
    chatListDiv.innerHTML = '';
    state.chats.forEach(chat => {
        const div = document.createElement('div');
        div.className = 'chat-item';
        if (chat.id === state.currentChatId) {
            div.classList.add('active');
        }

        // Gather Metadata
        const endpoint = state.endpoints.find(e => e.id === chat.endpointId);
        const endpointName = endpoint ? endpoint.name : (chat.endpointId ? 'Unknown' : 'No Endpoint');
        const modelName = chat.modelId || 'No Model';
        const dateStr = new Date(chat.timestamp).toLocaleString(undefined, {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        // Structure: 
        // [ Title         ] [Del]
        // [ Meta Details  ]
        const contentDiv = document.createElement('div');
        contentDiv.className = 'chat-content';

        const titleDiv = document.createElement('div');
        titleDiv.className = 'chat-title';
        titleDiv.textContent = chat.title;

        const metaDiv = document.createElement('div');
        metaDiv.className = 'chat-meta';
        metaDiv.textContent = `${endpointName} • ${modelName} • ${dateStr}`;

        contentDiv.appendChild(titleDiv);
        contentDiv.appendChild(metaDiv);

        const delBtn = document.createElement('button');
        delBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
        delBtn.className = 'delete-chat-btn';
        delBtn.onclick = (e) => { e.stopPropagation(); deleteChat(chat.id); };

        div.onclick = () => setCurrentChat(chat.id);
        div.appendChild(contentDiv);
        div.appendChild(delBtn);
        chatListDiv.appendChild(div);
    });
}

// ... (renderEndpointsList update) ...

function renderEndpointsList() {
    endpointsList.innerHTML = '';
    state.endpoints.forEach(ep => {
        const item = document.createElement('div');
        item.className = 'endpoint-item';
        item.innerHTML = `
            <div class="endpoint-info" style="display:flex; align-items:center; gap:0.5rem">
                <div>
                    <h4>${ep.name}</h4>
                    <p>${ep.baseUrl}</p>
                </div>
            </div>
            <div class="endpoint-actions">
                <button onclick="editEndpoint('${ep.id}')">Edit</button>
                <button onclick="deleteEndpoint('${ep.id}')" class="delete-btn">Delete</button>
            </div>
        `;
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


    // Auth Fields
    editAuthType.value = ep.authType || 'api-key';
    toggleAuthFields();

    editKey.value = '';
    editKey.placeholder = 'Leave blank to keep current key';

    // OAuth Fields
    editTokenUrl.value = ep.tokenUrl || '';
    editClientId.value = ep.clientId || '';
    editClientSecret.value = ''; // Don't show secret
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
    currentEndpointId: null
};

// --- Logging Helper ---
async function logToServer(level, message, details = null) {
    try {
        // Don't await strictly to avoid blocking UI
        fetch('/api/logs', {
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
        const res = await fetch('/api/endpoints');
        if (!res.ok) throw new Error('Failed to load settings');
        const data = await res.json();
        state.endpoints = data.endpoints;
        state.currentEndpointId = data.currentEndpointId;
        renderEndpointSelect();
        renderEndpointsList();
    } catch (e) {
        console.error('Failed to fetch endpoints', e);
        showError('Failed to load endpoints: ' + e.message);
        logToServer('ERROR', 'Failed to fetch endpoints', e.message);
    }
}

async function fetchModels() {
    try {
        const url = state.currentEndpointId
            ? `/api/models?endpointId=${state.currentEndpointId}`
            : '/api/models';

        const response = await fetch(url);

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `Error ${response.status}`);
        }

        const data = await response.json();
        logToServer('INFO', 'Fetched Models', { count: data.data ? data.data.length : 0 });

        modelSelect.innerHTML = '';
        if (data.data && Array.isArray(data.data)) {
            data.data.forEach(model => {
                const option = document.createElement('option');
                option.value = model.id;
                option.textContent = model.id;
                modelSelect.appendChild(option);
            });
            if (data.data.length > 0) modelSelect.value = data.data[0].id;

            statusIndicator.style.backgroundColor = '#2ea043';
            statusIndicator.title = 'Connected';
        }
    } catch (e) {
        console.error(e);
        statusIndicator.style.backgroundColor = '#d73a49';
        statusIndicator.title = 'Connection Failed';
        showError('Failed to fetch models: ' + e.message);
        logToServer('ERROR', 'Failed to fetch models', e.message);
    }
}

// --- Storage (History) ---

async function saveChatState() {
    try {
        await fetch('/api/history', {
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
        const response = await fetch('/api/history');
        if (response.ok) {
            const data = await response.json();
            state.chats = Array.isArray(data) ? data : [];
        } else {
            state.chats = [];
        }
    } catch (e) {
        state.chats = [];
    }
}

// --- Chat Logic ---

async function createNewChat() {
    const id = Date.now().toString();
    const newChat = {
        id: id,
        title: 'New Chat',
        messages: [],
        timestamp: Date.now()
    };
    state.chats.unshift(newChat);
    await saveChatState();
    return id;
}

function getCurrentChat() {
    return state.chats.find(c => c.id === state.currentChatId);
}

function setCurrentChat(id) {
    state.currentChatId = id;
    const chat = getCurrentChat();

    // UI Locking Logic
    if (chat) {
        // Enforce Model Locking
        if (chat.modelId) {
            modelSelect.value = chat.modelId;
            modelSelect.disabled = true;
        } else {
            // New or legacy chat without lock
            modelSelect.disabled = false;
        }

        // Enforce Endpoint Context
        if (chat.endpointId) {
            if (chat.endpointId !== state.currentEndpointId) {
                // Mismatch: Disable Input, Enable Selector (to switch back)
                if (window.easyMDE) window.easyMDE.codemirror.setOption('readOnly', true);
                sendBtn.disabled = true;
                endpointSelect.disabled = false;
            } else {
                // Match: Enable Input, Disable Selector (Lock context)
                if (window.easyMDE) window.easyMDE.codemirror.setOption('readOnly', false);
                sendBtn.disabled = false; // Let logic decide
                endpointSelect.disabled = true;
            }
        } else {
            // New/UnBound Chat: Enable everything
            if (window.easyMDE) window.easyMDE.codemirror.setOption('readOnly', false);
            sendBtn.disabled = false;
            endpointSelect.disabled = false;
        }
    }

    renderChatList();
    renderMessages();
    if (window.innerWidth <= 768) sidebar.classList.remove('open');
}

function updateChatTitle(chat, firstMessage) {
    if (chat.messages.length === 1) {
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
            setCurrentChat(state.chats[0].id);
        } else {
            const newId = await createNewChat();
            setCurrentChat(newId);
        }
    } else {
        renderChatList();
    }
};

function renderMessages() {
    chatContainer.innerHTML = '';
    const chat = getCurrentChat();
    if (!chat || chat.messages.length === 0) {
        chatContainer.innerHTML = `
            <div class="welcome-message">
                <h2>Welcome</h2>
                <p>Select a model and start chatting.</p>
                <div class="system-prompt-container">
                    <textarea 
                        id="system-prompt-input" 
                        class="system-prompt-input" 
                        placeholder="Optional: Enter a system instructions (e.g., 'You are a helpful coding assistant')..."
                    >${chat && chat.systemPromptDraft ? chat.systemPromptDraft : ''}</textarea>
                </div>
            </div>`;

        if (chat) {
            const spInput = document.getElementById('system-prompt-input');
            spInput.addEventListener('input', (e) => {
                chat.systemPromptDraft = e.target.value;
            });
        }
        return;
    }
    chat.messages.forEach(msg => appendMessageDiv(msg.role === 'user' ? 'User' : 'AI', msg.content, msg.role === 'user' ? 'user' : 'ai', msg.html));
    scrollToBottom();
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

marked.use({ renderer, tokenizer, breaks: true, gfm: true });

function appendMessageDiv(role, content, type, preRendered = null) {
    const welcome = document.querySelector('.welcome-message');
    if (welcome) welcome.remove();
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${type}`;

    // Use pre-rendered HTML if available (from history), otherwise parse now
    const htmlContent = preRendered || marked.parse(content);

    msgDiv.innerHTML = `<div class="message-content markdown-body">${htmlContent}</div>`;
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
        const res = await fetch(`/api/endpoints/${id}`, { method: 'DELETE' });
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
            tokenUrl: editTokenUrl.value,
            clientId: editClientId.value,
            clientSecret: editClientSecret.value || null,
            scope: editScope.value
        };

        const res = await fetch('/api/endpoints', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });

        if (!res.ok) throw new Error('Failed to save');

        logToServer('INFO', 'Saved Endpoint', { name: data.name, url: data.baseUrl });
        endpointForm.classList.add('hidden');
        addEndpointBtn.classList.remove('hidden');
        await fetchEndpoints();
    } catch (e) {
        showError('Save failed: ' + e.message);
        logToServer('ERROR', 'Save endpoint failed', e.message);
    }
}

// --- Interaction ---

async function init() {
    await fetchEndpoints(); // Load endpoints first
    await loadChatState();  // Load history

    if (state.currentEndpointId) {
        await fetchModels();
    }

    if (state.chats.length === 0) {
        const id = await createNewChat();
        state.currentChatId = id;
    } else if (!state.currentChatId) {
        state.currentChatId = state.chats[0].id;
    }

    renderChatList();
    renderMessages();
    setCurrentChat(state.currentChatId); // Enforce UI state on init
}

async function sendMessage() {
    if (state.isGenerating) return;
    const text = window.easyMDE.value().trim();
    if (!text) return;
    if (!modelSelect.value) { alert('Select a model'); return; }

    const chat = getCurrentChat();
    if (!chat) return;

    // LOCKING LOGIC: Bind chat to model/endpoint on first message
    if (chat.messages.length === 0) {
        chat.modelId = modelSelect.value;
        chat.endpointId = state.currentEndpointId;

        // Inject System Prompt if present
        if (chat.systemPromptDraft && chat.systemPromptDraft.trim()) {
            chat.messages.push({ role: 'system', content: chat.systemPromptDraft.trim() });
            delete chat.systemPromptDraft; // Clear draft after using
        }

        // Re-run setCurrentChat to lock UI immediately
        setCurrentChat(chat.id);
    }

    // Parse immediately for storage
    const userHtml = marked.parse(text);

    appendMessageDiv('User', text, 'user', userHtml);
    chat.messages.push({ role: 'user', content: text });
    updateChatTitle(chat, text);
    await saveChatState();
    scrollToBottom();

    window.easyMDE.value('');
    // userInput.style.height = 'auto'; // EasyMDE handles size
    state.isGenerating = true;
    sendBtn.disabled = true;

    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message ai';
    loadingDiv.innerHTML = `<div class="message-content"><div class="typing-indicator"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`;
    chatContainer.appendChild(loadingDiv);
    scrollToBottom();

    try {
        const payload = {
            endpointId: chat.endpointId || state.currentEndpointId,
            model: chat.modelId || modelSelect.value,
            messages: chat.messages
        };
        logToServer('INFO', 'Sending Message', payload);

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        loadingDiv.remove();

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            let msg = `Error ${response.status}`;
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
            throw new Error(msg);
        }

        const data = await response.json();

        if (data.choices && data.choices[0]) {
            const content = data.choices[0].message.content;
            const aiHtml = marked.parse(content);

            appendMessageDiv('AI', content, 'ai', aiHtml);
            chat.messages.push({ role: 'assistant', content: content });
            await saveChatState();
            logToServer('INFO', 'Message Received', { len: content.length });
        } else {
            console.error('Unexpected response:', data);
            showError('Invalid response format from API');
            appendMessageDiv('System', 'Invalid API Response', 'ai');
            logToServer('ERROR', 'Invalid API Response', data);
        }
    } catch (error) {
        loadingDiv.remove();
        console.error(error);
        showError(error.message || 'Failed to send message');
        logToServer('ERROR', 'Message Send Failed', error.message);
        // Optional: dont show system message if using toast?  
        // Or show it so it's in history. Let's keep it.
        appendMessageDiv('System', `Error: ${error.message}`, 'ai');
    } finally {
        state.isGenerating = false;
        sendBtn.disabled = false;
        scrollToBottom();
    }
}

// Listeners
// userInput auto-resize and Enter logic replaced by EasyMDE keymaps

// Setup EasyMDE
function initEasyMDE() {
    window.easyMDE = new EasyMDE({
        element: document.getElementById('user-input'),
        autoDownloadFontAwesome: true, // Needed for icons
        status: false,
        spellChecker: false,
        toolbar: [
            "bold", "italic", "strikethrough", "heading", "|",
            "code", "quote", "unordered-list", "ordered-list", "|",
            "link", "image", "table", "horizontal-rule", "|",
            "preview", "side-by-side", "fullscreen", "|",
            "undo", "redo"
        ],
        forceSync: true,
        placeholder: "Message AI...",
        minHeight: "45px", // Small initial height
        maxHeight: "200px",
        shortcuts: {
            "togglePreview": null, // Keep preview button but maybe disable shortcut if it conflicts
        },
    });

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
newChatBtn.addEventListener('click', async () => {
    const id = await createNewChat();
    setCurrentChat(id);
});
menuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));

// Settings Listeners
settingsBtn.addEventListener('click', () => settingsModal.style.display = 'block');
closeBtn.addEventListener('click', () => settingsModal.style.display = 'none');
window.onclick = (e) => { if (e.target === settingsModal) settingsModal.style.display = 'none'; };

endpointSelect.addEventListener('change', async () => {
    const id = endpointSelect.value;
    await fetch('/api/endpoints/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
    });
    state.currentEndpointId = id;
    await fetchModels();
    if (state.currentChatId) setCurrentChat(state.currentChatId); // Re-evaluate locks
});

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
initEasyMDE();
init();


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
