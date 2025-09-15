#!/usr/bin/env node

const fetch = require('node-fetch');

async function testMarketValue() {
  const baseUrl = 'http://localhost:3000';
  
  console.log('🧪 Testing Market Value Functionality...\n');
  
  try {
    // Test 1: Check if server is running
    console.log('1️⃣ Testing server connectivity...');
    const serverResponse = await fetch(`${baseUrl}/`);
    if (serverResponse.ok) {
      console.log('✅ Server is running');
    } else {
      console.log('❌ Server is not responding properly');
      return;
    }
    
    // Test 2: Test market data API
    console.log('\n2️⃣ Testing market data API...');
    const marketDataResponse = await fetch(`${baseUrl}/api/market-data?limit=5&type=PLAYER&status=AVAILABLE&view=full&sorts=listing.price&sortsOrders=ASC&ageMin=26&ageMax=28&overallMin=85&overallMax=87&positions=CAM%2CST&onlyPrimaryPosition=true`);
    
    if (marketDataResponse.ok) {
      const marketData = await marketDataResponse.json();
      if (marketData.success && marketData.data.length > 0) {
        console.log(`✅ Market data API working - found ${marketData.data.length} comparable players`);
        console.log(`   Price range: $${Math.min(...marketData.data.map(d => d.price))} - $${Math.max(...marketData.data.map(d => d.price))}`);
      } else {
        console.log('⚠️ Market data API returned no data');
      }
    } else {
      console.log('❌ Market data API failed:', marketDataResponse.status);
    }
    
    // Test 3: Test player page
    console.log('\n3️⃣ Testing Eric Hodge player page...');
    const playerResponse = await fetch(`${baseUrl}/players/93886`);
    if (playerResponse.ok) {
      const playerHtml = await playerResponse.text();
      if (playerHtml.includes('Market Value') || playerHtml.includes('market value')) {
        console.log('✅ Player page contains market value information');
      } else {
        console.log('⚠️ Player page does not show market value');
      }
    } else {
      console.log('❌ Player page not accessible:', playerResponse.status);
    }
    
    // Test 4: Test market values sync (limited to 10 players)
    console.log('\n4️⃣ Testing market values sync (limited to 10 players)...');
    const syncResponse = await fetch(`${baseUrl}/api/debug-market-values`, {
      method: 'POST'
    });
    
    if (syncResponse.ok) {
      const syncData = await syncResponse.json();
      if (syncData.success) {
        console.log('✅ Market values sync completed successfully');
        console.log(`   Progress log entries: ${syncData.progressLog ? syncData.progressLog.length : 0}`);
        
        // Look for Eric Hodge in the logs
        if (syncData.progressLog) {
          const ericHodgeLogs = syncData.progressLog.filter(log => 
            log.includes('Eric Hodge') || log.includes('93886')
          );
          if (ericHodgeLogs.length > 0) {
            console.log('✅ Eric Hodge was processed in sync');
            ericHodgeLogs.forEach(log => console.log(`   ${log}`));
          } else {
            console.log('⚠️ Eric Hodge was not found in sync logs');
          }
        }
      } else {
        console.log('❌ Market values sync failed:', syncData.error);
      }
    } else {
      console.log('❌ Market values sync endpoint failed:', syncResponse.status);
    }
    
    // Test 5: Check database for market values
    console.log('\n5️⃣ Checking database for market values...');
    const verifyResponse = await fetch(`${baseUrl}/api/verify-sync`);
    if (verifyResponse.ok) {
      const verifyData = await verifyResponse.json();
      console.log('✅ Database verification completed');
      console.log('   Results:', JSON.stringify(verifyData, null, 2));
    } else {
      console.log('❌ Database verification failed:', verifyResponse.status);
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
}

// Run the test
testMarketValue().then(() => {
  console.log('\n🏁 Market value testing completed');
}).catch(error => {
  console.error('💥 Test runner failed:', error);
});
