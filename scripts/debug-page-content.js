const puppeteer = require('puppeteer');

async function debugPageContent(playerId) {
  const browser = await puppeteer.launch({ headless: false }); // Show browser for debugging
  try {
    const page = await browser.newPage();
    const url = `https://mflplayer.info/player/${playerId}`;
    
    console.log(`Debugging page content for: ${url}`);
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for the page to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Take a screenshot
    await page.screenshot({ path: `debug-player-${playerId}.png`, fullPage: true });
    console.log(`Screenshot saved as debug-player-${playerId}.png`);
    
    // Get page content
    const pageContent = await page.evaluate(() => {
      return {
        title: document.title,
        bodyText: document.body.textContent.substring(0, 2000), // First 2000 chars
        html: document.documentElement.outerHTML.substring(0, 3000) // First 3000 chars
      };
    });
    
    console.log('\n=== PAGE CONTENT ANALYSIS ===');
    console.log('Title:', pageContent.title);
    console.log('\nBody Text (first 2000 chars):');
    console.log(pageContent.bodyText);
    console.log('\nHTML (first 3000 chars):');
    console.log(pageContent.html);
    
    // Look for any numbers that might be ratings
    const numbers = pageContent.bodyText.match(/\d+/g);
    if (numbers) {
      console.log('\n=== NUMBERS FOUND ON PAGE ===');
      console.log('All numbers:', numbers.slice(0, 20)); // First 20 numbers
    }
    
    // Look for position-related text
    const positions = ['ST', 'CF', 'CAM', 'RW', 'LW', 'RM', 'LM', 'CM', 'CDM', 'RWB', 'LWB', 'RB', 'LB', 'CB', 'GK'];
    console.log('\n=== POSITION SEARCH ===');
    positions.forEach(pos => {
      if (pageContent.bodyText.includes(pos)) {
        console.log(`Found "${pos}" in page content`);
      }
    });
    
    console.log('\n=== DEBUG COMPLETE ===');
    console.log('Check the screenshot to see what the page looks like');
    
  } catch (error) {
    console.error(`Error debugging page for player ${playerId}:`, error);
  } finally {
    await browser.close();
  }
}

async function main() {
  // Test with Vincent Manson
  await debugPageContent(4942);
}

main().catch(console.error);
