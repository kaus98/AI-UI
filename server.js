// Allow running behind a self-signed/MitM TLS proxy (e.g., corporate firewalls).
// Defaults to true. Set ALLOW_INSECURE_TLS=false before starting to enforce TLS.
process.env.ALLOW_INSECURE_TLS = process.env.ALLOW_INSECURE_TLS || 'true';
if (process.env.ALLOW_INSECURE_TLS === 'true') {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    console.warn('WARNING: TLS certificate verification is disabled for outbound HTTPS. Set ALLOW_INSECURE_TLS=false to enable it.');
}

const express = require('express');
const path = require('path');
const { logToFile } = require('./utils/logger');

// Config
const LOGS_DIR = path.join(__dirname, 'logs');

// Middleware Setup
const app = express();
const PORT = process.env.PORT || 3001;

const favicon = require('serve-favicon');
app.use(favicon(path.join(__dirname, 'public', 'favicon.png')));
app.use(express.json({ limit: '50mb' }));

// CORS headers to allow docs (static/GH Pages or local) to call /api
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

// Serve static content (no-cache to avoid stale JS/CSS/index.html during debugging)
const noCacheHeaders = (res, filePath) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
};
app.use('/docs', express.static(path.join(__dirname, 'docs'), { setHeaders: noCacheHeaders }));
app.use(express.static(path.join(__dirname, 'public'), { setHeaders: noCacheHeaders }));

// Redact sensitive values from logged request bodies (keys, secrets, tokens)
function sanitizeBody(body) {
    if (!body || typeof body !== 'object') return body;
    const clone = Array.isArray(body) ? [...body] : { ...body };
    for (const key of Object.keys(clone)) {
        const value = clone[key];
        const lowerKey = key.toLowerCase();
        const isUrlField = lowerKey.includes('url');
        const isSensitive = !isUrlField && (
            lowerKey.includes('key') ||
            lowerKey.includes('secret') ||
            lowerKey.includes('token') ||
            lowerKey.includes('password') ||
            lowerKey.includes('credential')
        );
        if (isSensitive) {
            clone[key] = '***';
        } else if (value && typeof value === 'object') {
            clone[key] = sanitizeBody(value);
        }
    }
    return clone;
}

// Global Request Logger Middleware
app.use((req, res, next) => {
    // Skip logging for log endpoint to prevent loop
    if (req.url === '/api/logs') return next();

    const start = Date.now();
    res.on('finish', () => {
        const duration = Date.now() - start;
        let bodyString = '';
        try {
            const safeBody = sanitizeBody(req.body) ?? null;
            bodyString = JSON.stringify(safeBody);
        } catch (e) {
            bodyString = '[Unserializable body]';
        }
        const truncatedBody = bodyString && bodyString.length > 1200
            ? bodyString.slice(0, 1200) + '... [truncated]'
            : (bodyString || 'null');

        logToFile('request', `${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`, {
            status: res.statusCode,
            duration: `${duration}ms`,
            query: req.query,
            body: truncatedBody,
            headers: {
                'user-agent': req.headers['user-agent'],
                'content-type': req.headers['content-type']
            }
        });
    });
    next();
});

// Import Routes
const apiRoutes = require('./routes/api');
const unifiedRoutes = require('./routes/unified');
const { setSearchEngine } = require('./utils/tools');

// Mount Routes
app.use('/api', apiRoutes);
app.use('/unified/v1', unifiedRoutes);

// Initialize search engine from config
(async () => {
    try {
        const { getConfig } = require('./utils/helpers');
        const config = await getConfig();
        if (config.searchEngine) setSearchEngine(config.searchEngine);
    } catch (e) {
        console.error('Failed to initialize search engine from config:', e.message);
    }
})();

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
