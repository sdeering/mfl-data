// Debug script to compare market value calculations
const fetch = require('node-fetch');

async function testMarketValueCalculation() {
  const playerId = '116267';
  const walletAddress = '0x95dc70d7d39f6f76';
  
  console.log('🔍 Testing market value calculation for player', playerId);
  
  try {
    const response = await fetch(`http://localhost:3000/api/calculate-market-value/${playerId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletAddress: walletAddress
      })
    });
    
    const result = await response.json();
    
    console.log('📊 API Response:');
    console.log('Market Value:', result.marketValue);
    console.log('Confidence:', result.confidence);
    console.log('Base Value:', result.details.details.baseValue);
    console.log('Total Adjustments:', result.details.breakdown.totalAdjustments);
    console.log('Position Premium:', result.details.breakdown.positionPremium);
    console.log('Progression Premium:', result.details.breakdown.progressionPremium);
    console.log('Comparable Listings:', result.details.details.comparableListings.length);
    console.log('Recent Sales:', result.details.details.recentSales.length);
    
    if (result.debug) {
      console.log('\n🔍 Debug Information:');
      console.log('Progression Count:', result.debug.progressionCount);
      console.log('Match Count:', result.debug.matchCount);
      console.log('Recent Sales Count:', result.debug.recentSalesCount);
      console.log('Comparable Listings Count:', result.debug.comparableListingsCount);
      console.log('Position Ratings:', result.debug.positionRatings);
      if (result.debug.progressionData && result.debug.progressionData.length > 0) {
        console.log('Progression Data (first 3):', result.debug.progressionData.slice(0, 3));
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testMarketValueCalculation();
