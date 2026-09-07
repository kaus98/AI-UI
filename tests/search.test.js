const { searchDuckDuckGo, searchWeb } = require('../utils/search');

async function testSearchDuckDuckGo() {
    console.log('Testing DuckDuckGo search...');
    try {
        const results = await searchDuckDuckGo('test query', 5);
        console.log(`DuckDuckGo search returned ${results.length} results`);
        if (results.length > 0) {
            console.log('Sample result:', results[0]);
        }
        return results.length > 0;
    } catch (e) {
        console.error('DuckDuckGo search failed:', e.message);
        return false;
    }
}

async function testSearchWeb() {
    console.log('Testing searchWeb (auto mode)...');
    try {
        const results = await searchWeb('test query', 5, 'auto');
        console.log(`searchWeb returned ${results.length} results`);
        if (results.length > 0) {
            console.log('Sample result:', results[0]);
        }
        return results.length > 0;
    } catch (e) {
        console.error('searchWeb failed:', e.message);
        return false;
    }
}

async function testSearchWebSpecificEngine() {
    console.log('Testing searchWeb with specific engine (bing)...');
    try {
        const results = await searchWeb('test query', 5, 'bing');
        console.log(`searchWeb (bing) returned ${results.length} results`);
        if (results.length > 0) {
            console.log('Sample result:', results[0]);
        }
        return results.length > 0;
    } catch (e) {
        console.error('searchWeb (bing) failed:', e.message);
        return false;
    }
}

async function testSearchWebYahoo() {
    console.log('Testing searchWeb with specific engine (yahoo)...');
    try {
        const results = await searchWeb('test query', 5, 'yahoo');
        console.log(`searchWeb (yahoo) returned ${results.length} results`);
        if (results.length > 0) {
            console.log('Sample result:', results[0]);
        }
        return results.length > 0;
    } catch (e) {
        console.error('searchWeb (yahoo) failed:', e.message);
        return false;
    }
}

async function testSearchWebStartpage() {
    console.log('Testing searchWeb with specific engine (startpage)...');
    try {
        const results = await searchWeb('test query', 5, 'startpage');
        console.log(`searchWeb (startpage) returned ${results.length} results`);
        if (results.length > 0) {
            console.log('Sample result:', results[0]);
        }
        return results.length > 0;
    } catch (e) {
        console.error('searchWeb (startpage) failed:', e.message);
        return false;
    }
}

async function runTests() {
    console.log('=== Web Search Scraper Tests ===\n');
    
    const ddgResult = await testSearchDuckDuckGo();
    console.log(`DuckDuckGo test: ${ddgResult ? 'PASS' : 'FAIL'}\n`);
    
    const webResult = await testSearchWeb();
    console.log(`searchWeb (auto) test: ${webResult ? 'PASS' : 'FAIL'}\n`);
    
    const webSpecificResult = await testSearchWebSpecificEngine();
    console.log(`searchWeb (bing) test: ${webSpecificResult ? 'PASS' : 'FAIL'}\n`);

    const yahooResult = await testSearchWebYahoo();
    console.log(`searchWeb (yahoo) test: ${yahooResult ? 'PASS' : 'FAIL'}\n`);
    
    const allPassed = ddgResult && webResult && webSpecificResult && yahooResult;
    console.log(`=== Overall: ${allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED'} ===`);
    
    process.exit(allPassed ? 0 : 1);
}

runTests().catch(e => {
    console.error('Test runner error:', e);
    process.exit(1);
});
