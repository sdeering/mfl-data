import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js'
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
    
    // Process players in batches for better performance
    const BATCH_SIZE = 5; // Process 5 players in parallel
    const batches = [];
    
    for (let i = 0; i < playerIds.length; i += BATCH_SIZE) {
      batches.push(playerIds.slice(i, i + BATCH_SIZE));
    }
    
    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      
      // Update progress for the batch (show total players in brackets)
      job.currentPlayer = `Processing batch ${batchIndex + 1}/${batches.length} (${job.total} players total)`;
      
      // Process batch in parallel
      const batchPromises = batch.map(async (playerId, playerIndex) => {
        const globalIndex = batchIndex * BATCH_SIZE + playerIndex;
        
        try {
          console.log(`🔄 Processing player ${playerId} (${globalIndex + 1}/${playerIds.length})`);
          
          // Only force recalculate if explicitly requested, otherwise respect 7-day cache
          const result = await getPlayerMarketValue(playerId, walletAddress, forceRecalculate);
          
          if (result.success) {
            console.log(`✅ Player ${playerId}: $${result.marketValue}`);
            return {
              playerId,
              marketValue: result.marketValue || 0,
              success: true
            };
          } else {
            console.log(`❌ Player ${playerId}: ${result.error}`);
            return {
              playerId,
              marketValue: 0,
              success: false
            };
          }
          
        } catch (error) {
          console.error(`❌ Error processing player ${playerId}:`, error);
          return {
            playerId,
            marketValue: 0,
            success: false
          };
        }
      });
      
      // Wait for batch to complete
      const batchResults = await Promise.all(batchPromises);
      job.results.push(...batchResults);
      
      // Update progress
      job.progress = Math.min((batchIndex + 1) * BATCH_SIZE, playerIds.length);
      
      // Small delay between batches to prevent overwhelming the system
      if (batchIndex < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    // Mark as completed
    job.status = 'completed';
    job.progress = playerIds.length;
    job.currentPlayer = 'Sync completed';
    
    console.log(`✅ Market value sync completed for ${playerIds.length} players`);

    // Write wallet-scoped SYNC_STATUS gate so front-end will not resync for 7 days
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      if (supabaseUrl && supabaseAnonKey) {
        const supabase = createClient(supabaseUrl, supabaseAnonKey)
        const dataType = `agency_player_market_values:${walletAddress}`
        await supabase
          .from('sync_status')
          .upsert({
            data_type: dataType,
            status: 'completed',
            progress_percentage: 100,
            last_synced: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            error_message: null
          }, { onConflict: 'data_type' })
      } else {
        console.warn('Skipping SYNC_STATUS write: Supabase env vars not set')
      }
    } catch (e) {
      console.warn('Warning: could not update SYNC_STATUS for market values gate:', e)
    }
    
  } catch (error) {
    console.error('❌ Market value sync failed:', error);
    job.status = 'failed';
    job.error = error instanceof Error ? error.message : 'Unknown error';
  }
}
