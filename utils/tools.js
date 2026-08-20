const { searchWeb } = require('./search');
const { createDriver, waitForResults } = require('./search/selenium');
const { getRandomUserAgent, stripHtmlTags } = require('./search/helpers');
const { By } = require('selenium-webdriver');

let currentSearchEngine = 'auto';

function setSearchEngine(engine) {
    currentSearchEngine = engine;
}

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

function stripHtml(raw) {
    if (!raw) return '';
    return raw
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

async function fetchWebpageWithSelenium(url) {
    const driver = await createDriver();
    try {
        console.log(`Fetching ${url} with Selenium...`);
        await driver.get(url);
        
        // Wait for page to load
        await waitForResults(driver, 5000);
        
        // Small stability wait
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get page content
        const pageHtml = await driver.getPageSource();
        const pageTitle = await driver.getTitle();
        
        // Clean and extract content
        const clean = stripHtml(pageHtml);
        const content = clean.slice(0, 5000);
        
        return `URL: ${url}\nTitle: ${pageTitle}\n\n${content}`;
    } finally {
        await driver.quit();
    }
}

async function fetchWebpage(url) {
    let target = url;
    if (!/^https?:\/\//i.test(target)) target = 'https://' + target;

    // Try HTTP fetch first
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
        const res = await fetch(target, {
            headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8' },
            signal: controller.signal,
            redirect: 'follow'
        });
        clearTimeout(timeout);

        if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('text/html') && !contentType.includes('text/plain') && !contentType.includes('application/xhtml')) {
            return `URL: ${target}\nContent-Type: ${contentType}\nThe URL did not return readable text.`;
        }

        let text = await res.text();
        text = text.slice(0, 25000);
        const clean = stripHtml(text);
        return `URL: ${target}\n\n${clean.slice(0, 5000)}`;
    } catch (e) {
        clearTimeout(timeout);
        console.warn(`HTTP fetch failed for ${target}: ${e.message}, trying Selenium fallback...`);
        
        // Fallback to Selenium
        try {
            return await fetchWebpageWithSelenium(target);
        } catch (seleniumError) {
            throw new Error(`Failed to fetch URL (both HTTP and Selenium failed): HTTP - ${e.message}, Selenium - ${seleniumError.message}`);
        }
    }
}

async function searchWikipedia(query) {
    const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&format=json&origin=*`;
    const searchRes = await fetch(searchUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (!searchRes.ok) throw new Error('Wikipedia search request failed');
    const searchData = await searchRes.json();
    const results = searchData?.query?.search;
    if (!Array.isArray(results) || !results.length) return `No Wikipedia article found for "${query}".`;

    const title = results[0].title;
    const extractUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&exsentences=5&titles=${encodeURIComponent(title)}&format=json&origin=*`;
    const extractRes = await fetch(extractUrl, { headers: { 'User-Agent': USER_AGENT } });
    if (!extractRes.ok) throw new Error('Wikipedia extract request failed');
    const extractData = await extractRes.json();
    const page = Object.values(extractData?.query?.pages || {})[0];
    if (!page) return `No summary found for "${title}".`;

    return `Title: ${page.title}\nURL: https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}\n\nSummary:\n${page.extract || 'No extract available.'}`;
}

async function executeTool(tool, args) {
    const name = (tool && tool.name) || '';
    switch (name) {
        case 'web_search': {
            const results = await searchWeb(args.query, Math.min(Number(args.limit) || 10, 10), currentSearchEngine);
            return results.map((r, i) => `[${i + 1}] ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`).join('\n\n');
        }
        case 'url_fetch': {
            return await fetchWebpage(args.url);
        }
        case 'wikipedia': {
            return await searchWikipedia(args.query);
        }
        default:
            return 'Tool not implemented.';
    }
}

module.exports = {
    executeTool,
    setSearchEngine
};
