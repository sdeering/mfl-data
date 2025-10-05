const puppeteer = require('puppeteer');

async function advancedPositionScraper(playerId) {
  const browser = await puppeteer.launch({ 
    headless: false, // Show browser for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set a realistic user agent
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    const url = `https://mflplayer.info/player/${playerId}`;
    console.log(`Advanced scraping for: ${url}`);
    
    // Navigate to the page
    await page.goto(url, { 
      waitUntil: 'networkidle0', 
      timeout: 60000 
    });
    
    // Wait for the page to fully load
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Try to find and click any position-related elements
    try {
      // Look for position ratings toggle or expand button
      const toggleSelectors = [
        'button:contains("Position Ratings")',
        '[data-testid*="position"]',
        '.position-ratings',
        '.toggle',
        'button',
        'div[role="button"]'
      ];
      
      for (const selector of toggleSelectors) {
        try {
          await page.waitForSelector(selector, { timeout: 2000 });
          await page.click(selector);
          console.log(`Clicked on selector: ${selector}`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          break;
        } catch (e) {
          // Continue to next selector
        }
      }
    } catch (e) {
      console.log('No toggle elements found');
    }
    
    // Take a screenshot for debugging
    await page.screenshot({ path: `advanced-debug-${playerId}.png`, fullPage: true });
    console.log(`Screenshot saved as advanced-debug-${playerId}.png`);
    
    // Try multiple extraction methods
    const results = await page.evaluate(() => {
      const ratings = {};
      
      // Method 1: Look for position ratings in the DOM structure
      const positions = ['ST', 'CF', 'CAM', 'RW', 'LW', 'RM', 'LM', 'CM', 'CDM', 'RWB', 'LWB', 'RB', 'LB', 'CB', 'GK'];
      
      positions.forEach(pos => {
        // Try multiple selectors for each position
        const selectors = [
          `[data-position="${pos}"]`,
          `[class*="${pos.toLowerCase()}"]`,
          `[class*="${pos}"]`,
          `[id*="${pos.toLowerCase()}"]`,
          `[id*="${pos}"]`,
          `div:contains("${pos}")`,
          `span:contains("${pos}")`,
          `td:contains("${pos}")`
        ];
        
        for (const selector of selectors) {
          try {
            const elements = document.querySelectorAll(selector);
            for (const element of elements) {
              const text = element.textContent.trim();
              const numberMatch = text.match(/\d+/);
              if (numberMatch) {
                const rating = parseInt(numberMatch[0]);
                if (rating > 0 && rating <= 100) {
                  ratings[pos] = rating;
                  console.log(`Found ${pos}: ${rating} using selector: ${selector}`);
                  break;
                }
              }
            }
            if (ratings[pos]) break;
          } catch (e) {
            // Continue to next selector
          }
        }
      });
      
      // Method 2: Look for position ratings in text content with context
      if (Object.keys(ratings).length === 0) {
        const bodyText = document.body.textContent;
        console.log('Body text length:', bodyText.length);
        
        // Look for patterns like "ST: 54" or "ST 54" or "ST54"
        positions.forEach(pos => {
          const patterns = [
            new RegExp(`${pos}\\s*:\\s*(\\d+)`, 'gi'),
            new RegExp(`${pos}\\s+(\\d+)`, 'gi'),
            new RegExp(`${pos}(\\d+)`, 'gi')
          ];
          
          for (const pattern of patterns) {
            const matches = bodyText.match(pattern);
            if (matches && matches.length > 0) {
              const match = matches[0];
              const rating = parseInt(match.replace(pos, '').replace(/[^\d]/g, ''));
              if (rating > 0 && rating <= 100) {
                ratings[pos] = rating;
                console.log(`Found ${pos}: ${rating} using pattern: ${pattern}`);
                break;
              }
            }
          }
        });
      }
      
      // Method 3: Look for position ratings in specific sections
      if (Object.keys(ratings).length === 0) {
        // Look for position ratings section
        const sections = document.querySelectorAll('div, section, article');
        for (const section of sections) {
          const sectionText = section.textContent;
          if (sectionText.includes('Position') && sectionText.includes('Rating')) {
            console.log('Found position ratings section:', sectionText.substring(0, 200));
            
            positions.forEach(pos => {
              const pattern = new RegExp(`${pos}\\s*:\\s*(\\d+)`, 'gi');
              const matches = sectionText.match(pattern);
              if (matches && matches.length > 0) {
                const match = matches[0];
                const rating = parseInt(match.replace(pos, '').replace(/[^\d]/g, ''));
                if (rating > 0 && rating <= 100) {
                  ratings[pos] = rating;
                  console.log(`Found ${pos}: ${rating} in section`);
                }
              }
            });
          }
        }
      }
      
      // Method 4: Look for any numbers near position text
      if (Object.keys(ratings).length === 0) {
        const bodyText = document.body.textContent;
        positions.forEach(pos => {
          const posIndex = bodyText.indexOf(pos);
          if (posIndex !== -1) {
            // Look for numbers in a 50-character window around the position
            const start = Math.max(0, posIndex - 25);
            const end = Math.min(bodyText.length, posIndex + 25);
            const nearbyText = bodyText.substring(start, end);
            
            const numberMatches = nearbyText.match(/\d+/g);
            if (numberMatches) {
              for (const numStr of numberMatches) {
                const num = parseInt(numStr);
                if (num > 0 && num <= 100) {
                  ratings[pos] = num;
                  console.log(`Found ${pos}: ${num} in nearby text`);
                  break;
                }
              }
            }
          }
        });
      }
      
      return ratings;
    });
    
    console.log(`Advanced scraping results for player ${playerId}:`, results);
    
    return results;
    
  } catch (error) {
    console.error(`Error in advanced scraping for player ${playerId}:`, error);
    return null;
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('=== Advanced Position Rating Scraping Test ===');
  
  // Test with Vincent Manson first
  console.log('\n--- Testing Vincent Manson (ID: 4942) ---');
  const vincentResults = await advancedPositionScraper(4942);
  
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
    const playerResults = await advancedPositionScraper(playerId);
    console.log(`Results:`, playerResults);
  }
}

main().catch(console.error);


