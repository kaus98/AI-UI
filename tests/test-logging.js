const { searchWeb, getSearchStats, getRecentSearches } = require('../utils/search');

async function testLogging() {
    console.log('=== Testing Search Logging ===\n');
    
    // Perform a few searches
    console.log('Performing searches...');
    await searchWeb('test query 1', 5);
    await searchWeb('test query 2', 5, 'bing');
    await searchWeb('test query 3', 5, 'yahoo');
    
    console.log('\n=== Search Statistics ===');
    const stats = getSearchStats();
    console.log(JSON.stringify(stats, null, 2));
    
    console.log('\n=== Recent Searches ===');
    const recent = getRecentSearches(5);
    console.log(JSON.stringify(recent, null, 2));
    
    console.log('\n=== Logging Test Complete ===');
}

testLogging().catch(console.error);
