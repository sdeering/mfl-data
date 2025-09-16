import { NextRequest, NextResponse } from 'next/server';
import { getPlayerMarketValue } from '../../../../src/services/marketValueService';

// In-memory job queue (in production, use Redis with Bull/BullMQ)
const jobQueue = new Map<string, {
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  total: number;
  currentPlayer?: string;
  error?: string;
  results: Array<{ playerId: string; marketValue: number; success: boolean }>;
  walletAddress: string;
  playerIds: string[];
  startedAt: Date;
}>();

export async function POST(request: NextRequest) {
  try {
    const { walletAddress, playerIds, forceRecalculate = false, limit } = await request.json();
    
    if (!playerIds || !Array.isArray(playerIds) || playerIds.length === 0) {
      return NextResponse.json({ error: 'Player IDs array required' }, { status: 400 });
    }

    // Check if there's already a sync in progress for this wallet
    const existingJob = Array.from(jobQueue.values()).find(job => 
      job.walletAddress === walletAddress && 
      (job.status === 'pending' || job.status === 'running')
    );

    if (existingJob && !forceRecalculate) {
      console.log(`🔄 Found existing sync for wallet ${walletAddress}, returning existing job ID`);
      const existingJobId = Array.from(jobQueue.entries()).find(([_, job]) => job === existingJob)?.[0];
      return NextResponse.json({ 
        success: true, 
        jobId: existingJobId,
        message: `Resuming existing market value sync for ${existingJob.total} players`,
        totalPlayers: existingJob.total,
        resumed: true
      });
    }

    // Apply limit only if provided (for production, no limit by default)
    const limitedPlayerIds = limit ? playerIds.slice(0, Math.min(limit, 50)) : playerIds;
    
    if (limit && limitedPlayerIds.length < playerIds.length) {
      console.log(`⚠️ Limited sync to ${limitedPlayerIds.length} players (from ${playerIds.length}) for testing`);
    } else if (!limit) {
      console.log(`🚀 Production sync: processing all ${playerIds.length} players`);
    }

    const jobId = `market-value-sync-${Date.now()}`;
    
    // Initialize job in queue
    jobQueue.set(jobId, {
      status: 'pending',
      progress: 0,
      total: limitedPlayerIds.length,
      results: [],
      walletAddress,
      playerIds: limitedPlayerIds,
      startedAt: new Date()
    });

    // Start background processing (don't await)
    processMarketValueSync(jobId, limitedPlayerIds, walletAddress, forceRecalculate);

    return NextResponse.json({ 
      success: true, 
      jobId,
      message: `Market value sync started for ${limitedPlayerIds.length} players`,
      totalPlayers: playerIds.length,
      limitedPlayers: limit ? limitedPlayerIds.length : undefined
    });

  } catch (error) {
    console.error('Error starting market value sync:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const jobId = searchParams.get('jobId');
    const walletAddress = searchParams.get('walletAddress');
    
    // Clean up old completed jobs (older than 1 hour)
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    for (const [id, job] of jobQueue.entries()) {
      if ((job.status === 'completed' || job.status === 'failed') && job.startedAt < oneHourAgo) {
        jobQueue.delete(id);
      }
    }
    
    if (walletAddress) {
      // Return all active jobs for this wallet
      const activeJobs = Array.from(jobQueue.entries())
        .filter(([_, job]) => job.walletAddress === walletAddress && (job.status === 'pending' || job.status === 'running'))
        .map(([id, job]) => ({
          jobId: id,
          status: job.status,
          progress: job.progress,
          total: job.total,
          percentage: Math.round((job.progress / job.total) * 100),
          currentPlayer: job.currentPlayer,
          error: job.error,
          startedAt: job.startedAt
        }));
      
      return NextResponse.json({
        success: true,
        activeJobs,
        count: activeJobs.length
      });
    }
    
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID or wallet address required' }, { status: 400 });
    }

    const job = jobQueue.get(jobId);
    if (!job) {
      return NextResponse.json({ error: 'Job not found' }, { status: 404 });
    }

    return NextResponse.json({
      jobId,
      status: job.status,
      progress: job.progress,
      total: job.total,
      percentage: Math.round((job.progress / job.total) * 100),
      currentPlayer: job.currentPlayer,
      error: job.error,
      results: job.results,
      startedAt: job.startedAt
    });

  } catch (error) {
    console.error('Error getting sync status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function processMarketValueSync(
  jobId: string, 
  playerIds: string[], 
  walletAddress: string, 
  forceRecalculate: boolean
) {
  const job = jobQueue.get(jobId);
  if (!job) return;

  try {
    job.status = 'running';
    
    for (let i = 0; i < playerIds.length; i++) {
      const playerId = playerIds[i];
      
      // Update progress
      job.progress = i;
      job.currentPlayer = `Calculating market value for player #${playerId} (${i + 1}/${playerIds.length})`;
      
      try {
        console.log(`🔄 Processing player ${playerId} (${i + 1}/${playerIds.length})`);
        
        // Only force recalculate if explicitly requested, otherwise respect 7-day cache
        const result = await getPlayerMarketValue(playerId, walletAddress, forceRecalculate);
        
        if (result.success) {
          job.results.push({
            playerId,
            marketValue: result.marketValue || 0,
            success: true
          });
          console.log(`✅ Player ${playerId}: $${result.marketValue}`);
        } else {
          job.results.push({
            playerId,
            marketValue: 0,
            success: false
          });
          console.log(`❌ Player ${playerId}: ${result.error}`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing player ${playerId}:`, error);
        job.results.push({
          playerId,
          marketValue: 0,
          success: false
        });
      }
      
      // Small delay to prevent overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Mark as completed
    job.status = 'completed';
    job.progress = playerIds.length;
    job.currentPlayer = 'Sync completed';
    
    console.log(`✅ Market value sync completed for ${playerIds.length} players`);
    
  } catch (error) {
    console.error('❌ Market value sync failed:', error);
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : 'Unknown error';
  }
}
