import { state, getCurrentChat, setCurrentChatId } from './state.js';
import { sendChatMessage, saveChatState, fetchModels } from './api.js';
import { showError } from './ui.js';

export async function createCompareChat(selectedEndpoints) {
    const id = Date.now().toString();
    const lanes = selectedEndpoints.map(ep => ({
        endpointId: ep.endpointId,
        modelId: ep.modelId,
        name: ep.name,
        messages: []
    }));

    const newChat = {
        id: id,
        type: 'compare',
        title: 'Compare: ' + lanes.map(l => l.name).join(' vs '),
        lanes: lanes,
        timestamp: Date.now()
    };
    state.chats.unshift(newChat);
    await saveChatState();
    return id;
}

export async function sendMessageCompare(chat, text) {
    const userHtml = marked.parse(text);

    chat.lanes.forEach((lane, index) => {
        lane.messages.push({ role: 'user', content: text, html: userHtml });

        const col = document.getElementById(`lane-${index}`);
        if (col) {
            const scrollArea = col.querySelector('.compare-scroll-area');
            const msgDiv = document.createElement('div');
            msgDiv.className = 'message user';
            msgDiv.innerHTML = `<div class="message-content markdown-body">${userHtml}</div>`;
            scrollArea.appendChild(msgDiv);
            requestAnimationFrame(() => scrollArea.scrollTop = scrollArea.scrollHeight);

            // Loading indicator
            const loadingDiv = document.createElement('div');
            loadingDiv.className = 'message ai loading';
            loadingDiv.innerHTML = `<div class="message-content"><div class="typing-indicator"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`;
            scrollArea.appendChild(loadingDiv);
            requestAnimationFrame(() => scrollArea.scrollTop = scrollArea.scrollHeight);
        }
    });

    // Parallel Requests
    await Promise.all(chat.lanes.map(async (lane, index) => {
        try {
            const payload = {
                endpointId: lane.endpointId,
                model: lane.modelId,
                messages: [{ role: 'user', content: text }] // Simplification: Send only last message for now? No, should be full history? 
                // The original code was sending "messages: chat.messages" but chat.messages in compare mode was empty/different structure.
                // Wait, in original app.js, sendMessageCompare logic was probably missing history context or constructed it.
                // Let's check original app.js logic if possible.
                // Original app.js line 798+ (step 257 view) shows: 
                // lane.messages.push(...)
                // Then payload uses lane.messages (assumed).

                // Let's assume we want full history for that lane.
            };

            // Correction: payload messages should be lane.messages (without HTML property to be safe, but backend usually ignores extra props)
            // But let's map it clean.
            const apiMessages = lane.messages.map(m => ({ role: m.role, content: m.content }));

            const response = await sendChatMessage({
                endpointId: lane.endpointId,
                model: lane.modelId,
                messages: apiMessages
            });

            // Remove loading
            const col = document.getElementById(`lane-${index}`);
            if (col) {
                const loader = col.querySelector('.loading');
                if (loader) loader.remove();
            }

            if (response.choices && response.choices[0]) {
                const content = response.choices[0].message.content;
                const aiHtml = marked.parse(content);
                lane.messages.push({ role: 'assistant', content: content, html: aiHtml });

                if (col) {
                    const scrollArea = col.querySelector('.compare-scroll-area');
                    const msgDiv = document.createElement('div');
                    msgDiv.className = 'message ai';
                    msgDiv.innerHTML = `<div class="message-content markdown-body">${aiHtml}</div>`;
                    scrollArea.appendChild(msgDiv);
                    requestAnimationFrame(() => scrollArea.scrollTop = scrollArea.scrollHeight);
                }
            }
        } catch (e) {
            console.error(e);
            const col = document.getElementById(`lane-${index}`);
            if (col) {
                const loader = col.querySelector('.loading');
                if (loader) loader.remove();

                const scrollArea = col.querySelector('.compare-scroll-area'); // Re-query just in case
                const errDiv = document.createElement('div');
                errDiv.className = 'message ai error';
                errDiv.innerHTML = `<div class="message-content" style="color:red">Error: ${e.message}</div>`;
                scrollArea.appendChild(errDiv);
            }
        }
    }));

    await saveChatState();
}

export function renderCompareMessages(chat, container) {
    container.innerHTML = '';
    const wrapper = document.createElement('div');
    wrapper.className = 'compare-container';

    chat.lanes.forEach((lane, index) => {
        const col = document.createElement('div');
        col.className = 'compare-column';
        col.id = `lane-${index}`;

        const header = document.createElement('div');
        header.className = 'compare-header';
        header.textContent = lane.name;
        col.appendChild(header);

        const scrollArea = document.createElement('div');
        scrollArea.className = 'compare-scroll-area';

        lane.messages.forEach(msg => {
            const msgDiv = document.createElement('div');
            msgDiv.className = `message ${msg.role === 'user' ? 'user' : 'ai'}`;
            const htmlContent = msg.html || marked.parse(msg.content);
            msgDiv.innerHTML = `<div class="message-content markdown-body">${htmlContent}</div>`;
            scrollArea.appendChild(msgDiv);
        });

        col.appendChild(scrollArea);
        wrapper.appendChild(col);
    });

    container.appendChild(wrapper);
    setTimeout(() => {
        document.querySelectorAll('.compare-scroll-area').forEach(el => el.scrollTop = el.scrollHeight);
    }, 50);
}
