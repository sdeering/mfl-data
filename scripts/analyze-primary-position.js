const XLSX = require('xlsx');
const path = require('path');

// Read the Excel file
const workbook = XLSX.readFile(path.join(__dirname, '../Data/600-player-data-scraped.xlsx'));
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet);

console.log('Analyzing primary position vs overall rating pattern...\n');
console.log('First few rows of data:');
console.log(Object.keys(data[0]));
console.log('');

// Analyze first 10 players to confirm the pattern
data.slice(0, 10).forEach((player, index) => {
  console.log(`Player ${index + 1}:`);
  console.log(`  Raw data:`, player);
  
  // Check if we have the expected fields
  if (player.overall && player.positions) {
    console.log(`  Name: ${player.firstName || 'N/A'} ${player.lastName || 'N/A'}`);
    console.log(`  Overall: ${player.overall}`);
    console.log(`  Positions: ${player.positions}`);
    
    // Parse positions if it's a string
    let positions = player.positions;
    if (typeof positions === 'string') {
      try {
        positions = JSON.parse(positions);
      } catch (e) {
        positions = [positions];
      }
    }
    
    if (positions && positions.length > 0) {
      const primaryPosition = positions[0];
      const primaryRating = player[primaryPosition];
      
      console.log(`  Primary Position: ${primaryPosition}`);
      console.log(`  Primary Rating: ${primaryRating}`);
      console.log(`  Overall vs Primary: ${player.overall} vs ${primaryRating}`);
      console.log(`  Match: ${player.overall === primaryRating ? '✅ YES' : '❌ NO'}`);
    } else {
      console.log(`  No valid positions found`);
    }
  } else {
    console.log(`  Missing required fields: overall=${!!player.overall}, positions=${!!player.positions}`);
  }
  console.log('');
});

// Check all players for this pattern
let matches = 0;
let total = 0;

data.forEach((player) => {
  let positions = player.positions;
  if (typeof positions === 'string') {
    try {
      positions = JSON.parse(positions);
    } catch (e) {
      positions = [positions];
    }
  }
  
  const primaryPosition = positions[0];
  const primaryRating = player[primaryPosition];
  
  if (player.overall === primaryRating) {
    matches++;
  }
  total++;
});

console.log(`\nPattern Analysis:`);
console.log(`Total players: ${total}`);
console.log(`Primary position = Overall rating: ${matches}`);
console.log(`Percentage: ${((matches / total) * 100).toFixed(2)}%`);
console.log(`Pattern confirmed: ${matches === total ? '✅ YES' : '❌ NO'}`);
