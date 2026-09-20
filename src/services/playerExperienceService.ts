import type { PlayerExperienceHistory, PlayerExperienceEntry } from '../types/playerExperience';
import { MFL_API_BASE_URL, getMflAuthHeaders } from '../config/mflApi';

interface CacheEntry {
  data: PlayerExperienceHistory;
  timestamp: number;
}

class PlayerExperienceService {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_DURATION;
  }

  async fetchPlayerExperienceHistory(playerId: string): Promise<PlayerExperienceHistory> {
    const cacheKey = `player_experience_${playerId}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached && this.isCacheValid(cached.timestamp)) {
      console.log(`🎯 CACHE HIT: Using cached player experience data for ${cacheKey}`);
      return cached.data;
    }

    try {
      // Detect environment: use proxy in browser, direct API in Node/test
      const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';
      const isTest = typeof process !== 'undefined' && !!(process.env?.JEST_WORKER_ID || process.env?.NODE_ENV === 'test');
      const isBrowserRuntime = hasDom && !isTest;

      let response;
      if (isBrowserRuntime) {
        // Use proxy API route to avoid CORS issues in browser
        const proxyUrl = `/api/players/${playerId}/experiences`;
        console.log(`🌐 Using proxy API route: ${proxyUrl}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        try {
          response = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            },
            signal: controller.signal
          });
          clearTimeout(timeoutId);
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      } else {
        // In Node.js/test environment, use direct MFL API call
        response = await fetch(`${MFL_API_BASE_URL}/players/${playerId}/experiences/history`, { headers: getMflAuthHeaders() });
      }
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const resultData = await response.json();
      
      // Handle proxy response format { success: true, data: [...] }
      const data: PlayerExperienceEntry[] = resultData.data || resultData;
      
      const result: PlayerExperienceHistory = {
        success: true,
        data: data
      };

      // Cache the result with timestamp
      this.cache.set(cacheKey, { data: result, timestamp: Date.now() });
      console.log(`✅ Cached player experience data for ${cacheKey}`);

      return result;
    } catch (error) {
      const result: PlayerExperienceHistory = {
        success: false,
        data: [],
        error: error instanceof Error ? error.message : 'Failed to fetch experience history'
      };
      return result;
    }
  }

  /**
   * Clear cache for a specific player or all cache
   */
  clearCache(playerId?: string): void {
    if (playerId) {
      const cacheKey = `player_experience_${playerId}`;
      this.cache.delete(cacheKey);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.cache.size;
  }
}

export const playerExperienceService = new PlayerExperienceService();

/**
 * Fetch player experience history from the MFL API (legacy function for backward compatibility)
 */
export async function fetchPlayerExperienceHistory(playerId: string): Promise<PlayerExperienceHistory> {
  return playerExperienceService.fetchPlayerExperienceHistory(playerId);
}

// A player ages one year every 6 weeks (42 days)
const MS_PER_AGE_YEAR = 42 * 24 * 60 * 60 * 1000;

/**
 * Build a function that maps a timestamp to a fractional age.
 *
 * The API reports the real age on its INITIAL and NEW_AGE entries, so those are the
 * anchors. Between two anchors the age rises at most one year per 42 days, counted
 * back from the later anchor: the gap from the INITIAL snapshot to the first NEW_AGE
 * can be many months long and must not be counted as several years. After the last
 * anchor the age is counted forward from it.
 */
function createAgeResolver(sortedData: PlayerExperienceEntry[]) {
  const anchors = sortedData
    .filter(entry => entry.values.age !== undefined)
    .map(entry => ({ date: entry.date, age: entry.values.age as number }));

  // No ages in the data at all: count from the first entry, starting at 0
  if (anchors.length === 0) {
    anchors.push({ date: sortedData[0]?.date || 0, age: 0 });
  }

  return (date: number): number => {
    const nextIndex = anchors.findIndex(anchor => anchor.date > date);

    if (nextIndex === -1) {
      const last = anchors[anchors.length - 1];
      return last.age + (date - last.date) / MS_PER_AGE_YEAR;
    }

    const next = anchors[nextIndex];
    const prev = anchors[nextIndex - 1];

    if (!prev) {
      // Before the first known age
      return next.age - (next.date - date) / MS_PER_AGE_YEAR;
    }

    const ageGain = next.age - prev.age;
    const startDate = Math.max(prev.date, next.date - ageGain * MS_PER_AGE_YEAR);
    if (date <= startDate) return prev.age;
    return prev.age + (ageGain * (date - startDate)) / (next.date - startDate);
  };
}

/**
 * The player's age as of the latest entry in the history (any entry, including the
 * age-only NEW_AGE ones that processProgressionData drops)
 */
export function getCurrentAge(experienceData: PlayerExperienceEntry[]): number | undefined {
  if (experienceData.length === 0) return undefined;

  const sortedData = [...experienceData].sort((a, b) => a.date - b.date);
  return createAgeResolver(sortedData)(sortedData[sortedData.length - 1].date);
}

/**
 * Process experience history data for chart display
 */
export function processProgressionData(experienceData: PlayerExperienceEntry[]) {
  // Sort by date first
  const sortedData = experienceData.sort((a, b) => a.date - b.date);
  const getAgeAt = createAgeResolver(sortedData);

  // Carry forward values - each entry should have all stats from previous entries
  let currentValues = {
    overall: undefined as number | undefined,
    age: undefined as number | undefined,
    pace: undefined as number | undefined,
    dribbling: undefined as number | undefined,
    passing: undefined as number | undefined,
    shooting: undefined as number | undefined,
    defense: undefined as number | undefined,
    physical: undefined as number | undefined
  };

  const progressionData = sortedData
    .filter(entry => entry.values.overall !== undefined || entry.values.pace !== undefined || entry.values.dribbling !== undefined || entry.values.passing !== undefined || entry.values.shooting !== undefined || entry.values.defense !== undefined || entry.values.physical !== undefined)
    .map((entry, index) => {
      // Update current values with any new values from this entry
      if (entry.values.overall !== undefined) currentValues.overall = entry.values.overall;
      if (entry.values.age !== undefined) currentValues.age = entry.values.age;
      if (entry.values.pace !== undefined) currentValues.pace = entry.values.pace;
      if (entry.values.dribbling !== undefined) currentValues.dribbling = entry.values.dribbling;
      if (entry.values.passing !== undefined) currentValues.passing = entry.values.passing;
      if (entry.values.shooting !== undefined) currentValues.shooting = entry.values.shooting;
      if (entry.values.defense !== undefined) currentValues.defense = entry.values.defense;
      if (entry.values.physical !== undefined) currentValues.physical = entry.values.physical;

      const result = {
        date: new Date(entry.date),
        overall: currentValues.overall!,
        age: getAgeAt(entry.date), // Precise age with decimals
        pace: currentValues.pace,
        dribbling: currentValues.dribbling,
        passing: currentValues.passing,
        shooting: currentValues.shooting,
        defense: currentValues.defense,
        physical: currentValues.physical
      };

      return result;
    });

  return progressionData;
}
