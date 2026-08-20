# AI-UI Search System Documentation

## Overview

The AI-UI search system provides robust web scraping capabilities with multiple search engines, intelligent performance optimization, and fallback mechanisms. The system has been completely refactored into a modular structure for better maintainability and performance.

## Architecture

### Modular Structure

```
utils/search/
├── index.js          # Main orchestrator and auto-selection
├── helpers.js        # Utility functions (UA rotation, jitter, etc.)
├── selenium.js       # Selenium WebDriver management
├── logger.js         # Search logging and analytics
├── duckduckgo.js     # DuckDuckGo scraper (Selenium)
├── bing.js           # Bing scraper (HTTP)
├── yahoo.js          # Yahoo scraper (Selenium)
└── google.js         # Google scraper (Selenium - CAPTCHA blocked)
```

### Main Entry Point

```javascript
// utils/search.js - Re-exports from modular structure
module.exports = require('./search/index');
```

## Performance Improvements

### 1. Smart Wait with WebDriverWait

**Before:** Fixed 15-second wait  
**After:** Detects results in ~5 seconds

```javascript
// Automatic detection of result elements
await waitForResults(driver, 5000);
```

### 2. Auto Engine Selection

The system automatically selects the best performing search engine based on:
- Success rate
- Average duration
- Recency of use
- Fallback to other engines if primary fails

```javascript
// Auto mode (recommended)
const results = await searchWeb('climate change', 10, 'auto');

// Specific engine
const results = await searchWeb('climate change', 10, 'bing');
```

### 3. Request Jitter

Random delays make requests appear more human-like:

```javascript
// 100-500ms delay before HTTP requests
await sleepWithJitter(100, 500);

// 1-2s stability wait after results load
await sleepWithJitter(1000, 2000);
```

### 4. User Agent Rotation

10 diverse user agents across platforms and browsers:

- Desktop Chrome (Windows/Mac)
- Desktop Firefox (Windows/Mac)
- Desktop Safari (Mac)
- Mobile Chrome (Android)
- Mobile Safari (iOS)
- Edge (Windows)

```javascript
const { getRandomUserAgent } = require('./search/helpers');
const ua = getRandomUserAgent();
```

### 5. Snippet Extraction

DOM-based snippet extraction for better result quality:

```javascript
// Yahoo example with working snippets
{
  title: 'SQL Fiddle',
  url: 'https://sqlfiddle.com/',
  snippet: 'Real-time Code Execution: Test your SQL queries instantly...',
  source: 'yahoo'
}
```

## Available Search Engines

| Engine | Method | Speed | Snippets | Status |
|--------|--------|-------|----------|--------|
| **Bing** | HTTP | Fast (~0.5s) | Limited | ✅ Reliable |
| **DuckDuckGo** | Selenium | Medium (~5s) | Limited | ✅ Reliable |
| **Yahoo** | Selenium | Medium (~5s) | ✅ Working | ✅ Reliable |
| **Google** | Selenium | Medium (~5s) | N/A | ⚠️ CAPTCHA Blocked |

## Usage Examples

### Basic Search

```javascript
const { searchWeb } = require('./utils/search');

// Auto mode (recommended)
const results = await searchWeb('climate change', 10);
console.log(`Found ${results.length} results`);
```

### Specific Engine

```javascript
// Use specific search engine
const results = await searchWeb('climate change', 10, 'bing');
const results = await searchWeb('climate change', 10, 'duckduckgo');
const results = await searchWeb('climate change', 10, 'yahoo');
```

### Direct Engine Access

```javascript
const { searchDuckDuckGo, searchBing, searchYahoo } = require('./utils/search');

const ddgResults = await searchDuckDuckGo('query', 5);
const bingResults = await searchBing('query', 5);
const yahooResults = await searchYahoo('query', 5);
```

### Result Format

```javascript
{
  title: 'Article Title',
  url: 'https://example.com/article',
  snippet: 'Article description or excerpt...',
  source: 'bing' // or 'duckduckgo', 'yahoo'
}
```

## URL Fetch with Selenium Fallback

The `url_fetch` tool now includes automatic Selenium fallback:

```javascript
const { executeTool } = require('./utils/tools');

// Tries HTTP first, falls back to Selenium if it fails
const content = await executeTool(
  { name: 'url_fetch' }, 
  { url: 'https://example.com' }
);
```

### Fallback Behavior

1. **Primary:** HTTP fetch (fast, ~0.5s)
2. **Fallback:** Selenium (handles JavaScript, ~5-10s)
3. **Error:** Detailed error messages for both methods

## Search Logging

All searches are logged to `logs/searches.log` for analytics:

```javascript
const { getSearchStats, getRecentSearches } = require('./utils/search');

// Get search statistics
const stats = getSearchStats();
console.log(stats);
// {
//   totalSearches: 15,
//   byEngine: { bing: 8, duckduckgo: 5, yahoo: 2 },
//   byStatus: { success: 15 },
//   avgResults: 5,
//   avgDuration: 3500
// }

// Get recent searches
const recent = getRecentSearches(10);
console.log(recent);
```

### Log Format

```json
{
  "timestamp": "2026-08-19T15:11:08.863Z",
  "query": "test query",
  "engine": "bing",
  "resultsCount": 5,
  "limit": 5,
  "method": "http",
  "duration": 522,
  "status": "success"
}
```

## Performance Tracking

The system tracks engine performance for intelligent selection:

```javascript
const { enginePerformance } = require('./utils/search');

console.log(enginePerformance);
// {
//   bing: { success: 8, failure: 0, avgDuration: 520, lastUsed: 1787233400000 },
//   duckduckgo: { success: 5, failure: 0, avgDuration: 8500, lastUsed: 1787233300000 },
//   yahoo: { success: 2, failure: 0, avgDuration: 9200, lastUsed: 1787233200000 }
// }
```

### Engine Scoring

Engines are scored based on:
- **Success Rate:** Higher is better
- **Speed:** Faster is better
- **Recency:** Recently used engines get preference
- **Age Penalty:** Engines not used recently lose score

## Configuration

### Chrome Options (Selenium)

The system uses optimized Chrome options for performance:

```javascript
// Performance optimizations
--headless=new              // New headless mode (faster)
--disable-images            // Disable image loading
--disable-gpu               // Disable GPU
--no-zygote                // Disable zygote process
--disable-3d-apis          // Disable 3D APIs
--disable-accelerated-*     // Disable hardware acceleration
--disable-logging           // Reduce logging
```

### Search Limits

- **Default:** 10 results per search
- **Maximum:** 30 results per search
- **Timeout:** 10 seconds for HTTP, 30 seconds for Selenium

## Testing

### Run All Tests

```bash
npm test
```

### Individual Engine Tests

```bash
# DuckDuckGo
node tests/test-selenium.js

# Yahoo
node tests/test-yahoo.js

# Logging
node tests/test-logging.js
```

### Test Coverage

- ✅ DuckDuckGo search
- ✅ Yahoo search  
- ✅ Auto mode selection
- ✅ Specific engine selection
- ✅ Search logging
- ✅ URL fetch with fallback

## Integration with AI Tools

### Web Search Tool

```javascript
const { executeTool } = require('./utils/tools');

const results = await executeTool(
  { name: 'web_search' }, 
  { query: 'climate change', limit: 5 }
);
```

### URL Fetch Tool

```javascript
const content = await executeTool(
  { name: 'url_fetch' }, 
  { url: 'https://example.com' }
);
```

### Wikipedia Tool

```javascript
const summary = await executeTool(
  { name: 'wikipedia' }, 
  { query: 'climate change' }
);
```

## Troubleshooting

### Common Issues

**Issue:** Search returns no results  
**Solution:** Try different engine or check query terms

**Issue:** Selenium timeout  
**Solution:** Increase timeout in `selenium.js` or check network connection

**Issue:** Chrome warnings in console  
**Solution:** These are filtered out automatically and don't affect functionality

**Issue:** Google CAPTCHA  
**Solution:** Google is blocked by CAPTCHA - use other engines

### Debug Mode

Enable detailed logging:

```javascript
// Logs are automatically written to logs/ directory
// Check logs/searches.log for search history
// Check logs/ddg-page-*.html for page analysis
```

## Future Enhancements

Potential improvements for future versions:

1. **Proxy Rotation** - Add rotating proxies for better anti-bot protection
2. **Exponential Backoff** - Implement retry with increasing delays
3. **Result Caching** - Cache common queries to avoid repeated scraping
4. **Circuit Breaker** - Temporarily disable failing engines
5. **Concurrent Searches** - Run multiple engines in parallel
6. **Playwright Migration** - Consider Playwright for better performance
7. **More News Sources** - Add specialized news site scrapers

## API Reference

### Main Functions

```javascript
// Search with auto engine selection
searchWeb(query, limit, engine)

// Direct engine access
searchDuckDuckGo(query, limit)
searchBing(query, limit)
searchYahoo(query, limit)
searchGoogle(query, limit)

// Analytics
getSearchStats()
getRecentSearches(limit)
clearOldLogs(keepLines)
```

### Helper Functions

```javascript
// From utils/search/helpers.js
getRandomUserAgent()
sleep(ms)
sleepWithJitter(min, max)
getRandomDelay(min, max)
fetchWithTimeout(url, options, timeout)
stripHtmlTags(raw)
```

### Selenium Functions

```javascript
// From utils/search/selenium.js
createDriver()
waitForResults(driver, timeout)
savePageAnalysis(driver, engine, query)
analyzeSelectors(driver, selectors)
extractResultsFromLinks(driver, maxLimit, source, filterFn)
```

## License

This search system is part of the AI-UI project and follows the same license terms.

## Support

For issues or questions:
- Check logs in `logs/` directory
- Review test files in `tests/` directory
- Examine individual engine files in `utils/search/`