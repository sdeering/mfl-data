'use client';

import { useState } from 'react';
import { useWallet } from '../contexts/WalletContext';
import { matchesService } from '../services/matchesService';
import { userService } from '../services/userService';
import { clubsService } from '../services/clubsService';
import { clubPlayersService } from '../services/clubPlayersService';
import { nftService } from '../services/nftService';
import { playerExperienceService } from '../services/playerExperienceService';
import { fetchPlayerMatches } from '../services/playerMatchesService';
import { fetchPlayerSaleHistory } from '../services/playerSaleHistoryService';
import { mflApi } from '../services/mflApi';

export default function CacheVerificationTest() {
  const { account, isConnected } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<any>(null);

  // Helper function to run cache tests consistently
  const runCacheTestForService = async (
    serviceName: string,
    testFunction: () => Promise<any>,
    url: string
  ) => {
    console.log(`🔍 Testing ${serviceName} cache...`);
    
    // Don't clear cache - we want to test if cache is working properly
    // if (serviceName.includes('matchesService')) {
    //   matchesService.clearCache();
    // }
    
    const start1 = Date.now();
    await testFunction();
    const end1 = Date.now();
    const time1 = end1 - start1;
    
    console.log(`📊 ${serviceName} first call: ${time1}ms`);
    
    // Small delay to ensure timing difference
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const start2 = Date.now();
    await testFunction();
    const end2 = Date.now();
    const time2 = end2 - start2;
    
    console.log(`📊 ${serviceName} second call: ${time2}ms`);
    
    const cacheWorking = time2 < time1 / 2 || (time1 === 0 && time2 === 0);
    console.log(`✅ ${serviceName} cache: ${cacheWorking ? 'Working' : 'Not Working'}`);
    
    return {
      service: serviceName,
      url,
      firstCall: `${time1}ms`,
      secondCall: `${time2}ms`,
      cacheWorking
    };
  };

  const runCacheTest = async () => {
    if (!account || !isConnected) return;
    
    console.log('🧪 Starting cache verification test...');
    setIsLoading(true);
    setResults(null);
    
    try {
      const testResults: any = {
        timestamp: new Date().toISOString(),
        tests: []
      };
      
      // Test 1: User Service Cache
      testResults.tests.push(await runCacheTestForService(
        'userService',
        () => userService.fetchUserByWallet(account),
        'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/clubs?walletAddress=' + account
      ));
      
      // Test 2: Clubs Service Cache
      testResults.tests.push(await runCacheTestForService(
        'clubsService',
        () => clubsService.fetchClubsForWallet(account),
        'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/clubs?walletAddress=' + account
      ));
      
      // Test 3: Matches Service Cache (Upcoming)
      testResults.tests.push(await runCacheTestForService(
        'matchesService (upcoming)',
        () => matchesService.fetchUpcomingMatches('28'),
        'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/matches (upcoming)'
      ));
      
      // Test 4: Matches Service Past Matches Cache
      testResults.tests.push(await runCacheTestForService(
        'matchesService (past)',
        () => matchesService.fetchPastMatches('28'),
        'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/matches (past)'
      ));
      
      // Test 5: MFL API Player Progressions Cache
      try {
        testResults.tests.push(await runCacheTestForService(
          'mflApi (progressions)',
          () => mflApi.getPlayerProgressions([93886, 116267], 'ALL'),
          'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/progressions?playersIds=93886,116267&interval=ALL'
        ));
      } catch (error) {
        console.warn('⚠️ Progressions test failed:', error);
        testResults.tests.push({
          service: 'mflApi (progressions)',
          url: 'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/progressions?playersIds=93886,116267&interval=ALL',
          firstCall: 'N/A',
          secondCall: 'N/A',
          cacheWorking: false,
          error: 'API Error - 400 Bad Request'
        });
      }
      
      // Test 6: MFL API Player Experience History Cache
      try {
        testResults.tests.push(await runCacheTestForService(
          'mflApi (experience history)',
          () => mflApi.getPlayerExperienceHistory(93886),
          'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/93886/experiences/history'
        ));
      } catch (error) {
        console.warn('⚠️ Experience history test failed:', error);
        testResults.tests.push({
          service: 'mflApi (experience history)',
          url: 'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/93886/experiences/history',
          firstCall: 'N/A',
          secondCall: 'N/A',
          cacheWorking: false,
          error: 'API Error'
        });
      }
      
      // Test 7: MFL API Player Data Cache
      testResults.tests.push(await runCacheTestForService(
        'mflApi (player)',
        () => mflApi.getPlayer(93886),
        'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players/93886'
      ));
      
      // Test 8: Club Players Service Cache
      testResults.tests.push(await runCacheTestForService(
        'clubPlayersService',
        () => clubPlayersService.fetchPlayersForClub('28'),
        'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/clubs/28/players'
      ));
      
      // Test 9: NFT Service Cache
      testResults.tests.push(await runCacheTestForService(
        'nftService',
        () => nftService.fetchNFTsForWallet(account),
        'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/players?ownerWalletAddress=' + account + '&limit=1200'
      ));
      
      // Test 10: Opponent Matches Service Cache (12-hour cache)
      try {
        testResults.tests.push(await runCacheTestForService(
          'opponentMatchesService',
          () => matchesService.fetchOpponentPastMatches(482, 5),
          'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/matches?squadId=482&past=true&limit=5'
        ));
      } catch (error) {
        console.warn('⚠️ Opponent matches test failed:', error);
        testResults.tests.push({
          service: 'opponentMatchesService',
          url: 'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/matches?squadId=482&past=true&limit=5',
          firstCall: 'N/A',
          secondCall: 'N/A',
          cacheWorking: false,
          error: 'API Error'
        });
      }
      
      // Add summary
      const workingCaches = testResults.tests.filter((test: any) => test.cacheWorking).length;
      const totalTests = testResults.tests.length;
      
      console.log(`🎯 Cache Test Summary: ${workingCaches}/${totalTests} caches working`);
      console.log('📊 Detailed results:', testResults.tests);
      
      setResults(testResults);
      
    } catch (error) {
      console.error('❌ Cache test failed:', error);
      setResults({ error: error instanceof Error ? error.message : 'Unknown error' });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isConnected || !account) {
    return (
      <div className="p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
        <h2 className="text-lg font-semibold text-yellow-800">Cache Verification Test</h2>
        <p className="text-yellow-700">Please connect your wallet to run the cache test.</p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow">
      <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
        Cache Verification Test
      </h2>
      
      <div className="mb-4">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
          This test verifies that 1-hour caching is working by comparing response times.
        </p>
        <button
          onClick={runCacheTest}
          disabled={isLoading}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
        >
          {isLoading ? 'Running Test...' : 'Run Cache Test'}
        </button>
      </div>

      {results && (
        <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Results:</h3>
          <div className="space-y-2">
            {results.tests?.map((test: any, index: number) => (
              <div key={index} className="p-2 bg-white dark:bg-gray-600 rounded">
                <div className="font-medium">{test.service}</div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mb-1 break-all">
                  {test.url}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  First call: {test.firstCall} | Second call: {test.secondCall}
                </div>
                <div className={`text-sm font-medium ${test.cacheWorking ? 'text-green-600' : 'text-red-600'}`}>
                  Cache: {test.cacheWorking ? '✅ Working' : '❌ Not Working'}
                </div>
                {test.error && (
                  <div className="text-xs text-red-500 mt-1">
                    Error: {test.error}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
