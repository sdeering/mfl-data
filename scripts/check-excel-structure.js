const XLSX = require('xlsx');

function checkExcelStructure() {
  try {
    const workbook = XLSX.readFile('Data/corrected-player-data.xlsx');
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const players = XLSX.utils.sheet_to_json(worksheet);
    
    console.log(`Loaded ${players.length} players from corrected data file`);
    
    if (players.length > 0) {
      console.log('\n=== EXCEL FILE STRUCTURE ===');
      console.log('Available columns:', Object.keys(players[0]));
      
      console.log('\n=== SAMPLE PLAYER DATA ===');
      const samplePlayer = players[0];
      Object.keys(samplePlayer).forEach(key => {
        console.log(`${key}: ${samplePlayer[key]}`);
      });
      
      console.log('\n=== 3 RANDOM PLAYERS WITH CORRECT COLUMNS ===');
      
      // Select 3 random players
      const randomPlayers = [];
      for (let i = 0; i < 3; i++) {
        const randomIndex = Math.floor(Math.random() * players.length);
        randomPlayers.push(players[randomIndex]);
      }
      
      randomPlayers.forEach((player, index) => {
        console.log(`\n--- Player ${index + 1}: ${player.name || 'Unknown'} (ID: ${player.id || 'Unknown'}) ---`);
        
        // Show position ratings if they exist
        const positions = ['ST', 'CF', 'CAM', 'RW', 'LW', 'RM', 'LM', 'CM', 'CDM', 'RWB', 'LWB', 'RB', 'LB', 'CB', 'GK'];
        const positionRatings = {};
        
        positions.forEach(pos => {
          if (player[pos] !== undefined) {
            positionRatings[pos] = player[pos];
          }
        });
        
        if (Object.keys(positionRatings).length > 0) {
          console.log('Position Ratings:', positionRatings);
        }
        
        // Show other key fields
        const keyFields = ['primaryPosition', 'secondaryPositions', 'overall', 'pace', 'shooting', 'passing', 'dribbling', 'defense', 'physical', 'goalkeeping'];
        keyFields.forEach(field => {
          if (player[field] !== undefined) {
            console.log(`${field}: ${player[field]}`);
          }
        });
      });
    }
    
  } catch (error) {
    console.error('Error loading data file:', error);
  }
}

checkExcelStructure();
