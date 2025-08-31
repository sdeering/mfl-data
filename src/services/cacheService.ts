// Cache service for API responses
// Caches responses for 1 hour (3600000 milliseconds)

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

class CacheService {
  private cache = new Map<string, CacheEntry>();
  private readonly DEFAULT_TTL = 3600000; // 1 hour in milliseconds

  // Generate a cache key from URL and parameters
  private generateKey(url: string, params?: Record<string, any>): string {
    const urlObj = new URL(url);
    
    // Add query parameters to the key
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        urlObj.searchParams.set(key, String(value));
      });
    }
    
    return urlObj.toString();
  }

  // Get cached data if it exists and is not expired
  get(url: string, params?: Record<string, any>): any | null {
    const key = this.generateKey(url, params);
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    const now = Date.now();
    if (now - entry.timestamp > entry.ttl) {
      // Entry has expired, remove it
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  // Store data in cache
  set(url: string, data: any, params?: Record<string, any>, ttl?: number): void {
    const key = this.generateKey(url, params);
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.DEFAULT_TTL
    };
    
    this.cache.set(key, entry);
  }

  // Clear all cached data
  clear(): void {
    this.cache.clear();
  }

  // Remove expired entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  // Get cache statistics
  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

// Export a singleton instance
export const cacheService = new CacheService();

// Clean up expired entries every 5 minutes
setInterval(() => {
  cacheService.cleanup();
}, 5 * 60 * 1000);
