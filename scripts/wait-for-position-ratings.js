const puppeteer = require('puppeteer');

async function waitForPositionRatings(playerId) {
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
    console.log(`Waiting for position ratings on: ${url}`);
    
    // Navigate to the page
    await page.goto(url, { 
      waitUntil: 'networkidle0', 
      timeout: 60000 
    });
    
    // Wait for initial page load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Try to find and click position ratings toggle
    try {
      // Look for various toggle elements
      const toggleSelectors = [
        'button:contains("Position Ratings")',
        'div:contains("Position Ratings")',
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
    
    // Wait for dynamic content to load
    console.log('Waiting for dynamic content...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Take a screenshot
    await page.screenshot({ path: `wait-for-ratings-${playerId}.png`, fullPage: true });
    console.log(`Screenshot saved as wait-for-ratings-${playerId}.png`);
    
    // Try to extract position ratings with multiple methods
    const results = await page.evaluate(() => {
      const ratings = {};
      const positions = ['ST', 'CF', 'CAM', 'RW', 'LW', 'RM', 'LM', 'CM', 'CDM', 'RWB', 'LWB', 'RB', 'LB', 'CB', 'GK'];
      
      // Method 1: Look for position ratings in the entire page text
      const bodyText = document.body.textContent;
      console.log('Page text length:', bodyText.length);
      
      // Look for position ratings section
      const positionSectionMatch = bodyText.match(/Position Ratings[^]*?(?=Contract Info|$)/);
      if (positionSectionMatch) {
        const positionSection = positionSectionMatch[0];
        console.log('Position section found:', positionSection.substring(0, 300));
        
        positions.forEach(pos => {
          const pattern = new RegExp(`${pos}\\s*:\\s*(\\d+)`, 'gi');
          const matches = positionSection.match(pattern);
          if (matches && matches.length > 0) {
            const match = matches[0];
            const rating = parseInt(match.replace(pos, '').replace(/[^\d]/g, ''));
            if (rating > 0 && rating <= 100) {
              ratings[pos] = rating;
              console.log(`Found ${pos}: ${rating} in position section`);
            }
          }
        });
      }
      
      // Method 2: Look for position ratings in DOM elements
      if (Object.keys(ratings).length === 0) {
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
      }
      
      // Method 3: Look for position ratings in the entire body text
      if (Object.keys(ratings).length === 0) {
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
      
      // Method 4: Look for any numbers near position text
      if (Object.keys(ratings).length === 0) {
        positions.forEach(pos => {
          const posIndex = bodyText.indexOf(pos);
          if (posIndex !== -1) {
            // Look for numbers in a 100-character window around the position
            const start = Math.max(0, posIndex - 50);
            const end = Math.min(bodyText.length, posIndex + 50);
            const nearbyText = bodyText.substring(start, end);
            
            const patterns = [
              new RegExp(`${pos}\\s*:\\s*(\\d+)`, 'gi'),
              new RegExp(`${pos}\\s+(\\d+)`, 'gi'),
              new RegExp(`${pos}(\\d+)`, 'gi')
            ];
            
            for (const pattern of patterns) {
              const matches = nearbyText.match(pattern);
              if (matches && matches.length > 0) {
                const match = matches[0];
                const rating = parseInt(match.replace(pos, '').replace(/[^\d]/g, ''));
                if (rating > 0 && rating <= 100) {
                  ratings[pos] = rating;
                  console.log(`Found ${pos}: ${rating} in nearby text`);
                  break;
                }
              }
            }
          }
        });
      }
      
      return ratings;
    });
    
    console.log(`Position ratings for player ${playerId}:`, results);
    
    return results;
    
  } catch (error) {
    console.error(`Error waiting for position ratings for player ${playerId}:`, error);
    return null;
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('=== Wait for Position Ratings Test ===');
  
  // Test with Vincent Manson first
  console.log('\n--- Testing Vincent Manson (ID: 4942) ---');
  const vincentResults = await waitForPositionRatings(4942);
  
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
  
  // Test with one more player
  console.log('\n--- Testing Player ID: 111125 ---');
  const playerResults = await waitForPositionRatings(111125);
  console.log(`Results:`, playerResults);
}

main().catch(console.error);
