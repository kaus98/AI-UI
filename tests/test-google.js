const { searchGoogle } = require('../utils/search');
const fs = require('fs');
const path = require('path');

async function testGoogle() {
    console.log('Testing Google search...');
    try {
        const results = await searchGoogle('test query', 5);
        console.log('Success! Results:', results);
    } catch (e) {
        console.error('Failed:', e.message);
        
        // Try to fetch the page directly to analyze
        console.log('\nTrying to fetch Google page directly for analysis...');
        try {
            const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36';
            const params = new URLSearchParams({ q: 'test query', num: '5' });
            const url = `https://www.google.com/search?${params.toString()}`;
            
            const res = await fetch(url, {
                headers: {
                    'User-Agent': ua,
                    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                    'Accept-Language': 'en-US,en;q=0.5',
                    'Referer': 'https://www.google.com/',
                    'DNT': '1',
                    'Connection': 'keep-alive'
                }
            });
            
            console.log('Status:', res.status);
            const html = await res.text();
            
            const htmlPath = path.join(__dirname, '..', 'logs', `google-page-${Date.now()}.html`);
            fs.writeFileSync(htmlPath, html);
            console.log(`Page HTML saved to: ${htmlPath}`);
            
            // Check for common result patterns
            const patterns = [
                'class="g"',
                'class="yuRUbf"',
                'class="VwiC3b"',
                'data-hveid',
                'class="Z26qb"'
            ];
            
            for (const pattern of patterns) {
                const count = (html.match(new RegExp(pattern, 'g')) || []).length;
                console.log(`Pattern "${pattern}": ${count} matches`);
            }
            
            // Check if JavaScript is required
            if (html.includes('enable JavaScript') || html.includes('Enable JavaScript')) {
                console.log('Google requires JavaScript - Selenium needed');
            }
            
        } catch (fetchError) {
            console.error('Fetch failed:', fetchError.message);
        }
    }
}

testGoogle();
