const express = require('express');
const cors = require('cors'); // Ensure cors is required if used, otherwise remove
const path = require('path');
const { logToFile } = require('./utils/logger');

// Disable SSL Verification (Self-signed cert support)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

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

// Serve static content
app.use('/docs', express.static(path.join(__dirname, 'docs')));
app.use(express.static(path.join(__dirname, 'public')));

// Global Request Logger Middleware
app.use((req, res, next) => {
    // Skip logging for log endpoint to prevent loop
    if (req.url === '/api/logs') return next();

    logToFile('server', `Incoming Request: ${req.method} ${req.url}`, {
        body: req.body,
        query: req.query,
        headers: {
            'user-agent': req.headers['user-agent']
        }
    });
    next();
});

// Import Routes
const apiRoutes = require('./routes/api');
const unifiedRoutes = require('./routes/unified');

// Mount Routes
app.use('/api', apiRoutes);
app.use('/unified/v1', unifiedRoutes);

app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
