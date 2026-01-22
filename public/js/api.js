import { state } from './state.js';
import { showError } from './ui.js';

export async function logToServer(level, message, details = null) {
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

export async function fetchEndpoints() {
    try {
        const res = await fetch('/api/endpoints');
        if (!res.ok) throw new Error('Failed to load settings');
        const data = await res.json();
        state.endpoints = data.endpoints;
        state.currentEndpointId = data.currentEndpointId;
        return data;
    } catch (e) {
        console.error('Failed to fetch endpoints', e);
        showError('Failed to load endpoints: ' + e.message);
        logToServer('ERROR', 'Failed to fetch endpoints', e.message);
        throw e;
    }
}

export async function fetchModels(endpointId) {
    try {
        const url = endpointId ? `/api/models?endpointId=${endpointId}` : '/api/models';
        const response = await fetch(url);
        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `Error ${response.status}`);
        }
        const data = await response.json();
        logToServer('INFO', 'Fetched Models', { count: data.data ? data.data.length : 0 });
        return data.data || [];
    } catch (e) {
        console.error(e);
        showError('Failed to fetch models: ' + e.message);
        logToServer('ERROR', 'Failed to fetch models', e.message);
        return [];
    }
}

export async function saveChatState() {
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

export async function loadChatState() {
    try {
        const response = await fetch('/api/history');
        if (response.ok) {
            const data = await response.json();
            return Array.isArray(data) ? data : [];
        }
        return [];
    } catch (e) {
        return [];
    }
}

export async function sendChatMessage(payload) {
    logToServer('INFO', 'Sending Message', payload);
    const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        let msg = `Error ${response.status}`;
        if (err.error) {
            msg = typeof err.error === 'string' ? err.error : (err.error.message || JSON.stringify(err.error));
        } else if (err.message) {
            msg = err.message;
        }
        throw new Error(msg);
    }
    return await response.json();
}

export async function deleteEndpointApi(id) {
    const res = await fetch(`/api/endpoints/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete');
}

export async function saveEndpointApi(data) {
    const res = await fetch('/api/endpoints', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to save');
    return await res.json();
}
