#!/usr/bin/env node

/**
 * Test runner for market value protection features
 * Tests: 7-day expiration, rate limiting, 10-player limit
 */

const { execSync } = require('child_process');
const path = require('path');

console.log('🧪 Running Market Value Protection Tests...\n');

const testFiles = [
  'src/__tests__/marketValueProtection.test.ts'
];

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

testFiles.forEach((testFile, index) => {
  console.log(`📋 Running ${index + 1}/${testFiles.length}: ${testFile}`);
  
  try {
    const result = execSync(`npx jest ${testFile} --verbose --no-coverage`, {
      encoding: 'utf8',
      stdio: 'pipe'
    });
    
    console.log('✅ PASSED\n');
    passedTests++;
    
    // Extract test count from output
    const testMatch = result.match(/(\d+) tests?/);
    if (testMatch) {
      totalTests += parseInt(testMatch[1]);
    }
    
  } catch (error) {
    console.log('❌ FAILED');
    console.log(error.stdout || error.message);
    console.log('');
    failedTests++;
  }
});

console.log('📊 Test Summary:');
console.log(`   Total Test Files: ${testFiles.length}`);
console.log(`   Passed: ${passedTests}`);
console.log(`   Failed: ${failedTests}`);
console.log(`   Success Rate: ${((passedTests / testFiles.length) * 100).toFixed(1)}%`);

if (failedTests === 0) {
  console.log('\n🎉 All market value protection tests passed!');
  console.log('✅ 7-day expiration logic is working');
  console.log('✅ Rate limiting is functional');
  console.log('✅ 10-player limit is enforced');
  console.log('✅ Integration tests are passing');
} else {
  console.log('\n⚠️  Some tests failed. Please review the output above.');
  process.exit(1);
}
