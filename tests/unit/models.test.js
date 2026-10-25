const { test } = require('node:test');
const assert = require('node:assert/strict');
const { resolveModel } = require('../../utils/models');

const config = {
    endpoints: [
        { id: '1700000000001', name: 'OpenAI' },
        { id: '1700000000002', name: 'Groq' },
        { id: '1700000000003', name: 'Dup' },
        { id: '1700000000004', name: 'dup' },
        { id: '1700000000005', name: 'My/Org' }
    ]
};

test('resolves by endpoint ID and keeps slashes in the model ID', () => {
    const r = resolveModel(config, '1700000000001/ft:gpt/custom/v2');
    assert.equal(r.endpoint.name, 'OpenAI');
    assert.equal(r.realModelId, 'ft:gpt/custom/v2');
});

test('falls back to a unique endpoint name, case-insensitively', () => {
    const r = resolveModel(config, 'groq/llama3-70b');
    assert.equal(r.endpoint.id, '1700000000002');
    assert.equal(r.realModelId, 'llama3-70b');
});

test('handles endpoint names that contain a slash', () => {
    const r = resolveModel(config, 'My/Org/model-x');
    assert.equal(r.endpoint.id, '1700000000005');
    assert.equal(r.realModelId, 'model-x');
});

test('rejects an ambiguous endpoint name and asks for the ID', () => {
    const r = resolveModel(config, 'dup/model');
    assert.equal(r.error.status, 409);
});

test('rejects a model without a prefix', () => {
    assert.equal(resolveModel(config, 'gpt-4o').error.status, 400);
});

test('returns 404 for an unknown prefix', () => {
    assert.equal(resolveModel(config, 'Nope/model').error.status, 404);
});
