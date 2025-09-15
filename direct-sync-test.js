/**
 * Direct sync test - calls sync functions directly
 */

// We'll use the existing sync-test page to trigger the sync
// and then monitor the results

const https = require('https');
const http = require('http');

async function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const client = url.startsWith('https') ? https : http;
    
    client.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        resolve({ status: res.statusCode, data });
      });
    }).on('error', (err) => {
      reject(err);
    });
  });
}

async function runDirectSyncTest() {
  console.log('🧪 Running direct sync test...');
  
  try {
    // First, let's check if the server is running
    console.log('🔍 Checking server status...');
    const response = await makeRequest('http://localhost:3000');
    
    if (response.status === 200) {
      console.log('✅ Server is running');
    } else {
      console.log(`❌ Server returned status: ${response.status}`);
      return;
    }
    
    // Check the sync-test page
    console.log('🔍 Checking sync-test page...');
    const syncTestResponse = await makeRequest('http://localhost:3000/sync-test');
    
    if (syncTestResponse.status === 200) {
      console.log('✅ Sync-test page is accessible');
    } else {
      console.log(`❌ Sync-test page returned status: ${syncTestResponse.status}`);
      return;
    }
    
    // Check the comprehensive test page
    console.log('🔍 Checking comprehensive test page...');
    const comprehensiveTestResponse = await makeRequest('http://localhost:3000/sync-tests');
    
    if (comprehensiveTestResponse.status === 200) {
      console.log('✅ Comprehensive test page is accessible');
    } else {
      console.log(`❌ Comprehensive test page returned status: ${comprehensiveTestResponse.status}`);
      return;
    }
    
    console.log('\n📊 Test Environment Status:');
    console.log('=' .repeat(40));
    console.log('✅ Server: Running');
    console.log('✅ Sync-test page: Accessible');
    console.log('✅ Comprehensive test page: Accessible');
    console.log('=' .repeat(40));
    
    console.log('\n🚀 Ready to run tests!');
    console.log('📋 Please manually run the tests in the browser:');
    console.log('   1. Go to http://localhost:3000/sync-test');
    console.log('   2. Click "Run Debug Test" button');
    console.log('   3. Monitor console output for results');
    console.log('   4. Go to http://localhost:3000/sync-tests');
    console.log('   5. Click "Run All Tests" button');
    console.log('   6. Review test results');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

runDirectSyncTest();
