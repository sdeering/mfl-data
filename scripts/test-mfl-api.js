#!/usr/bin/env node

/**
 * Test script to verify MFL API connectivity and data structure
 * This will help us understand the data before importing to Supabase
 */

const fetch = require('node-fetch');

// Test wallet address
const WALLET_ADDRESS = '0x95dc70d7d39f6f76';

// MFL API configuration
const MFL_API_BASE = 'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod';

/**
 * Make HTTP request to MFL API
 */
async function mflApiRequest(endpoint) {
  const url = `${MFL_API_BASE}${endpoint}`;
  console.log(`📡 Fetching: ${url}`);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  
  return await response.json();
}

/**
 * Test user info
 */
async function testUserInfo() {
  console.log('\n🔍 Testing User Info...');
  
  try {
    const userInfo = await mflApiRequest(`/users/${WALLET_ADDRESS}`);
    console.log('✅ User info fetched successfully');
    console.log('📊 User data structure:', {
      walletAddress: userInfo.walletAddress,
      username: userInfo.username,
      experience: userInfo.experience,
      hasClubs: !!userInfo.clubs,
      clubsCount: userInfo.clubs?.length || 0
    });
    
    return userInfo;
  } catch (error) {
    console.error('❌ User info fetch failed:', error.message);
    throw error;
  }
}

/**
 * Test agency players
 */
async function testAgencyPlayers() {
  console.log('\n🔍 Testing Agency Players...');
  
  try {
    const ownerPlayers = await mflApiRequest(`/users/${WALLET_ADDRESS}/players?limit=1200`);
    console.log('✅ Agency players fetched successfully');
    console.log('📊 Agency players data structure:', {
      totalPlayers: ownerPlayers.players?.length || 0,
      hasPlayers: !!ownerPlayers.players,
      firstPlayer: ownerPlayers.players?.[0] ? {
        id: ownerPlayers.players[0].id,
        name: ownerPlayers.players[0].name,
        position: ownerPlayers.players[0].position,
        overall: ownerPlayers.players[0].overall
      } : null
    });
    
    return ownerPlayers;
  } catch (error) {
    console.error('❌ Agency players fetch failed:', error.message);
    throw error;
  }
}

/**
 * Test club data
 */
async function testClubData() {
  console.log('\n🔍 Testing Club Data...');
  
  try {
    const clubs = await mflApiRequest(`/users/${WALLET_ADDRESS}/clubs`);
    console.log('✅ Club data fetched successfully');
    console.log('📊 Club data structure:', {
      totalClubs: clubs.clubs?.length || 0,
      hasClubs: !!clubs.clubs,
      firstClub: clubs.clubs?.[0] ? {
        id: clubs.clubs[0].id,
        name: clubs.clubs[0].name,
        hasSquad: !!clubs.clubs[0].squad
      } : null
    });
    
    return clubs;
  } catch (error) {
    console.error('❌ Club data fetch failed:', error.message);
    throw error;
  }
}

/**
 * Test matches data
 */
async function testMatchesData() {
  console.log('\n🔍 Testing Matches Data...');
  
  try {
    // Test upcoming matches
    const upcomingMatches = await mflApiRequest(`/users/${WALLET_ADDRESS}/matches/upcoming`);
    console.log('✅ Upcoming matches fetched successfully');
    console.log('📊 Upcoming matches structure:', {
      totalMatches: upcomingMatches.matches?.length || 0,
      hasMatches: !!upcomingMatches.matches,
      firstMatch: upcomingMatches.matches?.[0] ? {
        id: upcomingMatches.matches[0].id,
        homeTeam: upcomingMatches.matches[0].homeTeamName,
        awayTeam: upcomingMatches.matches[0].awayTeamName,
        date: upcomingMatches.matches[0].date
      } : null
    });

    // Test previous matches
    const previousMatches = await mflApiRequest(`/users/${WALLET_ADDRESS}/matches/previous`);
    console.log('✅ Previous matches fetched successfully');
    console.log('📊 Previous matches structure:', {
      totalMatches: previousMatches.matches?.length || 0,
      hasMatches: !!previousMatches.matches,
      firstMatch: previousMatches.matches?.[0] ? {
        id: previousMatches.matches[0].id,
        homeTeam: previousMatches.matches[0].homeTeamName,
        awayTeam: previousMatches.matches[0].awayTeamName,
        result: previousMatches.matches[0].result,
        date: previousMatches.matches[0].date
      } : null
    });
    
    return { upcomingMatches, previousMatches };
  } catch (error) {
    console.error('❌ Matches data fetch failed:', error.message);
    throw error;
  }
}

/**
 * Main test function
 */
async function runMflApiTest() {
  console.log('🚀 Starting MFL API Test');
  console.log(`📋 Wallet Address: ${WALLET_ADDRESS}`);
  console.log('='.repeat(50));

  try {
    // Test all endpoints
    const userInfo = await testUserInfo();
    const agencyPlayers = await testAgencyPlayers();
    const clubData = await testClubData();
    const matchesData = await testMatchesData();

    console.log('\n🎉 MFL API test completed successfully!');
    console.log('✅ All endpoints are accessible and returning data');
    console.log('\n📈 Summary:');
    console.log(`   👤 User: ${userInfo.username} (${userInfo.walletAddress})`);
    console.log(`   🏃 Players: ${agencyPlayers.players?.length || 0} agency players`);
    console.log(`   🏟️  Clubs: ${clubData.clubs?.length || 0} clubs`);
    console.log(`   ⚽ Upcoming matches: ${matchesData.upcomingMatches.matches?.length || 0}`);
    console.log(`   📅 Previous matches: ${matchesData.previousMatches.matches?.length || 0}`);
    
  } catch (error) {
    console.error('\n💥 MFL API test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
runMflApiTest();

