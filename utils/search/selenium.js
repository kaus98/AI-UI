const { Builder, By, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const fs = require('fs');
const path = require('path');

// Suppress Chrome console output
const originalConsoleError = console.error;
console.error = (...args) => {
    // Filter out Chrome warnings
    const message = args.join(' ');
    if (message.includes('ERROR:') && 
        (message.includes('cloud_policy_validator') ||
         message.includes('direct_composition_support') ||
         message.includes('policy_conversions_client') ||
         message.includes('usb_service_win') ||
         message.includes('registration_request') ||
         message.includes('device_event_log'))) {
        return; // Skip these Chrome internal errors
    }
    originalConsoleError.apply(console, args);
};

async function createDriver() {
    const options = new chrome.Options();
    options.addArguments('--headless=new'); // Use new headless mode (faster)
    options.addArguments('--no-sandbox');
    options.addArguments('--disable-dev-shm-usage');
    options.addArguments('--disable-gpu');
    options.addArguments('--window-size=1920,1080');
    options.addArguments('--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36');
    
    // Suppress Chrome warnings and errors
    options.addArguments('--disable-extensions');
    options.addArguments('--disable-infobars');
    options.addArguments('--disable-notifications');
    options.addArguments('--disable-popup-blocking');
    options.addArguments('--disable-save-password-bubble');
    options.addArguments('--disable-translate');
    options.addArguments('--disable-background-networking');
    options.addArguments('--disable-background-timer-throttling');
    options.addArguments('--disable-backgrounding-occluded-windows');
    options.addArguments('--disable-breakpad');
    options.addArguments('--disable-component-extensions-with-background-pages');
    options.addArguments('--disable-features=TranslateUI');
    options.addArguments('--disable-features=IsolateOrigins,site-per-process');
    options.addArguments('--disable-sync');
    options.addArguments('--disable-default-apps');
    options.addArguments('--log-level=3');
    options.addArguments('--silent');
    options.addArguments('--no-first-run');
    options.addArguments('--no-default-browser-check');
    options.addArguments('--disable-web-security');
    options.addArguments('--ignore-certificate-errors');
    options.addArguments('--ignore-ssl-errors');
    options.addArguments('--allow-running-insecure-content');
    options.addArguments('--disable-logging');
    options.addArguments('--disable-permissions-api');
    options.addArguments('--disable-device-discovery-notifications');
    options.addArguments('--disable-domain-reliability');
    options.addArguments('--disable-features=VizDisplayCompositor');
    
    // Performance optimizations - disable unused features
    options.addArguments('--blink-settings=imagesEnabled=false'); // Disable images
    options.addArguments('--disable-images'); // Disable images
    options.addArguments('--disable-javascript-harmony-shipping'); // Disable some JS features
    options.addArguments('--disable-ipc-flooding-protection'); // Disable IPC protection
    options.addArguments('--disable-renderer-backgrounding'); // Disable renderer backgrounding
    options.addArguments('--disable-features=UseSkiaRenderer'); // Disable Skia renderer
    options.addArguments('--disable-features=IsolateOrigins'); // Disable site isolation
    options.addArguments('--disable-features=site-per-process'); // Disable per-site process
    options.addArguments('--no-zygote'); // Disable zygote process
    options.addArguments('--disable-gpu-compositing'); // Disable GPU compositing
    options.addArguments('--disable-software-rasterizer'); // Disable software rasterizer
    options.addArguments('--disable-3d-apis'); // Disable 3D APIs
    options.addArguments('--disable-accelerated-2d-canvas'); // Disable 2D canvas acceleration
    options.addArguments('--disable-accelerated-jpeg-decoding'); // Disable JPEG acceleration
    options.addArguments('--disable-accelerated-mjpeg-decode'); // Disable MJPEG acceleration
    options.addArguments('--disable-accelerated-video-decode'); // Disable video acceleration
    options.addArguments('--disable-accelerated-video-encode'); // Disable video encoding
    options.addArguments('--disable-accelerated-video-decoding'); // Disable video decoding
    options.addArguments('--disable-accelerated-video-encoding'); // Disable video encoding
    options.addArguments('--disable-accelerated-png-decoding'); // Disable PNG decoding
    options.addArguments('--disable-accelerated-webp-decoding'); // Disable WebP decoding
    options.addArguments('--disable-accelerated-webgl'); // Disable WebGL
    
    // Suppress Chrome console output
    options.setLoggingPrefs({ browser: 'ALL', driver: 'ALL' });
    
    const driver = await new Builder()
        .forBrowser('chrome')
        .setChromeOptions(options)
        .build();
    
    // Set page load timeout
    await driver.manage().setTimeouts({ pageLoad: 30000 });
    
    return driver;
}

async function waitForResults(driver, timeout = 5000) {
    try {
        // Wait for any h2 a element (search results) to appear
        await driver.wait(until.elementLocated(By.css('h2 a')), timeout);
        console.log('Results detected');
        return true;
    } catch (e) {
        console.log('No results detected within timeout, continuing anyway');
        return false;
    }
}

async function savePageAnalysis(driver, engine, query) {
    const timestamp = Date.now();
    const pageHtml = await driver.getPageSource();
    const screenshot = await driver.takeScreenshot();
    const pageTitle = await driver.getTitle();
    const pageUrl = await driver.getCurrentUrl();
    
    const htmlPath = path.join(__dirname, '..', '..', 'logs', `${engine}-page-${timestamp}.html`);
    const screenshotPath = path.join(__dirname, '..', '..', 'logs', `${engine}-screenshot-${timestamp}.png`);
    const analysisPath = path.join(__dirname, '..', '..', 'logs', `${engine}-analysis-${timestamp}.json`);
    
    fs.writeFileSync(htmlPath, pageHtml);
    fs.writeFileSync(screenshotPath, screenshot, 'base64');
    
    console.log(`Page HTML saved to: ${htmlPath}`);
    console.log(`Screenshot saved to: ${screenshotPath}`);
    console.log(`Page title: ${pageTitle}`);
    console.log(`Page URL: ${pageUrl}`);
    
    return { htmlPath, screenshotPath, analysisPath, pageTitle, pageUrl };
}

async function analyzeSelectors(driver, selectors) {
    const selectorResults = {};
    for (const selector of selectors) {
        try {
            const elements = await driver.findElements(By.css(selector));
            selectorResults[selector] = elements.length;
            console.log(`Selector "${selector}": ${elements.length} elements`);
        } catch (e) {
            selectorResults[selector] = `Error: ${e.message}`;
        }
    }
    return selectorResults;
}

async function extractResultsFromLinks(driver, maxLimit, source, filterFn) {
    const results = [];
    const seen = new Set();
    
    const allLinks = await driver.findElements(By.css('a[href*="http"]'));
    console.log(`Found ${allLinks.length} links with http URLs`);
    
    for (let i = 0; i < allLinks.length && results.length < maxLimit; i++) {
        try {
            const link = allLinks[i];
            const url = await link.getAttribute('href');
            const text = await link.getText();
            
            if (!text || !url) continue;
            if (filterFn && !filterFn(url, text)) continue;
            if (seen.has(url)) continue;
            seen.add(url);
            
            results.push({
                title: text,
                url,
                snippet: '',
                source
            });
        } catch (e) {
            // Skip this link
        }
    }
    
    return results;
}

module.exports = {
    createDriver,
    savePageAnalysis,
    analyzeSelectors,
    extractResultsFromLinks,
    waitForResults
};
