import { supabase } from '../lib/supabase';

export interface OpponentMatchData {
  id: string;
  opponent_squad_id: number;
  match_limit: number;
  matches_data: any[];
  formations_data: string[];
  last_synced: string;
  created_at: string;
  updated_at: string;
}

class OpponentMatchesService {
  private static instance: OpponentMatchesService;

  public static getInstance(): OpponentMatchesService {
    if (!OpponentMatchesService.instance) {
      OpponentMatchesService.instance = new OpponentMatchesService();
    }
    return OpponentMatchesService.instance;
  }

  /**
   * Get opponent matches data from database
   */
  async getOpponentMatchesData(opponentSquadId: number, matchLimit: number = 5): Promise<OpponentMatchData | null> {
    try {
      console.log(`🔍 DB: Fetching opponent data for squad ${opponentSquadId} from database...`);
      
      const { data, error } = await supabase
        .from('opponent_matches')
        .select('*')
        .eq('opponent_squad_id', opponentSquadId)
        .eq('match_limit', matchLimit)
        .maybeSingle();

      if (error) {
        console.error(`❌ DB: Error fetching opponent data for squad ${opponentSquadId}:`, error);
        return null;
      }

      if (!data) {
        console.log(`⚠️ DB: No opponent data found for squad ${opponentSquadId}`);
        return null;
      }

      console.log(`✅ DB: Found opponent data for squad ${opponentSquadId} (${data.matches_data?.length || 0} matches, ${data.formations_data?.length || 0} formations)`);
      return data;
    } catch (error) {
      console.error(`❌ DB: Exception fetching opponent data for squad ${opponentSquadId}:`, error);
      return null;
    }
  }

  /**
   * Check if opponent data exists and is recent (within 12 hours)
   */
  async isOpponentDataAvailable(opponentSquadId: number, matchLimit: number = 5): Promise<boolean> {
    try {
      const data = await this.getOpponentMatchesData(opponentSquadId, matchLimit);
      
      if (!data) {
        return false;
      }

      // Check if data is recent (within 12 hours)
      const lastSynced = new Date(data.last_synced);
      const now = new Date();
      const twelveHoursAgo = new Date(now.getTime() - (12 * 60 * 60 * 1000));
      
      const isRecent = lastSynced > twelveHoursAgo;
      console.log(`🔍 DB: Data for squad ${opponentSquadId} is ${isRecent ? 'recent' : 'stale'} (last synced: ${lastSynced.toISOString()})`);
      
      return isRecent;
    } catch (error) {
      console.error(`❌ DB: Error checking opponent data availability for squad ${opponentSquadId}:`, error);
      return false;
    }
  }

  /**
   * Get all available opponent data for multiple squads
   */
  async getAllOpponentData(opponentSquadIds: number[], matchLimit: number = 5): Promise<{[squadId: number]: OpponentMatchData}> {
    try {
      console.log(`🔍 DB: Fetching opponent data for ${opponentSquadIds.length} squads from database...`);
      
      const { data, error } = await supabase
        .from('opponent_matches')
        .select('*')
        .in('opponent_squad_id', opponentSquadIds)
        .eq('match_limit', matchLimit);

      if (error) {
        console.error(`❌ DB: Error fetching multiple opponent data:`, error);
        return {};
      }

      const result: {[squadId: number]: OpponentMatchData} = {};
      
      if (data) {
        data.forEach(item => {
          result[item.opponent_squad_id] = item;
        });
      }

      console.log(`✅ DB: Found opponent data for ${Object.keys(result).length}/${opponentSquadIds.length} squads`);
      return result;
    } catch (error) {
      console.error(`❌ DB: Exception fetching multiple opponent data:`, error);
      return {};
    }
  }

  /**
   * Get formations data for an opponent
   */
  getOpponentFormations(opponentData: OpponentMatchData): string[] {
    return opponentData.formations_data || [];
  }

  /**
   * Get matches data for an opponent
   */
  getOpponentMatches(opponentData: OpponentMatchData): any[] {
    return opponentData.matches_data || [];
  }
}

export const opponentMatchesService = OpponentMatchesService.getInstance();

