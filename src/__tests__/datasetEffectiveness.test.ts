import XLSX from 'xlsx';
import path from 'path';
import { calculateAllPositionOVRs } from '../utils/ruleBasedPositionCalculator';
import { convertDatasetPlayerToOVRFormat } from '../utils/datasetConverter';

describe('Dataset Effectiveness Analysis', () => {
  let dataset: any[] = [];

  beforeAll(() => {
    try {
      // Load the dataset
      const filePath = path.join(__dirname, '../../Data/600-player-data-scraped.xlsx');
      const workbook = XLSX.readFile(filePath);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      dataset = XLSX.utils.sheet_to_json(worksheet);
      console.log(`📊 Loaded ${dataset.length} players from dataset`);
    } catch (error) {
      console.error('❌ Error loading dataset:', error);
      dataset = [];
    }
  });

  it('should analyze algorithm effectiveness on the full dataset', () => {
    if (dataset.length === 0) {
      console.log('⚠️  No dataset available, skipping test');
      return;
    }

    console.log('\n🔍 Analyzing Rule-Based Algorithm Effectiveness...\n');

    // Analyze the data structure
    const samplePlayer = dataset[0];
    console.log('📋 Sample player data structure:');
    console.log(JSON.stringify(samplePlayer, null, 2));
    console.log('\n');

    // Test our algorithm on a few sample players first
    console.log('🧪 Testing algorithm on sample players...\n');

    let totalPlayers = 0;
    let successfulCalculations = 0;
    let errors = 0;
    const errorDetails: Array<{ player: string; error: string }> = [];

    // Test first 10 players to see the structure
    const testPlayers = dataset.slice(0, 10);
    
    for (let i = 0; i < testPlayers.length; i++) {
      const player = dataset[i];
      console.log(`\n--- Player ${i + 1}: ${player.firstName || 'Unknown'} ${player.lastName || 'Unknown'} ---`);
      
      try {
        // Convert to our format
        const convertedPlayer = convertDatasetPlayerToOVRFormat(player);
        console.log(`✅ Converted successfully`);
        console.log(`   ID: ${convertedPlayer.id}`);
        console.log(`   Name: ${convertedPlayer.name}`);
        console.log(`   Positions: ${convertedPlayer.positions.join(', ')}`);
        console.log(`   Attributes: PAC:${convertedPlayer.attributes.PAC}, SHO:${convertedPlayer.attributes.SHO}, PAS:${convertedPlayer.attributes.PAS}, DRI:${convertedPlayer.attributes.DRI}, DEF:${convertedPlayer.attributes.DEF}, PHY:${convertedPlayer.attributes.PHY}`);

        // Calculate all position ratings
        const results = calculateAllPositionOVRs(convertedPlayer);
        
        if (results.success) {
          console.log(`✅ Calculated ${Object.keys(results.results).length} position ratings`);
          
          // Show top 3 positions
          const topPositions = Object.values(results.results)
            .filter(r => r.success)
            .sort((a, b) => b.ovr - a.ovr)
            .slice(0, 3);
          
          console.log(`   Top positions:`);
          topPositions.forEach(pos => {
            console.log(`     ${pos.position}: ${pos.ovr} (${pos.familiarity})`);
          });
          
          successfulCalculations++;
        } else {
          console.log(`❌ Calculation failed: ${results.error?.message}`);
          errors++;
          errorDetails.push({
            player: `${player.firstName || 'Unknown'} ${player.lastName || 'Unknown'}`,
            error: results.error?.message || 'Unknown error'
          });
        }
        
        totalPlayers++;
        
      } catch (error) {
        console.log(`❌ Error processing player: ${error instanceof Error ? error.message : 'Unknown error'}`);
        errors++;
        errorDetails.push({
          player: `${player.firstName || 'Unknown'} ${player.lastName || 'Unknown'}`,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        totalPlayers++;
      }
    }

    // Summary statistics for sample
    console.log('\n' + '='.repeat(60));
    console.log('📈 SAMPLE ALGORITHM EFFECTIVENESS SUMMARY');
    console.log('='.repeat(60));
    console.log(`Total players tested: ${totalPlayers}`);
    console.log(`Successful calculations: ${successfulCalculations}`);
    console.log(`Errors: ${errors}`);
    console.log(`Success rate: ${((successfulCalculations / totalPlayers) * 100).toFixed(2)}%`);

    if (errorDetails.length > 0) {
      console.log('\n❌ Error Details:');
      errorDetails.forEach((detail, index) => {
        console.log(`${index + 1}. ${detail.player}: ${detail.error}`);
      });
    }

    // Now test the full dataset
    console.log('\n' + '='.repeat(60));
    console.log('🚀 TESTING FULL DATASET...');
    console.log('='.repeat(60));

    let fullDatasetSuccess = 0;
    let fullDatasetErrors = 0;
    const fullDatasetErrorDetails: Array<{ player: string; error: string }> = [];

    for (let i = 0; i < dataset.length; i++) {
      const player = dataset[i];
      
      try {
        const convertedPlayer = convertDatasetPlayerToOVRFormat(player);
        const results = calculateAllPositionOVRs(convertedPlayer);
        
        if (results.success) {
          fullDatasetSuccess++;
        } else {
          fullDatasetErrors++;
          fullDatasetErrorDetails.push({
            player: `${player.firstName || 'Unknown'} ${player.lastName || 'Unknown'}`,
            error: results.error?.message || 'Unknown error'
          });
        }
      } catch (error) {
        fullDatasetErrors++;
        fullDatasetErrorDetails.push({
          player: `${player.firstName || 'Unknown'} ${player.lastName || 'Unknown'}`,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Progress indicator
      if ((i + 1) % 50 === 0) {
        console.log(`Processed ${i + 1}/${dataset.length} players...`);
      }
    }

    // Final results
    console.log('\n' + '='.repeat(60));
    console.log('🎯 FINAL ALGORITHM EFFECTIVENESS RESULTS');
    console.log('='.repeat(60));
    console.log(`Total players in dataset: ${dataset.length}`);
    console.log(`Successful calculations: ${fullDatasetSuccess}`);
    console.log(`Errors: ${fullDatasetErrors}`);
    console.log(`Success rate: ${((fullDatasetSuccess / dataset.length) * 100).toFixed(2)}%`);

    if (fullDatasetErrorDetails.length > 0) {
      console.log('\n❌ Error Summary (showing first 10):');
      fullDatasetErrorDetails.slice(0, 10).forEach((detail, index) => {
        console.log(`${index + 1}. ${detail.player}: ${detail.error}`);
      });
      
      if (fullDatasetErrorDetails.length > 10) {
        console.log(`... and ${fullDatasetErrorDetails.length - 10} more errors`);
      }
    }

    // Success rate analysis
    const successRate = (fullDatasetSuccess / dataset.length) * 100;
    console.log('\n' + '='.repeat(60));
    console.log('🏆 SUCCESS RATE ANALYSIS');
    console.log('='.repeat(60));
    
    if (successRate === 100) {
      console.log('🎉 PERFECT! 100% success rate achieved!');
      console.log('✅ Our rule-based algorithm works flawlessly on the entire dataset');
    } else if (successRate >= 95) {
      console.log('🌟 EXCELLENT! 95%+ success rate achieved!');
      console.log('✅ Our rule-based algorithm works very well on the dataset');
    } else if (successRate >= 90) {
      console.log('👍 GOOD! 90%+ success rate achieved!');
      console.log('✅ Our rule-based algorithm works well on the dataset');
    } else if (successRate >= 80) {
      console.log('⚠️  ACCEPTABLE! 80%+ success rate achieved!');
      console.log('⚠️  Some improvements may be needed');
    } else {
      console.log('❌ NEEDS IMPROVEMENT! Success rate below 80%');
      console.log('🔧 Algorithm needs significant improvements');
    }

    // Assertions for the test
    expect(dataset.length).toBeGreaterThan(0);
    expect(fullDatasetSuccess).toBeGreaterThan(0);
    expect(successRate).toBeGreaterThan(0);
    
    // Log the final success rate for easy reference
    console.log(`\n📊 FINAL SUCCESS RATE: ${successRate.toFixed(2)}%`);
  }, 300000); // 5 minute timeout for large dataset
});
