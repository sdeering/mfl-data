const puppeteer = require('puppeteer');

async function precisePositionScraper(playerId) {
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const url = `https://mflplayer.info/player/${playerId}`;
    
    console.log(`Precise scraping for: ${url}`);
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for dynamic content
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Try to click on position ratings toggle
    try {
      await page.click('text=Position Ratings');
      console.log('Clicked on Position Ratings toggle');
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (e) {
      console.log('Could not click Position Ratings toggle');
    }
    
    // Extract position ratings with precise parsing
    const positionRatings = await page.evaluate(() => {
      const bodyText = document.body.textContent;
      
      console.log('Body text length:', bodyText.length);
      
      // Look for the position ratings section
      const positionSection = bodyText.match(/Position RatingsToggle([^]*?)(?=Contract Info|$)/);
      
      if (positionSection) {
        console.log('Found position section:', positionSection[0]);
        
        const ratings = {};
        const positions = ['ST', 'CF', 'CAM', 'RW', 'LW', 'RM', 'LM', 'CM', 'CDM', 'RWB', 'LWB', 'RB', 'LB', 'CB', 'GK'];
        
        // Look for each position in the section
        positions.forEach(pos => {
          // Look for pattern like "ST054" or "CF48" etc.
          const pattern = new RegExp(`${pos}(\\d+)`, 'g');
          const matches = positionSection[0].match(pattern);
          
          if (matches && matches.length > 0) {
            // Take the first match and extract the number
            const match = matches[0];
            const rating = parseInt(match.replace(pos, ''));
            ratings[pos] = rating;
            console.log(`Found ${pos}: ${rating}`);
          }
        });
        
        return ratings;
      }
      
      // Fallback: Look in entire body text
      const ratings = {};
      const positions = ['ST', 'CF', 'CAM', 'RW', 'LW', 'RM', 'LM', 'CM', 'CDM', 'RWB', 'LWB', 'RB', 'LB', 'CB', 'GK'];
      
      positions.forEach(pos => {
        const pattern = new RegExp(`${pos}(\\d+)`, 'g');
        const matches = bodyText.match(pattern);
        
        if (matches && matches.length > 0) {
          const match = matches[0];
          const rating = parseInt(match.replace(pos, ''));
          ratings[pos] = rating;
        }
      });
      
      return ratings;
    });
    
    console.log(`Precise scraping results for player ${playerId}:`, positionRatings);
    
    return positionRatings;
    
  } catch (error) {
    console.error(`Error in precise scraping for player ${playerId}:`, error);
    return null;
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('=== Precise Position Rating Scraping Test ===');
  
  // Test with Vincent Manson
  const results = await precisePositionScraper(4942);
  
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
  
  // Test with 2 more random players
  console.log('\n=== Testing 2 more random players ===');
  
  const testPlayers = [111125, 82036]; // From previous test
  
  for (const playerId of testPlayers) {
    console.log(`\n--- Testing player ID: ${playerId} ---`);
    const playerResults = await precisePositionScraper(playerId);
    console.log(`Results:`, playerResults);
  }
}

main().catch(console.error);
