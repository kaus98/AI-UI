const fs = require('fs');
const http = require('http');

const API_KEY = 'my-static-secret-key-123'; // Matches config.json
const BASE_URL = 'http://localhost:3000';

async function testEndpoint(name, fn) {
    try {
        process.stdout.write(`Testing ${name}... `);
        await fn();
        console.log('✅ OK');
        return true;
    } catch (e) {
        console.log('❌ FAIL');
        console.error('  Error:', e.message);
        return false;
    }
}

function req(method, path, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const opts = {
            method,
            headers: { 'Content-Type': 'application/json', ...headers }
        };
        const r = http.request(`${BASE_URL}${path}`, opts, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => resolve({ status: res.statusCode, data: data ? JSON.parse(data) : {} }));
        });
        r.on('error', reject);
        if (body) r.write(JSON.stringify(body));
        r.end();
    });
}

(async () => {
    console.log('--- System Validation ---\n');

    // 1. Check Server Response
    await testEndpoint('GET /api/endpoints', async () => {
        const res = await req('GET', '/api/endpoints');
        if (res.status !== 200) throw new Error(`Status ${res.status}`);
        if (!res.data.endpoints) throw new Error('No endpoints found');
    });

    // 2. Check Client Log Ingestion
    await testEndpoint('POST /api/logs', async () => {
        const res = await req('POST', '/api/logs', {
            level: 'TEST',
            message: 'Validation Script Test',
            details: { test: true }
        });
        if (res.status !== 200) throw new Error(`Status ${res.status}`);
    });

    // 3. Check Unified API Auth
    await testEndpoint('Unified Query (No Key)', async () => {
        // Should fail or match policy. As per code, it allows if no key configured? 
        // Wait, server.js checkUnifiedAuth: if (!config.unifiedApiKey) return next();
        // We set 'my-static-secret-key-123' in config. So it should 401 without key.
        const res = await req('GET', '/unified/v1/models');
        if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    await testEndpoint('Unified Query (With Key)', async () => {
        const res = await req('GET', '/unified/v1/models', null, {
            'Authorization': `Bearer ${API_KEY}`
        });
        if (res.status !== 200) throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
    });

    // 4. Check Log Files Existence
    console.log('\n--- Checking Log Files ---');

    if (fs.existsSync('logs/server_logs.txt')) {
        console.log('✅ logs/server_logs.txt exists');
        const content = fs.readFileSync('logs/server_logs.txt', 'utf8');
        if (content.includes('Incoming Request: GET /api/endpoints')) console.log('  Content Verified: Endpoint hit logged');
        else console.log('  ❌ Missing specific log entry');
    } else {
        console.log('❌ logs/server_logs.txt missing');
    }

    if (fs.existsSync('logs/client_logs.txt')) {
        console.log('✅ logs/client_logs.txt exists');
        const content = fs.readFileSync('logs/client_logs.txt', 'utf8');
        if (content.includes('Validation Script Test')) console.log('  Content Verified: Test log found');
        else console.log('  ❌ Missing test log entry');
    } else {
        console.log('❌ logs/client_logs.txt missing');
    }

})();
