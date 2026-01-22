export const state = {
    chats: [],
    currentChatId: null,
    isGenerating: false,
    endpoints: [],
    currentEndpointId: null
};

export function setCurrentChatId(id) {
    state.currentChatId = id;
}

export function getCurrentChat() {
    return state.chats.find(c => c.id === state.currentChatId);
}
