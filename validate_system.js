const fs = require('fs');
const path = require('path');
const http = require('http');
const { getConfig } = require('./utils/helpers');

const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

async function testEndpoint(name, fn) {
    try {
        process.stdout.write(`Testing ${name}... `);
        await fn();
        console.log('OK');
        return true;
    } catch (e) {
        console.log('FAIL');
        console.error('  Error:', e.message);
        process.exitCode = 1;
        return false;
    }
}

function req(method, urlPath, body = null, headers = {}) {
    return new Promise((resolve, reject) => {
        const opts = {
            method,
            headers: { 'Content-Type': 'application/json', ...headers }
        };
        const r = http.request(`${BASE_URL}${urlPath}`, opts, (res) => {
            let data = '';
            res.on('data', c => data += c);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: data ? JSON.parse(data) : {} });
                } catch (e) {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });
        r.on('error', reject);
        if (body) r.write(JSON.stringify(body));
        r.end();
    });
}

function checkLogFile(file, expected) {
    const fullPath = path.join(__dirname, 'logs', file);
    if (!fs.existsSync(fullPath)) {
        console.log(`FAIL logs/${file} missing`);
        return;
    }
    console.log(`OK logs/${file} exists`);
    const found = fs.readFileSync(fullPath, 'utf8').includes(expected);
    console.log(found ? `  Content Verified: "${expected}" found` : `  Missing log entry: "${expected}"`);
}

(async () => {
    console.log('--- System Validation ---\n');

    // Load the generated unified API key from config instead of hardcoding it.
    let apiKey;
    try {
        const config = await getConfig();
        apiKey = config.unifiedApiKey;
    } catch (e) {
        console.error('Unable to load config for validation:', e.message);
        process.exit(1);
    }

    // 1. Check Server Response
    await testEndpoint('GET /api/endpoints', async () => {
        const res = await req('GET', '/api/endpoints');
        if (res.status !== 200) throw new Error(`Status ${res.status}`);
        if (!res.data || !Array.isArray(res.data.endpoints)) throw new Error('No endpoints array found');
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
        const res = await req('GET', '/unified/v1/models');
        if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
    });

    await testEndpoint('Unified Query (With Key)', async () => {
        const res = await req('GET', '/unified/v1/models', null, {
            'Authorization': `Bearer ${apiKey}`
        });
        if (res.status !== 200) throw new Error(`Status ${res.status}: ${JSON.stringify(res.data)}`);
    });

    // 4. Check Log Files Existence
    console.log('\n--- Checking Log Files ---');
    checkLogFile('requests.txt', 'GET /api/endpoints');
    checkLogFile('client_logs.txt', 'Validation Script Test');
})().catch(e => {
    console.error('Validation runner error:', e);
    process.exit(1);
});
