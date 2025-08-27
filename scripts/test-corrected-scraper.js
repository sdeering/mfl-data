const axios = require('axios');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const OWNER_WALLETS = [
  '0xa7942ae65333f69d',
  '0x55e8be2966409ed4'
];

const API_BASE_URL = 'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod';

// Test with just a few sample players to verify the fix
const SAMPLE_DATA = [
  {
    name: "Vincent Manson", id: 4942, inputUrl: "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/4942",
    inputData: '{"player":{"id":4942,"metadata":{"id":4940,"firstName":"Vincent","lastName":"Manson","overall":54,"nationalities":["SCOTLAND"],"positions":["ST"],"preferredFoot":"LEFT","age":26,"height":169,"pace":47,"shooting":54,"passing":46,"dribbling":58,"defense":27,"physical":64,"goalkeeping":0},"ownedBy":{"walletAddress":"0x55e8be2966409ed4","name":"NepentheZ","twitter":null,"lastActive":1},"ownedSince":1738428715000,"activeContract":{"id":763180,"status":"ACTIVE","kind":"CONTRACT","revenueShare":0,"totalRevenueShareLocked":0,"club":{"id":3992,"name":"Evo FC : The Agency","mainColor":"#0693e3","secondaryColor":"#ffffff","city":"Allahābād","division":9,"logoVersion":"592207ab0da0ea34b56c77ec9b7cf019","country":"INDIA","squads":[]},"startSeason":18,"nbSeasons":1,"autoRenewal":false,"createdDateTime":1755807251704,"clauses":[]},"hasPreContract":false,"energy":10000,"offerStatus":0,"nbSeasonYellows":0}}',
    primary: "ST", secondary: "", ST: 54, CF: 41, CAM: 41, RW: 41, LW: 41, RM: 38, LM: 38, CM: 36, CDM: 34, RWB: 33, LWB: 33, RB: 32, LB: 32, CB: 34, GK: 0
  }
];

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

function calculatePositionRatings(player) {
  const { pace, shooting, passing, dribbling, defense, physical, goalkeeping, overall } = player.metadata;
  const positions = player.metadata.positions;
  const primaryPosition = positions[0];
  
  const ratings = {
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
  
  // Set the primary position to the overall rating
  if (primaryPosition && ratings.hasOwnProperty(primaryPosition)) {
    ratings[primaryPosition] = overall;
  }
  
  return ratings;
}

async function main() {
  console.log('Starting TEST of corrected player data scraping...');
  
  // Start with sample data
  let playersData = [...SAMPLE_DATA];
  
  try {
    // Get all player IDs from both wallets
    const allPlayerIds = [];
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
    
    // TEST: Process only 5 new players
    const testPlayerIds = newPlayerIds.slice(0, 5);
    console.log(`TESTING: Processing only ${testPlayerIds.length} players: ${testPlayerIds.join(', ')}`);
    
    // Process each test player
    for (let i = 0; i < testPlayerIds.length; i++) {
      const playerId = testPlayerIds[i];
      console.log(`\n=== Processing TEST player ${i + 1}/${testPlayerIds.length}: ${playerId} ===`);
      
      // Get player data from API
      const player = await getPlayerData(playerId);
      if (!player) {
        console.log(`Skipping player ${playerId} - no data found`);
        continue;
      }
      
      // Calculate position ratings
      const positionRatings = calculatePositionRatings(player);
      
      // Determine primary and secondary positions
      const positions = player.metadata.positions;
      const primary = positions[0] || '';
      const secondary = positions.slice(1).join(', ') || '';
      
      // Log the test results
      console.log(`Player: ${player.metadata.firstName} ${player.metadata.lastName}`);
      console.log(`Overall: ${player.metadata.overall}`);
      console.log(`Primary Position: ${primary}`);
      console.log(`Primary Position Rating: ${positionRatings[primary]}`);
      console.log(`All Position Ratings:`, positionRatings);
      
      // Create player data object
      const playerData = {
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
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Create test Excel file
    console.log('\n=== Creating TEST Excel file... ===');
    const workbook = XLSX.utils.book_new();
    const worksheet = XLSX.utils.json_to_sheet(playersData);
    
    // Set column widths
    worksheet['!cols'] = [
      { wch: 20 }, { wch: 10 }, { wch: 80 }, { wch: 50 }, { wch: 10 }, { wch: 15 },
      { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
      { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
      { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }
    ];
    
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Players');
    XLSX.writeFile(workbook, 'Data/test-corrected-player-data.xlsx');
    
    console.log(`TEST Excel file created: ${path.resolve('Data/test-corrected-player-data.xlsx')}`);
    console.log(`Total players in test: ${playersData.length}`);
    console.log('\n=== TEST COMPLETE - Check the Excel file to verify the fix ===');
    
  } catch (error) {
    console.error('Error during test scraping:', error);
  }
}

main();
