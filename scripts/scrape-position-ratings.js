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

async function scrapePositionRatings(playerId) {
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const url = `https://mflplayer.info/player/${playerId}`;
    
    console.log(`Scraping position ratings from: ${url}`);
    
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for the page to load
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Extract position ratings from page content
    const positionRatings = await page.evaluate(() => {
      const bodyText = document.body.textContent;
      
      // Look for the position ratings section
      const positionRatingsMatch = bodyText.match(/Position RatingsToggle([A-Z]+)(\d+)([A-Z]+)(\d+)([A-Z]+)(\d+)/);
      
      if (positionRatingsMatch) {
        console.log('Found position ratings section:', positionRatingsMatch[0]);
        
        const ratings = {};
        const positions = ['ST', 'CF', 'CAM', 'RW', 'LW', 'RM', 'LM', 'CM', 'CDM', 'RWB', 'LWB', 'RB', 'LB', 'CB', 'GK'];
        
        // Extract ratings from the match
        for (let i = 1; i < positionRatingsMatch.length; i += 2) {
          const position = positionRatingsMatch[i];
          const rating = parseInt(positionRatingsMatch[i + 1]);
          
          if (positions.includes(position)) {
            ratings[position] = rating;
          }
        }
        
        return ratings;
      }
      
      // Alternative: Look for individual position patterns
      const ratings = {};
      const positions = ['ST', 'CF', 'CAM', 'RW', 'LW', 'RM', 'LM', 'CM', 'CDM', 'RWB', 'LWB', 'RB', 'LB', 'CB', 'GK'];
      
      positions.forEach(pos => {
        // Look for pattern like "ST054" or "CF48" etc.
        const pattern = new RegExp(`${pos}(\\d+)`, 'g');
        const matches = bodyText.match(pattern);
        
        if (matches && matches.length > 0) {
          // Take the first match and extract the number
          const match = matches[0];
          const rating = parseInt(match.replace(pos, ''));
          ratings[pos] = rating;
        }
      });
      
      return ratings;
    });
    
    console.log(`Scraped ratings for player ${playerId}:`, positionRatings);
    
    return positionRatings;
    
  } catch (error) {
    console.error(`Error scraping position ratings for player ${playerId}:`, error);
    return null;
  } finally {
    await browser.close();
  }
}

async function main() {
  console.log('Starting position rating scraper...');
  
  // Load the corrected data file to get 3 random players
  try {
    const workbook = XLSX.readFile('Data/corrected-player-data.xlsx');
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const players = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`Loaded ${players.length} players from corrected data file`);
    
    // Select 3 random players
    const randomPlayers = [];
    for (let i = 0; i < 3; i++) {
      const randomIndex = Math.floor(Math.random() * players.length);
      randomPlayers.push(players[randomIndex]);
    }
    
    console.log('\n=== Testing with 3 random players ===');
    
    for (const player of randomPlayers) {
      console.log(`\n--- Player: ${player.name} (ID: ${player.id}) ---`);
      console.log(`Current calculated ratings from file:`);
      console.log(`  ST: ${player.ST}, CF: ${player.CF}, CAM: ${player.CAM}, RW: ${player.RW}, LW: ${player.LW}`);
      console.log(`  RM: ${player.RM}, LM: ${player.LM}, CM: ${player.CM}, CDM: ${player.CDM}, RWB: ${player.RWB}`);
      console.log(`  LWB: ${player.LWB}, RB: ${player.RB}, LB: ${player.LB}, CB: ${player.CB}, GK: ${player.GK}`);
      
      const scrapedRatings = await scrapePositionRatings(player.id);
      
      if (scrapedRatings && Object.keys(scrapedRatings).length > 0) {
        console.log(`✅ Successfully scraped position ratings:`, scrapedRatings);
        
        // Compare with calculated values
        console.log(`\nComparison:`);
        Object.keys(scrapedRatings).forEach(pos => {
          const scraped = scrapedRatings[pos];
          const calculated = player[pos];
          const match = scraped === calculated ? '✅' : '❌';
          console.log(`  ${pos}: Scraped=${scraped}, Calculated=${calculated} ${match}`);
        });
      } else {
        console.log(`❌ Failed to scrape position ratings or no ratings found`);
      }
      
      // Add delay between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
  } catch (error) {
    console.error('Error loading data file:', error);
  }
}

main().catch(console.error);
