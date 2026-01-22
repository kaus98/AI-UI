import { state, setCurrentChatId, getCurrentChat } from './state.js';
import { fetchEndpoints, fetchModels, saveChatState, loadChatState, sendChatMessage, logToServer, deleteEndpointApi, saveEndpointApi } from './api.js';
import { generateId, formatDate } from './utils.js';
import { showError, renderEndpointSelect, scrollToBottom } from './ui.js';
import { initEasyMDE } from './editor.js';
import { createCompareChat, sendMessageCompare, renderCompareMessages } from './compare.js';

// DOM Elements (mapped roughly to original)
const modelSelect = document.getElementById('model-select');
const chatContainer = document.getElementById('chat-container');
const sendBtn = document.getElementById('send-btn');
const statusIndicator = document.getElementById('status-indicator');
const chatListDiv = document.getElementById('chat-list');
const newChatBtn = document.getElementById('new-chat-btn');
const sidebar = document.getElementById('sidebar');
const menuBtn = document.getElementById('menu-btn');

// Comparison DOM
const newCompareBtn = document.getElementById('new-compare-btn');
const compareModal = document.getElementById('compare-modal');
const closeCompareBtn = document.querySelector('.close-compare-btn');
const compareEndpointSelect = document.getElementById('compare-endpoint-select');
const compareModelSelect = document.getElementById('compare-model-select');
const addCompareModelBtn = document.getElementById('add-compare-model-btn');
const compareSelectedList = document.getElementById('compare-selected-list');
const startCompareBtn = document.getElementById('start-compare-btn');

// Settings DOM
const settingsBtn = document.getElementById('settings-btn');
const settingsModal = document.getElementById('settings-modal');
const closeBtn = document.querySelector('.close-btn');
const endpointSelect = document.getElementById('endpoint-select');
const endpointsList = document.getElementById('endpoints-list');
const addEndpointBtn = document.getElementById('add-endpoint-btn');
const endpointForm = document.getElementById('endpoint-form');
const saveEndpointBtn = document.getElementById('save-endpoint-btn');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const editPreset = document.getElementById('edit-preset');

// Settings Inputs
const inputs = {
    id: document.getElementById('edit-id'),
    name: document.getElementById('edit-name'),
    url: document.getElementById('edit-url'),
    key: document.getElementById('edit-key'),
    authType: document.getElementById('edit-auth-type'),
    tokenUrl: document.getElementById('edit-token-url'),
    clientId: document.getElementById('edit-client-id'),
    clientSecret: document.getElementById('edit-client-secret'),
    scope: document.getElementById('edit-scope')
};

// Global EasyMDE instance
let easyMDE;

// --- MARKED CONFIG ---
const renderer = {
    html(chunk) {
        const text = typeof chunk === 'string' ? chunk : (chunk.text || chunk.raw || '');
        return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
};
const tokenizer = {
    code(src) { return false; },
    list(src) { return false; },
    blockquote(src) { return false; },
    html(src) { return false; }
};
marked.use({ renderer, tokenizer, breaks: true, gfm: true });


// --- MAIN LOGIC ---

async function init() {
    try {
        const data = await fetchEndpoints();
        renderEndpointSelect(state.endpoints, state.currentEndpointId, endpointSelect);

        state.chats = await loadChatState();

        if (state.currentEndpointId) {
            const models = await fetchModels(state.currentEndpointId);
            renderModelOptions(models);
        }

        if (state.chats.length === 0) {
            const id = await createNewChat();
            setCurrentChatId(id);
        } else {
            setCurrentChatId(state.chats[0].id);
        }

        renderChatListInternal();
        renderCurrentChat();
    } catch (e) {
        console.error("Init failed", e);
    }
}

// Wrap internal Logic
async function createNewChat() {
    const id = generateId();
    const newChat = {
        id: id,
        type: 'standard',
        title: 'New Chat',
        messages: [],
        timestamp: Date.now()
    };
    state.chats.unshift(newChat);
    await saveChatState();
    return id;
}

function renderModelOptions(models) {
    modelSelect.innerHTML = '';
    models.forEach(model => {
        const option = document.createElement('option');
        option.value = model.id;
        option.textContent = model.id;
        modelSelect.appendChild(option);
    });
    if (models.length > 0) {
        modelSelect.value = models[0].id;
        statusIndicator.style.backgroundColor = '#2ea043';
    } else {
        statusIndicator.style.backgroundColor = '#d73a49';
    }
}

function renderChatListInternal() {
    chatListDiv.innerHTML = '';
    state.chats.forEach(chat => {
        const div = document.createElement('div');
        div.className = 'chat-item';
        if (chat.id === state.currentChatId) div.classList.add('active');

        const endpoint = state.endpoints.find(e => e.id === chat.endpointId);
        const endpointName = endpoint ? endpoint.name : (chat.endpointId ? 'Unknown' : 'No Endpoint');
        const modelName = chat.modelId || 'No Model';

        div.innerHTML = `
            <div class="chat-content">
                <div class="chat-title">${chat.title}</div>
                <div class="chat-meta">${endpointName} • ${modelName} • ${formatDate(chat.timestamp)}</div>
            </div>
            <button class="delete-chat-btn">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2 2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
        `;

        div.querySelector('.delete-chat-btn').onclick = (e) => {
            e.stopPropagation();
            if (confirm('Delete chat?')) deleteChat(chat.id);
        };
        div.onclick = () => {
            setCurrentChatId(chat.id);
            renderChatListInternal();
            renderCurrentChat();
            if (window.innerWidth <= 768) sidebar.classList.remove('open');
        };

        chatListDiv.appendChild(div);
    });
}

function renderCurrentChat() {
    const chat = getCurrentChat();
    // UI Locking & Type Switching
    if (chat) {
        if (chat.modelId) {
            modelSelect.value = chat.modelId;
            modelSelect.disabled = true;
        } else {
            modelSelect.disabled = false;
        }

        if (chat.endpointId) {
            if (chat.endpointId !== state.currentEndpointId) {
                if (easyMDE) easyMDE.codemirror.setOption('readOnly', true);
                sendBtn.disabled = true;
                endpointSelect.disabled = false;
            } else {
                if (easyMDE) easyMDE.codemirror.setOption('readOnly', false);
                sendBtn.disabled = false;
                endpointSelect.disabled = true;
            }
        } else {
            if (easyMDE) easyMDE.codemirror.setOption('readOnly', false);
            sendBtn.disabled = false;
            endpointSelect.disabled = false;
        }
    }

    if (chat && chat.type === 'compare') {
        renderCompareMessages(chat, chatContainer);
        endpointSelect.style.display = 'none';
        modelSelect.style.display = 'none';
        statusIndicator.style.display = 'none';
    } else {
        renderStandardMessages(chat);
        endpointSelect.style.display = 'block';
        modelSelect.style.display = 'block';
        statusIndicator.style.display = 'block';
    }
}

function renderStandardMessages(chat) {
    chatContainer.innerHTML = '';
    if (!chat || chat.messages.length === 0) {
        // Welcome Screen
        chatContainer.innerHTML = `
            <div class="welcome-message">
                <h2>Welcome</h2>
                <p>Select a model and start chatting.</p>
                
                <div class="system-prompt-container">
                    <textarea id="system-prompt-input" class="system-prompt-input" placeholder="Optional: System instructions...">${chat && chat.systemPromptDraft ? chat.systemPromptDraft : ''}</textarea>
                </div>

                <div class="options-container">
                    <label>Temperature:</label>
                    <input type="range" id="temp-slider" min="0" max="2.0" step="0.1" value="${chat && chat.temperatureDraft !== undefined ? chat.temperatureDraft : 0.7}">
                    <span id="temp-value">${chat && chat.temperatureDraft !== undefined ? chat.temperatureDraft : 0.7}</span>
                </div>
            </div>`;

        if (chat) {
            // System Prompt Listener
            document.getElementById('system-prompt-input').addEventListener('input', (e) => chat.systemPromptDraft = e.target.value);

            // Temperature Listener
            const slider = document.getElementById('temp-slider');
            const valDisplay = document.getElementById('temp-value');
            slider.addEventListener('input', (e) => {
                chat.temperatureDraft = parseFloat(e.target.value);
                valDisplay.textContent = chat.temperatureDraft;
            });
            // Init default draft if missing
            if (chat.temperatureDraft === undefined) chat.temperatureDraft = 0.7;
        }
        return;
    }

    chat.messages.forEach(msg => {
        const div = document.createElement('div');
        div.className = `message ${msg.role === 'user' ? 'user' : 'ai'}`;
        const html = msg.html || marked.parse(msg.content);
        div.innerHTML = `<div class="message-content markdown-body">${html}</div>`;
        chatContainer.appendChild(div);
    });
    scrollToBottom(chatContainer);
}

// Logic to Delete Chat
async function deleteChat(id) {
    state.chats = state.chats.filter(c => c.id !== id);
    await saveChatState();
    if (state.currentChatId === id) {
        if (state.chats.length > 0) setCurrentChatId(state.chats[0].id);
        else {
            const newId = await createNewChat();
            setCurrentChatId(newId);
        }
    }
    renderChatListInternal();
    renderCurrentChat();
}


// --- SEND LOGIC ---

async function onSend() {
    if (state.isGenerating) return;
    const text = easyMDE.value().trim();
    if (!text) return;
    if (!modelSelect.value) return alert('Select a model');

    const chat = getCurrentChat();
    if (!chat) return;

    if (chat.type === 'compare') {
        easyMDE.value('');
        await sendMessageCompare(chat, text);
        return;
    }

    // Standard
    if (chat.messages.length === 0) {
        chat.modelId = modelSelect.value;
        chat.endpointId = state.currentEndpointId;

        // System Prompt
        if (chat.systemPromptDraft && chat.systemPromptDraft.trim()) {
            chat.messages.push({ role: 'system', content: chat.systemPromptDraft.trim() });
            delete chat.systemPromptDraft;
        }

        // Temperature
        chat.temperature = chat.temperatureDraft !== undefined ? chat.temperatureDraft : 0.7;
        delete chat.temperatureDraft;

        renderCurrentChat(); // Lock UI
    }

    const userHtml = marked.parse(text);
    chat.messages.push({ role: 'user', content: text, html: userHtml });
    if (chat.messages.length === 1) {
        chat.title = text.length > 30 ? text.substring(0, 30) + '...' : text;
        renderChatListInternal();
    }

    // Render user message immediately
    const msgDiv = document.createElement('div');
    msgDiv.className = 'message user';
    msgDiv.innerHTML = `<div class="message-content markdown-body">${userHtml}</div>`;
    chatContainer.appendChild(msgDiv);
    scrollToBottom(chatContainer);

    easyMDE.value('');
    state.isGenerating = true;
    sendBtn.disabled = true;

    // Loading
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'message ai';
    loadingDiv.innerHTML = `<div class="message-content"><div class="typing-indicator"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`;
    chatContainer.appendChild(loadingDiv);
    scrollToBottom(chatContainer);

    try {
        await saveChatState();
        const payload = {
            endpointId: chat.endpointId,
            model: chat.modelId,
            messages: chat.messages,
            temperature: chat.temperature // Pass temperature
        };

        const responseData = await sendChatMessage(payload);
        loadingDiv.remove();

        if (responseData.choices && responseData.choices[0]) {
            const content = responseData.choices[0].message.content;
            const aiHtml = marked.parse(content);
            chat.messages.push({ role: 'assistant', content: content, html: aiHtml });

            const aiDiv = document.createElement('div');
            aiDiv.className = 'message ai';
            aiDiv.innerHTML = `<div class="message-content markdown-body">${aiHtml}</div>`;
            chatContainer.appendChild(aiDiv);
            await saveChatState();
        }

    } catch (e) {
        loadingDiv.remove();
        showError(e.message);
        const errDiv = document.createElement('div');
        errDiv.className = 'message ai';
        errDiv.innerHTML = `<div class="message-content">Error: ${e.message}</div>`;
        chatContainer.appendChild(errDiv);
    } finally {
        state.isGenerating = false;
        sendBtn.disabled = false;
        scrollToBottom(chatContainer);
    }
}


// --- EVENT LISTENERS ---

sendBtn.addEventListener('click', onSend);
newChatBtn.addEventListener('click', async () => {
    const id = await createNewChat();
    setCurrentChatId(id);
    renderChatListInternal();
    renderCurrentChat();
    if (window.innerWidth <= 768) sidebar.classList.remove('open');
});
menuBtn.addEventListener('click', () => sidebar.classList.toggle('open'));

// Endpoint Select Logic
endpointSelect.addEventListener('change', async () => {
    state.currentEndpointId = endpointSelect.value;
    const models = await fetchModels(state.currentEndpointId);
    renderModelOptions(models);
});

// Compare UI Listeners 
let pendingCompareModels = [];

newCompareBtn.addEventListener('click', () => {
    compareModal.style.display = 'block';
    pendingCompareModels = [];
    renderCompareList();

    // Populate
    compareEndpointSelect.innerHTML = '<option value="">Select Endpoint</option>';
    state.endpoints.forEach(ep => {
        const opt = document.createElement('option');
        opt.value = ep.id;
        opt.textContent = ep.name;
        compareEndpointSelect.appendChild(opt);
    });
    compareModelSelect.innerHTML = '<option value="">Select Model</option>';
    compareModelSelect.disabled = true;
    addCompareModelBtn.disabled = true;
    startCompareBtn.disabled = true;
});

compareEndpointSelect.addEventListener('change', async () => {
    const eid = compareEndpointSelect.value;
    if (!eid) {
        compareModelSelect.innerHTML = '<option value="">Select Model</option>';
        compareModelSelect.disabled = true;
        return;
    }
    compareModelSelect.innerHTML = '<option>Loading...</option>';
    const models = await fetchModels(eid);
    compareModelSelect.innerHTML = '<option value="">Select Model</option>';
    models.forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = m.id;
        compareModelSelect.appendChild(opt);
    });
    compareModelSelect.disabled = false;
});

compareModelSelect.addEventListener('change', () => {
    addCompareModelBtn.disabled = !compareModelSelect.value;
});

addCompareModelBtn.addEventListener('click', () => {
    const eid = compareEndpointSelect.value;
    const mid = compareModelSelect.value;
    const ep = state.endpoints.find(e => e.id === eid);
    if (eid && mid && ep) {
        if (!pendingCompareModels.find(i => i.endpointId === eid && i.modelId === mid)) {
            pendingCompareModels.push({ endpointId: eid, endpointName: ep.name, modelId: mid, name: `${ep.name} - ${mid}` });
            renderCompareList();
        }
    }
});

function renderCompareList() {
    compareSelectedList.innerHTML = '';
    if (pendingCompareModels.length === 0) {
        compareSelectedList.innerHTML = '<div style="padding:1rem">No models added...</div>';
        startCompareBtn.disabled = true;
        return;
    }
    startCompareBtn.disabled = pendingCompareModels.length < 2;
    pendingCompareModels.forEach((item, idx) => {
        const div = document.createElement('div');
        div.className = 'compare-item-select selected';
        div.innerHTML = `
            <div><b>${item.endpointName}</b><br><small>${item.modelId}</small></div>
            <button class="remove-btn">x</button>
        `;
        div.querySelector('.remove-btn').onclick = () => {
            pendingCompareModels.splice(idx, 1);
            renderCompareList();
        };
        compareSelectedList.appendChild(div);
    });
}

startCompareBtn.addEventListener('click', async () => {
    if (pendingCompareModels.length < 2) return;
    compareModal.style.display = 'none';
    const id = await createCompareChat(pendingCompareModels);
    setCurrentChatId(id);
    renderChatListInternal();
    renderCurrentChat();
});

closeCompareBtn.addEventListener('click', () => compareModal.style.display = 'none');


// Settings UI - Keeping mostly same logic
function renderEndpointsList() {
    endpointsList.innerHTML = '';
    state.endpoints.forEach(ep => {
        const div = document.createElement('div');
        div.className = 'endpoint-item';
        div.innerHTML = `
            <div><h4>${ep.name}</h4><p>${ep.baseUrl}</p></div>
            <div>
                <button class="edit-btn">Edit</button>
                <button class="del-btn">Delete</button>
            </div>
        `;
        div.querySelector('.edit-btn').onclick = () => openEditEndpoint(ep);
        div.querySelector('.del-btn').onclick = async () => {
            if (confirm('Delete?')) {
                await deleteEndpointApi(ep.id);
                await fetchEndpoints(); // Refresh state
                renderEndpointsList();
                renderEndpointSelect(state.endpoints, state.currentEndpointId, endpointSelect);
            }
        };
        endpointsList.appendChild(div);
    });
}

function openEditEndpoint(ep) {
    inputs.id.value = ep.id;
    inputs.name.value = ep.name;
    inputs.url.value = ep.baseUrl;
    inputs.authType.value = ep.authType || 'api-key';
    inputs.key.value = '';
    inputs.key.placeholder = 'Current Key Hidden';
    // OAUTH fields ...
    endpointForm.classList.remove('hidden');
    addEndpointBtn.classList.add('hidden');
}

settingsBtn.addEventListener('click', () => {
    settingsModal.style.display = 'block';
    renderEndpointsList();
});
closeBtn.addEventListener('click', () => settingsModal.style.display = 'none');
addEndpointBtn.addEventListener('click', () => {
    // Clear inputs
    Object.values(inputs).forEach(i => i.value = '');
    inputs.authType.value = 'api-key';
    endpointForm.classList.remove('hidden');
    addEndpointBtn.classList.add('hidden');
});
cancelEditBtn.addEventListener('click', () => {
    endpointForm.classList.add('hidden');
    addEndpointBtn.classList.remove('hidden');
});

saveEndpointBtn.addEventListener('click', async () => {
    const data = {
        id: inputs.id.value || null,
        name: inputs.name.value,
        baseUrl: inputs.url.value,
        apiKey: inputs.key.value || null,
        authType: inputs.authType.value,
        tokenUrl: inputs.tokenUrl.value,
        clientId: inputs.clientId.value,
        clientSecret: inputs.clientSecret.value || null,
        scope: inputs.scope.value
    };
    try {
        await saveEndpointApi(data);
        await fetchEndpoints();
        renderEndpointsList();
        renderEndpointSelect(state.endpoints, state.currentEndpointId, endpointSelect);
        endpointForm.classList.add('hidden');
        addEndpointBtn.classList.remove('hidden');
    } catch (e) { showError(e.message); }
});

// Init
easyMDE = initEasyMDE('user-input', onSend);
init();
