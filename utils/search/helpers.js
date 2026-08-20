const USER_AGENTS = [
    // Desktop Chrome
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    // Desktop Firefox
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:131.0) Gecko/20100101 Firefox/131.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:131.0) Gecko/20100101 Firefox/131.0',
    // Desktop Safari
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15',
    // Mobile Chrome
    'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',
    // Mobile Safari
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPad; CPU OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
    // Edge
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0'
];

function getRandomUserAgent() {
    return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function getRandomDelay(min = 1000, max = 3000) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function sleepWithJitter(min = 1000, max = 3000) {
    const delay = getRandomDelay(min, max);
    await sleep(delay);
}

async function fetchWithTimeout(url, options, timeout = 10000) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (e) {
        clearTimeout(id);
        if (e.name === 'AbortError') throw new Error(`Request timeout after ${timeout}ms`);
        throw e;
    }
}

function stripHtmlTags(raw) {
    if (!raw) return '';
    return raw
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, ' ')
        .trim();
}

function extractSnippet(html, element) {
    // Try various snippet patterns for different search engines
    const patterns = [
        // DuckDuckGo
        /<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/,
        /<div[^>]*class="result__snippet"[^>]*>(.*?)<\/div>/,
        // Google
        /<div[^>]*class="VwiC3b"[^>]*>(.*?)<\/div>/,
        /<span[^>]*class="st"[^>]*>(.*?)<\/span>/,
        // Bing
        /<p[^>]*class="b_lineCl2"[^>]*>(.*?)<\/p>/,
        /<div[^>]*class="b_lineCl2"[^>]*>(.*?)<\/div>/,
        // Yahoo
        /<p[^>]*class="compText"[^>]*>(.*?)<\/p>/,
        /<div[^>]*class="compText"[^>]*>(.*?)<\/div>/,
        // Generic
        /<div[^>]*class="s"[^>]*>(.*?)<\/div>/,
        /<p[^>]*class="desc"[^>]*>(.*?)<\/p>/,
        /<span[^>]*class="desc"[^>]*>(.*?)<\/span>/,
        /<div[^>]*class="description"[^>]*>(.*?)<\/div>/,
        // Fallback: Try to get text from any div or span near the link
        /<div[^>]*class="[^"]*snippet[^"]*"[^>]*>(.*?)<\/div>/i,
        /<span[^>]*class="[^"]*snippet[^"]*"[^>]*>(.*?)<\/span>/i
    ];
    
    for (const pattern of patterns) {
        const match = html.match(pattern);
        if (match && match[1] && match[1].trim().length > 10) {
            return stripHtmlTags(match[1]);
        }
    }
    
    // Fallback: Try to extract text from the element's siblings
    if (element && typeof element === 'string') {
        // For HTML string, try to find text after the link
        const afterLink = element.split('</a>')[1];
        if (afterLink) {
            const text = stripHtmlTags(afterLink);
            if (text.length > 20 && text.length < 300) {
                return text;
            }
        }
    }
    
    return '';
}

module.exports = {
    getRandomUserAgent,
    sleep,
    sleepWithJitter,
    getRandomDelay,
    fetchWithTimeout,
    stripHtmlTags,
    extractSnippet,
    USER_AGENTS
};
