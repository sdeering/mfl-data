const XLSX = require('xlsx');
const path = require('path');

// Read the Excel file
const workbook = XLSX.readFile(path.join(__dirname, '../Data/600-player-data-scraped.xlsx'));
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

// Find player 116267
const player = data.find(p => p.id === 116267);

if (player) {
  console.log('Player 116267 (Max Pasquier) Analysis:');
  console.log('=====================================');
  console.log(`Name: ${player.name}`);
  console.log(`ID: ${player.id}`);
  console.log(`Overall: ${player.overall}`);
  console.log(`Primary: ${player.primary}`);
  console.log(`Secondary: ${player.secondary}`);
  
  // Parse the inputData to get attributes
  const inputData = JSON.parse(player.inputData);
  const metadata = inputData.player.metadata;
  
  console.log('\nAttributes:');
  console.log(`PAC: ${metadata.pace}`);
  console.log(`SHO: ${metadata.shooting}`);
  console.log(`PAS: ${metadata.passing}`);
  console.log(`DRI: ${metadata.dribbling}`);
  console.log(`DEF: ${metadata.defense}`);
  console.log(`PHY: ${metadata.physical}`);
  console.log(`GK: ${metadata.goalkeeping}`);
  
  // Calculate simple average
  const simpleAvg = Math.round((metadata.pace + metadata.shooting + metadata.passing + metadata.dribbling + metadata.defense + metadata.physical) / 6);
  console.log(`\nSimple Average: ${simpleAvg}`);
  console.log(`MFL Overall: ${metadata.overall}`);
  console.log(`Difference: ${metadata.overall - simpleAvg}`);
  
  console.log('\nPosition Ratings:');
  console.log(`LB: ${player.LB} (should be ${metadata.overall})`);
  console.log(`LWB: ${player.LWB}`);
  console.log(`CB: ${player.CB}`);
  console.log(`RB: ${player.RB}`);
  console.log(`RWB: ${player.RWB}`);
  console.log(`CDM: ${player.CDM}`);
  console.log(`CM: ${player.CM}`);
  console.log(`LM: ${player.LM}`);
  console.log(`RM: ${player.RM}`);
  console.log(`CAM: ${player.CAM}`);
  console.log(`LW: ${player.LW}`);
  console.log(`RW: ${player.RW}`);
  console.log(`CF: ${player.CF}`);
  console.log(`ST: ${player.ST}`);
  
} else {
  console.log('Player 116267 not found');
}
