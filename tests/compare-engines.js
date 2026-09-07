const { searchDuckDuckGo, searchWeb } = require('../utils/search');
const fs = require('fs');
const path = require('path');

async function testAllEnginesWithSameQuery() {
    const query = 'artificial intelligence latest news';
    const limit = 5;
    const timestamp = new Date().toISOString();
    
    console.log(`=== Testing all search engines with query: "${query}" ===\n`);
    console.log(`Timestamp: ${timestamp}\n`);
    
    const results = {
        timestamp,
        query,
        engines: {}
    };
    
    // Test DuckDuckGo
    console.log('Testing DuckDuckGo...');
    try {
        const ddgResults = await searchDuckDuckGo(query, limit);
        results.engines.duckduckgo = {
            success: true,
            count: ddgResults.length,
            results: ddgResults
        };
        console.log(`✓ DuckDuckGo: ${ddgResults.length} results`);
    } catch (e) {
        results.engines.duckduckgo = {
            success: false,
            error: e.message
        };
        console.log(`✗ DuckDuckGo failed: ${e.message}`);
    }
    
    // Test Bing
    console.log('Testing Bing...');
    try {
        const bingResults = await searchWeb(query, limit, 'bing');
        results.engines.bing = {
            success: true,
            count: bingResults.length,
            results: bingResults
        };
        console.log(`✓ Bing: ${bingResults.length} results`);
    } catch (e) {
        results.engines.bing = {
            success: false,
            error: e.message
        };
        console.log(`✗ Bing failed: ${e.message}`);
    }
    
    // Test Yahoo
    console.log('Testing Yahoo...');
    try {
        const yahooResults = await searchWeb(query, limit, 'yahoo');
        results.engines.yahoo = {
            success: true,
            count: yahooResults.length,
            results: yahooResults
        };
        console.log(`✓ Yahoo: ${yahooResults.length} results`);
    } catch (e) {
        results.engines.yahoo = {
            success: false,
            error: e.message
        };
        console.log(`✗ Yahoo failed: ${e.message}`);
    }
    
    // Test Startpage
    console.log('Testing Startpage...');
    try {
        const startpageResults = await searchWeb(query, limit, 'startpage');
        results.engines.startpage = {
            success: true,
            count: startpageResults.length,
            results: startpageResults
        };
        console.log(`✓ Startpage: ${startpageResults.length} results`);
    } catch (e) {
        results.engines.startpage = {
            success: false,
            error: e.message
        };
        console.log(`✗ Startpage failed: ${e.message}`);
    }
    
    // Save results to file
    const outputDir = path.join(__dirname, '..', 'logs');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const outputFile = path.join(outputDir, `search-comparison-${Date.now()}.json`);
    fs.writeFileSync(outputFile, JSON.stringify(results, null, 2));
    
    console.log(`\n=== Results saved to: ${outputFile} ===`);
    
    // Print summary
    console.log('\n=== Summary ===');
    for (const [engine, data] of Object.entries(results.engines)) {
        if (data.success) {
            console.log(`${engine}: ✓ ${data.count} results`);
            if (data.results[0]?.fallbackSource) {
                console.log(`  └─ Fallback from: ${data.results[0].fallbackSource} (${data.results[0].fallbackReason})`);
            }
        } else {
            console.log(`${engine}: ✗ ${data.error}`);
        }
    }
    
    return results;
}

testAllEnginesWithSameQuery().catch(e => {
    console.error('Test failed:', e);
    process.exit(1);
});
