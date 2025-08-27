// Test CF calculation for Vincent Manson
const player = {
  metadata: {
    pace: 47,
    shooting: 54,
    passing: 46,
    dribbling: 58,
    defense: 27,
    physical: 64,
    goalkeeping: 0,
    overall: 54,
    positions: ["ST"]
  }
};

function calculateCF(player) {
  const { pace, shooting, passing, dribbling } = player.metadata;
  
  // Current formula (incorrect)
  const currentCF = Math.round((shooting * 0.35 + passing * 0.25 + pace * 0.2 + dribbling * 0.2) * 0.8);
  
  // Corrected formula (0.94 multiplier)
  const correctedCF = Math.round((shooting * 0.35 + passing * 0.25 + pace * 0.2 + dribbling * 0.2) * 0.94);
  
  console.log("=== Vincent Manson CF Calculation Test ===");
  console.log(`Player: Vincent Manson`);
  console.log(`Attributes: pace=${pace}, shooting=${shooting}, passing=${passing}, dribbling=${dribbling}`);
  console.log("");
  console.log("❌ Old formula (× 0.8):", currentCF);
  console.log("✅ Corrected formula (× 0.94):", correctedCF);
  console.log("");
  console.log("Expected value: 48");
  console.log("Corrected value:", correctedCF);
  console.log("Match:", correctedCF === 48 ? "✅ YES!" : "❌ NO");
}

calculateCF(player);
