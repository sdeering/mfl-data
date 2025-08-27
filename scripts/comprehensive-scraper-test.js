const puppeteer = require('puppeteer');

async function comprehensiveScrapeTest(playerId) {
  const browser = await puppeteer.launch({ headless: false }); // Show browser for debugging
  try {
    const page = await browser.newPage();
    const url = `https://mflplayer.info/player/${playerId}`;
    
    console.log(`Comprehensive scraping test for: ${url}`);
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait longer for dynamic content
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Try to click on position ratings toggle if it exists
    try {
      await page.click('text=Position Ratings');
      console.log('Clicked on Position Ratings toggle');
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (e) {
      console.log('Could not click Position Ratings toggle');
    }
    
    // Take a screenshot after waiting
    await page.screenshot({ path: `comprehensive-debug-${playerId}.png`, fullPage: true });
    console.log(`Screenshot saved as comprehensive-debug-${playerId}.png`);
    
    // Try multiple extraction methods
    const results = await page.evaluate(() => {
      const bodyText = document.body.textContent;
      
      console.log('Body text length:', bodyText.length);
      console.log('First 2000 chars:', bodyText.substring(0, 2000));
      
      const ratings = {};
      
      // Method 1: Look for the specific pattern we saw
      const pattern1 = /Position RatingsToggle([A-Z]+)(\d+)([A-Z]+)(\d+)([A-Z]+)(\d+)/;
      const match1 = bodyText.match(pattern1);
      console.log('Pattern 1 match:', match1);
      
      if (match1) {
        for (let i = 1; i < match1.length; i += 2) {
          const position = match1[i];
          const rating = parseInt(match1[i + 1]);
          ratings[position] = rating;
        }
      }
      
      // Method 2: Look for individual position patterns
      const positions = ['ST', 'CF', 'CAM', 'RW', 'LW', 'RM', 'LM', 'CM', 'CDM', 'RWB', 'LWB', 'RB', 'LB', 'CB', 'GK'];
      positions.forEach(pos => {
        const pattern = new RegExp(`${pos}(\\d+)`, 'g');
        const matches = bodyText.match(pattern);
        if (matches && matches.length > 0) {
          const match = matches[0];
          const rating = parseInt(match.replace(pos, ''));
          if (!ratings[pos]) { // Don't overwrite if already found
            ratings[pos] = rating;
          }
        }
      });
      
      // Method 3: Look for any numbers near position text
      positions.forEach(pos => {
        const posIndex = bodyText.indexOf(pos);
        if (posIndex !== -1) {
          // Look for numbers near this position
          const nearbyText = bodyText.substring(posIndex - 10, posIndex + 20);
          const numberMatch = nearbyText.match(/\d+/);
          if (numberMatch && !ratings[pos]) {
            ratings[pos] = parseInt(numberMatch[0]);
          }
        }
      });
      
      return ratings;
    });
    
    console.log(`Comprehensive scraping results for player ${playerId}:`, results);
    
    return results;
    
  } catch (error) {
    console.error(`Error in comprehensive scraping for player ${playerId}:`, error);
    return null;
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('=== Comprehensive Position Rating Scraping Test ===');
  
  // Test with Vincent Manson
  const results = await comprehensiveScrapeTest(4942);
  
  console.log('\nFinal results:', results);
  
  // Expected values based on debug output
  const expected = {
    ST: 54,
    CF: 48,
    RW: 33
  };
  
  console.log('\nExpected values:', expected);
  
  if (results) {
    Object.keys(expected).forEach(pos => {
      const expectedVal = expected[pos];
      const scrapedVal = results[pos];
      const match = expectedVal === scrapedVal ? '✅' : '❌';
      console.log(`${pos}: Expected=${expectedVal}, Scraped=${scrapedVal} ${match}`);
    });
  }
}

main().catch(console.error);
