export function showError(message) {
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
    void toast.offsetWidth; // Force reflow
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
}

// NOTE: Specific UI rendering functions (renderChatList, etc.) will be moved here
// but they might need circular dependencies (calling initChat from UI).
// To keep it simple, we might pass callbacks or keep logic in main.js and just have helpers here.
// For now, I will extract pure UI helpers.

export function renderEndpointSelect(endpoints, currentId, selectElement) {
    selectElement.innerHTML = '';
    endpoints.forEach(ep => {
        const option = document.createElement('option');
        option.value = ep.id;
        option.textContent = ep.name;
        selectElement.appendChild(option);
    });
    if (currentId) selectElement.value = currentId;
}

export function scrollToBottom(container) {
    requestAnimationFrame(() => container.scrollTop = container.scrollHeight);
}
