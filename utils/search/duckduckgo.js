 const { fetchWithTimeout, stripHtmlTags, sleep, getRandomUserAgent, sleepWithJitter } = require('./helpers');
const { createDriver, savePageAnalysis, analyzeSelectors, extractResultsFromLinks, waitForResults } = require('./selenium');
const { By, until } = require('selenium-webdriver');
const { logSearch } = require('./logger');
const fs = require('fs');
const path = require('path');

const MAX_VQD_CACHE = 100;
const vqdCache = new Map();
const SEARCH_DELAY_MS = 2000;
let lastSearchTime = 0;
const USE_SELENIUM = true;

async function getDdgVqd(query, force = false) {
    const key = query.toLowerCase().trim();
    if (!force && vqdCache.has(key)) return vqdCache.get(key);

    const ua = getRandomUserAgent();
    const res = await fetchWithTimeout('https://duckduckgo.com', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': ua,
            'Accept': 'text/html',
            'Referer': 'https://duckduckgo.com/',
            'DNT': '1',
            'Connection': 'keep-alive'
        },
        body: new URLSearchParams({ q: query }).toString()
    }, 8000);

    if (!res.ok) throw new Error(`DuckDuckGo VQD request failed: ${res.status}`);
    const html = await res.text();
    const match = html.match(/vqd=\\?['"]([A-Za-z0-9_-]+)\\?['"]/);
    if (!match) {
        const altMatch = html.match(/vqd['"]\s*:\s*['"]([A-Za-z0-9_-]+)['"]/);
        if (!altMatch) throw new Error('VQD token not found in DuckDuckGo response');
        const token = altMatch[1];
        if (vqdCache.size >= MAX_VQD_CACHE) {
            const oldest = vqdCache.keys().next().value;
            vqdCache.delete(oldest);
        }
        vqdCache.set(key, token);
        return token;
    }

    if (vqdCache.size >= MAX_VQD_CACHE) {
        const oldest = vqdCache.keys().next().value;
        vqdCache.delete(oldest);
    }
    vqdCache.set(key, match[1]);
    return match[1];
}

async function searchDuckDuckGoSelenium(query, limit = 10) {
    const maxLimit = Math.min(Number(limit) || 10, 30);
    if (!query || typeof query !== 'string') throw new Error('Query is required');

    const startTime = Date.now();
    const driver = await createDriver();
    console.log('WebDriver started successfully');

    try {
        console.log('Navigating to DuckDuckGo...');
        await driver.get('https://duckduckgo.com');
        
        console.log('Finding search box...');
        const searchBox = await driver.findElement(By.name('q'));
        await searchBox.sendKeys(query);
        await searchBox.submit();
        
        // Smart wait: Wait for results to appear (max 5 seconds)
        console.log('Waiting for results to load...');
        await waitForResults(driver, 5000);
        
        // Small stability wait with jitter
        await sleepWithJitter(1000, 2000);
        
        await savePageAnalysis(driver, 'ddg', query);
        
        const selectors = [
            'a[href*="http"]',
            '.result',
            '.web-result',
            '[data-testid*="result"]',
            'article',
            '.result__title',
            'h2 a',
            'h3 a'
        ];
        
        const selectorResults = await analyzeSelectors(driver, selectors);
        
        const analysisPath = path.join(__dirname, '..', '..', 'logs', `ddg-analysis-${Date.now()}.json`);
        fs.writeFileSync(analysisPath, JSON.stringify({
            timestamp: Date.now(),
            query,
            selectorResults
        }, null, 2));
        console.log(`Analysis saved to: ${analysisPath}`);
        
        const results = [];
        const seen = new Set();
        
        console.log('Trying h2 a selector...');
        const h2Links = await driver.findElements(By.css('h2 a'));
        console.log(`Found ${h2Links.length} h2 a elements`);
        
        for (let i = 0; i < h2Links.length && results.length < maxLimit; i++) {
            try {
                const link = h2Links[i];
                const url = await link.getAttribute('href');
                const text = await link.getText();
                
                if (!text || !url) continue;
                if (url.includes('duckduckgo.com')) continue;
                if (seen.has(url)) continue;
                seen.add(url);
                
                // Extract snippet from parent element using DOM
                let snippet = '';
                try {
                    const parent = await link.findElement(By.xpath('..'));
                    // Try to find snippet in various sibling elements
                    const snippetSelectors = [
                        'div[class*="snippet"]',
                        'div[class*="description"]',
                        'span[class*="snippet"]',
                        'span[class*="description"]',
                        'p[class*="snippet"]',
                        'p[class*="description"]'
                    ];
                    
                    for (const selector of snippetSelectors) {
                        try {
                            const snippetElement = await parent.findElement(By.css(selector));
                            snippet = await snippetElement.getText();
                            if (snippet && snippet.length > 10) break;
                        } catch (e) {
                            // Try next selector
                        }
                    }
                    
                    // Fallback: Get text from parent excluding the link
                    if (!snippet) {
                        const parentText = await parent.getText();
                        const linkText = await link.getText();
                        snippet = parentText.replace(linkText, '').trim();
                    }
                } catch (e) {
                    // If DOM extraction fails, leave snippet empty
                }
                
                results.push({
                    title: text,
                    url,
                    snippet,
                    source: 'duckduckgo'
                });
            } catch (e) {
                // Skip this link
            }
        }
        
        if (results.length < maxLimit) {
            console.log('Trying article elements...');
            const articles = await driver.findElements(By.css('article'));
            console.log(`Found ${articles.length} article elements`);
            
            for (let i = 0; i < articles.length && results.length < maxLimit; i++) {
                try {
                    const article = articles[i];
                    const link = await article.findElement(By.css('a'));
                    const url = await link.getAttribute('href');
                    const text = await link.getText();
                    
                    if (!text || !url) continue;
                    if (url.includes('duckduckgo.com')) continue;
                    if (seen.has(url)) continue;
                    seen.add(url);
                    
                    // Extract snippet from article using DOM
                    let snippet = '';
                    try {
                        const articleText = await article.getText();
                        const linkText = await link.getText();
                        snippet = articleText.replace(linkText, '').trim();
                    } catch (e) {
                        // If DOM extraction fails, leave snippet empty
                    }
                    
                    results.push({
                        title: text,
                        url,
                        snippet,
                        source: 'duckduckgo'
                    });
                } catch (e) {
                    // Skip this article
                }
            }
        }
        
        if (results.length < maxLimit) {
            const filterFn = (url, text) => {
                if (url.includes('duckduckgo.com') || url.includes('/l/?uddg=')) return false;
                if (text.length < 10) return false;
                if (text.match(/^(search|images|videos|news|maps)$/i)) return false;
                return true;
            };
            const moreResults = await extractResultsFromLinks(driver, maxLimit, 'duckduckgo', filterFn);
            results.push(...moreResults);
        }
        
        console.log(`Extracted ${results.length} results`);
        
        const duration = Date.now() - startTime;
        logSearch({
            query,
            engine: 'duckduckgo',
            resultsCount: results.length,
            limit: maxLimit,
            method: 'selenium',
            duration,
            status: 'success'
        });
        
        return results;
    } finally {
        console.log('Closing WebDriver...');
        await driver.quit();
    }
}

async function searchDuckDuckGo(query, limit = 10) {
    const maxLimit = Math.min(Number(limit) || 10, 30);
    if (!query || typeof query !== 'string') throw new Error('Query is required');

    const now = Date.now();
    const timeSinceLast = now - lastSearchTime;
    if (timeSinceLast < SEARCH_DELAY_MS) {
        await sleep(SEARCH_DELAY_MS - timeSinceLast);
    }
    lastSearchTime = Date.now();

    if (USE_SELENIUM) {
        try {
            return await searchDuckDuckGoSelenium(query, maxLimit);
        } catch (e) {
            console.error('Selenium DuckDuckGo failed, falling back to HTTP:', e.message);
            const duration = Date.now() - startTime;
            logSearch({
                query,
                engine: 'duckduckgo',
                resultsCount: 0,
                limit: maxLimit,
                method: 'selenium',
                duration,
                status: 'error',
                error: e.message
            });
        }
    }

    const DDG_HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate",
        "Connection": "keep-alive",
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Sec-Ch-Ua": '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Upgrade-Insecure-Requests": "1"
    };

    try {
        const data = new URLSearchParams({
            q: query,
            b: '',
            kl: 'wt-wt',
            kp: '-1'
        });
        const url = 'https://html.duckduckgo.com/html';

        const res = await fetchWithTimeout(url, {
            method: 'POST',
            headers: DDG_HEADERS,
            body: data.toString()
        }, 10000);

        if (!res.ok) throw new Error(`DuckDuckGo search failed: ${res.status}`);
        const html = await res.text();
        
        if (!html || !html.trim()) {
            throw new Error('DuckDuckGo returned empty response (likely blocked)');
        }

        const results = [];
        const seen = new Set();

        const itemRegex = /<div[^>]*class="result"[^>]*>[\s\S]*?<\/div>/g;
        let m;
        while ((m = itemRegex.exec(html)) !== null) {
            const block = m[0];
            const titleElem = block.match(/<div[^>]*class="result__title"[^>]*>[\s\S]*?<\/div>/);
            if (!titleElem) continue;
            
            const linkMatch = titleElem[0].match(/<a[^>]*href="([^"]+)"[^>]*>/);
            if (!linkMatch) continue;
            
            const titleMatch = titleElem[0].match(/<a[^>]*>(.*?)<\/a>/);
            if (!titleMatch) continue;
            
            let url = linkMatch[1];
            const title = stripHtmlTags(titleMatch[1]);
            
            if (seen.has(url)) continue;
            seen.add(url);

            const snippetMatch = block.match(/<div[^>]*class="result__snippet"[^>]*>[\s\S]*?<\/div>/);
            const snippet = snippetMatch ? stripHtmlTags(snippetMatch[0]) : '';

            results.push({
                title,
                url,
                snippet,
                source: 'duckduckgo'
            });
            if (results.length >= maxLimit) break;
        }

        const duration = Date.now() - startTime;
        logSearch({
            query,
            engine: 'duckduckgo',
            resultsCount: results.length,
            limit: maxLimit,
            method: 'http',
            duration,
            status: 'success'
        });

        return results;
    } catch (e) {
        console.error('DuckDuckGo HTML search failed, trying API fallback:', e.message);
        try {
            const params = new URLSearchParams({ q: query, format: 'json' });
            const url = `https://api.duckduckgo.com/?${params.toString()}`;
            const res = await fetchWithTimeout(url, {
                headers: {
                    'User-Agent': DDG_HEADERS['User-Agent'],
                    'Accept': 'application/json'
                }
            }, 10000);
            if (!res.ok) throw new Error(`DuckDuckGo API search failed: ${res.status}`);
            const data = await res.json();
            const results = [];
            const seen = new Set();
            if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
                for (const item of data.RelatedTopics) {
                    if (!item.FirstURL || !item.Text) continue;
                    const url = item.FirstURL;
                    if (seen.has(url)) continue;
                    seen.add(url);
                    results.push({
                        title: stripHtmlTags(item.Text),
                        url,
                        snippet: '',
                        source: 'duckduckgo'
                    });
                    if (results.length >= maxLimit) break;
                }
            }

            const duration = Date.now() - startTime;
            logSearch({
                query,
                engine: 'duckduckgo',
                resultsCount: results.length,
                limit: maxLimit,
                method: 'api',
                duration,
                status: 'success'
            });

            return results;
        } catch (apiError) {
            const duration = Date.now() - startTime;
            logSearch({
                query,
                engine: 'duckduckgo',
                resultsCount: 0,
                limit: maxLimit,
                method: 'error',
                duration,
                status: 'error',
                error: e.message
            });
            throw new Error(`DuckDuckGo search failed: ${e.message} (API: ${apiError.message})`);
        }
    }
}

module.exports = {
    searchDuckDuckGo
};
