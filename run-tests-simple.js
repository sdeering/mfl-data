/**
 * Simple test runner that uses the existing sync-test page
 */

const { exec } = require('child_process');
const util = require('util');
const execAsync = util.promisify(exec);

async function runTests() {
  console.log('🧪 Running sync tests using existing sync-test page...');
  
  try {
    // Open the sync-test page
    console.log('📱 Opening sync-test page...');
    await execAsync('open "http://localhost:3000/sync-test"');
    
    console.log('✅ Sync-test page opened in browser');
    console.log('📋 Please manually click "Run Debug Test" button');
    console.log('📊 Monitor the console output for test results');
    console.log('🔄 This will test the full sync flow with real data');
    
    // Also open the new comprehensive test page
    console.log('📱 Opening comprehensive test page...');
    await execAsync('open "http://localhost:3000/sync-tests"');
    
    console.log('✅ Comprehensive test page opened in browser');
    console.log('📋 Please manually click "Run All Tests" button');
    console.log('📊 This will run individual component tests');
    
  } catch (error) {
    console.error('❌ Error opening test pages:', error.message);
  }
}

runTests();
