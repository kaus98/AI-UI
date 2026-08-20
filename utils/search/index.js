const { searchDuckDuckGo } = require('./duckduckgo');
const { searchBing } = require('./bing');
const { searchYahoo } = require('./yahoo');
const { searchGoogle } = require('./google');
const { logSearch, getSearchStats, getRecentSearches, clearOldLogs } = require('./logger');

const SEARCH_ENGINES = ['bing', 'duckduckgo', 'yahoo'];

// Engine performance tracking
const enginePerformance = {
    bing: { success: 0, failure: 0, avgDuration: 0, lastUsed: 0 },
    duckduckgo: { success: 0, failure: 0, avgDuration: 0, lastUsed: 0 },
    yahoo: { success: 0, failure: 0, avgDuration: 0, lastUsed: 0 }
};

function updateEnginePerformance(engine, success, duration) {
    const perf = enginePerformance[engine];
    if (success) {
        perf.success++;
        perf.avgDuration = (perf.avgDuration * (perf.success - 1) + duration) / perf.success;
    } else {
        perf.failure++;
    }
    perf.lastUsed = Date.now();
}

function getEngineScore(engine) {
    const perf = enginePerformance[engine];
    const total = perf.success + perf.failure;
    if (total === 0) return 1; // Default score for unused engines
    
    const successRate = perf.success / total;
    const agePenalty = (Date.now() - perf.lastUsed) / (1000 * 60 * 60); // Decay over hours
    const speedScore = perf.avgDuration > 0 ? Math.min(10000 / perf.avgDuration, 10) : 5;
    
    return (successRate * 10) + speedScore - agePenalty;
}

function selectBestEngine() {
    // Sort engines by performance score
    const sorted = SEARCH_ENGINES.sort((a, b) => getEngineScore(b) - getEngineScore(a));
    return sorted[0];
}

async function searchWeb(query, limit = 10, engine = 'auto') {
    let engines = SEARCH_ENGINES.slice();
    
    if (engine === 'auto') {
        // Auto-select best performing engine
        engine = selectBestEngine();
        console.log(`Auto-selected engine: ${engine}`);
        // Try the best engine first, then fall back to others if it fails
        engines = [engine, ...SEARCH_ENGINES.filter(e => e !== engine)];
    } else if (SEARCH_ENGINES.includes(engine)) {
        engines = [engine];
    }
    
    const shuffled = engines.sort(() => Math.random() - 0.5);
    
    for (const eng of shuffled) {
        const startTime = Date.now();
        try {
            let results;
            switch (eng) {
                case 'duckduckgo':
                    results = await searchDuckDuckGo(query, limit);
                    break;
                case 'bing':
                    results = await searchBing(query, limit);
                    break;
                case 'yahoo':
                    results = await searchYahoo(query, limit);
                    break;
            }
            
            const duration = Date.now() - startTime;
            
            // Treat empty results as failure
            if (!results || results.length === 0) {
                console.warn(`Search engine ${eng} returned no results`);
                updateEnginePerformance(eng, false, duration);
                continue; // Try next engine
            }
            
            updateEnginePerformance(eng, true, duration);
            return results;
        } catch (e) {
            console.warn(`Search engine ${eng} failed: ${e.message}`);
            const duration = Date.now() - startTime;
            updateEnginePerformance(eng, false, duration);
        }
    }
    
    throw new Error('All search engines failed');
}

module.exports = {
    searchDuckDuckGo,
    searchBing,
    searchYahoo,
    searchGoogle,
    searchWeb,
    logSearch,
    getSearchStats,
    getRecentSearches,
    clearOldLogs,
    enginePerformance
};
