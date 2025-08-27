const puppeteer = require('puppeteer');

async function headlessPositionScraper(playerId) {
  const browser = await puppeteer.launch({ 
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--disable-gpu'
    ]
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    const url = `https://mflplayer.info/player/${playerId}`;
    console.log(`Headless scraping for: ${url}`);
    
    // Navigate and wait for full load
    await page.goto(url, { 
      waitUntil: 'networkidle0', 
      timeout: 60000 
    });
    
    // Wait for dynamic content
    await new Promise(resolve => setTimeout(resolve, 8000));
    
    // Try to expand position ratings if there's a toggle
    try {
      await page.evaluate(() => {
        // Look for any clickable elements that might expand position ratings
        const buttons = document.querySelectorAll('button, [role="button"], .toggle, .expand');
        buttons.forEach(button => {
          const text = button.textContent.toLowerCase();
          if (text.includes('position') || text.includes('rating') || text.includes('toggle')) {
            button.click();
          }
        });
      });
      
      // Wait after clicking
      await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (e) {
      console.log('No expandable elements found');
    }
    
    // Extract position ratings with multiple methods
    const results = await page.evaluate(() => {
      const ratings = {};
      const positions = ['ST', 'CF', 'CAM', 'RW', 'LW', 'RM', 'LM', 'CM', 'CDM', 'RWB', 'LWB', 'RB', 'LB', 'CB', 'GK'];
      
      // Method 1: Look for position ratings in the entire page text
      const bodyText = document.body.textContent;
      console.log('Page text length:', bodyText.length);
      
      // Look for the position ratings section specifically
      const positionSectionMatch = bodyText.match(/Position Ratings[^]*?(?=Contract Info|$)/);
      if (positionSectionMatch) {
        const positionSection = positionSectionMatch[0];
        console.log('Position section found:', positionSection.substring(0, 300));
        
        // Extract ratings from this section
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
      
      // Method 2: Look for position ratings in table format
      if (Object.keys(ratings).length === 0) {
        const tables = document.querySelectorAll('table');
        tables.forEach(table => {
          const tableText = table.textContent;
          if (tableText.includes('Position') || tableText.includes('Rating')) {
            console.log('Found position table:', tableText.substring(0, 200));
            
            positions.forEach(pos => {
              const pattern = new RegExp(`${pos}\\s*:\\s*(\\d+)`, 'gi');
              const matches = tableText.match(pattern);
              if (matches && matches.length > 0) {
                const match = matches[0];
                const rating = parseInt(match.replace(pos, '').replace(/[^\d]/g, ''));
                if (rating > 0 && rating <= 100) {
                  ratings[pos] = rating;
                  console.log(`Found ${pos}: ${rating} in table`);
                }
              }
            });
          }
        });
      }
      
      // Method 3: Look for position ratings in list format
      if (Object.keys(ratings).length === 0) {
        const lists = document.querySelectorAll('ul, ol, dl');
        lists.forEach(list => {
          const listText = list.textContent;
          if (listText.includes('Position') || listText.includes('Rating')) {
            console.log('Found position list:', listText.substring(0, 200));
            
            positions.forEach(pos => {
              const pattern = new RegExp(`${pos}\\s*:\\s*(\\d+)`, 'gi');
              const matches = listText.match(pattern);
              if (matches && matches.length > 0) {
                const match = matches[0];
                const rating = parseInt(match.replace(pos, '').replace(/[^\d]/g, ''));
                if (rating > 0 && rating <= 100) {
                  ratings[pos] = rating;
                  console.log(`Found ${pos}: ${rating} in list`);
                }
              }
            });
          }
        });
      }
      
      // Method 4: Look for position ratings in div containers
      if (Object.keys(ratings).length === 0) {
        const divs = document.querySelectorAll('div');
        divs.forEach(div => {
          const divText = div.textContent;
          if (divText.includes('Position') && divText.includes('Rating') && divText.length < 1000) {
            console.log('Found position div:', divText.substring(0, 200));
            
            positions.forEach(pos => {
              const pattern = new RegExp(`${pos}\\s*:\\s*(\\d+)`, 'gi');
              const matches = divText.match(pattern);
              if (matches && matches.length > 0) {
                const match = matches[0];
                const rating = parseInt(match.replace(pos, '').replace(/[^\d]/g, ''));
                if (rating > 0 && rating <= 100) {
                  ratings[pos] = rating;
                  console.log(`Found ${pos}: ${rating} in div`);
                }
              }
            });
          }
        });
      }
      
      // Method 5: Look for any numbers near position text in the entire page
      if (Object.keys(ratings).length === 0) {
        positions.forEach(pos => {
          const posIndex = bodyText.indexOf(pos);
          if (posIndex !== -1) {
            // Look for numbers in a 100-character window around the position
            const start = Math.max(0, posIndex - 50);
            const end = Math.min(bodyText.length, posIndex + 50);
            const nearbyText = bodyText.substring(start, end);
            
            // Look for patterns like "ST: 54" or "ST 54" in nearby text
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
    
    console.log(`Headless scraping results for player ${playerId}:`, results);
    
    return results;
    
  } catch (error) {
    console.error(`Error in headless scraping for player ${playerId}:`, error);
    return null;
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('=== Headless Position Rating Scraping Test ===');
  
  // Test with Vincent Manson first
  console.log('\n--- Testing Vincent Manson (ID: 4942) ---');
  const vincentResults = await headlessPositionScraper(4942);
  
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
    const playerResults = await headlessPositionScraper(playerId);
    console.log(`Results:`, playerResults);
  }
}

main().catch(console.error);
