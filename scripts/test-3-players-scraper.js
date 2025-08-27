const puppeteer = require('puppeteer');
const XLSX = require('xlsx');

async function scrapePositionRatings(page, playerId) {
  try {
    const url = `https://mflplayer.info/player/${playerId}`;
    console.log(`Scraping position ratings for: ${url}`);
    
    // Navigate to the page
    await page.goto(url, { 
      waitUntil: 'networkidle0', 
      timeout: 60000 
    });
    
    // Wait for initial page load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Click the collapsible toggle button to expand position ratings
    try {
      await page.waitForSelector('button[data-slot="collapsible-trigger"]', { timeout: 10000 });
      await page.click('button[data-slot="collapsible-trigger"]');
      console.log('Clicked on collapsible toggle button');
      
      // Wait for the content to expand
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (e) {
      console.log('Could not find or click toggle button:', e.message);
      return null;
    }
    
    // Extract position ratings from the expanded content
    const ratings = await page.evaluate(() => {
      const ratings = {};
      const positions = ['ST', 'CF', 'CAM', 'RW', 'LW', 'RM', 'LM', 'CM', 'CDM', 'RWB', 'LWB', 'RB', 'LB', 'CB', 'GK'];
      
      // Look for position ratings in the expanded content
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
            }
          }
        }
      });
      
      return ratings;
    });
    
    console.log(`Scraped ratings for player ${playerId}:`, ratings);
    return ratings;
    
  } catch (error) {
    console.error(`Error scraping position ratings for player ${playerId}:`, error);
    return null;
  }
}

async function main() {
  console.log('=== Test Scraper: 3 Players ===');
  
  // Load existing data
  const workbook = XLSX.readFile('Data/corrected-player-data.xlsx');
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const players = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`Loaded ${players.length} players from data file`);
  
  // Select 3 random players
  const testPlayers = [];
  for (let i = 0; i < 3; i++) {
    const randomIndex = Math.floor(Math.random() * players.length);
    testPlayers.push(players[randomIndex]);
  }
  
  console.log('\n=== SELECTED TEST PLAYERS ===');
  testPlayers.forEach((player, index) => {
    console.log(`${index + 1}. ${player.name} (ID: ${player.id}) - Primary: ${player.primary}`);
  });
  
  // Launch browser
  const browser = await puppeteer.launch({ 
    headless: false, // Show browser for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Process the 3 test players
    const results = [];
    
    for (let i = 0; i < testPlayers.length; i++) {
      const player = testPlayers[i];
      console.log(`\n--- TESTING PLAYER ${i + 1}/3: ${player.name} (ID: ${player.id}) ---`);
      
      // Show current calculated ratings
      console.log('Current calculated ratings:');
      const positions = ['ST', 'CF', 'CAM', 'RW', 'LW', 'RM', 'LM', 'CM', 'CDM', 'RWB', 'LWB', 'RB', 'LB', 'CB', 'GK'];
      positions.forEach(pos => {
        if (player[pos] !== undefined) {
          console.log(`  ${pos}: ${player[pos]}`);
        }
      });
      
      // Scrape position ratings
      const scrapedRatings = await scrapePositionRatings(page, player.id);
      
      if (scrapedRatings && Object.keys(scrapedRatings).length > 0) {
        console.log('\n✅ SCRAPED RATINGS:');
        Object.keys(scrapedRatings).forEach(pos => {
          const scraped = scrapedRatings[pos];
          const calculated = player[pos];
          const match = scraped === calculated ? '✅' : '❌';
          console.log(`  ${pos}: ${scraped} (calculated: ${calculated}) ${match}`);
        });
        
        results.push({
          player: player.name,
          id: player.id,
          scraped: scrapedRatings,
          calculated: positions.reduce((acc, pos) => {
            if (player[pos] !== undefined) acc[pos] = player[pos];
            return acc;
          }, {})
        });
      } else {
        console.log('\n❌ FAILED TO SCRAPE RATINGS');
        results.push({
          player: player.name,
          id: player.id,
          scraped: null,
          calculated: positions.reduce((acc, pos) => {
            if (player[pos] !== undefined) acc[pos] = player[pos];
            return acc;
          }, {})
        });
      }
      
      // Add delay between requests
      if (i < testPlayers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    // Summary
    console.log('\n=== TEST RESULTS SUMMARY ===');
    results.forEach((result, index) => {
      console.log(`\n${index + 1}. ${result.player} (ID: ${result.id})`);
      if (result.scraped) {
        console.log(`   ✅ Successfully scraped ${Object.keys(result.scraped).length} position ratings`);
        console.log(`   Sample ratings:`, Object.entries(result.scraped).slice(0, 5));
      } else {
        console.log(`   ❌ Failed to scrape position ratings`);
      }
    });
    
    console.log('\n=== VERIFICATION COMPLETE ===');
    console.log('If the scraped ratings look correct, we can proceed with the full scraping.');
    
  } catch (error) {
    console.error('Error in test scraping process:', error);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
