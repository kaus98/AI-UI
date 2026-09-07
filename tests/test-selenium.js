const { searchDuckDuckGo } = require('../utils/search');

async function testSelenium() {
    console.log('Testing DuckDuckGo with Selenium...');
    try {
        const results = await searchDuckDuckGo('test query', 3);
        console.log('Success! Results:', results);
    } catch (e) {
        console.error('Failed:', e.message);
    }
}

testSelenium();
