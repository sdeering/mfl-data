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

// Complete sample data from user
const SAMPLE_DATA = [
  {
    name: "Max Pasquier", id: 116267, inputUrl: "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/116267",
    inputData: '{"player":{"id":116267,"metadata":{"id":116267,"firstName":"Max","lastName":"Pasquier","overall":82,"nationalities":["FRANCE"],"positions":["LB"],"preferredFoot":"LEFT","age":27,"height":182,"pace":84,"shooting":32,"passing":77,"dribbling":74,"defense":87,"physical":83,"goalkeeping":0},"ownedBy":{"walletAddress":"0x95dc70d7d39f6f76","name":"DogeSports HQ","twitter":"dogesports69","lastActive":1},"ownedSince":1745334407000,"hasPreContract":false,"energy":10000,"offerStatus":1,"nbSeasonYellows":0}}',
    primary: "LB", secondary: "", ST: 36, CF: 46, CAM: 47, RW: 46, LW: 46, RM: 52, LM: 64, CM: 52, CDM: 61, RWB: 62, LWB: 77, RB: 74, LB: 82, CB: 76, GK: -20
  },
  {
    name: "Jan Kessler", id: 52088, inputUrl: "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/52088",
    inputData: '{"player":{"id":52088,"metadata":{"id":52087,"firstName":"Jan","lastName":"Kessler","overall":64,"nationalities":["GERMANY"],"positions":["RM","ST"],"preferredFoot":"RIGHT","age":30,"height":189,"pace":80,"shooting":66,"passing":59,"dribbling":75,"defense":48,"physical":68,"goalkeeping":0},"ownedBy":{"walletAddress":"0x95dc70d7d39f6f76","name":"DogeSports HQ","twitter":"dogesports69","lastActive":1},"ownedSince":1744652440000,"hasPreContract":false,"energy":10000,"offerStatus":1,"nbSeasonYellows":0}}',
    primary: "RM", secondary: "ST", ST: 68, CF: 50, CAM: 48, RW: 65, LW: 50, RM: 64, LM: 56, CM: 56, CDM: 39, RWB: 52, LWB: 40, RB: 52, LB: 40, CB: 36, GK: -20
  },
  {
    name: "Fabrice Vallet", id: 39651, inputUrl: "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/39651",
    inputData: '{"player":{"id":39651,"metadata":{"id":39663,"firstName":"Fabrice","lastName":"Vallet","overall":78,"nationalities":["FRANCE"],"positions":["RWB","RM","CM"],"preferredFoot":"RIGHT","age":27,"height":185,"pace":76,"shooting":61,"passing":83,"dribbling":75,"defense":78,"physical":71,"goalkeeping":0},"ownedBy":{"walletAddress":"0x95dc70d7d39f6f76","name":"DogeSports HQ","twitter":"dogesports69","lastActive":1},"ownedSince":1744947243000,"hasPreContract":false,"energy":10000,"offerStatus":1,"nbSeasonYellows":0}}',
    primary: "RWB", secondary: "RM, CM", ST: 49, CF: 54, CAM: 55, RW: 66, LW: 54, RM: 76, LM: 57, CM: 76, CDM: 58, RWB: 78, LWB: 70, RB: 73, LB: 58, CB: 57, GK: -20
  },
  {
    name: "Eric Hodge", id: 93886, inputUrl: "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/93886",
    inputData: '{"player":{"id":93886,"metadata":{"id":93886,"firstName":"Eric","lastName":"Hodge","overall":84,"nationalities":["AUSTRALIA"],"positions":["CAM","ST"],"preferredFoot":"RIGHT","age":27,"height":177,"pace":73,"shooting":81,"passing":87,"dribbling":84,"defense":30,"physical":53,"goalkeeping":0},"ownedBy":{"walletAddress":"0x95dc70d7d39f6f76","name":"DogeSports HQ","twitter":"dogesports69","lastActive":1},"ownedSince":1745446840000,"hasPreContract":false,"energy":10000,"offerStatus":1,"nbSeasonYellows":0}}',
    primary: "CAM", secondary: "ST", ST: 79, CF: 78, CAM: 84, RW: 63, LW: 63, RM: 58, LM: 58, CM: 73, CDM: 51, RWB: 37, LWB: 37, RB: 37, LB: 37, CB: 23, GK: -20
  },
  {
    name: "Roger Pike", id: 80916, inputUrl: "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/80916",
    inputData: '{"player":{"id":80916,"metadata":{"id":80918,"firstName":"Roger","lastName":"Pike","overall":54,"nationalities":["WALES"],"positions":["RM","ST","LM"],"preferredFoot":"LEFT","age":28,"height":172,"pace":74,"shooting":67,"passing":63,"dribbling":44,"defense":22,"physical":67,"goalkeeping":0},"ownedBy":{"walletAddress":"0x95dc70d7d39f6f76","name":"DogeSports HQ","twitter":"dogesports69","lastActive":1},"ownedSince":1744314336000,"activeContract":{"id":374270,"status":"ACTIVE","kind":"CONTRACT","revenueShare":0,"totalRevenueShareLocked":0,"club":{"id":100000,"name":"Development Center","type":"DEVELOPMENT_CENTER","mainColor":"#fff700","secondaryColor":"#000000","city":"Paris","division":null,"logoVersion":"1","country":"FRANCE","squads":[]},"startSeason":15,"nbSeasons":4,"autoRenewal":false,"createdDateTime":1745331029425,"clauses":[]},"hasPreContract":false,"energy":10000,"offerStatus":1,"nbSeasonYellows":0}}',
    primary: "RM", secondary: "ST, LM", ST: 60, CF: 38, CAM: 37, RW: 53, LW: 38, RM: 54, LM: 53, CM: 46, CDM: 24, RWB: 35, LWB: 23, RB: 35, LB: 23, CB: 16, GK: -20
  },
  {
    name: "Anthony Cornelis", id: 66071, inputUrl: "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/66071",
    inputData: '{"player":{"id":66071,"metadata":{"id":66071,"firstName":"Anthony","lastName":"Cornelis","overall":85,"nationalities":["BELGIUM"],"positions":["ST"],"preferredFoot":"RIGHT","age":25,"height":187,"pace":75,"shooting":99,"passing":55,"dribbling":81,"defense":29,"physical":65,"goalkeeping":0},"ownedBy":{"walletAddress":"0x55e8be2966409ed4","name":"NepentheZ","twitter":null,"lastActive":1},"ownedSince":1739464462000,"hasPreContract":false,"energy":10000,"offerStatus":0,"nbSeasonYellows":0}}',
    primary: "ST", secondary: "", ST: 85, CF: 73, CAM: 56, RW: 58, LW: 58, RM: 46, LM: 46, CM: 46, CDM: 31, RWB: 31, LWB: 31, RB: 31, LB: 31, CB: 23, GK: -20
  },
  {
    name: "Eric Debruyne", id: 93067, inputUrl: "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/93067",
    inputData: '{"player":{"id":93067,"metadata":{"id":93066,"firstName":"Eric","lastName":"Debruyne","overall":78,"nationalities":["BELGIUM"],"positions":["ST","LM"],"preferredFoot":"RIGHT","age":30,"height":188,"pace":75,"shooting":85,"passing":68,"dribbling":76,"defense":35,"physical":53,"goalkeeping":0},"ownedBy":{"walletAddress":"0x55e8be2966409ed4","name":"NepentheZ","twitter":null,"lastActive":1},"ownedSince":1753229716000,"activeContract":{"id":770978,"status":"ACTIVE","kind":"CONTRACT","revenueShare":0,"totalRevenueShareLocked":0,"club":{"id":1893,"name":"Evo FC : Prestige 26","mainColor":"#000000","secondaryColor":"#ffffff","city":"Kyiv","division":6,"logoVersion":"4e2cd78548c5cb79b42982247fd44b38","country":"UKRAINE","squads":[]},"startSeason":18,"nbSeasons":1,"autoRenewal":false,"createdDateTime":1756113988591,"clauses":[]},"hasPreContract":false,"energy":10000,"offerStatus":0,"nbSeasonYellows":0}}',
    primary: "ST", secondary: "LM", ST: 78, CF: 71, CAM: 55, RW: 56, LW: 56, RM: 48, LM: 67, CM: 48, CDM: 34, RWB: 34, LWB: 34, RB: 34, LB: 34, CB: 25, GK: -20
  },
  {
    name: "Gerhard Beckmann", id: 56783, inputUrl: "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/56783",
    inputData: '{"player":{"id":56783,"metadata":{"id":56775,"firstName":"Gerhard","lastName":"Beckmann","overall":97,"nationalities":["GERMANY"],"positions":["ST"],"preferredFoot":"RIGHT","age":33,"height":168,"pace":99,"shooting":97,"passing":99,"dribbling":95,"defense":64,"physical":99,"goalkeeping":0},"ownedBy":{"walletAddress":"0x6faf52b615a6b550","name":"SomethingBalling23","twitter":"Sballing23","lastActive":1},"ownedSince":1748456674000,"activeContract":{"id":564467,"status":"ACTIVE","kind":"CONTRACT","revenueShare":0,"totalRevenueShareLocked":0,"club":{"id":167,"name":"Black MFC","mainColor":"#000000","secondaryColor":"#8ed1fc","city":"Cagliari","division":2,"logoVersion":"c45ddc2a8e98735a5dea459d18932976","country":"ITALY","squads":[]},"startSeason":16,"nbSeasons":3,"autoRenewal":true,"createdDateTime":1749412082526,"clauses":[]},"hasPreContract":false,"energy":10000,"offerStatus":1,"nbSeasonYellows":0,"jerseyNumber":23},"listing":{"listingResourceId":100055560123060,"status":"AVAILABLE","price":3600,"sellerAddress":"0x6faf52b615a6b550","sellerName":"SomethingBalling23","createdDateTime":1756124102112}}',
    primary: "ST", secondary: "", ST: 97, CF: 92, CAM: 77, RW: 77, LW: 77, RM: 74, LM: 74, CM: 74, CDM: 64, RWB: 63, LWB: 63, RB: 63, LB: 63, CB: 56, GK: -20
  },
  {
    name: "Said Castellano", id: 57125, inputUrl: "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/57125",
    inputData: '{"player":{"id":57125,"metadata":{"id":57107,"firstName":"Said","lastName":"Castellano","overall":84,"nationalities":["SPAIN"],"positions":["LW"],"preferredFoot":"RIGHT","age":31,"height":178,"pace":96,"shooting":67,"passing":90,"dribbling":86,"defense":36,"physical":76,"goalkeeping":0},"ownedBy":{"walletAddress":"0x95dc70d7d39f6f76","name":"DogeSports HQ","twitter":"dogesports69","lastActive":1},"ownedSince":1746562880000,"hasPreContract":false,"energy":10000,"offerStatus":1,"nbSeasonYellows":0},"listing":{"listingResourceId":140737490318153,"status":"AVAILABLE","price":149,"sellerAddress":"0x95dc70d7d39f6f76","sellerName":"DogeSports HQ","createdDateTime":1755348759478}}',
    primary: "LW", secondary: "", ST: 58, CF: 64, CAM: 64, RW: 76, LW: 84, RM: 60, LM: 75, CM: 60, CDM: 46, RWB: 45, LWB: 57, RB: 45, LB: 45, CB: 32, GK: -20
  },
  {
    name: "Fritz Grimm", id: 129983, inputUrl: "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/129983",
    inputData: '{"player":{"id":129983,"metadata":{"id":129983,"firstName":"Fritz","lastName":"Grimm","overall":86,"nationalities":["GERMANY"],"positions":["RM","ST"],"preferredFoot":"RIGHT","age":26,"height":183,"pace":73,"shooting":78,"passing":89,"dribbling":87,"defense":81,"physical":76,"goalkeeping":0},"ownedBy":{"walletAddress":"0x55e8be2966409ed4","name":"NepentheZ","twitter":null,"lastActive":1},"ownedSince":1747259237000,"hasPreContract":false,"energy":10000,"offerStatus":0,"nbSeasonYellows":0}}',
    primary: "RM", secondary: "ST", ST: 80, CF: 64, CAM: 65, RW: 79, LW: 64, RM: 86, LM: 78, CM: 78, CDM: 64, RWB: 74, LWB: 62, RB: 74, LB: 62, CB: 61, GK: -20
  },
  {
    name: "Noel Birch", id: 45981, inputUrl: "https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/45981",
    inputData: '{"player":{"id":45981,"metadata":{"id":45981,"firstName":"Noel","lastName":"Birch","overall":76,"nationalities":["ENGLAND"],"positions":["ST"],"preferredFoot":"RIGHT","age":32,"height":187,"pace":82,"shooting":80,"passing":72,"dribbling":70,"defense":34,"physical":61,"goalkeeping":0,"retirementYears":3},"ownedBy":{"walletAddress":"0x95dc70d7d39f6f76","name":"DogeSports HQ","twitter":"dogesports69","lastActive":1},"ownedSince":1744708276000,"hasPreContract":false,"energy":10000,"offerStatus":1,"nbSeasonYellows":0}}',
    primary: "ST", secondary: "", ST: 76, CF: 69, CAM: 54, RW: 54, LW: 54, RM: 48, LM: 48, CM: 48, CDM: 35, RWB: 35, LWB: 35, RB: 35, LB: 35, CB: 26, GK: -20
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
  console.log('Starting full player data scraping...');
  
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
    
    // Process each new player
    for (let i = 0; i < newPlayerIds.length; i++) {
      const playerId = newPlayerIds[i];
      console.log(`Processing player ${i + 1}/${newPlayerIds.length}: ${playerId}`);
      
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
      
      // Save progress every 100 players
      if ((i + 1) % 100 === 0) {
        console.log(`Saving progress... (${i + 1} players processed)`);
        const progressWorkbook = XLSX.utils.book_new();
        const progressWorksheet = XLSX.utils.json_to_sheet(playersData);
        progressWorksheet['!cols'] = [
          { wch: 20 }, { wch: 10 }, { wch: 80 }, { wch: 50 }, { wch: 10 }, { wch: 15 },
          { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
          { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 },
          { wch: 8 }, { wch: 8 }, { wch: 8 }, { wch: 8 }
        ];
        XLSX.utils.book_append_sheet(progressWorkbook, progressWorksheet, 'Players');
        XLSX.writeFile(progressWorkbook, 'Data/player-data-progress.xlsx');
      }
    }
    
    // Create final Excel workbook
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
    const outputPath = path.join(process.cwd(), 'Data/full-player-data.xlsx');
    XLSX.writeFile(workbook, outputPath);
    
    console.log(`\nExcel file created successfully: ${outputPath}`);
    console.log(`Total players processed: ${playersData.length}`);
    
  } catch (error) {
    console.error('Error during scraping:', error);
  }
}

// Run the script
main().catch(console.error);
