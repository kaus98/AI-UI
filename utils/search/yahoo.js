const { fetchWithTimeout, stripHtmlTags, getRandomUserAgent, sleepWithJitter } = require('./helpers');
const { createDriver, savePageAnalysis, analyzeSelectors, extractResultsFromLinks, waitForResults } = require('./selenium');
const { By, until } = require('selenium-webdriver');
const { logSearch } = require('./logger');
const fs = require('fs');
const path = require('path');

async function searchYahooSelenium(query, limit = 10) {
    const maxLimit = Math.min(Number(limit) || 10, 30);
    if (!query || typeof query !== 'string') throw new Error('Query is required');

    const startTime = Date.now();
    const driver = await createDriver();
    console.log('WebDriver started successfully');

    try {
        console.log('Navigating to Yahoo...');
        await driver.get('https://search.yahoo.com');
        
        console.log('Finding search box...');
        const searchBox = await driver.findElement(By.name('p'));
        await searchBox.sendKeys(query);
        await searchBox.submit();
        
        // Smart wait: Wait for results to appear (max 5 seconds)
        console.log('Waiting for results to load...');
        await waitForResults(driver, 5000);
        
        // Small stability wait with jitter
        await sleepWithJitter(1000, 2000);
        
        await savePageAnalysis(driver, 'yahoo', query);
        
        const selectors = [
            'a[href*="http"]',
            '.dd.algo',
            '.algo',
            '.web',
            '[data-testid*="webresult"]',
            'article',
            'h3 a',
            'h4 a'
        ];
        
        const selectorResults = await analyzeSelectors(driver, selectors);
        
        const analysisPath = path.join(__dirname, '..', '..', 'logs', `yahoo-analysis-${Date.now()}.json`);
        fs.writeFileSync(analysisPath, JSON.stringify({
            timestamp: Date.now(),
            query,
            selectorResults
        }, null, 2));
        console.log(`Analysis saved to: ${analysisPath}`);
        
        const results = [];
        const seen = new Set();
        
        console.log('Trying .algo selector...');
        const algoElements = await driver.findElements(By.css('.algo'));
        console.log(`Found ${algoElements.length} .algo elements`);
        
        for (let i = 0; i < algoElements.length && results.length < maxLimit; i++) {
            try {
                const element = algoElements[i];
                const link = await element.findElement(By.css('a'));
                const url = await link.getAttribute('href');
                const text = await link.getText();
                
                if (!text || !url) continue;
                if (url.includes('yahoo.com')) continue;
                if (seen.has(url)) continue;
                seen.add(url);
                
                // Extract snippet from element using DOM
                let snippet = '';
                try {
                    const elementText = await element.getText();
                    const linkText = await link.getText();
                    snippet = elementText.replace(linkText, '').trim();
                } catch (e) {
                    // If DOM extraction fails, leave snippet empty
                }
                
                results.push({
                    title: text,
                    url,
                    snippet,
                    source: 'yahoo'
                });
            } catch (e) {
                // Skip this element
            }
        }
        
        if (results.length < maxLimit) {
            console.log('Trying h3 a selector...');
            const h3Links = await driver.findElements(By.css('h3 a'));
            console.log(`Found ${h3Links.length} h3 a elements`);
            
            for (let i = 0; i < h3Links.length && results.length < maxLimit; i++) {
                try {
                    const link = h3Links[i];
                    const url = await link.getAttribute('href');
                    const text = await link.getText();
                    
                    if (!text || !url) continue;
                    if (url.includes('yahoo.com')) continue;
                    if (seen.has(url)) continue;
                    seen.add(url);
                    
                    // Extract snippet from parent using DOM
                    let snippet = '';
                    try {
                        const parent = await link.findElement(By.xpath('..'));
                        const parentText = await parent.getText();
                        const linkText = await link.getText();
                        snippet = parentText.replace(linkText, '').trim();
                    } catch (e) {
                        // If DOM extraction fails, leave snippet empty
                    }
                    
                    results.push({
                        title: text,
                        url,
                        snippet,
                        source: 'yahoo'
                    });
                } catch (e) {
                    // Skip this link
                }
            }
        }
        
        if (results.length < maxLimit) {
            const filterFn = (url, text) => {
                if (url.includes('yahoo.com')) return false;
                if (text.length < 10) return false;
                return true;
            };
            const moreResults = await extractResultsFromLinks(driver, maxLimit, 'yahoo', filterFn);
            results.push(...moreResults);
        }
        
        console.log(`Extracted ${results.length} results`);
        
        const duration = Date.now() - startTime;
        logSearch({
            query,
            engine: 'yahoo',
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

async function searchYahoo(query, limit = 10) {
    const maxLimit = Math.min(Number(limit) || 10, 30);
    if (!query || typeof query !== 'string') throw new Error('Query is required');

    const startTime = Date.now();

    // Try Selenium first
    try {
        return await searchYahooSelenium(query, maxLimit);
    } catch (e) {
        console.error('Selenium Yahoo failed, trying HTTP fallback:', e.message);
    }

    // Add jitter before HTTP request
    await sleepWithJitter(100, 500);

    // Fallback to HTTP
    try {
        const ua = getRandomUserAgent();
        const params = new URLSearchParams({ p: query, n: String(maxLimit) });
        const url = `https://search.yahoo.com/search?${params.toString()}`;

        const res = await fetchWithTimeout(url, {
            headers: {
                'User-Agent': ua,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Referer': 'https://search.yahoo.com/',
                'DNT': '1',
                'Connection': 'keep-alive'
            }
        }, 10000);

        if (!res.ok) throw new Error(`Yahoo search failed: ${res.status}`);
        const html = await res.text();
        const results = [];
        const seen = new Set();

        const itemRegex = /<div[^>]*class="dd algo"[^>]*>[\s\S]*?<\/div>/g;
        let m;
        while ((m = itemRegex.exec(html)) !== null) {
            const block = m[0];
            const urlMatch = block.match(/<a[^>]*href="([^"]+)"[^>]*>/);
            const titleMatch = block.match(/<h3[^>]*>[\s\S]*?<a[^>]*>(.*?)<\/a>[\s\S]*?<\/h3>/);
            const snippetMatch = block.match(/<p[^>]*class="compText"[^>]*>(.*?)<\/p>/);
            if (!urlMatch || !titleMatch) continue;
            const url = urlMatch[1];
            if (seen.has(url)) continue;
            seen.add(url);
            
            // Try to extract snippet
            let snippet = '';
            if (snippetMatch) {
                snippet = stripHtmlTags(snippetMatch[1]);
            }
            
            results.push({
                title: stripHtmlTags(titleMatch[1]),
                url,
                snippet,
                source: 'yahoo'
            });
            if (results.length >= maxLimit) break;
        }

        const duration = Date.now() - startTime;
        logSearch({
            query,
            engine: 'yahoo',
            resultsCount: results.length,
            limit: maxLimit,
            method: 'http',
            duration,
            status: 'success'
        });

        return results;
    } catch (e) {
        const duration = Date.now() - startTime;
        logSearch({
            query,
            engine: 'yahoo',
            resultsCount: 0,
            limit: maxLimit,
            method: 'http',
            duration,
            status: 'error',
            error: e.message
        });
        throw new Error(`Yahoo search failed: ${e.message}`);
    }
}

module.exports = {
    searchYahoo
};
