const XLSX = require('xlsx');

function show3RandomPlayers() {
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
    
    console.log('\n=== 3 RANDOM PLAYERS FROM DATA FILE ===');
    
    randomPlayers.forEach((player, index) => {
      console.log(`\n--- Player ${index + 1}: ${player.name} (ID: ${player.id}) ---`);
      console.log(`Primary Position: ${player.primaryPosition}`);
      console.log(`Secondary Positions: ${player.secondaryPositions}`);
      console.log(`Overall Rating: ${player.overall}`);
      console.log(`\nPosition Ratings:`);
      console.log(`  ST: ${player.ST}, CF: ${player.CF}, CAM: ${player.CAM}, RW: ${player.RW}, LW: ${player.LW}`);
      console.log(`  RM: ${player.RM}, LM: ${player.LM}, CM: ${player.CM}, CDM: ${player.CDM}, RWB: ${player.RWB}`);
      console.log(`  LWB: ${player.LWB}, RB: ${player.RB}, LB: ${player.LB}, CB: ${player.CB}, GK: ${player.GK}`);
      console.log(`\nCore Attributes:`);
      console.log(`  Pace: ${player.pace}, Shooting: ${player.shooting}, Passing: ${player.passing}, Dribbling: ${player.dribbling}`);
      console.log(`  Defense: ${player.defense}, Physical: ${player.physical}, Goalkeeping: ${player.goalkeeping}`);
      console.log(`\nInput URL: ${player.inputUrl}`);
    });
    
    console.log('\n=== EXPLANATION ===');
    console.log('These position ratings are CALCULATED using weighted formulas based on the player\'s core attributes.');
    console.log('The MFL player info website does not display individual position ratings in a scrapable format.');
    console.log('The calculated approach ensures consistency and follows the rule that primary position = overall rating.');
    
  } catch (error) {
    console.error('Error loading data file:', error);
  }
}

show3RandomPlayers();


