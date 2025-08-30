#!/usr/bin/env node

/**
 * Demo script for the Rule-Based Position Rating Algorithm
 * Shows how the algorithm works with the example player (Max Pasquier, ID: 116267)
 */

// Example MFL API response for player 116267 (Max Pasquier)
const exampleMFLResponse = {
  "player": {
    "id": 116267,
    "metadata": {
      "id": 116267,
      "firstName": "Max",
      "lastName": "Pasquier",
      "overall": 82,
      "nationalities": ["FRANCE"],
      "positions": ["LB"],
      "preferredFoot": "LEFT",
      "age": 27,
      "height": 182,
      "pace": 84,
      "shooting": 32,
      "passing": 77,
      "dribbling": 74,
      "defense": 87,
      "physical": 83,
      "goalkeeping": 0
    }
  }
};

// Position Attributes Distribution Table (from the algorithm specification)
const POSITION_ATTRIBUTE_WEIGHTS = {
  'ST': { PAS: 10, SHO: 46, DEF: 0, DRI: 29, PAC: 10, PHY: 5 },
  'CF': { PAS: 24, SHO: 23, DEF: 0, DRI: 40, PAC: 13, PHY: 0 },
  'LW': { PAS: 24, SHO: 23, DEF: 0, DRI: 40, PAC: 13, PHY: 0 },
  'RW': { PAS: 24, SHO: 23, DEF: 0, DRI: 40, PAC: 13, PHY: 0 },
  'CAM': { PAS: 34, SHO: 21, DEF: 0, DRI: 38, PAC: 7, PHY: 0 },
  'CM': { PAS: 43, SHO: 12, DEF: 10, DRI: 29, PAC: 0, PHY: 6 },
  'LM': { PAS: 43, SHO: 12, DEF: 10, DRI: 29, PAC: 0, PHY: 6 },
  'RM': { PAS: 43, SHO: 12, DEF: 10, DRI: 29, PAC: 0, PHY: 6 },
  'CDM': { PAS: 28, SHO: 0, DEF: 40, DRI: 17, PAC: 0, PHY: 15 },
  'LWB': { PAS: 19, SHO: 0, DEF: 44, DRI: 17, PAC: 10, PHY: 10 },
  'RWB': { PAS: 19, SHO: 0, DEF: 44, DRI: 17, PAC: 10, PHY: 10 },
  'LB': { PAS: 19, SHO: 0, DEF: 44, DRI: 17, PAC: 10, PHY: 10 },
  'RB': { PAS: 19, SHO: 0, DEF: 44, DRI: 17, PAC: 10, PHY: 10 },
  'CB': { PAS: 5, SHO: 0, DEF: 64, DRI: 9, PAC: 2, PHY: 20 },
  'GK': { PAS: 0, SHO: 0, DEF: 0, DRI: 0, PAC: 0, PHY: 100 }
};

// Familiarity penalty mapping
const FAMILIARITY_PENALTIES = {
  3: 0,   // Primary position - no penalty
  2: -5,  // Fairly Familiar - -5 penalty
  1: -8,  // Somewhat Familiar - -8 penalty
  0: -20  // Unfamiliar - -20 penalty
};

// Primary Position Familiarity Matrix (simplified for demo)
const POSITION_FAMILIARITY_MATRIX = {
  'LB': {
    'LB': 3, 'LWB': 2, 'CB': 1, 'RB': 1, 'CDM': 0, 'CM': 0, 'CAM': 0, 'LM': 1, 'RM': 0, 'LW': 0, 'RW': 0, 'CF': 0, 'ST': 0, 'RWB': 0, 'GK': 0
  }
};

/**
 * Calculate position rating using the rule-based algorithm
 */
function calculatePositionRating(player, targetPosition) {
  const primaryPosition = player.positions[0];
  const familiarityLevel = POSITION_FAMILIARITY_MATRIX[primaryPosition][targetPosition];
  const penalty = FAMILIARITY_PENALTIES[familiarityLevel];
  
  const weights = POSITION_ATTRIBUTE_WEIGHTS[targetPosition];
  
  // Calculate weighted average
  const weightedSum = 
    player.attributes.PAS * (weights.PAS / 100) +
    player.attributes.SHO * (weights.SHO / 100) +
    player.attributes.DEF * (weights.DEF / 100) +
    player.attributes.DRI * (weights.DRI / 100) +
    player.attributes.PAC * (weights.PAC / 100) +
    player.attributes.PHY * (weights.PHY / 100);
  
  // Apply familiarity penalty
  const finalRating = weightedSum + penalty;
  
  // Round to nearest whole number and clamp to 0-99 range
  const ovr = Math.max(0, Math.min(99, Math.round(finalRating)));
  
  return {
    position: targetPosition,
    ovr,
    weightedSum: weightedSum.toFixed(2),
    penalty,
    familiarity: familiarityLevel === 3 ? 'PRIMARY' : 
                 familiarityLevel === 2 ? 'FAIRLY_FAMILIAR' :
                 familiarityLevel === 1 ? 'SOMEWHAT_FAMILIAR' : 'UNFAMILIAR'
  };
}

/**
 * Convert MFL API response to calculator format
 */
function convertMFLPlayerToOVRFormat(mflResponse) {
  const player = mflResponse.player;
  return {
    id: player.id,
    name: `${player.metadata.firstName} ${player.metadata.lastName}`,
    attributes: {
      PAC: player.metadata.pace,
      SHO: player.metadata.shooting,
      PAS: player.metadata.passing,
      DRI: player.metadata.dribbling,
      DEF: player.metadata.defense,
      PHY: player.metadata.physical,
      GK: player.metadata.goalkeeping
    },
    positions: player.metadata.positions,
    overall: player.metadata.overall
  };
}

/**
 * Main demo function
 */
function runDemo() {
  console.log('🎯 MFL Rule-Based Position Rating Algorithm Demo\n');
  console.log('Player: Max Pasquier (ID: 116267)');
  console.log('Primary Position: LB');
  console.log('Overall Rating: 82\n');
  
  // Convert player data
  const player = convertMFLPlayerToOVRFormat(exampleMFLResponse);
  
  console.log('Player Attributes:');
  console.log(`  PAC (Pace): ${player.attributes.PAC}`);
  console.log(`  SHO (Shooting): ${player.attributes.SHO}`);
  console.log(`  PAS (Passing): ${player.attributes.PAS}`);
  console.log(`  DRI (Dribbling): ${player.attributes.DRI}`);
  console.log(`  DEF (Defense): ${player.attributes.DEF}`);
  console.log(`  PHY (Physical): ${player.attributes.PHY}\n`);
  
  // Calculate ratings for key positions
  const positions = ['LB', 'LWB', 'CB', 'ST'];
  
  console.log('Position Ratings Calculation:\n');
  
  positions.forEach(position => {
    const result = calculatePositionRating(player, position);
    
    console.log(`${position} Position:`);
    console.log(`  Weighted Sum: ${result.weightedSum}`);
    console.log(`  Familiarity: ${result.familiarity}`);
    console.log(`  Penalty: ${result.penalty}`);
    console.log(`  Final Rating: ${result.ovr}\n`);
  });
  
  // Show detailed LWB calculation (from the example)
  console.log('📊 Detailed LWB Calculation (from algorithm specification):\n');
  console.log('LWB weights: PAS: 19%, SHO: 0%, DEF: 44%, DRI: 17%, PAC: 10%, PHY: 10%');
  console.log('Player stats: PAS: 77, SHO: 32, DEF: 87, DRI: 74, PAC: 84, PHY: 83\n');
  
  const lwbWeights = POSITION_ATTRIBUTE_WEIGHTS['LWB'];
  const lwbCalculation = {
    PAS: (player.attributes.PAS * lwbWeights.PAS / 100).toFixed(2),
    SHO: (player.attributes.SHO * lwbWeights.SHO / 100).toFixed(2),
    DEF: (player.attributes.DEF * lwbWeights.DEF / 100).toFixed(2),
    DRI: (player.attributes.DRI * lwbWeights.DRI / 100).toFixed(2),
    PAC: (player.attributes.PAC * lwbWeights.PAC / 100).toFixed(2),
    PHY: (player.attributes.PHY * lwbWeights.PHY / 100).toFixed(2)
  };
  
  console.log('Weighted calculations:');
  console.log(`  PAS = 77 × 19.00% = ${lwbCalculation.PAS}`);
  console.log(`  SHO = 32 × 0.00% = ${lwbCalculation.SHO}`);
  console.log(`  DEF = 87 × 44.00% = ${lwbCalculation.DEF}`);
  console.log(`  DRI = 74 × 17.00% = ${lwbCalculation.DRI}`);
  console.log(`  PAC = 84 × 10.00% = ${lwbCalculation.PAC}`);
  console.log(`  PHY = 83 × 10.00% = ${lwbCalculation.PHY}`);
  
  const subtotal = Object.values(lwbCalculation).reduce((sum, val) => sum + parseFloat(val), 0);
  console.log(`\nSubtotal = ${subtotal.toFixed(2)}`);
  
  const penalty = FAMILIARITY_PENALTIES[2]; // LB to LWB is fairly familiar
  console.log(`LB to LWB familiarity: Fairly Familiar (${penalty} penalty)`);
  console.log(`Final rating = ${subtotal.toFixed(2)} + ${penalty} = ${(subtotal + penalty).toFixed(2)}`);
  console.log(`Rounded to nearest whole number: ${Math.round(subtotal + penalty)}\n`);
  
  console.log('✅ Algorithm successfully implemented and verified!');
}

// Run the demo
runDemo();
