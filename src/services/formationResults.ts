// Server-only: talks to the MFL API and the database. Never import this from client code.
import { MFL_API_BASE_URL, getMflAuthHeaders } from '../config/mflApi'
import { executeRaw } from '../lib/db-helpers'
import { blockFor, blockedFor } from '../lib/rateLimit'
import { MFL_BLOCK } from './agencyLoader'
import { MflRateLimitError } from './playerProgressionCache'

/*
 * Our own formation meta: every competitive match we read from MFL is kept as a row of the two formations and
 * the score, and a daily crawl reads more. Added up they show how each formation does against each other, like
 * the mfl-coach snapshot the planner starts from, but kept up to date and on the current match engine.
 */

const TIMEOUT_MS = 30000
const HOUR = 3600

/** Only matches between teams this close in OVR (the starting XIs' overalls added up) count, as on mfl-coach */
export const MAX_OVR_DIFFERENCE = 22

/** GET from the MFL API, cached by Next for `revalidate` seconds. A 429 blocks every server instance until it passes. */
export async function fetchMflCached<T>(path: string, revalidate: number): Promise<T> {
  const response = await fetch(`${MFL_API_BASE_URL}${path}`, {
    headers: { Accept: 'application/json', ...getMflAuthHeaders() },
    signal: AbortSignal.timeout(TIMEOUT_MS),
    next: { revalidate },
  })
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get('retry-after'))
    const seconds = Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 600
    await blockFor(MFL_BLOCK, seconds).catch(() => {})
    throw new MflRateLimitError(seconds)
  }
  if (!response.ok) throw new MflHttpError(response.status, path)
  return response.json()
}

export class MflHttpError extends Error {
  constructor(public status: number, path: string) {
    super(`MFL API error ${status} for ${path}`)
  }
}

/** Seconds until MFL can be asked again, 0 when it can now. Without a database, assumes it can. */
export const mflBlockedFor = () => blockedFor(MFL_BLOCK).catch(() => 0)

/** A competitive match as MFL's /matches list gives it. */
export interface ListedMatch {
  id: number
  startDate: number
  homeSquad: { id: number; club: { id: number; name: string; logoVersion?: string } }
  awaySquad: { id: number; club: { id: number; name: string; logoVersion?: string } }
  homeTeamName: string
  awayTeamName: string
  homeScore: number
  awayScore: number
  competition: { name: string }
}

/** The parts of a match's details, asked for with its formations, that the meta needs. */
export interface MatchDetails {
  status?: string
  engine?: string
  startDate?: number
  homeScore?: number
  awayScore?: number
  homeSquad?: { id: number }
  awaySquad?: { id: number }
  homeFormation?: FormationDetails | null
  awayFormation?: FormationDetails | null
}

/** A side's formation, with its players by position: 0 to 10 the starting XI, the rest the bench */
interface FormationDetails {
  type?: string
  positions?: { index?: number; player?: { metadata?: { overall?: number } } }[]
}

export interface FormationResult {
  matchId: number
  /** Major and minor version of the match engine, e.g. "16.0" */
  engine: string | null
  startDate: number | null
  homeSquadId: number | null
  awaySquadId: number | null
  homeFormation: string
  awayFormation: string
  homeScore: number
  awayScore: number
  /** The starting XI's overalls added up */
  homeOvr: number | null
  awayOvr: number | null
}

/** "16.0" from MFL's "16.0.2/10.5.5". */
export function engineVersion(engine: string | undefined | null): string | null {
  const match = engine?.match(/^(\d+)\.(\d+)/)
  return match ? `${match[1]}.${match[2]}` : null
}

const XI_POSITIONS = 11

/** The starting XI's overalls added up, as mfl-coach measures a team; the bench doesn't count */
const teamOvr = (formation: FormationDetails | null | undefined) => {
  const overalls = (formation?.positions ?? [])
    .filter(position => typeof position.index === 'number' && position.index < XI_POSITIONS)
    .map(position => position.player?.metadata?.overall)
    .filter((overall): overall is number => typeof overall === 'number')
  return overalls.length ? overalls.reduce((total, overall) => total + overall, 0) : null
}

/** A finished match's row for the meta, or null when it isn't finished or a formation is missing. */
export function toFormationResult(matchId: number, details: MatchDetails): FormationResult | null {
  const homeFormation = details.homeFormation?.type
  const awayFormation = details.awayFormation?.type
  if (!homeFormation || !awayFormation || (details.status && details.status !== 'ENDED')) return null
  if (typeof details.homeScore !== 'number' || typeof details.awayScore !== 'number') return null
  return {
    matchId,
    engine: engineVersion(details.engine),
    startDate: details.startDate ?? null,
    homeSquadId: details.homeSquad?.id ?? null,
    awaySquadId: details.awaySquad?.id ?? null,
    homeFormation,
    awayFormation,
    homeScore: details.homeScore,
    awayScore: details.awayScore,
    homeOvr: teamOvr(details.homeFormation),
    awayOvr: teamOvr(details.awayFormation),
  }
}

/** Keeps the matches' rows, skipping any kept already. Without a database it does nothing. */
export async function recordFormationResults(results: FormationResult[]): Promise<void> {
  if (results.length === 0 || !process.env.TURSO_DATABASE_URL) return
  const placeholders = results.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ')
  const args = results.flatMap(result => [
    result.matchId, result.engine, result.startDate, result.homeSquadId, result.awaySquadId,
    result.homeFormation, result.awayFormation, result.homeScore, result.awayScore, result.homeOvr, result.awayOvr,
  ])
  const { error } = await executeRaw(
    `INSERT OR IGNORE INTO formation_results (mfl_match_id, engine, start_date, home_squad_id, away_squad_id,
       home_formation, away_formation, home_score, away_score, home_ovr, away_ovr) VALUES ${placeholders}`,
    args,
  )
  if (error) console.error('Could not keep formation results:', error.message)
}

/** The kept rows of these matches, by match ID. Empty without a database. */
export async function keptFormationResults(matchIds: number[]): Promise<Map<number, FormationResult>> {
  if (matchIds.length === 0 || !process.env.TURSO_DATABASE_URL) return new Map()
  const { data, error } = await executeRaw(
    `SELECT * FROM formation_results WHERE mfl_match_id IN (${matchIds.map(() => '?').join(', ')})`,
    matchIds,
  )
  if (error || !data) return new Map()
  return new Map(
    data.map(row => [
      Number(row.mfl_match_id),
      {
        matchId: Number(row.mfl_match_id),
        engine: row.engine ?? null,
        startDate: row.start_date === null ? null : Number(row.start_date),
        homeSquadId: row.home_squad_id === null ? null : Number(row.home_squad_id),
        awaySquadId: row.away_squad_id === null ? null : Number(row.away_squad_id),
        homeFormation: row.home_formation,
        awayFormation: row.away_formation,
        homeScore: Number(row.home_score),
        awayScore: Number(row.away_score),
        homeOvr: row.home_ovr === null ? null : Number(row.home_ovr),
        awayOvr: row.away_ovr === null ? null : Number(row.away_ovr),
      },
    ]),
  )
}

/** Our formation meta in the shape of the bundled mfl-coach snapshot, for the engine most recent matches were played on. */
export interface OwnFormationMeta {
  source: string
  engine: string
  maxOvrDifference: number
  fetchedAt: string
  rows: (string | number)[][]
  totalGames: number
}

export async function loadOwnFormationMeta(): Promise<OwnFormationMeta | null> {
  const latest = await executeRaw(
    `SELECT engine FROM formation_results WHERE engine IS NOT NULL ORDER BY start_date DESC LIMIT 1`,
  )
  const engine: string | undefined = latest.data?.[0]?.engine
  if (!engine) return null

  // Each match from both sides
  const close = `engine = ? AND (home_ovr IS NULL OR away_ovr IS NULL OR ABS(home_ovr - away_ovr) <= ${MAX_OVR_DIFFERENCE})`
  const { data, error } = await executeRaw(
    `SELECT formation, opponent_formation,
            SUM(goals_for > goals_against) AS wins, SUM(goals_for = goals_against) AS draws, SUM(goals_for < goals_against) AS losses,
            SUM(goals_for) AS goals_for, SUM(goals_against) AS goals_against
       FROM (
         SELECT home_formation AS formation, away_formation AS opponent_formation, home_score AS goals_for, away_score AS goals_against
           FROM formation_results WHERE ${close}
         UNION ALL
         SELECT away_formation, home_formation, away_score, home_score
           FROM formation_results WHERE ${close}
       )
      GROUP BY formation, opponent_formation`,
    [engine, engine],
  )
  if (error || !data) throw new Error(error?.message ?? 'No formation results')
  const rows = data.map(row => [
    row.formation, row.opponent_formation,
    Number(row.wins), Number(row.draws), Number(row.losses), Number(row.goals_for), Number(row.goals_against),
  ])
  // Every match is in there twice, once from each side
  const totalGames = rows.reduce((total, row) => total + (row[2] as number) + (row[3] as number) + (row[4] as number), 0) / 2
  return {
    source: 'mfldata',
    engine,
    maxOvrDifference: MAX_OVR_DIFFERENCE,
    fetchedAt: new Date().toISOString().slice(0, 10),
    rows,
    totalGames,
  }
}

/** Squads to crawl from: those in the latest kept matches, the most recent first */
async function crawlSquads(limit: number): Promise<number[]> {
  const { data } = await executeRaw(
    `SELECT squad_id FROM (
       SELECT home_squad_id AS squad_id, start_date FROM formation_results
       UNION ALL SELECT away_squad_id, start_date FROM formation_results
     ) WHERE squad_id IS NOT NULL GROUP BY squad_id ORDER BY MAX(start_date) DESC LIMIT ?`,
    [limit],
  )
  return (data ?? []).map(row => Number(row.squad_id))
}

const shuffle = <T>(items: T[]) => {
  const shuffled = [...items]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
  }
  return shuffled
}
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** Random club IDs MFL has, to find squads with when nothing has been kept yet */
const SEED_CLUB_IDS = 9000
/**
 * Least time between the starts of two MFL requests. Two at a time 0.3 seconds apart got the token blocked for
 * 10 minutes, about 90 requests in, so the crawl asks one at a time, at most 40 a minute.
 */
const CRAWL_GAP_MS = 1500

export interface CrawlReport {
  squads: number
  listed: number
  fetched: number
  kept: number
  stoppedBy: 'budget' | 'time' | 'squads' | 'rate limit'
}

/**
 * Reads more competitive matches into the meta: the latest matches of squads seen lately (random clubs when there
 * are none), and the details of each match not kept yet. One request at a time, 1.5 seconds apart, until
 * `maxMatches` have been read or `deadline` passes.
 */
export async function crawlFormationResults({ maxMatches, deadline }: { maxMatches: number; deadline: number }): Promise<CrawlReport> {
  const report: CrawlReport = { squads: 0, listed: 0, fetched: 0, kept: 0, stoppedBy: 'squads' }
  const timeLeft = () => Date.now() < deadline
  let lastAsk = 0
  const ask = async <T>(path: string, revalidate: number): Promise<T> => {
    await sleep(Math.max(0, lastAsk + CRAWL_GAP_MS - Date.now()))
    lastAsk = Date.now()
    return fetchMflCached<T>(path, revalidate)
  }

  const squads = shuffle(await crawlSquads(400)).slice(0, 60)
  try {
    while (squads.length < 10 && timeLeft()) {
      const club = await ask<{ squads?: { id: number }[] }>(`/clubs/${1 + Math.floor(Math.random() * SEED_CLUB_IDS)}`, 24 * HOUR).catch(error => {
        if (error instanceof MflRateLimitError) throw error
        return null
      })
      const squadId = club?.squads?.[0]?.id
      if (squadId && !squads.includes(squadId)) squads.push(squadId)
    }

    for (const squadId of squads) {
      if (report.fetched >= maxMatches) return { ...report, stoppedBy: 'budget' }
      if (!timeLeft()) return { ...report, stoppedBy: 'time' }
      report.squads++
      const listed = await ask<ListedMatch[]>(`/matches?squadId=${squadId}&past=true&onlyCompetitions=true&limit=15`, HOUR).catch(error => {
        if (error instanceof MflRateLimitError) throw error
        return [] as ListedMatch[]
      })
      report.listed += listed.length
      const kept = await keptFormationResults(listed.map(match => match.id))
      const results: FormationResult[] = []
      const unread = listed.filter(match => !kept.has(match.id))
      try {
        for (const match of unread) {
          if (report.fetched >= maxMatches || !timeLeft()) break
          report.fetched++
          const details = await ask<MatchDetails>(`/matches/${match.id}?withFormations=true`, 168 * HOUR).catch(error => {
            if (error instanceof MflRateLimitError) throw error
            return null
          })
          const result = details && toFormationResult(match.id, { ...details, startDate: details.startDate ?? match.startDate })
          if (result) results.push(result)
        }
      } finally {
        // Keep what was read, even when MFL stopped us partway
        await recordFormationResults(results)
        report.kept += results.length
      }
    }
    return report
  } catch (error) {
    if (error instanceof MflRateLimitError) return { ...report, stoppedBy: 'rate limit' }
    throw error
  }
}
