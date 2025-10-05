/**
 * Market Value Cache Service
 * 
 * Caches market value calculations for 1 day to avoid recalculating
 * the same player's market value repeatedly.
 */

class MarketValueCacheService {
  private cache = new Map<string, { value: number; timestamp: number }>();
  private readonly CACHE_DURATION = 24 * 60 * 60 * 1000; // 1 day in milliseconds

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_DURATION;
  }

  get(playerId: number): number | null {
    const cacheKey = `market_value_${playerId}`;
    const cached = this.cache.get(cacheKey);

    if (cached && this.isCacheValid(cached.timestamp)) {
      return cached.value;
    }

    // Remove expired cache entry
    if (cached) {
      this.cache.delete(cacheKey);
    }

    return null;
  }

  set(playerId: number, value: number): void {
    const cacheKey = `market_value_${playerId}`;
    this.cache.set(cacheKey, { value, timestamp: Date.now() });
  }

  has(playerId: number): boolean {
    return this.get(playerId) !== null;
  }

  clear(): void {
    this.cache.clear();
  }

  // Get cache stats for debugging
  getStats(): { totalEntries: number; validEntries: number } {
    const now = Date.now();
    let validEntries = 0;
    
    for (const [_, entry] of this.cache) {
      if (this.isCacheValid(entry.timestamp)) {
        validEntries++;
      }
    }

    return {
      totalEntries: this.cache.size,
      validEntries
    };
  }
}

export const marketValueCache = new MarketValueCacheService();

