const axios = require('axios');
const cheerio = require('cheerio');

async function httpPositionScraper(playerId) {
  try {
    const url = `https://mflplayer.info/player/${playerId}`;
    console.log(`HTTP scraping for: ${url}`);
    
    // Make HTTP request with headers to mimic a real browser
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'gzip, deflate',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1'
      },
      timeout: 30000
    });
    
    const html = response.data;
    console.log(`Received HTML (${html.length} characters)`);
    
    // Load HTML into cheerio for parsing
    const $ = cheerio.load(html);
    
    // Extract text content
    const bodyText = $('body').text();
    console.log(`Body text length: ${bodyText.length}`);
    
    // Look for position ratings in the text
    const ratings = {};
    const positions = ['ST', 'CF', 'CAM', 'RW', 'LW', 'RM', 'LM', 'CM', 'CDM', 'RWB', 'LWB', 'RB', 'LB', 'CB', 'GK'];
    
    // Method 1: Look for position ratings section
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
    
    // Method 2: Look for position ratings in the entire body text
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
    
    // Method 3: Look for position ratings in specific HTML elements
    if (Object.keys(ratings).length === 0) {
      // Look for tables
      $('table').each((i, table) => {
        const tableText = $(table).text();
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
      
      // Look for lists
      $('ul, ol, dl').each((i, list) => {
        const listText = $(list).text();
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
    
    console.log(`HTTP scraping results for player ${playerId}:`, ratings);
    
    return ratings;
    
  } catch (error) {
    console.error(`Error in HTTP scraping for player ${playerId}:`, error.message);
    return null;
  }
}

async function main() {
  console.log('=== HTTP Position Rating Scraping Test ===');
  
  // Test with Vincent Manson first
  console.log('\n--- Testing Vincent Manson (ID: 4942) ---');
  const vincentResults = await httpPositionScraper(4942);
  
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
    const playerResults = await httpPositionScraper(playerId);
    console.log(`Results:`, playerResults);
  }
}

main().catch(console.error);
