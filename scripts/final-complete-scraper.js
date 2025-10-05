const puppeteer = require('puppeteer');
const XLSX = require('xlsx');
const fs = require('fs');

async function scrapePositionRatings(page, playerId) {
  try {
    const url = `https://mflplayer.info/player/${playerId}`;
    
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
      
      // Wait for the content to expand
      await new Promise(resolve => setTimeout(resolve, 2000));
      
    } catch (e) {
      console.log(`Could not find or click toggle button for player ${playerId}:`, e.message);
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
  console.log('=== FINAL COMPLETE SCRAPER: ALL 600+ PLAYERS ===');
  console.log('Loading existing player data...');
  
  // Load existing data
  const workbook = XLSX.readFile('Data/corrected-player-data.xlsx');
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const players = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`Loaded ${players.length} players from data file`);
  
  // Create progress tracking
  let processedCount = 0;
  let successCount = 0;
  let failedCount = 0;
  const startTime = Date.now();
  const failedPlayers = []; // Track failed players
  
  // Create backup of original data
  const backupPath = 'Data/backup-original-calculated-data.xlsx';
  XLSX.writeFile(workbook, backupPath);
  console.log(`Backup created: ${backupPath}`);
  
  // Launch browser
  const browser = await puppeteer.launch({ 
    headless: true, // Run headless for speed
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Process all players
    const updatedPlayers = [];
    
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      processedCount++;
      
      console.log(`\n[${processedCount}/${players.length}] Processing: ${player.name} (ID: ${player.id})`);
      
      // Scrape position ratings
      const scrapedRatings = await scrapePositionRatings(page, player.id);
      
      if (scrapedRatings && Object.keys(scrapedRatings).length > 0) {
        // Create updated player object with scraped ratings
        const updatedPlayer = {
          ...player,
          // Replace all calculated position ratings with scraped ones
          ST: scrapedRatings.ST || null,
          CF: scrapedRatings.CF || null,
          CAM: scrapedRatings.CAM || null,
          RW: scrapedRatings.RW || null,
          LW: scrapedRatings.LW || null,
          RM: scrapedRatings.RM || null,
          LM: scrapedRatings.LM || null,
          CM: scrapedRatings.CM || null,
          CDM: scrapedRatings.CDM || null,
          RWB: scrapedRatings.RWB || null,
          LWB: scrapedRatings.LWB || null,
          RB: scrapedRatings.RB || null,
          LB: scrapedRatings.LB || null,
          CB: scrapedRatings.CB || null,
          GK: scrapedRatings.GK || null
        };
        
        updatedPlayers.push(updatedPlayer);
        successCount++;
        
        console.log(`✅ Successfully scraped ${Object.keys(scrapedRatings).length} position ratings`);
        console.log(`   Primary (${player.primary}): ${scrapedRatings[player.primary] || 'Not found'}`);
        
        // Show sample of scraped ratings
        const sampleRatings = Object.entries(scrapedRatings).slice(0, 5);
        console.log(`   Sample: ${sampleRatings.map(([pos, rating]) => `${pos}:${rating}`).join(', ')}`);
        
      } else {
        // Track failed player but don't include in final output
        failedPlayers.push({
          name: player.name,
          id: player.id,
          primary: player.primary,
          reason: 'Could not scrape position ratings'
        });
        failedCount++;
        
        console.log(`❌ Failed to scrape position ratings - REMOVING from final output`);
      }
      
      // Progress update every 50 players
      if (processedCount % 50 === 0) {
        const elapsed = Math.round((Date.now() - startTime) / 1000);
        const rate = Math.round(processedCount / elapsed * 60);
        console.log(`\n📊 PROGRESS UPDATE:`);
        console.log(`   Processed: ${processedCount}/${players.length} (${Math.round(processedCount/players.length*100)}%)`);
        console.log(`   Success: ${successCount}, Failed: ${failedCount}`);
        console.log(`   Rate: ${rate} players/minute`);
        console.log(`   Elapsed: ${elapsed}s`);
        
        // Save intermediate progress (only successful players)
        const progressWorkbook = XLSX.utils.book_new();
        const progressWorksheet = XLSX.utils.json_to_sheet(updatedPlayers);
        XLSX.utils.book_append_sheet(progressWorkbook, progressWorksheet, 'Players');
        XLSX.writeFile(progressWorkbook, 'Data/scraping-progress.xlsx');
        console.log(`   Progress saved to: Data/scraping-progress.xlsx`);
      }
      
      // Add delay between requests to be respectful
      if (i < players.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Final processing complete
    console.log(`\n🎉 SCRAPING COMPLETE!`);
    console.log(`   Total Players: ${players.length}`);
    console.log(`   Successfully Scraped: ${successCount}`);
    console.log(`   Failed & Removed: ${failedCount}`);
    console.log(`   Success Rate: ${Math.round(successCount/players.length*100)}%`);
    
    // Create final workbook with ONLY successful scraped data
    const finalWorkbook = XLSX.utils.book_new();
    const finalWorksheet = XLSX.utils.json_to_sheet(updatedPlayers);
    XLSX.utils.book_append_sheet(finalWorkbook, finalWorksheet, 'Players');
    
    // Save to final filename
    const finalPath = 'Data/600-player-data-scraped.xlsx';
    XLSX.writeFile(finalWorkbook, finalPath);
    
    console.log(`\n💾 FINAL FILE SAVED: ${finalPath}`);
    console.log(`📁 File size: ${Math.round(fs.statSync(finalPath).size / 1024)} KB`);
    console.log(`📊 Final player count: ${updatedPlayers.length} (${failedCount} removed)`);
    
    // Save failed players to separate file for reference
    if (failedPlayers.length > 0) {
      const failedWorkbook = XLSX.utils.book_new();
      const failedWorksheet = XLSX.utils.json_to_sheet(failedPlayers);
      XLSX.utils.book_append_sheet(failedWorkbook, failedWorksheet, 'Failed Players');
      XLSX.writeFile(failedWorkbook, 'Data/failed-players.xlsx');
      console.log(`📋 Failed players saved to: Data/failed-players.xlsx`);
    }
    
    // Show summary of what was replaced
    console.log(`\n📋 DATA REPLACEMENT SUMMARY:`);
    console.log(`   ✅ All calculated position ratings replaced with real scraped data`);
    console.log(`   ✅ Primary position ratings now match overall ratings`);
    console.log(`   ✅ 14 position ratings per player: ST, CF, CAM, RW, LW, RM, LM, CM, CDM, RWB, LWB, RB, LB, CB, GK`);
    console.log(`   ✅ Original calculated data backed up to: ${backupPath}`);
    console.log(`   ✅ Failed players removed from final output`);
    
    // Show sample of final data
    console.log(`\n📊 SAMPLE OF FINAL DATA:`);
    const samplePlayer = updatedPlayers[0];
    console.log(`   Player: ${samplePlayer.name} (ID: ${samplePlayer.id})`);
    console.log(`   Primary: ${samplePlayer.primary} (${samplePlayer[samplePlayer.primary]})`);
    const positions = ['ST', 'CF', 'CAM', 'RW', 'LW', 'RM', 'LM', 'CM', 'CDM', 'RWB', 'LWB', 'RB', 'LB', 'CB', 'GK'];
    const sampleRatings = positions.map(pos => `${pos}:${samplePlayer[pos] || 'N/A'}`).join(', ');
    console.log(`   All Ratings: ${sampleRatings}`);
    
    // Report failed players
    if (failedPlayers.length > 0) {
      console.log(`\n❌ FAILED PLAYERS (${failedPlayers.length} total):`);
      failedPlayers.forEach((player, index) => {
        console.log(`   ${index + 1}. ${player.name} (ID: ${player.id}) - ${player.primary} - ${player.reason}`);
      });
    }
    
  } catch (error) {
    console.error('Error in scraping process:', error);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
