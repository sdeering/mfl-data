import type { MFLPlayer, MFLMatch } from '../types/mflApi'

/**
 * Client-side data service that wraps fetch() calls to /api/data/* routes.
 * Mirrors the server-side dataService interface for use in browser components.
 */
class ClientDataService {
  private queryCache = new Map<string, { data: any; timestamp: number; ttl: number }>()
  private readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  private async getCachedData<T>(cacheKey: string, fetchFn: () => Promise<T>, ttl: number = this.CACHE_TTL): Promise<T> {
    const cached = this.queryCache.get(cacheKey)
    if (cached && (Date.now() - cached.timestamp) < cached.ttl) return cached.data
    const data = await fetchFn()
    this.queryCache.set(cacheKey, { data, timestamp: Date.now(), ttl })
    return data
  }

  clearCache(cacheKey?: string) {
    if (cacheKey) this.queryCache.delete(cacheKey)
    else this.queryCache.clear()
  }

  async getAgencyPlayerMarketValues(walletAddress: string) {
    return this.getCachedData(`agency_market_values_${walletAddress}`, async () => {
      const res = await fetch(`/api/data/agency-players?walletAddress=${encodeURIComponent(walletAddress)}&marketValues=true`)
      if (!res.ok) throw new Error('Failed to fetch market values')
      return res.json()
    })
  }

  async getUserInfo(walletAddress: string) {
    const cacheKey = `user_${walletAddress}`
    return this.getCachedData(cacheKey, async () => {
      const res = await fetch(`/api/data/agency-players?walletAddress=${encodeURIComponent(walletAddress)}&type=userInfo`)
      if (!res.ok) throw new Error('Failed to fetch user info')
      const data = await res.json()
      return data
    })
  }

  async getClubsForWallet(walletAddress: string): Promise<any[]> {
    const cacheKey = `clubs_${walletAddress}`
    return this.getCachedData(cacheKey, async () => {
      const res = await fetch(`/api/data/agency-players?walletAddress=${encodeURIComponent(walletAddress)}&type=clubs`)
      if (!res.ok) throw new Error('Failed to fetch clubs')
      return res.json()
    })
  }

  async getAgencyPlayers(walletAddress: string): Promise<MFLPlayer[]> {
    const cacheKey = `agency_players_${walletAddress}`
    const AGENCY_PLAYERS_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours
    return this.getCachedData(cacheKey, async () => {
      const res = await fetch(`/api/data/agency-players?walletAddress=${encodeURIComponent(walletAddress)}`)
      if (!res.ok) throw new Error('Failed to fetch agency players')
      return res.json()
    }, AGENCY_PLAYERS_CACHE_TTL)
  }

  async getMatchesData(walletAddress: string, matchType?: 'upcoming' | 'previous') {
    const cacheKey = `matches_${walletAddress}_${matchType || 'all'}`
    return this.getCachedData(cacheKey, async () => {
      let url = `/api/data/agency-players?walletAddress=${encodeURIComponent(walletAddress)}&type=matches`
      if (matchType) url += `&matchType=${matchType}`
      const res = await fetch(url)
      if (!res.ok) throw new Error('Failed to fetch matches')
      return res.json()
    })
  }

  async getUpcomingMatches(walletAddress: string): Promise<MFLMatch[]> {
    const matchesData = await this.getMatchesData(walletAddress)
    return matchesData.upcoming
  }

  async getPreviousMatches(walletAddress: string): Promise<MFLMatch[]> {
    const matchesData = await this.getMatchesData(walletAddress)
    return matchesData.previous
  }

  async getPlayer(playerId: string): Promise<MFLPlayer | null> {
    const cacheKey = `player_${playerId}`
    const PLAYER_CACHE_TTL = 6 * 60 * 60 * 1000 // 6 hours
    return this.getCachedData(cacheKey, async () => {
      const res = await fetch(`/api/data/agency-players?type=player&playerId=${encodeURIComponent(playerId)}`)
      if (!res.ok) throw new Error('Failed to fetch player')
      const data = await res.json()
      return data
    }, PLAYER_CACHE_TTL)
  }

  async getPlayerProgression(playerId: string) {
    const cacheKey = `player_progression_${playerId}`
    const PROGRESSION_CACHE_TTL = 60 * 60 * 1000 // 1 hour
    return this.getCachedData(cacheKey, async () => {
      const res = await fetch(`/api/data/agency-players?type=playerProgression&playerId=${encodeURIComponent(playerId)}`)
      if (!res.ok) throw new Error('Failed to fetch player progression')
      return res.json()
    }, PROGRESSION_CACHE_TTL)
  }

  async getPlayerSaleHistory(playerId: string, limit: number = 25) {
    const cacheKey = `player_sales_${playerId}_${limit}`
    const SALE_HISTORY_CACHE_TTL = 60 * 60 * 1000 // 1 hour
    return this.getCachedData(cacheKey, async () => {
      const res = await fetch(`/api/data/agency-players?type=playerSaleHistory&playerId=${encodeURIComponent(playerId)}&limit=${limit}`)
      if (!res.ok) throw new Error('Failed to fetch player sale history')
      return res.json()
    }, SALE_HISTORY_CACHE_TTL)
  }

  async getSyncStatus(walletAddress: string) {
    const cacheKey = `sync_status_${walletAddress}`
    return this.getCachedData(cacheKey, async () => {
      const res = await fetch(`/api/data/sync-status?walletAddress=${encodeURIComponent(walletAddress)}`)
      if (!res.ok) throw new Error('Failed to fetch sync status')
      return res.json()
    })
  }

  async getTacticsPageData(walletAddress: string) {
    const cacheKey = `tactics_data_${walletAddress}`
    return this.getCachedData(cacheKey, async () => {
      const [clubs, upcomingMatches, previousMatches] = await Promise.all([
        this.getClubsForWallet(walletAddress),
        this.getUpcomingMatches(walletAddress),
        this.getPreviousMatches(walletAddress)
      ])
      return { clubs, upcomingMatches, previousMatches }
    })
  }

  async getPlayerPageData(playerId: string) {
    const cacheKey = `player_page_${playerId}`
    return this.getCachedData(cacheKey, async () => {
      const [player, progression, saleHistory] = await Promise.all([
        this.getPlayer(playerId),
        this.getPlayerProgression(playerId),
        this.getPlayerSaleHistory(playerId, 10)
      ])
      return { player, progression, saleHistory }
    })
  }
}

export const clientDataService = new ClientDataService()
export const supabaseDataService = clientDataService // backward compat alias
