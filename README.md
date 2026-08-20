# AI-UI (ag-aiEndpoints)

A local-first, multi-endpoint chat interface and OpenAI-compatible API gateway for LLMs. It supports API-key and OAuth2 endpoints, model caching, streaming completions, image uploads, web search capabilities, and a unified `/unified/v1` API for external clients.

## Setup

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Run the server**:
    ```bash
    npm start
    # or
    node server.js
    ```

3.  **Open the UI** at `http://localhost:3001`.

4.  **Add an endpoint** via the Settings (gear icon). Endpoint keys are stored locally in `config.json`.

## Usage

- Select an endpoint and model from the header, then chat.
- Use `/unified/v1/models` and `/unified/v1/chat/completions` (with the key from `config.json`) to access all configured endpoints from other tools.

## Web Search System

The AI-UI includes a robust web search system with multiple search engines and intelligent performance optimization:

### Features

- **Multiple Search Engines:** Bing, DuckDuckGo, Yahoo (Google blocked by CAPTCHA)
- **Auto Engine Selection:** Automatically selects the best performing engine
- **Smart Wait Detection:** Reduces wait time from 15s to ~5s using WebDriverWait
- **Selenium Fallback:** Automatic fallback to Selenium for JavaScript-heavy pages
- **Request Jitter:** Human-like random delays to avoid detection
- **User Agent Rotation:** 10 diverse user agents across platforms
- **Snippet Extraction:** DOM-based extraction for better result quality
- **Search Logging:** Comprehensive analytics and performance tracking
- **Performance Tracking:** Engine scoring based on success rate, speed, and recency

### Usage

```javascript
const { searchWeb } = require('./utils/search');

// Auto mode (recommended)
const results = await searchWeb('climate change', 10);

// Specific engine
const results = await searchWeb('climate change', 10, 'bing');
```

### Available Tools

- **web_search:** Search across multiple search engines
- **url_fetch:** Fetch webpage content with Selenium fallback
- **wikipedia:** Search and summarize Wikipedia articles

### Documentation

For detailed documentation on the search system, see [docs/SEARCH_SYSTEM.md](docs/SEARCH_SYSTEM.md).

## Testing

Run the test suite:
```bash
npm test
```

Individual tests:
```bash
# Search system tests
node tests/search.test.js
node tests/test-selenium.js
node tests/test-yahoo.js
node tests/test-logging.js
```

