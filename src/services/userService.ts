import axios from 'axios';

export interface MFLUser {
  id: number;
  walletAddress: string;
  username: string;
  displayName?: string;
  email?: string;
  createdAt: string;
  updatedAt: string;
}

class UserService {
  private cache = new Map<string, { data: MFLUser; timestamp: number }>();
  private readonly CACHE_DURATION = 60 * 60 * 1000; // 1 hour

  private isCacheValid(timestamp: number): boolean {
    return Date.now() - timestamp < this.CACHE_DURATION;
  }

  async fetchUserByWallet(walletAddress: string): Promise<MFLUser | null> {
    const cacheKey = `user_${walletAddress}`;
    const cached = this.cache.get(cacheKey);

    if (cached && this.isCacheValid(cached.timestamp)) {
      return cached.data;
    }

    // Get user info from clubs data
    return await this.fetchUserFromClubs(walletAddress);
  }

  private async fetchUserFromClubs(walletAddress: string): Promise<MFLUser | null> {
    try {
      // Detect environment: use proxy in browser, direct API in Node/test
      const hasDom = typeof window !== 'undefined' && typeof document !== 'undefined';
      const isTest = typeof process !== 'undefined' && !!(process.env?.JEST_WORKER_ID || process.env?.NODE_ENV === 'test');
      const isBrowserRuntime = hasDom && !isTest;

      let responseData: any;
      if (isBrowserRuntime) {
        // Use proxy API route to avoid CORS issues in browser
        const proxyUrl = `/api/clubs?walletAddress=${walletAddress}`;
        console.log(`🌐 Using proxy API route: ${proxyUrl}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        try {
          const response = await fetch(proxyUrl, {
            method: 'GET',
            headers: {
              'Accept': 'application/json',
            },
            signal: controller.signal
          });
          
          clearTimeout(timeoutId);
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const result = await response.json();
          responseData = result.data || result;
        } catch (error) {
          clearTimeout(timeoutId);
          throw error;
        }
      } else {
        // In Node.js/test environment, use direct MFL API call
        const url = `https://z519wdyajg.execute-api.us-east-1.amazonaws.com/prod/clubs?walletAddress=${walletAddress}`;
        const response = await axios.get(url, { timeout: 30000 });
        responseData = response.data;
      }
      
      if (responseData && responseData.length > 0) {
        // Extract user name from club names (e.g., "DogeSports Japan" -> "DogeSports")
        const clubNames = responseData.map((club: any) => club.club.name);
        const commonPrefix = this.findCommonPrefix(clubNames);
        
        if (commonPrefix) {
          const userData: MFLUser = {
            id: 0,
            walletAddress,
            username: commonPrefix,
            displayName: commonPrefix,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          // Cache this derived user data
          const cacheKey = `user_${walletAddress}`;
          this.cache.set(cacheKey, { data: userData, timestamp: Date.now() });
          
          return userData;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching user from clubs:', error);
      return null;
    }
  }

  private findCommonPrefix(strings: string[]): string | null {
    if (strings.length === 0) return null;
    
    const firstString = strings[0];
    let prefix = '';
    
    // Find the longest common prefix
    for (let i = 0; i < firstString.length; i++) {
      const char = firstString[i];
      if (strings.every(str => str[i] === char)) {
        prefix += char;
      } else {
        break;
      }
    }
    
    // Return the prefix if it's meaningful (at least 3 characters)
    return prefix.length >= 3 ? prefix : null;
  }
}

export const userService = new UserService();
