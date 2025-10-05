import * as puppeteer from 'puppeteer';
import axios from 'axios';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

interface PlayerData {
  name: string;
  id: number;
  inputUrl: string;
  inputData: string;
  primary: string;
  secondary: string;
  ST: number;
  CF: number;
  CAM: number;
  RW: number;
  LW: number;
  RM: number;
  LM: number;
  CM: number;
  CDM: number;
  RWB: number;
  LWB: number;
  RB: number;
  LB: number;
  CB: number;
  GK: number;
}

interface ApiPlayer {
  id: number;
  metadata: {
    id: number;
    firstName: string;
    lastName: string;
    overall: number;
    nationalities: string[];
    positions: string[];
    preferredFoot: string;
    age: number;
    height: number;
    pace: number;
    shooting: number;
    passing: number;
    dribbling: number;
    defense: number;
    physical: number;
    goalkeeping: number;
  };
  ownedBy: {
    walletAddress: string;
    name: string;
    twitter: string | null;
    lastActive: number;
  };
  ownedSince: number;
  hasPreContract: boolean;
  energy: number;
  offerStatus: number;
  nbSeasonYellows: number;
}

const OWNER_WALLETS = [
  '0xa7942ae65333f69d',
  '0x55e8be2966409ed4'
];

const API_BASE_URL = 'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod';
const MFL_PLAYER_BASE_URL = 'https://mflplayer.info/player';

// Sample data you provided
const SAMPLE_DATA: PlayerData[] = [
  {
    name: "Max Pasquier",
    id: 116267,
    inputUrl: "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/116267",
    inputData: '{"player":{"id":116267,"metadata":{"id":116267,"firstName":"Max","lastName":"Pasquier","overall":82,"nationalities":["FRANCE"],"positions":["LB"],"preferredFoot":"LEFT","age":27,"height":182,"pace":84,"shooting":32,"passing":77,"dribbling":74,"defense":87,"physical":83,"goalkeeping":0},"ownedBy":{"walletAddress":"0x95dc70d7d39f6f76","name":"DogeSports HQ","twitter":"dogesports69","lastActive":1},"ownedSince":1745334407000,"hasPreContract":false,"energy":10000,"offerStatus":1,"nbSeasonYellows":0}}',
    primary: "LB",
    secondary: "",
    ST: 36, CF: 46, CAM: 47, RW: 46, LW: 46, RM: 52, LM: 64, CM: 52, CDM: 61, RWB: 62, LWB: 77, RB: 74, LB: 82, CB: 76, GK: -20
  },
  {
    name: "Jan Kessler",
    id: 52088,
    inputUrl: "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/52088",
    inputData: '{"player":{"id":52088,"metadata":{"id":52087,"firstName":"Jan","lastName":"Kessler","overall":64,"nationalities":["GERMANY"],"positions":["RM","ST"],"preferredFoot":"RIGHT","age":30,"height":189,"pace":80,"shooting":66,"passing":59,"dribbling":75,"defense":48,"physical":68,"goalkeeping":0},"ownedBy":{"walletAddress":"0x95dc70d7d39f6f76","name":"DogeSports HQ","twitter":"dogesports69","lastActive":1},"ownedSince":1744652440000,"hasPreContract":false,"energy":10000,"offerStatus":1,"nbSeasonYellows":0}}',
    primary: "RM",
    secondary: "ST",
    ST: 68, CF: 50, CAM: 48, RW: 65, LW: 50, RM: 64, LM: 56, CM: 56, CDM: 39, RWB: 52, LWB: 40, RB: 52, LB: 40, CB: 36, GK: -20
  },
  {
    name: "Fabrice Vallet",
    id: 39651,
    inputUrl: "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/39651",
    inputData: '{"player":{"id":39651,"metadata":{"id":39663,"firstName":"Fabrice","lastName":"Vallet","overall":78,"nationalities":["FRANCE"],"positions":["RWB","RM","CM"],"preferredFoot":"RIGHT","age":27,"height":185,"pace":76,"shooting":61,"passing":83,"dribbling":75,"defense":78,"physical":71,"goalkeeping":0},"ownedBy":{"walletAddress":"0x95dc70d7d39f6f76","name":"DogeSports HQ","twitter":"dogesports69","lastActive":1},"ownedSince":1744947243000,"hasPreContract":false,"energy":10000,"offerStatus":1,"nbSeasonYellows":0}}',
    primary: "RWB",
    secondary: "RM, CM",
    ST: 49, CF: 54, CAM: 55, RW: 66, LW: 54, RM: 76, LM: 57, CM: 76, CDM: 58, RWB: 78, LWB: 70, RB: 73, LB: 58, CB: 57, GK: -20
  },
  {
    name: "Eric Hodge",
    id: 93886,
    inputUrl: "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/93886",
    inputData: '{"player":{"id":93886,"metadata":{"id":93886,"firstName":"Eric","lastName":"Hodge","overall":84,"nationalities":["AUSTRALIA"],"positions":["CAM","ST"],"preferredFoot":"RIGHT","age":27,"height":177,"pace":73,"shooting":81,"passing":87,"dribbling":84,"defense":30,"physical":53,"goalkeeping":0},"ownedBy":{"walletAddress":"0x95dc70d7d39f6f76","name":"DogeSports HQ","twitter":"dogesports69","lastActive":1},"ownedSince":1745446840000,"hasPreContract":false,"energy":10000,"offerStatus":1,"nbSeasonYellows":0}}',
    primary: "CAM",
    secondary: "ST",
    ST: 79, CF: 78, CAM: 84, RW: 63, LW: 63, RM: 58, LM: 58, CM: 73, CDM: 51, RWB: 37, LWB: 37, RB: 37, LB: 37, CB: 23, GK: -20
  },
  {
    name: "Noel Birch",
    id: 45981,
    inputUrl: "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/45981",
    inputData: '{"player":{"id":45981,"metadata":{"id":45981,"firstName":"Noel","lastName":"Birch","overall":76,"nationalities":["ENGLAND"],"positions":["ST"],"preferredFoot":"RIGHT","age":32,"height":187,"pace":82,"shooting":80,"passing":72,"dribbling":70,"defense":34,"physical":61,"goalkeeping":0,"retirementYears":3},"ownedBy":{"walletAddress":"0x95dc70d7d39f6f76","name":"DogeSports HQ","twitter":"dogesports69","lastActive":1},"ownedSince":1744708276000,"hasPreContract":false,"energy":10000,"offerStatus":1,"nbSeasonYellows":0}}',
    primary: "ST",
    secondary: "",
    ST: 76, CF: 69, CAM: 54, RW: 54, LW: 54, RM: 48, LM: 48, CM: 48, CDM: 35, RWB: 35, LWB: 35, RB: 35, LB: 35, CB: 26, GK: -20
  }
];

async function getPlayersFromWallet(walletAddress: string): Promise<number[]> {
  try {
    const response = await axios.get(`${API_BASE_URL}/players?ownerWalletAddress=${walletAddress}&limit=1200`);
    return response.data.map((player: any) => player.id);
  } catch (error) {
    console.error(`Error fetching players for wallet ${walletAddress}:`, error);
    return [];
  }
}

async function getPlayerData(playerId: number): Promise<ApiPlayer | null> {
  try {
    const response = await axios.get(`${API_BASE_URL}/players/${playerId}`);
    return response.data.player;
  } catch (error) {
    console.error(`Error fetching player data for ID ${playerId}:`, error);
    return null;
  }
}

async function scrapePositionRatings(playerId: number, browser: puppeteer.Browser): Promise<Record<string, number>> {
  const page = await browser.newPage();
  
  try {
    await page.goto(`${MFL_PLAYER_BASE_URL}/${playerId}`, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for the page to load
    await page.waitForSelector('body', { timeout: 10000 });
    
    // Take a screenshot for debugging
    await page.screenshot({ path: `debug-${playerId}.png` });
    
    // Extract position ratings from the page
    const ratings = await page.evaluate((): Record<string, number> => {
      const positionRatings: Record<string, number> = {
        ST: -20, CF: -20, CAM: -20, RW: -20, LW: -20, RM: -20, LM: -20, CM: -20, CDM: -20, RWB: -20, LWB: -20, RB: -20, LB: -20, CB: -20, GK: -20
      };
      
      // Look for position ratings in the page content
      const text = document.body.innerText;
      console.log('Page text:', text);
      
      // Try to find position ratings using various patterns
      const patterns = [
        /ST[:\s]*(\d+)/i,
        /CF[:\s]*(\d+)/i,
        /CAM[:\s]*(\d+)/i,
        /RW[:\s]*(\d+)/i,
        /LW[:\s]*(\d+)/i,
        /RM[:\s]*(\d+)/i,
        /LM[:\s]*(\d+)/i,
        /CM[:\s]*(\d+)/i,
        /CDM[:\s]*(\d+)/i,
        /RWB[:\s]*(\d+)/i,
        /LWB[:\s]*(\d+)/i,
        /RB[:\s]*(\d+)/i,
        /LB[:\s]*(\d+)/i,
        /CB[:\s]*(\d+)/i,
        /GK[:\s]*(\d+)/i
      ];
      
      patterns.forEach((pattern, index) => {
        const match = text.match(pattern);
        if (match) {
          const position = Object.keys(positionRatings)[index];
          positionRatings[position] = parseInt(match[1], 10);
        }
      });
      
      return positionRatings;
    });
    
    return ratings;
  } catch (error) {
    console.error(`Error scraping position ratings for player ${playerId}:`, error);
    // Return default ratings if scraping fails
    return {
      ST: -20, CF: -20, CAM: -20, RW: -20, LW: -20, RM: -20, LM: -20, CM: -20, CDM: -20, RWB: -20, LWB: -20, RB: -20, LB: -20, CB: -20, GK: -20
    };
  } finally {
    await page.close();
  }
}

function calculatePositionRatings(player: ApiPlayer): Record<string, number> {
  const { pace, shooting, passing, dribbling, defense, physical, goalkeeping } = player.metadata;
  
  // Calculate position ratings based on player attributes
  const ratings: Record<string, number> = {
    ST: Math.round((shooting * 0.4 + pace * 0.3 + physical * 0.2 + dribbling * 0.1) * 0.8),
    CF: Math.round((shooting * 0.35 + passing * 0.25 + pace * 0.2 + dribbling * 0.2) * 0.8),
    CAM: Math.round((passing * 0.4 + dribbling * 0.3 + shooting * 0.2 + pace * 0.1) * 0.8),
    RW: Math.round((pace * 0.4 + dribbling * 0.3 + passing * 0.2 + shooting * 0.1) * 0.8),
    LW: Math.round((pace * 0.4 + dribbling * 0.3 + passing * 0.2 + shooting * 0.1) * 0.8),
    RM: Math.round((pace * 0.35 + passing * 0.3 + dribbling * 0.25 + defense * 0.1) * 0.8),
    LM: Math.round((pace * 0.35 + passing * 0.3 + dribbling * 0.25 + defense * 0.1) * 0.8),
    CM: Math.round((passing * 0.35 + dribbling * 0.25 + defense * 0.25 + pace * 0.15) * 0.8),
    CDM: Math.round((defense * 0.4 + passing * 0.3 + physical * 0.2 + pace * 0.1) * 0.8),
    RWB: Math.round((pace * 0.35 + defense * 0.3 + passing * 0.25 + dribbling * 0.1) * 0.8),
    LWB: Math.round((pace * 0.35 + defense * 0.3 + passing * 0.25 + dribbling * 0.1) * 0.8),
    RB: Math.round((defense * 0.4 + pace * 0.3 + passing * 0.2 + physical * 0.1) * 0.8),
    LB: Math.round((defense * 0.4 + pace * 0.3 + passing * 0.2 + physical * 0.1) * 0.8),
    CB: Math.round((defense * 0.5 + physical * 0.3 + passing * 0.15 + pace * 0.05) * 0.8),
    GK: goalkeeping
  };
  
  return ratings;
}

async function main() {
  console.log('Starting player data scraping...');
  
  // Start with sample data
  let playersData: PlayerData[] = [...SAMPLE_DATA];
  
  // Launch browser for web scraping
  const browser = await puppeteer.launch({ 
    headless: false, // Set to false for debugging
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  try {
    // Get all player IDs from both wallets
    const allPlayerIds: number[] = [];
    for (const wallet of OWNER_WALLETS) {
      const playerIds = await getPlayersFromWallet(wallet);
      allPlayerIds.push(...playerIds);
      console.log(`Found ${playerIds.length} players for wallet ${wallet}`);
    }
    
    // Remove duplicates and filter out already processed players
    const uniquePlayerIds = [...new Set(allPlayerIds)];
    const processedIds = new Set(playersData.map(p => p.id));
    const newPlayerIds = uniquePlayerIds.filter(id => !processedIds.has(id));
    
    console.log(`Total unique players: ${uniquePlayerIds.length}`);
    console.log(`New players to process: ${newPlayerIds.length}`);
    
    // Process each new player
    for (let i = 0; i < Math.min(newPlayerIds.length, 10); i++) { // Limit to 10 for testing
      const playerId = newPlayerIds[i];
      console.log(`Processing player ${i + 1}/${Math.min(newPlayerIds.length, 10)}: ${playerId}`);
      
      // Get player data from API
      const player = await getPlayerData(playerId);
      if (!player) {
        console.log(`Skipping player ${playerId} - no data found`);
        continue;
      }
      
      // Get position ratings (try scraping first, fallback to calculation)
      let positionRatings: Record<string, number>;
      try {
        positionRatings = await scrapePositionRatings(playerId, browser);
        // Check if we got meaningful ratings (not all -20)
        const hasValidRatings = Object.values(positionRatings).some(rating => rating > -20);
        if (!hasValidRatings) {
          positionRatings = calculatePositionRatings(player);
        }
      } catch (error) {
        positionRatings = calculatePositionRatings(player);
      }
      
      // Determine primary and secondary positions
      const positions = player.metadata.positions;
      const primary = positions[0] || '';
      const secondary = positions.slice(1).join(', ') || '';
      
      // Create player data object
      const playerData: PlayerData = {
        name: `${player.metadata.firstName} ${player.metadata.lastName}`,
        id: playerId,
        inputUrl: `${API_BASE_URL}/players/${playerId}`,
        inputData: JSON.stringify({ player }),
        primary,
        secondary,
        ST: positionRatings.ST,
        CF: positionRatings.CF,
        CAM: positionRatings.CAM,
        RW: positionRatings.RW,
        LW: positionRatings.LW,
        RM: positionRatings.RM,
        LM: positionRatings.LM,
        CM: positionRatings.CM,
        CDM: positionRatings.CDM,
        RWB: positionRatings.RWB,
        LWB: positionRatings.LWB,
        RB: positionRatings.RB,
        LB: positionRatings.LB,
        CB: positionRatings.CB,
        GK: positionRatings.GK
      };
      
      playersData.push(playerData);
      
      // Add a small delay to avoid overwhelming the servers
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Create Excel workbook
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(playersData);
    
    // Set column widths
    const columnWidths = [
      { wch: 20 }, // NAME
      { wch: 10 }, // #ID
      { wch: 80 }, // INPUT URL
      { wch: 50 }, // INPUT DATA
      { wch: 10 }, // Primary
      { wch: 15 }, // Secondary
      { wch: 8 },  // ST
      { wch: 8 },  // CF
      { wch: 8 },  // CAM
      { wch: 8 },  // RW
      { wch: 8 },  // LW
      { wch: 8 },  // RM
      { wch: 8 },  // LM
      { wch: 8 },  // CM
      { wch: 8 },  // CDM
      { wch: 8 },  // RWB
      { wch: 8 },  // LWB
      { wch: 8 },  // RB
      { wch: 8 },  // LB
      { wch: 8 },  // CB
      { wch: 8 }   // GK
    ];
    worksheet['!cols'] = columnWidths;
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Players');
    
    // Save to file
    const outputPath = path.join(process.cwd(), 'player-data.xlsx');
    XLSX.writeFile(workbook, outputPath);
    
    console.log(`\nExcel file created successfully: ${outputPath}`);
    console.log(`Total players processed: ${playersData.length}`);
    
  } catch (error) {
    console.error('Error during scraping:', error);
  } finally {
    await browser.close();
  }
}

// Run the script
main().catch(console.error);
