const { searchYahoo } = require('../utils/search');
const fs = require('fs');
const path = require('path');

async function testYahoo() {
    console.log('Testing Yahoo search...');
    try {
        const results = await searchYahoo('test query', 5);
        console.log('Success! Results:', results);
    } catch (e) {
        console.error('Failed:', e.message);
        
        // Try to fetch the page directly to analyze
        console.log('\nTrying to fetch Yahoo page directly for analysis...');
        try {
            const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';
            const params = new URLSearchParams({ p: 'test query', n: '5' });
            const url = `https://search.yahoo.com/search?${params.toString()}`;
            
            const res = await fetch(url, {
                headers: {
                    'User-Agent': ua,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Referer': 'https://search.yahoo.com/',
                    'DNT': '1',
                    'Connection': 'keep-alive'
                }
            });
            
            console.log('Status:', res.status);
            const html = await res.text();
            
            const htmlPath = path.join(__dirname, '..', 'logs', `yahoo-page-${Date.now()}.html`);
            fs.writeFileSync(htmlPath, html);
            console.log(`Page HTML saved to: ${htmlPath}`);
            
            // Check for common result patterns
            const patterns = [
                'class="dd algo"',
                'class="algo"',
                'class="web"',
                'data-testid="webresult"',
                'class="search-result"'
            ];
            
            for (const pattern of patterns) {
                const count = (html.match(new RegExp(pattern, 'g')) || []).length;
                console.log(`Pattern "${pattern}": ${count} matches`);
            }
            
        } catch (fetchError) {
            console.error('Fetch failed:', fetchError.message);
        }
    }
}

testYahoo();
