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
    
    return ratings;
    
  } catch (error) {
    console.error(`Error scraping position ratings for player ${playerId}:`, error);
    return null;
  }
}

async function main() {
  console.log('=== FULL PLAYER DETAILS FOR VERIFICATION ===');
  
  // Load existing data
  const workbook = XLSX.readFile('Data/corrected-player-data.xlsx');
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const players = XLSX.utils.sheet_to_json(worksheet);
  
  // Select one test player (Javier Guzman from previous test)
  let testPlayer = players.find(p => p.id === 73280); // Javier Guzman
  
  if (!testPlayer) {
    console.log('Test player not found, selecting random player...');
    const randomIndex = Math.floor(Math.random() * players.length);
    testPlayer = players[randomIndex];
  }
  
  console.log(`\n=== SELECTED PLAYER: ${testPlayer.name} ===`);
  console.log(`ID: ${testPlayer.id}`);
  console.log(`Primary Position: ${testPlayer.primary}`);
  console.log(`Secondary Positions: ${testPlayer.secondary}`);
  console.log(`Input URL: ${testPlayer.inputUrl}`);
  
  // Show current calculated ratings
  console.log('\n=== CURRENT CALCULATED RATINGS ===');
  const positions = ['ST', 'CF', 'CAM', 'RW', 'LW', 'RM', 'LM', 'CM', 'CDM', 'RWB', 'LWB', 'RB', 'LB', 'CB', 'GK'];
  positions.forEach(pos => {
    if (testPlayer[pos] !== undefined) {
      console.log(`${pos}: ${testPlayer[pos]}`);
    }
  });
  
  // Launch browser and scrape real ratings
  const browser = await puppeteer.launch({ 
    headless: false, // Show browser for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Scrape position ratings
    const scrapedRatings = await scrapePositionRatings(page, testPlayer.id);
    
    if (scrapedRatings && Object.keys(scrapedRatings).length > 0) {
      console.log('\n=== SCRAPED POSITION RATINGS ===');
      Object.keys(scrapedRatings).forEach(pos => {
        console.log(`${pos}: ${scrapedRatings[pos]}`);
      });
      
      console.log('\n=== COMPARISON: CALCULATED vs SCRAPED ===');
      console.log('Position | Calculated | Scraped | Difference | Match');
      console.log('---------|------------|---------|------------|------');
      
      Object.keys(scrapedRatings).forEach(pos => {
        const calculated = testPlayer[pos] || 'N/A';
        const scraped = scrapedRatings[pos];
        const difference = calculated !== 'N/A' ? scraped - calculated : 'N/A';
        const match = calculated === scraped ? '✅' : '❌';
        console.log(`${pos.padEnd(8)} | ${String(calculated).padEnd(10)} | ${String(scraped).padEnd(7)} | ${String(difference).padEnd(10)} | ${match}`);
      });
      
      console.log('\n=== VERIFICATION SUMMARY ===');
      console.log(`Player: ${testPlayer.name} (ID: ${testPlayer.id})`);
      console.log(`Primary Position: ${testPlayer.primary}`);
      console.log(`Primary Position Rating: ${scrapedRatings[testPlayer.primary] || 'Not found'}`);
      console.log(`Total Positions Scraped: ${Object.keys(scrapedRatings).length}`);
      console.log(`Positions Found: ${Object.keys(scrapedRatings).join(', ')}`);
      
      // Check if primary position matches overall rating
      const primaryRating = scrapedRatings[testPlayer.primary];
      if (primaryRating) {
        console.log(`\nPrimary Position Rule Check:`);
        console.log(`Primary Position (${testPlayer.primary}): ${primaryRating}`);
        console.log(`Overall Rating: ${testPlayer.overall || 'Not available'}`);
        console.log(`Rule Match: ${primaryRating === (testPlayer.overall || primaryRating) ? '✅ YES' : '❌ NO'}`);
      }
      
    } else {
      console.log('\n❌ FAILED TO SCRAPE POSITION RATINGS');
    }
    
  } catch (error) {
    console.error('Error in verification process:', error);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
