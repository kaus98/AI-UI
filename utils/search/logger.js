const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', '..', 'logs');
const SEARCH_LOG_FILE = path.join(LOG_DIR, 'searches.log');

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
    fs.mkdirSync(LOG_DIR, { recursive: true });
}

/**
 * Log a search request to file
 * @param {Object} data - Search data to log
 * @param {string} data.query - Search query
 * @param {string} data.engine - Search engine used
 * @param {number} data.resultsCount - Number of results returned
 * @param {number} data.limit - Requested limit
 * @param {string} data.method - Method used (selenium/http)
 * @param {number} data.duration - Duration in milliseconds
 * @param {string} data.status - Status (success/error)
 * @param {string} [data.error] - Error message if failed
 */
function logSearch(data) {
    const timestamp = new Date().toISOString();
    const logEntry = {
        timestamp,
        ...data
    };
    
    const logLine = JSON.stringify(logEntry) + '\n';
    
    try {
        fs.appendFileSync(SEARCH_LOG_FILE, logLine, 'utf8');
    } catch (e) {
        console.error('Failed to write search log:', e.message);
    }
}

/**
 * Get search statistics
 * @returns {Object} Statistics object
 */
function getSearchStats() {
    try {
        if (!fs.existsSync(SEARCH_LOG_FILE)) {
            return {
                totalSearches: 0,
                byEngine: {},
                byStatus: {},
                avgResults: 0,
                avgDuration: 0
            };
        }
        
        const content = fs.readFileSync(SEARCH_LOG_FILE, 'utf8');
        const lines = content.trim().split('\n').filter(line => line);
        
        const stats = {
            totalSearches: lines.length,
            byEngine: {},
            byStatus: {},
            totalResults: 0,
            totalDuration: 0,
            successfulSearches: 0
        };
        
        lines.forEach(line => {
            try {
                const entry = JSON.parse(line);
                
                // Count by engine
                stats.byEngine[entry.engine] = (stats.byEngine[entry.engine] || 0) + 1;
                
                // Count by status
                stats.byStatus[entry.status] = (stats.byStatus[entry.status] || 0) + 1;
                
                // Sum results and duration
                if (entry.resultsCount) {
                    stats.totalResults += entry.resultsCount;
                }
                if (entry.duration) {
                    stats.totalDuration += entry.duration;
                }
                if (entry.status === 'success') {
                    stats.successfulSearches++;
                }
            } catch (e) {
                // Skip malformed lines
            }
        });
        
        stats.avgResults = stats.successfulSearches > 0 
            ? Math.round(stats.totalResults / stats.successfulSearches) 
            : 0;
        stats.avgDuration = stats.successfulSearches > 0 
            ? Math.round(stats.totalDuration / stats.successfulSearches) 
            : 0;
        
        return stats;
    } catch (e) {
        console.error('Failed to read search stats:', e.message);
        return {
            totalSearches: 0,
            byEngine: {},
            byStatus: {},
            avgResults: 0,
            avgDuration: 0
        };
    }
}

/**
 * Get recent searches
 * @param {number} limit - Number of recent searches to return
 * @returns {Array} Array of recent search entries
 */
function getRecentSearches(limit = 10) {
    try {
        if (!fs.existsSync(SEARCH_LOG_FILE)) {
            return [];
        }
        
        const content = fs.readFileSync(SEARCH_LOG_FILE, 'utf8');
        const lines = content.trim().split('\n').filter(line => line);
        
        const recent = lines.slice(-limit).reverse().map(line => {
            try {
                return JSON.parse(line);
            } catch (e) {
                return null;
            }
        }).filter(entry => entry !== null);
        
        return recent;
    } catch (e) {
        console.error('Failed to read recent searches:', e.message);
        return [];
    }
}

/**
 * Clear old search logs (keep last N lines)
 * @param {number} keepLines - Number of lines to keep
 */
function clearOldLogs(keepLines = 1000) {
    try {
        if (!fs.existsSync(SEARCH_LOG_FILE)) {
            return;
        }
        
        const content = fs.readFileSync(SEARCH_LOG_FILE, 'utf8');
        const lines = content.trim().split('\n').filter(line => line);
        
        if (lines.length > keepLines) {
            const recentLines = lines.slice(-keepLines);
            fs.writeFileSync(SEARCH_LOG_FILE, recentLines.join('\n') + '\n', 'utf8');
            console.log(`Cleared old logs, kept ${recentLines.length} lines`);
        }
    } catch (e) {
        console.error('Failed to clear old logs:', e.message);
    }
}

module.exports = {
    logSearch,
    getSearchStats,
    getRecentSearches,
    clearOldLogs
};
