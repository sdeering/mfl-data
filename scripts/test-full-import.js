#!/usr/bin/env node

/**
 * Test script for full data import with real wallet address
 * This script will test the Supabase sync service with actual MFL API data
 */

const { createClient } = require('@supabase/supabase-js');

// Import fetch for Node.js
const fetch = require('node-fetch');

// Supabase configuration
const supabaseUrl = 'https://zafwdjrvzqpqqlcowlf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InphZndkanJ2enFwcXFsY293bHVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc4MjQ0ODcsImV4cCI6MjA3MzQwMDQ4N30.7D5sWwc5qinRY5RaNfSLnGpaF_LqwQqLNoWYrgQPBIg';

const supabase = createClient(supabaseUrl, supabaseKey);

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
 * Test user info sync
 */
async function testUserInfoSync() {
  console.log('\n🔍 Testing User Info Sync...');
  
  try {
    const userInfo = await mflApiRequest(`/users/${WALLET_ADDRESS}`);
    console.log('✅ User info fetched:', {
      walletAddress: userInfo.walletAddress,
      username: userInfo.username,
      experience: userInfo.experience
    });

    // Store in Supabase
    const { error } = await supabase
      .from('users')
      .upsert({
        wallet_address: WALLET_ADDRESS,
        data: userInfo,
        last_synced: new Date().toISOString()
      });

    if (error) throw error;
    console.log('✅ User info stored in Supabase');
    
  } catch (error) {
    console.error('❌ User info sync failed:', error.message);
    throw error;
  }
}

/**
 * Test agency players sync
 */
async function testAgencyPlayersSync() {
  console.log('\n🔍 Testing Agency Players Sync...');
  
  try {
    const ownerPlayers = await mflApiRequest(`/users/${WALLET_ADDRESS}/players?limit=1200`);
    console.log(`✅ Agency players fetched: ${ownerPlayers.players?.length || 0} players`);

    if (ownerPlayers.players && ownerPlayers.players.length > 0) {
      // Store in Supabase
      const agencyPlayerData = ownerPlayers.players.map(player => ({
        wallet_address: WALLET_ADDRESS,
        mfl_player_id: player.id,
        data: player,
        last_synced: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('agency_players')
        .upsert(agencyPlayerData);

      if (error) throw error;
      console.log(`✅ ${ownerPlayers.players.length} agency players stored in Supabase`);
    } else {
      console.log('ℹ️  No agency players found');
    }
    
  } catch (error) {
    console.error('❌ Agency players sync failed:', error.message);
    throw error;
  }
}

/**
 * Test club data sync
 */
async function testClubDataSync() {
  console.log('\n🔍 Testing Club Data Sync...');
  
  try {
    const clubs = await mflApiRequest(`/users/${WALLET_ADDRESS}/clubs`);
    console.log(`✅ Club data fetched: ${clubs.clubs?.length || 0} clubs`);

    if (clubs.clubs && clubs.clubs.length > 0) {
      // Store in Supabase
      const clubData = clubs.clubs.map(club => ({
        wallet_address: WALLET_ADDRESS,
        mfl_club_id: club.id,
        data: club,
        last_synced: new Date().toISOString()
      }));

      const { error } = await supabase
        .from('clubs')
        .upsert(clubData);

      if (error) throw error;
      console.log(`✅ ${clubs.clubs.length} clubs stored in Supabase`);
    } else {
      console.log('ℹ️  No clubs found');
    }
    
  } catch (error) {
    console.error('❌ Club data sync failed:', error.message);
    throw error;
  }
}

/**
 * Test matches data sync
 */
async function testMatchesDataSync() {
  console.log('\n🔍 Testing Matches Data Sync...');
  
  try {
    // Get upcoming matches
    const upcomingMatches = await mflApiRequest(`/users/${WALLET_ADDRESS}/matches/upcoming`);
    console.log(`✅ Upcoming matches fetched: ${upcomingMatches.matches?.length || 0} matches`);

    if (upcomingMatches.matches && upcomingMatches.matches.length > 0) {
      const upcomingData = upcomingMatches.matches.map(match => ({
        wallet_address: WALLET_ADDRESS,
        mfl_match_id: match.id,
        match_type: 'upcoming',
        data: match,
        last_synced: new Date().toISOString()
      }));

      const { error: upcomingError } = await supabase
        .from('matches')
        .upsert(upcomingData);

      if (upcomingError) throw upcomingError;
      console.log(`✅ ${upcomingMatches.matches.length} upcoming matches stored in Supabase`);
    }

    // Get previous matches
    const previousMatches = await mflApiRequest(`/users/${WALLET_ADDRESS}/matches/previous`);
    console.log(`✅ Previous matches fetched: ${previousMatches.matches?.length || 0} matches`);

    if (previousMatches.matches && previousMatches.matches.length > 0) {
      const previousData = previousMatches.matches.map(match => ({
        wallet_address: WALLET_ADDRESS,
        mfl_match_id: match.id,
        match_type: 'previous',
        data: match,
        last_synced: new Date().toISOString()
      }));

      const { error: previousError } = await supabase
        .from('matches')
        .upsert(previousData);

      if (previousError) throw previousError;
      console.log(`✅ ${previousMatches.matches.length} previous matches stored in Supabase`);
    }
    
  } catch (error) {
    console.error('❌ Matches data sync failed:', error.message);
    throw error;
  }
}

/**
 * Test database connectivity
 */
async function testDatabaseConnection() {
  console.log('\n🔍 Testing Database Connection...');
  
  try {
    const { data, error } = await supabase
      .from('users')
      .select('count')
      .limit(1);

    if (error) throw error;
    console.log('✅ Database connection successful');
    
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    throw error;
  }
}

/**
 * Main test function
 */
async function runFullImportTest() {
  console.log('🚀 Starting Full Data Import Test');
  console.log(`📋 Wallet Address: ${WALLET_ADDRESS}`);
  console.log('=' * 50);

  try {
    // Test database connection first
    await testDatabaseConnection();
    
    // Run all sync tests
    await testUserInfoSync();
    await testAgencyPlayersSync();
    await testClubDataSync();
    await testMatchesDataSync();

    console.log('\n🎉 Full data import test completed successfully!');
    console.log('✅ All data has been imported to Supabase');
    
  } catch (error) {
    console.error('\n💥 Full data import test failed:', error.message);
    process.exit(1);
  }
}

// Run the test
runFullImportTest();
