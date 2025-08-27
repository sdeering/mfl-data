const puppeteer = require('puppeteer');
const axios = require('axios');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const OWNER_WALLETS = [
  '0xa7942ae65333f69d',
  '0x55e8be2966409ed4'
];

const API_BASE_URL = 'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod';

async function getPlayersFromWallet(walletAddress) {
  try {
    const response = await axios.get(`${API_BASE_URL}/players?ownerWalletAddress=${walletAddress}&limit=1200`);
    return response.data.map(player => player.id);
  } catch (error) {
    console.error(`Error fetching players for wallet ${walletAddress}:`, error);
    return [];
  }
}

async function getPlayerData(playerId) {
  try {
    const response = await axios.get(`${API_BASE_URL}/players/${playerId}`);
    return response.data.player;
  } catch (error) {
    console.error(`Error fetching player data for ID ${playerId}:`, error);
    return null;
  }
}

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
  console.log('=== Final Position Rating Scraper ===');
  
  // Load existing data
  const workbook = XLSX.readFile('Data/corrected-player-data.xlsx');
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const players = XLSX.utils.sheet_to_json(worksheet);
  
  console.log(`Loaded ${players.length} players from data file`);
  
  // Launch browser
  const browser = await puppeteer.launch({ 
    headless: true, // Run headless for production
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    const page = await browser.newPage();
    
    // Set viewport and user agent
    await page.setViewport({ width: 1920, height: 1080 });
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    
    // Process players and update with scraped ratings
    const updatedPlayers = [];
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      console.log(`\n--- Processing player ${i + 1}/${players.length}: ${player.name} (ID: ${player.id}) ---`);
      
      // Scrape position ratings
      const scrapedRatings = await scrapePositionRatings(page, player.id);
      
      if (scrapedRatings && Object.keys(scrapedRatings).length > 0) {
        // Update player with scraped ratings
        const updatedPlayer = { ...player };
        
        // Update position ratings with scraped values
        Object.keys(scrapedRatings).forEach(pos => {
          updatedPlayer[pos] = scrapedRatings[pos];
        });
        
        updatedPlayers.push(updatedPlayer);
        successCount++;
        
        console.log(`✅ Successfully scraped ${Object.keys(scrapedRatings).length} position ratings`);
      } else {
        // Keep original player data if scraping failed
        updatedPlayers.push(player);
        failCount++;
        console.log(`❌ Failed to scrape position ratings`);
      }
      
      // Add delay between requests to be respectful
      if (i < players.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
      
      // Save progress every 50 players
      if ((i + 1) % 50 === 0) {
        console.log(`\n--- Progress: ${i + 1}/${players.length} players processed ---`);
        console.log(`Success: ${successCount}, Failed: ${failCount}`);
        
        // Save progress to file
        const progressWorkbook = XLSX.utils.book_new();
        const progressWorksheet = XLSX.utils.json_to_sheet(updatedPlayers);
        XLSX.utils.book_append_sheet(progressWorkbook, progressWorksheet, 'Players');
        XLSX.writeFile(progressWorkbook, 'Data/scraped-player-data-progress.xlsx');
        console.log('Progress saved to Data/scraped-player-data-progress.xlsx');
      }
    }
    
    // Create final workbook with scraped data
    const finalWorkbook = XLSX.utils.book_new();
    const finalWorksheet = XLSX.utils.json_to_sheet(updatedPlayers);
    XLSX.utils.book_append_sheet(finalWorkbook, finalWorksheet, 'Players');
    XLSX.writeFile(finalWorkbook, 'Data/scraped-player-data.xlsx');
    
    console.log(`\n=== SCRAPING COMPLETE ===`);
    console.log(`Total players processed: ${players.length}`);
    console.log(`Successful scrapes: ${successCount}`);
    console.log(`Failed scrapes: ${failCount}`);
    console.log(`Success rate: ${((successCount / players.length) * 100).toFixed(1)}%`);
    console.log(`Final file saved: Data/scraped-player-data.xlsx`);
    
  } catch (error) {
    console.error('Error in main scraping process:', error);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
