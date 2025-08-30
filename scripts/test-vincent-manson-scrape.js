const puppeteer = require('puppeteer');

async function scrapeVincentManson() {
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const url = `https://mflplayer.info/player/4942`;
    
    console.log(`Scraping Vincent Manson from: ${url}`);
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for the page to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Extract position ratings from page content
    const positionRatings = await page.evaluate(() => {
      const bodyText = document.body.textContent;
      
      console.log('Full body text:', bodyText);
      
      // Look for the specific pattern we saw: "ST054CFFF-648RWU-2133"
      const positionRatingsMatch = bodyText.match(/Position RatingsToggle([A-Z]+)(\d+)([A-Z]+)(\d+)([A-Z]+)(\d+)/);
      
      console.log('Position ratings match:', positionRatingsMatch);
      
      if (positionRatingsMatch) {
        const ratings = {};
        
        // Extract ratings from the match
        for (let i = 1; i < positionRatingsMatch.length; i += 2) {
          const position = positionRatingsMatch[i];
          const rating = parseInt(positionRatingsMatch[i + 1]);
          ratings[position] = rating;
        }
        
        return ratings;
      }
      
      // Alternative: Look for individual position patterns
      const ratings = {};
      const positions = ['ST', 'CF', 'CAM', 'RW', 'LW', 'RM', 'LM', 'CM', 'CDM', 'RWB', 'LWB', 'RB', 'LB', 'CB', 'GK'];
      
      positions.forEach(pos => {
        // Look for pattern like "ST054" or "CF48" etc.
        const pattern = new RegExp(`${pos}(\\d+)`, 'g');
        const matches = bodyText.match(pattern);
        
        if (matches && matches.length > 0) {
          // Take the first match and extract the number
          const match = matches[0];
          const rating = parseInt(match.replace(pos, ''));
          ratings[pos] = rating;
        }
      });
      
      return ratings;
    });
    
    console.log(`Scraped ratings for Vincent Manson:`, positionRatings);
    
    // Expected values based on debug output
    const expected = {
      ST: 54,
      CF: 48,
      RW: 33
    };
    
    console.log('\nExpected values:', expected);
    console.log('Scraped values:', positionRatings);
    
    // Compare
    Object.keys(expected).forEach(pos => {
      const expectedVal = expected[pos];
      const scrapedVal = positionRatings[pos];
      const match = expectedVal === scrapedVal ? '✅' : '❌';
      console.log(`${pos}: Expected=${expectedVal}, Scraped=${scrapedVal} ${match}`);
    });
    
    return positionRatings;
    
  } catch (error) {
    console.error(`Error scraping Vincent Manson:`, error);
    return null;
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('=== Testing Vincent Manson Position Rating Scraping ===');
  await scrapeVincentManson();
}

main().catch(console.error);


