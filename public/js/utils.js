export function generateId() {
    return Date.now().toString();
}

export function formatDate(timestamp) {
    return new Date(timestamp).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
}
