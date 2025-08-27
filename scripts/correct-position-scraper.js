const puppeteer = require('puppeteer');

async function correctPositionScraper(playerId) {
  const browser = await puppeteer.launch({ 
    headless: false, // Show browser for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    const url = `https://mflplayer.info/player/${playerId}`;
    console.log(`Correct scraping for: ${url}`);
    
    // Navigate to the page
    await page.goto(url, { 
      waitUntil: 'networkidle0', 
      timeout: 60000 
    });
    
    // Wait for initial page load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Click the collapsible toggle button to expand position ratings
    try {
      // Wait for the toggle button to be present
      await page.waitForSelector('button[data-slot="collapsible-trigger"]', { timeout: 10000 });
      
      // Click the toggle button
      await page.click('button[data-slot="collapsible-trigger"]');
      console.log('Clicked on collapsible toggle button');
      
      // Wait for the content to expand
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (e) {
      console.log('Could not find or click toggle button:', e.message);
    }
    
    // Take a screenshot after expanding
    await page.screenshot({ path: `correct-scraper-${playerId}.png`, fullPage: true });
    console.log(`Screenshot saved as correct-scraper-${playerId}.png`);
    
    // Extract position ratings from the expanded content
    const results = await page.evaluate(() => {
      const ratings = {};
      const positions = ['ST', 'CF', 'CAM', 'RW', 'LW', 'RM', 'LM', 'CM', 'CDM', 'RWB', 'LWB', 'RB', 'LB', 'CB', 'GK'];
      
      // Look for position ratings in the expanded content
      // Each position is in a div with class "grid grid-cols-2 py-1.5 pr-3 pl-4"
      const positionDivs = document.querySelectorAll('div.grid.grid-cols-2.py-1\\.5.pr-3.pl-4');
      
      positionDivs.forEach(div => {
        // Get the position name (first span with text-sm class)
        const positionSpan = div.querySelector('span.text-sm');
        if (positionSpan) {
          const position = positionSpan.textContent.trim();
          
          // Get the rating (div with size-8 class)
          const ratingDiv = div.querySelector('div.size-8');
          if (ratingDiv && positions.includes(position)) {
            const rating = parseInt(ratingDiv.textContent.trim());
            if (rating > 0 && rating <= 100) {
              ratings[position] = rating;
              console.log(`Found ${position}: ${rating}`);
            }
          }
        }
      });
      
      // If we didn't find ratings in the expanded content, try alternative selectors
      if (Object.keys(ratings).length === 0) {
        console.log('No ratings found in expanded content, trying alternative selectors...');
        
        // Look for any div with position name and rating
        positions.forEach(pos => {
          // Look for the position name
          const positionElements = document.querySelectorAll('span.text-sm');
          positionElements.forEach(element => {
            if (element.textContent.trim() === pos) {
              // Find the rating in the same row
              const parentDiv = element.closest('div.grid.grid-cols-2');
              if (parentDiv) {
                const ratingElements = parentDiv.querySelectorAll('div');
                ratingElements.forEach(ratingDiv => {
                  const text = ratingDiv.textContent.trim();
                  const rating = parseInt(text);
                  if (rating > 0 && rating <= 100) {
                    ratings[pos] = rating;
                    console.log(`Found ${pos}: ${rating} using alternative method`);
                  }
                });
              }
            }
          });
        });
      }
      
      return ratings;
    });
    
    console.log(`Correct scraping results for player ${playerId}:`, results);
    
    return results;
    
  } catch (error) {
    console.error(`Error in correct scraping for player ${playerId}:`, error);
    return null;
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('=== Correct Position Rating Scraping Test ===');
  
  // Test with Vincent Manson first
  console.log('\n--- Testing Vincent Manson (ID: 4942) ---');
  const vincentResults = await correctPositionScraper(4942);
  
  console.log('\nVincent Manson results:', vincentResults);
  
  // Expected values based on your feedback
  const expected = {
    ST: 54,
    CF: 48,
    RW: 33
  };
  
  console.log('\nExpected values:', expected);
  
  if (vincentResults) {
    Object.keys(expected).forEach(pos => {
      const expectedVal = expected[pos];
      const scrapedVal = vincentResults[pos];
      const match = expectedVal === scrapedVal ? '✅' : '❌';
      console.log(`${pos}: Expected=${expectedVal}, Scraped=${scrapedVal} ${match}`);
    });
  }
  
  // Test with 2 more players
  const testPlayers = [111125, 82036];
  
  for (const playerId of testPlayers) {
    console.log(`\n--- Testing player ID: ${playerId} ---`);
    const playerResults = await correctPositionScraper(playerId);
    console.log(`Results:`, playerResults);
  }
}

main().catch(console.error);
