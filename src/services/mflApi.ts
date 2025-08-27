// MFL API Service Module
// Comprehensive API client for MFL (Meta Football League) endpoints
// Features: Rate limiting, caching, error handling, retry logic

import {
  MFLPlayer,
  MFLPlayerResponse,
  MFLPlayerProgressionsResponse,
  MFLOwnerPlayersResponse,
  MFLSaleHistoryResponse,
  MFLExperienceHistoryResponse,
  MFLPlayerId,
  MFLInterval,
  MFLMatchDetails,
  MFLMatchReport
} from '../types/mflApi';

// ============================================================================
// CONFIGURATION
// ============================================================================

const MFL_API_CONFIG = {
  baseUrl: 'https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod',
  timeout: 10000, // 10 seconds
  retries: 3,
  retryDelay: 1000, // 1 second
  rateLimits: {
    general: {
      requests: 2000,
      window: 5 * 60 * 1000, // 5 minutes
    },
    listings: {
      requests: 100,
      window: 5 * 60 * 1000, // 5 minutes
    },
  },
  cache: {
    ttl: 5 * 60 * 1000, // 5 minutes
    maxSize: 100, // Maximum number of cached items
  },
} as const;

// ============================================================================
// RATE LIMITING
// ============================================================================

interface RateLimitTracker {
  requests: number;
  resetTime: number;
}

class RateLimiter {
  private trackers: Map<string, RateLimitTracker> = new Map();

  canMakeRequest(endpoint: string): boolean {
    const tracker = this.trackers.get(endpoint);
    const now = Date.now();

    if (!tracker || now > tracker.resetTime) {
      // Reset or create new tracker
      this.trackers.set(endpoint, {
        requests: 0,
        resetTime: now + this.getWindowForEndpoint(endpoint),
      });
      return true;
    }

    const limit = this.getLimitForEndpoint(endpoint);
    return tracker.requests < limit;
  }

  recordRequest(endpoint: string): void {
    const tracker = this.trackers.get(endpoint);
    if (tracker) {
      tracker.requests++;
    }
  }

  private getLimitForEndpoint(endpoint: string): number {
    return endpoint.includes('/listings/') 
      ? MFL_API_CONFIG.rateLimits.listings.requests 
      : MFL_API_CONFIG.rateLimits.general.requests;
  }

  private getWindowForEndpoint(endpoint: string): number {
    return endpoint.includes('/listings/') 
      ? MFL_API_CONFIG.rateLimits.listings.window 
      : MFL_API_CONFIG.rateLimits.general.window;
  }

  getRemainingRequests(endpoint: string): number {
    const tracker = this.trackers.get(endpoint);
    if (!tracker) return this.getLimitForEndpoint(endpoint);
    
    const now = Date.now();
    if (now > tracker.resetTime) return this.getLimitForEndpoint(endpoint);
    
    return Math.max(0, this.getLimitForEndpoint(endpoint) - tracker.requests);
  }
}

// ============================================================================
// CACHING
// ============================================================================

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

class Cache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private maxSize: number;

  constructor(maxSize: number = MFL_API_CONFIG.cache.maxSize) {
    this.maxSize = maxSize;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  set<T>(key: string, data: T, ttl: number = MFL_API_CONFIG.cache.ttl): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
    });
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

// ============================================================================
// HTTP CLIENT
// ============================================================================

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  timeout?: number;
  retries?: number;
}

class HTTPClient {
  private rateLimiter: RateLimiter;
  private cache: Cache;

  constructor() {
    this.rateLimiter = new RateLimiter();
    this.cache = new Cache();
  }

  async request<T>(
    endpoint: string,
    options: RequestOptions = {}
  ): Promise<T> {
    const {
      method = 'GET',
      headers = {},
      body,
      timeout = MFL_API_CONFIG.timeout,
      retries = MFL_API_CONFIG.retries,
    } = options;

    // Check rate limiting
    if (!this.rateLimiter.canMakeRequest(endpoint)) {
      const remaining = this.rateLimiter.getRemainingRequests(endpoint);
      throw new Error(`Rate limit exceeded. Remaining requests: ${remaining}`);
    }

    // Check cache for GET requests
    if (method === 'GET') {
      const cacheKey = this.generateCacheKey(endpoint, options);
      const cached = this.cache.get<T>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Make request with retry logic
    let lastError: Error;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.makeRequest<T>(endpoint, {
          method,
          headers,
          body,
          timeout,
        });

        // Record successful request
        this.rateLimiter.recordRequest(endpoint);

        // Cache successful GET responses
        if (method === 'GET') {
          const cacheKey = this.generateCacheKey(endpoint, options);
          this.cache.set(cacheKey, response);
        }

        return response;
      } catch (error) {
        lastError = error as Error;
        
        // Don't retry on rate limit errors
        if (error instanceof Error && error.message.includes('Rate limit')) {
          throw error;
        }

        // Don't retry on 4xx errors (client errors)
        if (error instanceof Error && error.message.includes('4')) {
          throw error;
        }

        // Wait before retry (except on last attempt)
        if (attempt < retries) {
          await this.delay(MFL_API_CONFIG.retryDelay * Math.pow(2, attempt));
        }
      }
    }

    throw lastError!;
  }

  private async makeRequest<T>(
    endpoint: string,
    options: RequestOptions
  ): Promise<T> {
    const { method, headers, body, timeout } = options;
    const url = `${MFL_API_CONFIG.baseUrl}${endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error(`Request timeout after ${timeout}ms`);
        }
        // Re-throw the original error for network issues
        throw error;
      }
      
      throw new Error('Unknown error occurred');
    }
  }

  private generateCacheKey(endpoint: string, options: RequestOptions): string {
    // Only include defined values to avoid undefined in cache key
    const cleanOptions = {
      method: options.method,
      headers: options.headers,
      body: options.body,
      timeout: options.timeout,
      retries: options.retries,
    };
    return `${endpoint}:${JSON.stringify(cleanOptions)}`;
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Cache management methods
  clearCache(): void {
    this.cache.clear();
  }

  getCacheSize(): number {
    return this.cache.size();
  }

  getRemainingRequests(endpoint: string): number {
    return this.rateLimiter.getRemainingRequests(endpoint);
  }
}

// ============================================================================
// MFL API SERVICE
// ============================================================================

export class MFLAPIService {
  private httpClient: HTTPClient;

  constructor() {
    this.httpClient = new HTTPClient();
  }

  // ============================================================================
  // PLAYER ENDPOINTS
  // ============================================================================

  /**
   * Get player information by ID
   */
  async getPlayer(playerId: MFLPlayerId): Promise<MFLPlayer> {
    const response = await this.httpClient.request<MFLPlayerResponse>(
      `/players/${playerId}`
    );
    return response.player;
  }

  /**
   * Get player progression data
   */
  async getPlayerProgressions(
    playerIds: MFLPlayerId | MFLPlayerId[],
    interval: MFLInterval = 'ALL'
  ): Promise<MFLPlayerProgressionsResponse> {
    const ids = Array.isArray(playerIds) ? playerIds.join(',') : playerIds;
    
    // Validate max 50 player IDs
    const idCount = Array.isArray(playerIds) ? playerIds.length : 1;
    if (idCount > 50) {
      throw new Error('Maximum 50 player IDs allowed per request');
    }

    return await this.httpClient.request<MFLPlayerProgressionsResponse>(
      `/players/progressions?playersIds=${ids}&interval=${interval}`
    );
  }

  /**
   * Get all players owned by a wallet address
   */
  async getOwnerPlayers(
    ownerWalletAddress: string,
    limit: number = 1200,
    isRetired?: boolean
  ): Promise<MFLOwnerPlayersResponse> {
    const params = new URLSearchParams({
      ownerWalletAddress,
      limit: limit.toString(),
    });

    if (isRetired !== undefined) {
      params.append('isRetired', isRetired.toString());
    }

    return await this.httpClient.request<MFLOwnerPlayersResponse>(
      `/players?${params.toString()}`
    );
  }

  /**
   * Get player experience history
   */
  async getPlayerExperienceHistory(playerId: MFLPlayerId): Promise<MFLExperienceHistoryResponse> {
    return await this.httpClient.request<MFLExperienceHistoryResponse>(
      `/players/${playerId}/experiences/history`
    );
  }

  // ============================================================================
  // LISTINGS ENDPOINTS
  // ============================================================================

  /**
   * Get player sale history
   */
  async getPlayerSaleHistory(
    playerId: MFLPlayerId,
    limit: number = 25
  ): Promise<MFLSaleHistoryResponse> {
    return await this.httpClient.request<MFLSaleHistoryResponse>(
      `/listings/feed?limit=${limit}&playerId=${playerId}`
    );
  }

  // ============================================================================
  // MATCH ENDPOINTS (Placeholder - will be implemented when endpoints are tested)
  // ============================================================================

  /**
   * Get match details with formations
   */
  async getMatchDetails(matchId: string): Promise<MFLMatchDetails> {
    return await this.httpClient.request<MFLMatchDetails>(
      `/matches/${matchId}?withFormations=true`
    );
  }

  /**
   * Get match report
   */
  async getMatchReport(matchId: string): Promise<MFLMatchReport> {
    return await this.httpClient.request<MFLMatchReport>(
      `/matches/${matchId}/report`
    );
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.httpClient.clearCache();
  }

  /**
   * Get cache size
   */
  getCacheSize(): number {
    return this.httpClient.getCacheSize();
  }

  /**
   * Get remaining requests for an endpoint
   */
  getRemainingRequests(endpoint: string): number {
    return this.httpClient.getRemainingRequests(endpoint);
  }

  /**
   * Health check - test API connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.httpClient.request('/players/93886');
      return true;
    } catch (error) {
      console.warn('Health check failed:', error);
      return false;
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

export const mflApi = new MFLAPIService();

// ============================================================================
// LEGACY COMPATIBILITY FUNCTIONS
// ============================================================================

/**
 * Legacy function for backward compatibility
 * @deprecated Use mflApi.getPlayer() instead
 */
export const searchMFLPlayerById = async (playerId: string): Promise<{ player: MFLPlayer; dataSource: 'api' }> => {
  try {
    const player = await mflApi.getPlayer(playerId);
    return { player, dataSource: 'api' as const };
  } catch (error) {
    throw new Error(`Failed to fetch player ${playerId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

/**
 * Legacy function for backward compatibility
 * @deprecated Use mflApi.getOwnerPlayers() instead
 */
export const discoverOwnerAddressForPlayerId = async (playerId: string): Promise<string | null> => {
  try {
    const player = await mflApi.getPlayer(playerId);
    return player.ownedBy.walletAddress;
  } catch (error) {
    console.warn(`Failed to discover owner for player ${playerId}:`, error);
    return null;
  }
};
