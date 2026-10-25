// Resolve a unified-API model string into its endpoint and upstream model ID.
// Accepted prefixes, in order of preference: endpoint ID, then endpoint name (case-insensitive).
// A name shared by several endpoints is ambiguous and must be addressed by ID.
function resolveModel(config, model) {
    if (typeof model !== 'string' || !model.includes('/')) {
        return { error: { status: 400, message: 'Invalid model format. Expected "EndpointId/ModelID" or "EndpointName/ModelID"' } };
    }

    const endpoints = config.endpoints || [];
    const byId = endpoints.filter(e => model.startsWith(`${e.id}/`));
    // Longest ID wins if IDs ever overlap as prefixes
    if (byId.length) {
        const endpoint = byId.reduce((a, b) => (String(b.id).length > String(a.id).length ? b : a));
        return { endpoint, realModelId: model.slice(String(endpoint.id).length + 1) };
    }

    const lower = model.toLowerCase();
    const byName = endpoints.filter(e => e.name && lower.startsWith(`${e.name.toLowerCase()}/`));
    if (!byName.length) {
        return { error: { status: 404, message: `No endpoint matches model '${model}'` } };
    }
    const endpoint = byName.reduce((a, b) => (b.name.length > a.name.length ? b : a));
    const sameName = byName.filter(e => e.name.toLowerCase() === endpoint.name.toLowerCase());
    if (sameName.length > 1) {
        return { error: { status: 409, message: `Endpoint name '${endpoint.name}' is ambiguous; use the endpoint ID instead` } };
    }
    return { endpoint, realModelId: model.slice(endpoint.name.length + 1) };
}

module.exports = { resolveModel };
