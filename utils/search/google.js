const { fetchWithTimeout, stripHtmlTags, getRandomUserAgent } = require('./helpers');
const { createDriver, savePageAnalysis, analyzeSelectors, extractResultsFromLinks } = require('./selenium');
const { By } = require('selenium-webdriver');
const fs = require('fs');
const path = require('path');

async function searchGoogleSelenium(query, limit = 10) {
    const maxLimit = Math.min(Number(limit) || 10, 30);
    if (!query || typeof query !== 'string') throw new Error('Query is required');

    const driver = await createDriver();
    console.log('WebDriver started successfully');

    try {
        console.log('Navigating to Google...');
        await driver.get('https://www.google.com');
        
        console.log('Finding search box...');
        const searchBox = await driver.findElement(By.name('q'));
        await searchBox.sendKeys(query);
        await searchBox.submit();
        
        console.log('Waiting for results to load (15 seconds)...');
        await driver.sleep(15000);
        
        await savePageAnalysis(driver, 'google', query);
        
        const selectors = [
            'a[href*="http"]',
            '.g',
            '.yuRUbf',
            '.VwiC3b',
            '[data-hveid]',
            'h3 a',
            'h4 a'
        ];
        
        const selectorResults = await analyzeSelectors(driver, selectors);
        
        const analysisPath = path.join(__dirname, '..', '..', 'logs', `google-analysis-${Date.now()}.json`);
        fs.writeFileSync(analysisPath, JSON.stringify({
            timestamp: Date.now(),
            query,
            selectorResults
        }, null, 2));
        console.log(`Analysis saved to: ${analysisPath}`);
        
        const results = [];
        const seen = new Set();
        
        console.log('Trying h3 a selector...');
        const h3Links = await driver.findElements(By.css('h3 a'));
        console.log(`Found ${h3Links.length} h3 a elements`);
        
        for (let i = 0; i < h3Links.length && results.length < maxLimit; i++) {
            try {
                const link = h3Links[i];
                const url = await link.getAttribute('href');
                const text = await link.getText();
                
                if (!text || !url) continue;
                if (url.includes('google.com') || url.includes('/search') || url.includes('/url')) continue;
                if (seen.has(url)) continue;
                seen.add(url);
                
                results.push({
                    title: text,
                    url,
                    snippet: '',
                    source: 'google'
                });
            } catch (e) {
                // Skip this link
            }
        }
        
        if (results.length < maxLimit) {
            console.log('Trying .g selector...');
            const gElements = await driver.findElements(By.css('.g'));
            console.log(`Found ${gElements.length} .g elements`);
            
            for (let i = 0; i < gElements.length && results.length < maxLimit; i++) {
                try {
                    const element = gElements[i];
                    const link = await element.findElement(By.css('a'));
                    const url = await link.getAttribute('href');
                    const text = await link.getText();
                    
                    if (!text || !url) continue;
                    if (url.includes('google.com') || url.includes('/search') || url.includes('/url')) continue;
                    if (seen.has(url)) continue;
                    seen.add(url);
                    
                    results.push({
                        title: text,
                        url,
                        snippet: '',
                        source: 'google'
                    });
                } catch (e) {
                    // Skip this element
                }
            }
        }
        
        if (results.length < maxLimit) {
            const filterFn = (url, text) => {
                if (url.includes('google.com') || url.includes('/search') || url.includes('/url') || url.includes('/httpservice')) return false;
                if (text.length < 10) return false;
                return true;
            };
            const moreResults = await extractResultsFromLinks(driver, maxLimit, 'google', filterFn);
            results.push(...moreResults);
        }
        
        console.log(`Extracted ${results.length} results`);
        return results;
    } finally {
        console.log('Closing WebDriver...');
        await driver.quit();
    }
}

async function searchGoogle(query, limit = 10) {
    const maxLimit = Math.min(Number(limit) || 10, 30);
    if (!query || typeof query !== 'string') throw new Error('Query is required');

    // Try Selenium first
    try {
        return await searchGoogleSelenium(query, maxLimit);
    } catch (e) {
        console.error('Selenium Google failed, trying HTTP fallback:', e.message);
    }

    // Fallback to HTTP
    try {
        const ua = getRandomUserAgent();
        const params = new URLSearchParams({ q: query, num: String(maxLimit) });
        const url = `https://www.google.com/search?${params.toString()}`;

        const res = await fetchWithTimeout(url, {
            headers: {
                'User-Agent': ua,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Referer': 'https://www.google.com/',
                'DNT': '1',
                'Connection': 'keep-alive'
            }
        }, 10000);

        if (!res.ok) throw new Error(`Google search failed: ${res.status}`);
        const html = await res.text();
        const results = [];
        const seen = new Set();

        if (html.includes('enable JavaScript') || html.includes('Enable JavaScript')) {
            throw new Error('Google requires JavaScript');
        }

        const itemRegex = /<div[^>]*class="g"[^>]*>[\s\S]*?<\/div>/g;
        let m;
        while ((m = itemRegex.exec(html)) !== null) {
            const block = m[0];
            const urlMatch = block.match(/<a[^>]*href="([^"]+)"[^>]*>/);
            const titleMatch = block.match(/<h3[^>]*>[\s\S]*?<a[^>]*>(.*?)<\/a>[\s\S]*?<\/h3>/);
            const snippetMatch = block.match(/<div[^>]*class="VwiC3b"[^>]*>[\s\S]*?<\/div>/);
            if (!urlMatch || !titleMatch) continue;
            const url = urlMatch[1];
            if (seen.has(url)) continue;
            seen.add(url);
            results.push({
                title: stripHtmlTags(titleMatch[1]),
                url,
                snippet: snippetMatch ? stripHtmlTags(snippetMatch[1]) : '',
                source: 'google'
            });
            if (results.length >= maxLimit) break;
        }

        if (results.length === 0) {
            const altRegex = /<a[^>]*href="([^"]+)"[^>]*>[\s\S]*?<h3[^>]*>(.*?)<\/h3>/g;
            let m;
            while ((m = altRegex.exec(html)) !== null) {
                const url = m[1];
                const title = stripHtmlTags(m[2]);
                if (seen.has(url)) continue;
                seen.add(url);
                results.push({ title, url, snippet: '', source: 'google' });
                if (results.length >= maxLimit) break;
            }
        }

        if (results.length === 0) {
            const simpleRegex = /<a[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>/g;
            let m;
            while ((m = simpleRegex.exec(html)) !== null) {
                const url = m[1];
                const title = stripHtmlTags(m[2]);
                if (url.includes('google.com') || url.includes('/search') || url.includes('/url') || url.includes('/httpservice')) continue;
                if (seen.has(url)) continue;
                seen.add(url);
                results.push({ title, url, snippet: '', source: 'google' });
                if (results.length >= maxLimit) break;
            }
        }

        return results;
    } catch (e) {
        throw new Error(`Google search failed: ${e.message}`);
    }
}

module.exports = {
    searchGoogle
};
