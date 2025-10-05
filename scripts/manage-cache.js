#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const CACHE_DIR = path.join(process.cwd(), '.cache', 'player-ratings');
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds

function getCacheStats() {
  if (!fs.existsSync(CACHE_DIR)) {
    console.log('Cache directory does not exist');
    return;
  }

  const files = fs.readdirSync(CACHE_DIR);
  const now = Date.now();
  let totalSize = 0;
  let expiredCount = 0;
  let validCount = 0;

  files.forEach(file => {
    if (file.endsWith('.json')) {
      const filePath = path.join(CACHE_DIR, file);
      const stats = fs.statSync(filePath);
      const cacheAge = now - stats.mtime.getTime();
      const isExpired = cacheAge > CACHE_DURATION;
      
      totalSize += stats.size;
      
      if (isExpired) {
        expiredCount++;
      } else {
        validCount++;
      }
    }
  });

  console.log(`Cache Statistics:`);
  console.log(`- Total files: ${files.length}`);
  console.log(`- Valid cache entries: ${validCount}`);
  console.log(`- Expired cache entries: ${expiredCount}`);
  console.log(`- Total cache size: ${(totalSize / 1024).toFixed(2)} KB`);
}

function clearExpiredCache() {
  if (!fs.existsSync(CACHE_DIR)) {
    console.log('Cache directory does not exist');
    return;
  }

  const files = fs.readdirSync(CACHE_DIR);
  const now = Date.now();
  let removedCount = 0;

  files.forEach(file => {
    if (file.endsWith('.json')) {
      const filePath = path.join(CACHE_DIR, file);
      const stats = fs.statSync(filePath);
      const cacheAge = now - stats.mtime.getTime();
      
      if (cacheAge > CACHE_DURATION) {
        fs.unlinkSync(filePath);
        removedCount++;
        console.log(`Removed expired cache: ${file}`);
      }
    }
  });

  console.log(`\nRemoved ${removedCount} expired cache entries`);
}

function clearAllCache() {
  if (!fs.existsSync(CACHE_DIR)) {
    console.log('Cache directory does not exist');
    return;
  }

  const files = fs.readdirSync(CACHE_DIR);
  let removedCount = 0;

  files.forEach(file => {
    if (file.endsWith('.json')) {
      const filePath = path.join(CACHE_DIR, file);
      fs.unlinkSync(filePath);
      removedCount++;
    }
  });

  console.log(`Removed ${removedCount} cache entries`);
}

function showCacheEntry(playerId) {
  const filePath = path.join(CACHE_DIR, `${playerId}.json`);
  
  if (!fs.existsSync(filePath)) {
    console.log(`No cache entry found for player ${playerId}`);
    return;
  }

  const cacheData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  const stats = fs.statSync(filePath);
  const now = Date.now();
  const cacheAge = now - stats.mtime.getTime();
  const isExpired = cacheAge > CACHE_DURATION;

  console.log(`Cache entry for player ${playerId}:`);
  console.log(`- Cached at: ${new Date(stats.mtime).toISOString()}`);
  console.log(`- Age: ${Math.floor(cacheAge / (1000 * 60 * 60))} hours`);
  console.log(`- Expired: ${isExpired ? 'Yes' : 'No'}`);
  console.log(`- Success: ${cacheData.success}`);
  console.log(`- Position ratings: ${cacheData.positionRatings?.length || 0}`);
  
  if (cacheData.positionRatings?.length > 0) {
    console.log(`- Primary position: ${cacheData.positionRatings.find(r => r.familiarity === 'PRIMARY')?.position || 'None'}`);
  }
}

// Parse command line arguments
const command = process.argv[2];
const playerId = process.argv[3];

switch (command) {
  case 'stats':
    getCacheStats();
    break;
  case 'clear-expired':
    clearExpiredCache();
    break;
  case 'clear-all':
    clearAllCache();
    break;
  case 'show':
    if (!playerId) {
      console.log('Usage: node scripts/manage-cache.js show <playerId>');
      process.exit(1);
    }
    showCacheEntry(playerId);
    break;
  default:
    console.log('Cache Management Utility');
    console.log('');
    console.log('Usage:');
    console.log('  node scripts/manage-cache.js stats                    - Show cache statistics');
    console.log('  node scripts/manage-cache.js clear-expired            - Remove expired cache entries');
    console.log('  node scripts/manage-cache.js clear-all                - Remove all cache entries');
    console.log('  node scripts/manage-cache.js show <playerId>          - Show specific cache entry');
    console.log('');
    console.log('Examples:');
    console.log('  node scripts/manage-cache.js stats');
    console.log('  node scripts/manage-cache.js show 116267');
    console.log('  node scripts/manage-cache.js clear-expired');
    break;
}
