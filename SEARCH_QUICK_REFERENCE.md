# Search System Quick Reference

## Quick Start

```javascript
const { searchWeb } = require('./utils/search');

// Auto mode (recommended)
const results = await searchWeb('your query', 10);
```

## Engine Selection

```javascript
// Auto (intelligent selection)
await searchWeb('query', 10, 'auto');

// Specific engines
await searchWeb('query', 10, 'bing');        // Fastest
await searchWeb('query', 10, 'duckduckgo');  // Reliable
await searchWeb('query', 10, 'yahoo');       // Best snippets
```

## Result Format

```javascript
{
  title: 'Article Title',
  url: 'https://example.com/article',
  snippet: 'Description or excerpt...',
  source: 'bing' // 'duckduckgo', 'yahoo'
}
```

## Tools Integration

```javascript
const { executeTool } = require('./utils/tools');

// Web search
await executeTool({ name: 'web_search' }, { query: 'climate', limit: 5 });

// URL fetch (with Selenium fallback)
await executeTool({ name: 'url_fetch' }, { url: 'https://example.com' });

// Wikipedia
await executeTool({ name: 'wikipedia' }, { query: 'climate change' });
```

## Performance Tips

1. **Use Auto Mode** - Let the system select the best engine
2. **Limit Results** - Request only what you need (default: 10)
3. **Cache Results** - For repeated queries, implement caching
4. **Monitor Performance** - Check `logs/searches.log` for analytics

## Engine Comparison

| Engine | Speed | Snippets | Best For |
|--------|-------|----------|----------|
| Bing | Fast (~0.5s) | Limited | Quick searches |
| DuckDuckGo | Medium (~5s) | Limited | Privacy-focused |
| Yahoo | Medium (~5s) | ✅ Good | Rich descriptions |

## Troubleshooting

**No results?** Try different engine or check query terms  
**Timeout?** Check network connection or increase timeout  
**Chrome warnings?** These are filtered automatically  
**Google blocked?** Use other engines (Google has CAPTCHA)

## Analytics

```javascript
const { getSearchStats } = require('./utils/search');

const stats = getSearchStats();
console.log(`Total searches: ${stats.totalSearches}`);
console.log(`Average duration: ${stats.avgDuration}ms`);
console.log(`By engine:`, stats.byEngine);
```

## File Locations

- **Main module:** `utils/search/index.js`
- **Engine files:** `utils/search/{bing,duckduckgo,yahoo}.js`
- **Selenium:** `utils/search/selenium.js`
- **Helpers:** `utils/search/helpers.js`
- **Logger:** `utils/search/logger.js`
- **Logs:** `logs/searches.log`
- **Tests:** `tests/search.test.js`

## Key Functions

```javascript
// Main search
searchWeb(query, limit, engine)

// Direct engines
searchDuckDuckGo(query, limit)
searchBing(query, limit)
searchYahoo(query, limit)

// Analytics
getSearchStats()
getRecentSearches(limit)
clearOldLogs(keepLines)

// Helpers
getRandomUserAgent()
sleepWithJitter(min, max)
stripHtmlTags(raw)
```