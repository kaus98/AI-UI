const { fetchWithTimeout, stripHtmlTags, getRandomUserAgent, sleepWithJitter } = require('./helpers');
const { logSearch } = require('./logger');

async function searchBing(query, limit = 10) {
    const maxLimit = Math.min(Number(limit) || 10, 30);
    if (!query || typeof query !== 'string') throw new Error('Query is required');

    const startTime = Date.now();

    try {
        const ua = getRandomUserAgent();
        const params = new URLSearchParams({ q: query, count: String(maxLimit) });
        const url = `https://www.bing.com/search?${params.toString()}`;

        const res = await fetchWithTimeout(url, {
            headers: {
                'User-Agent': ua,
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.5',
                'Referer': 'https://www.bing.com/',
                'DNT': '1',
                'Connection': 'keep-alive'
            }
        }, 10000);

        if (!res.ok) throw new Error(`Bing search failed: ${res.status}`);
        const html = await res.text();
        const results = [];
        const seen = new Set();

        const itemRegex = /<li[^>]*class="b_algo"[^>]*>[\s\S]*?<\/li>/g;
        let m;
        while ((m = itemRegex.exec(html)) !== null) {
            const block = m[0];
            const urlMatch = block.match(/<a[^>]*href="([^"]+)"[^>]*>/);
            const titleMatch = block.match(/<h2[^>]*>[\s\S]*?<a[^>]*>(.*?)<\/a>[\s\S]*?<\/h2>/);
            const snippetMatch = block.match(/<p[^>]*class="b_lineCl2"[^>]*>(.*?)<\/p>/);
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
                source: 'bing'
            });
            if (results.length >= maxLimit) break;
        }

        const duration = Date.now() - startTime;
        logSearch({
            query,
            engine: 'bing',
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
            engine: 'bing',
            resultsCount: 0,
            limit: maxLimit,
            method: 'http',
            duration,
            status: 'error',
            error: e.message
        });
        throw new Error(`Bing search failed: ${e.message}`);
    }
}

module.exports = {
    searchBing
};
