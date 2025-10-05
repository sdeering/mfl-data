/**
 * Simple sync test runner
 * Tests the sync functionality using the existing sync-test page
 */

const puppeteer = require('puppeteer');

async function runSyncTests() {
  console.log('🧪 Starting sync tests...');
  
  let browser;
  try {
    // Launch browser
    browser = await puppeteer.launch({ 
      headless: false, // Set to true for headless mode
      defaultViewport: null 
    });
    
    const page = await browser.newPage();
    
    // Navigate to sync tests page
    console.log('📱 Navigating to sync tests page...');
    await page.goto('http://localhost:3000/sync-tests', { 
      waitUntil: 'networkidle0' 
    });
    
    // Wait for page to load
    await page.waitForSelector('button', { timeout: 10000 });
    
    // Click the "Run All Tests" button
    console.log('🚀 Clicking "Run All Tests" button...');
    await page.click('button');
    
    // Wait for tests to complete (look for results)
    console.log('⏳ Waiting for tests to complete...');
    await page.waitForSelector('[class*="bg-green-50"], [class*="bg-red-50"]', { 
      timeout: 120000 // 2 minutes timeout
    });
    
    // Extract test results
    const results = await page.evaluate(() => {
      const resultElements = document.querySelectorAll('[class*="bg-green-50"], [class*="bg-red-50"]');
      const results = [];
      
      resultElements.forEach(element => {
        const nameElement = element.querySelector('h3');
        const statusElement = element.querySelector('span');
        const errorElement = element.querySelector('.text-red-700');
        
        if (nameElement && statusElement) {
          results.push({
            name: nameElement.textContent.replace(/[✅❌]/g, '').trim(),
            passed: statusElement.textContent.includes('PASSED'),
            error: errorElement ? errorElement.textContent.replace('Error:', '').trim() : null
          });
        }
      });
      
      return results;
    });
    
    // Report results
    console.log('\n📊 Test Results:');
    console.log('=' .repeat(50));
    
    let passed = 0;
    let failed = 0;
    
    results.forEach(result => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${status} ${result.name}`);
      if (result.error) {
        console.log(`   Error: ${result.error}`);
      }
      
      if (result.passed) passed++;
      else failed++;
    });
    
    console.log('=' .repeat(50));
    console.log(`Total: ${results.length}`);
    console.log(`Passed: ${passed}`);
    console.log(`Failed: ${failed}`);
    console.log(`Success Rate: ${((passed / results.length) * 100).toFixed(1)}%`);
    
    // Keep browser open for a moment to see results
    await new Promise(resolve => setTimeout(resolve, 5000));
    
  } catch (error) {
    console.error('❌ Test runner error:', error.message);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

// Check if puppeteer is available
try {
  runSyncTests();
} catch (error) {
  console.log('❌ Puppeteer not available. Please install it with: npm install puppeteer');
  console.log('Or run the tests manually at: http://localhost:3000/sync-tests');
}
