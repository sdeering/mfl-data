import { NextRequest, NextResponse } from 'next/server';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

// Cache configuration
const CACHE_DIR = path.join(process.cwd(), '.cache', 'player-ratings');
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 1 week in milliseconds

// Types for cache data
interface CacheData {
  playerId: string;
  positionRatings: Array<{
    position: string;
    familiarity: string;
    difference: number;
    rating: number;
  }>;
  success: boolean;
  error?: string;
  cachedAt: number;
}

// Ensure cache directory exists
function ensureCacheDir(): void {
  if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
  }
}

// Get cache file path for a player
function getCacheFilePath(playerId: string): string {
  return path.join(CACHE_DIR, `${playerId}.json`);
}

// Check if cache is valid (exists and not expired)
function isCacheValid(playerId: string): boolean {
  try {
    const cachePath = getCacheFilePath(playerId);
    if (!fs.existsSync(cachePath)) {
      return false;
    }
    
    const stats = fs.statSync(cachePath);
    const now = Date.now();
    const cacheAge = now - stats.mtime.getTime();
    
    return cacheAge < CACHE_DURATION;
  } catch {
    return false;
  }
}

// Read from cache
function readFromCache(playerId: string): CacheData | null {
  try {
    const cachePath = getCacheFilePath(playerId);
    if (!fs.existsSync(cachePath)) {
      return null;
    }
    
    const cacheData = fs.readFileSync(cachePath, 'utf8');
    return JSON.parse(cacheData);
  } catch {
    return null;
  }
}

// Write to cache
function writeToCache(playerId: string, data: { positionRatings: unknown[]; success: boolean; error?: string }): void {
  try {
    ensureCacheDir();
    const cachePath = getCacheFilePath(playerId);
    const cacheData: CacheData = {
      playerId,
      positionRatings: data.positionRatings as Array<{
        position: string;
        familiarity: string;
        difference: number;
        rating: number;
      }>,
      success: data.success,
      error: data.error,
      cachedAt: Date.now()
    };
    
    fs.writeFileSync(cachePath, JSON.stringify(cacheData, null, 2));
  } catch {
    // Silently fail if cache write fails
  }
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const playerId = searchParams.get('playerId');

  if (!playerId) {
    return NextResponse.json({ error: 'Player ID is required' }, { status: 400 });
  }

  // Check cache first
  if (isCacheValid(playerId)) {
    const cachedData = readFromCache(playerId);
    if (cachedData) {
      return NextResponse.json({
        playerId,
        positionRatings: cachedData.positionRatings,
        success: cachedData.success,
        cached: true
      });
    }
  }

  let browser;
  try {
    const url = `https://mflplayer.info/player/${playerId}`;
    
    // Launch headless browser
    browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Set user agent to avoid detection
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
    
    // Navigate to the page
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
    
    // Wait for the position ratings to load
    await page.waitForSelector('[data-slot="collapsible-trigger"]', { timeout: 10000 });
    
    // Click the expand button if it exists and is not already expanded
    const expandButton = await page.$('[data-slot="collapsible-trigger"]');
    if (expandButton) {
      const isExpanded = await page.$eval('[data-slot="collapsible-trigger"]', (el) => {
        return el.getAttribute('data-state') === 'open';
      });
      
      if (!isExpanded) {
        await expandButton.click();
        // Wait for the content to expand
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Extract position ratings from the expanded content
    const positionRatings = await page.evaluate(() => {
      const ratings: Array<{
        position: string;
        familiarity: string;
        difference: number;
        rating: number;
      }> = [];
      const seenPositions = new Set<string>();
      
      // Look for the expanded ratings section
      const ratingRows = document.querySelectorAll('.divide-border .grid.grid-cols-2');
      
      ratingRows.forEach((row) => {
        const positionElement = row.querySelector('span.text-sm');
        const badgeElement = row.querySelector('[data-slot="badge"]');
        const differenceElement = row.querySelector('.text-slate-400');
        const ratingElement = row.querySelector('div[class*="bg-[var(--tier-"]');
        
        if (positionElement && badgeElement && ratingElement) {
          const position = positionElement.textContent?.trim();
          const badgeTitle = badgeElement.getAttribute('title');
          const differenceText = differenceElement?.textContent?.trim();
          const rating = parseInt(ratingElement.textContent || '0');
          
          if (position && !isNaN(rating) && !seenPositions.has(position)) {
            seenPositions.add(position);
            
            // Parse difference (handle + and - signs)
            let difference = 0;
            if (differenceText) {
              difference = parseInt(differenceText.replace(/[+\-]/g, ''));
              if (differenceText.startsWith('-')) {
                difference = -difference;
              }
            }
            
            // Convert familiarity text to our format
            let familiarity = 'UNFAMILIAR';
            if (badgeTitle === 'Primary') {
              familiarity = 'PRIMARY';
            } else if (badgeTitle === 'Secondary' || badgeTitle === 'Fairly Familiar') {
              familiarity = 'SECONDARY';
            }
            
            ratings.push({
              position,
              familiarity,
              difference,
              rating
            });
          }
        }
      });
      
      // Add GK position if it's missing (for goalkeepers)
      const hasGK = ratings.some(r => r.position === 'GK');
      if (!hasGK) {
        // Check if this is a goalkeeper by looking for GK attributes
        const gkElement = document.querySelector('[data-testid="gk-rating"]');
        if (gkElement) {
          const gkRating = parseInt(gkElement.textContent || '0');
          if (gkRating > 0) {
            ratings.push({
              position: 'GK',
              familiarity: 'PRIMARY',
              difference: 0,
              rating: gkRating
            });
          }
        }
      }
      
      return ratings;
    });
    
    await browser.close();
    
    const result = {
      playerId,
      positionRatings,
      success: true
    };
    
    // Cache the result
    writeToCache(playerId, result);
    
    return NextResponse.json(result);
    
  } catch (error) {
    if (browser) {
      await browser.close();
    }
    
    const errorResult = {
      playerId,
      positionRatings: [],
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
    
    // Cache the error result too (to avoid repeated failed attempts)
    writeToCache(playerId, errorResult);
    
    return NextResponse.json(errorResult, { status: 500 });
  }
}
