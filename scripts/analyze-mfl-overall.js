const XLSX = require('xlsx');
const path = require('path');

// Read the Excel file
const workbook = XLSX.readFile(path.join(__dirname, '../Data/600-player-data-scraped.xlsx'));
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

console.log('Analyzing MFL Overall Rating Calculation...\n');

// Analyze first 20 players
data.slice(0, 20).forEach((player, index) => {
  const inputData = JSON.parse(player.inputData);
  const metadata = inputData.player.metadata;
  
  const simpleAvg = Math.round((metadata.pace + metadata.shooting + metadata.passing + metadata.dribbling + metadata.defense + metadata.physical) / 6);
  const difference = metadata.overall - simpleAvg;
  
  console.log(`${index + 1}. ${player.name} (${player.id}):`);
  console.log(`   Simple Avg: ${simpleAvg}, MFL Overall: ${metadata.overall}, Diff: ${difference}`);
  console.log(`   Attributes: PAC:${metadata.pace} SHO:${metadata.shooting} PAS:${metadata.passing} DRI:${metadata.dribbling} DEF:${metadata.defense} PHY:${metadata.physical}`);
  console.log('');
});

// Calculate average difference
let totalDiff = 0;
let count = 0;

data.forEach((player) => {
  const inputData = JSON.parse(player.inputData);
  const metadata = inputData.player.metadata;
  
  const simpleAvg = Math.round((metadata.pace + metadata.shooting + metadata.passing + metadata.dribbling + metadata.defense + metadata.physical) / 6);
  const difference = metadata.overall - simpleAvg;
  
  totalDiff += difference;
  count++;
});

console.log(`\nAverage difference between MFL Overall and Simple Average: ${(totalDiff / count).toFixed(2)}`);
console.log(`This suggests MFL uses a different calculation formula.`);
