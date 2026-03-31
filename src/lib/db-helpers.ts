import { getDb } from './database'
import { initializeSchema } from './schema'
import type { InValue } from '@libsql/client'
import * as crypto from 'crypto'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DbResult<T> {
  data: T | null
  error: { message: string; code?: string } | null
  count?: number
}

export interface WhereClause {
  [column: string]: any | { in: any[] } | { gte: any } | { neq: any }
}

export interface SelectOptions {
  columns?: string[]
  where?: WhereClause
  orderBy?: { column: string; ascending?: boolean }
  limit?: number
}

export interface JoinOptions {
  from: string
  join: { table: string; as: string; on: string }
  where?: WhereClause
  orderBy?: { column: string; ascending?: boolean }
  limit?: number
}

// ─── JSON Column Registry ─────────────────────────────────────────────────────

const JSON_COLUMNS: Record<string, string[]> = {
  users: ['data'],
  players: ['data'],
  agency_players: ['data'],
  clubs: ['data'],
  matches: ['data'],
  opponent_matches: ['matches_data', 'formations_data'],
  player_sale_history: ['data'],
  player_progression: ['data'],
  squad_ids: ['data'],
  match_formations: ['data'],
  competitions: ['data'],
  team_statistics: ['data'],
  player_ratings: ['data'],
  market_values: ['data'],
  transfer_history: ['data'],
  seasons: ['data'],
  league_standings: ['data'],
  sync_status: [],
  squads: ['players'],
  api_usage_daily: [],
  schema_version: [],
}

// ─── Initialization ───────────────────────────────────────────────────────────

let _schemaReady: Promise<void> | null = null

async function ensureSchema(): Promise<void> {
  if (!_schemaReady) {
    _schemaReady = initializeSchema()
  }
  await _schemaReady
}

// ─── Internal Helpers ─────────────────────────────────────────────────────────

function generateUUID(): string {
  return crypto.randomUUID()
}

function serializeJsonColumns(table: string, row: Record<string, any>): Record<string, any> {
  const jsonCols = JSON_COLUMNS[table] || []
  const result = { ...row }
  for (const col of jsonCols) {
    if (col in result && result[col] !== null && result[col] !== undefined && typeof result[col] !== 'string') {
      result[col] = JSON.stringify(result[col])
    }
  }
  return result
}

function deserializeJsonColumns(table: string, row: Record<string, any>): Record<string, any> {
  const jsonCols = JSON_COLUMNS[table] || []
  const result = { ...row }
  for (const col of jsonCols) {
    if (col in result && typeof result[col] === 'string') {
      try {
        result[col] = JSON.parse(result[col])
      } catch {
        // leave as string if not valid JSON
      }
    }
  }
  return result
}

function deserializeRows(table: string, rows: Record<string, any>[]): Record<string, any>[] {
  return rows.map(row => deserializeJsonColumns(table, row))
}

/**
 * Build WHERE clause SQL and args from a WhereClause object.
 * Supports: plain values (=), { in: [...] }, { gte: value }, { neq: value }
 */
function buildWhereClause(where: WhereClause): { sql: string; args: InValue[] } {
  const conditions: string[] = []
  const args: InValue[] = []

  for (const [column, value] of Object.entries(where)) {
    if (value === null || value === undefined) {
      conditions.push(`${column} IS NULL`)
    } else if (typeof value === 'object' && !Array.isArray(value)) {
      if ('in' in value) {
        const arr = value.in as any[]
        if (arr.length === 0) {
          conditions.push('1 = 0') // empty IN → no matches
        } else {
          const placeholders = arr.map(() => '?').join(', ')
          conditions.push(`${column} IN (${placeholders})`)
          args.push(...arr)
        }
      } else if ('gte' in value) {
        conditions.push(`${column} >= ?`)
        args.push(value.gte)
      } else if ('neq' in value) {
        conditions.push(`${column} != ?`)
        args.push(value.neq)
      }
    } else {
      conditions.push(`${column} = ?`)
      args.push(value)
    }
  }

  return {
    sql: conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '',
    args
  }
}

function buildOrderClause(orderBy?: { column: string; ascending?: boolean }): string {
  if (!orderBy) return ''
  const dir = orderBy.ascending === false ? 'DESC' : 'ASC'
  return `ORDER BY ${orderBy.column} ${dir}`
}

function buildLimitClause(limit?: number): string {
  if (!limit) return ''
  return `LIMIT ${limit}`
}

// Convert libSQL row result to plain object
function rowToObject(row: any): Record<string, any> {
  if (!row) return row
  // libSQL returns rows that are iterable with column access
  // but we can spread them into a plain object
  const obj: Record<string, any> = {}
  for (const key of Object.keys(row)) {
    obj[key] = row[key]
  }
  return obj
}

// ─── Public Query Helpers ─────────────────────────────────────────────────────

/**
 * SELECT multiple rows from a table
 */
export async function selectAll<T = any>(
  table: string,
  options: SelectOptions = {}
): Promise<DbResult<T[]>> {
  await ensureSchema()
  try {
    const db = getDb()
    const cols = options.columns?.join(', ') || '*'
    const { sql: whereSql, args } = options.where ? buildWhereClause(options.where) : { sql: '', args: [] }
    const orderSql = buildOrderClause(options.orderBy)
    const limitSql = buildLimitClause(options.limit)

    const sql = `SELECT ${cols} FROM ${table} ${whereSql} ${orderSql} ${limitSql}`.trim()
    const result = await db.execute({ sql, args })

    const rows = result.rows.map(r => rowToObject(r))
    return { data: deserializeRows(table, rows) as T[], error: null }
  } catch (err: any) {
    return { data: null, error: { message: err.message, code: err.code } }
  }
}

/**
 * SELECT a single row (errors if not found, like Supabase .single())
 */
export async function selectOne<T = any>(
  table: string,
  options: SelectOptions = {}
): Promise<DbResult<T>> {
  await ensureSchema()
  try {
    const db = getDb()
    const cols = options.columns?.join(', ') || '*'
    const { sql: whereSql, args } = options.where ? buildWhereClause(options.where) : { sql: '', args: [] }
    const orderSql = buildOrderClause(options.orderBy)

    const sql = `SELECT ${cols} FROM ${table} ${whereSql} ${orderSql} LIMIT 1`
    const result = await db.execute({ sql, args })

    if (result.rows.length === 0) {
      return { data: null, error: { message: 'No rows returned', code: 'PGRST116' } }
    }

    const row = rowToObject(result.rows[0])
    return { data: deserializeJsonColumns(table, row) as T, error: null }
  } catch (err: any) {
    return { data: null, error: { message: err.message, code: err.code } }
  }
}

/**
 * SELECT a single row or null (no error if not found, like Supabase .maybeSingle())
 */
export async function selectMaybeOne<T = any>(
  table: string,
  options: SelectOptions = {}
): Promise<DbResult<T>> {
  await ensureSchema()
  try {
    const db = getDb()
    const cols = options.columns?.join(', ') || '*'
    const { sql: whereSql, args } = options.where ? buildWhereClause(options.where) : { sql: '', args: [] }
    const orderSql = buildOrderClause(options.orderBy)

    const sql = `SELECT ${cols} FROM ${table} ${whereSql} ${orderSql} LIMIT 1`
    const result = await db.execute({ sql, args })

    if (result.rows.length === 0) {
      return { data: null, error: null }
    }

    const row = rowToObject(result.rows[0])
    return { data: deserializeJsonColumns(table, row) as T, error: null }
  } catch (err: any) {
    return { data: null, error: { message: err.message, code: err.code } }
  }
}

/**
 * INSERT OR UPDATE a single row with ON CONFLICT
 */
export async function upsertOne(
  table: string,
  data: Record<string, any>,
  onConflict: string
): Promise<DbResult<any>> {
  await ensureSchema()
  try {
    const db = getDb()
    const row = serializeJsonColumns(table, data)

    // Add id if not present
    if (!row.id) {
      row.id = generateUUID()
    }

    const columns = Object.keys(row)
    const placeholders = columns.map(() => '?').join(', ')
    const conflictColumns = onConflict.split(',').map(c => c.trim())
    const updateColumns = columns.filter(c => c !== 'id' && !conflictColumns.includes(c))
    const updateSet = updateColumns.map(c => `${c} = excluded.${c}`).join(', ')

    let sql: string
    if (updateSet) {
      sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT (${onConflict}) DO UPDATE SET ${updateSet}, updated_at = datetime('now')`
    } else {
      sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT (${onConflict}) DO NOTHING`
    }

    const args = columns.map(c => row[c] ?? null)
    await db.execute({ sql, args })

    return { data: row, error: null }
  } catch (err: any) {
    return { data: null, error: { message: err.message, code: err.code } }
  }
}

/**
 * Batch INSERT OR UPDATE multiple rows in a transaction
 */
export async function upsertMany(
  table: string,
  dataArray: Record<string, any>[],
  onConflict: string
): Promise<DbResult<any>> {
  if (dataArray.length === 0) return { data: [], error: null }

  await ensureSchema()
  try {
    const db = getDb()
    const conflictColumns = onConflict.split(',').map(c => c.trim())

    // Build template from first row
    const firstRow = serializeJsonColumns(table, dataArray[0])
    if (!firstRow.id) firstRow.id = generateUUID()
    const columns = Object.keys(firstRow)
    const placeholders = columns.map(() => '?').join(', ')
    const updateColumns = columns.filter(c => c !== 'id' && !conflictColumns.includes(c))
    const updateSet = updateColumns.map(c => `${c} = excluded.${c}`).join(', ')

    let sqlTemplate: string
    if (updateSet) {
      sqlTemplate = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT (${onConflict}) DO UPDATE SET ${updateSet}, updated_at = datetime('now')`
    } else {
      sqlTemplate = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT (${onConflict}) DO NOTHING`
    }

    // Execute all rows in a batch (libSQL supports batch)
    const statements = dataArray.map(data => {
      const row = serializeJsonColumns(table, data)
      if (!row.id) row.id = generateUUID()
      const args = columns.map(c => row[c] ?? null)
      return { sql: sqlTemplate, args }
    })

    await db.batch(statements, 'write')

    return { data: dataArray, error: null }
  } catch (err: any) {
    return { data: null, error: { message: err.message, code: err.code } }
  }
}

/**
 * INSERT a single row
 */
export async function insertOne(
  table: string,
  data: Record<string, any>
): Promise<DbResult<any>> {
  await ensureSchema()
  try {
    const db = getDb()
    const row = serializeJsonColumns(table, data)
    if (!row.id) row.id = generateUUID()

    const columns = Object.keys(row)
    const placeholders = columns.map(() => '?').join(', ')
    const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`
    const args = columns.map(c => row[c] ?? null)

    await db.execute({ sql, args })

    return { data: row, error: null }
  } catch (err: any) {
    return { data: null, error: { message: err.message, code: err.code } }
  }
}

/**
 * UPDATE rows matching a WHERE clause
 */
export async function updateWhere(
  table: string,
  data: Record<string, any>,
  where: WhereClause
): Promise<DbResult<any>> {
  await ensureSchema()
  try {
    const db = getDb()
    const row = serializeJsonColumns(table, data)
    const setClauses = Object.keys(row).map(c => `${c} = ?`)
    const setArgs = Object.values(row).map(v => v ?? null)
    const { sql: whereSql, args: whereArgs } = buildWhereClause(where)

    const sql = `UPDATE ${table} SET ${setClauses.join(', ')}, updated_at = datetime('now') ${whereSql}`
    const args = [...setArgs, ...whereArgs]

    await db.execute({ sql, args })

    return { data: row, error: null }
  } catch (err: any) {
    return { data: null, error: { message: err.message, code: err.code } }
  }
}

/**
 * DELETE rows matching a WHERE clause
 */
export async function deleteWhere(
  table: string,
  where: WhereClause
): Promise<DbResult<null>> {
  await ensureSchema()
  try {
    const db = getDb()
    const { sql: whereSql, args } = buildWhereClause(where)
    const sql = `DELETE FROM ${table} ${whereSql}`

    await db.execute({ sql, args })

    return { data: null, error: null }
  } catch (err: any) {
    return { data: null, error: { message: err.message, code: err.code } }
  }
}

/**
 * COUNT rows matching a WHERE clause
 */
export async function countWhere(
  table: string,
  where?: WhereClause
): Promise<DbResult<number>> {
  await ensureSchema()
  try {
    const db = getDb()
    const { sql: whereSql, args } = where ? buildWhereClause(where) : { sql: '', args: [] }
    const sql = `SELECT COUNT(*) as count FROM ${table} ${whereSql}`

    const result = await db.execute({ sql, args })
    const count = Number(result.rows[0]?.count ?? 0)

    return { data: count, error: null, count }
  } catch (err: any) {
    return { data: null, error: { message: err.message, code: err.code } }
  }
}

/**
 * SELECT with LEFT JOIN (for the `player:players(*)` pattern)
 */
export async function selectWithJoin<T = any>(
  options: JoinOptions
): Promise<DbResult<T[]>> {
  await ensureSchema()
  try {
    const db = getDb()
    const { from, join, where, orderBy, limit } = options
    const alias = from.charAt(0)
    const joinAlias = join.as || join.table.charAt(0)

    const { sql: whereSql, args } = where ? buildWhereClause(
      // Prefix where columns with the main table alias
      Object.fromEntries(
        Object.entries(where).map(([k, v]) => [`${alias}.${k}`, v])
      )
    ) : { sql: '', args: [] }

    const orderSql = orderBy
      ? `ORDER BY ${alias}.${orderBy.column} ${orderBy.ascending === false ? 'DESC' : 'ASC'}`
      : ''
    const limitSql = limit ? `LIMIT ${limit}` : ''

    const sql = `SELECT ${alias}.*, ${joinAlias}.data as ${join.as}_data, ${joinAlias}.mfl_player_id as ${join.as}_mfl_player_id, ${joinAlias}.last_synced as ${join.as}_last_synced FROM ${from} ${alias} LEFT JOIN ${join.table} ${joinAlias} ON ${alias}.${join.on} = ${joinAlias}.${join.on} ${whereSql} ${orderSql} ${limitSql}`

    const result = await db.execute({ sql, args })

    // Nest the joined columns under the alias key
    const rows = result.rows.map(r => {
      const obj = rowToObject(r)
      const mainRow: any = {}
      const joinedRow: any = {}

      for (const [key, value] of Object.entries(obj)) {
        if (key.startsWith(`${join.as}_`)) {
          const realKey = key.substring(join.as.length + 1)
          joinedRow[realKey] = value
        } else {
          mainRow[key] = value
        }
      }

      // Deserialize JSON on both
      const deserializedMain = deserializeJsonColumns(from, mainRow)
      const deserializedJoin = deserializeJsonColumns(join.table, joinedRow)

      deserializedMain[join.as] = joinedRow.mfl_player_id ? deserializedJoin : null
      return deserializedMain
    })

    return { data: rows as T[], error: null }
  } catch (err: any) {
    return { data: null, error: { message: err.message, code: err.code } }
  }
}

/**
 * Execute a raw SQL query (for advanced use cases)
 */
export async function executeRaw(sql: string, args: InValue[] = []): Promise<DbResult<any[]>> {
  await ensureSchema()
  try {
    const db = getDb()
    const result = await db.execute({ sql, args })
    const rows = result.rows.map(r => rowToObject(r))
    return { data: rows, error: null }
  } catch (err: any) {
    return { data: null, error: { message: err.message, code: err.code } }
  }
}

// ─── RPC Equivalents ──────────────────────────────────────────────────────────

/**
 * Increment API usage counter (replaces Supabase RPC 'increment_api_usage')
 */
export async function incrementApiUsage(source: string, endpoint?: string): Promise<DbResult<null>> {
  await ensureSchema()
  try {
    const db = getDb()
    await db.execute({
      sql: `INSERT INTO api_usage_daily (date, source, endpoint, count)
            VALUES (date('now'), ?, COALESCE(?, 'unknown'), 1)
            ON CONFLICT (date, source, endpoint)
            DO UPDATE SET count = count + 1, updated_at = datetime('now')`,
      args: [source, endpoint ?? null]
    })
    return { data: null, error: null }
  } catch (err: any) {
    return { data: null, error: { message: err.message, code: err.code } }
  }
}

/**
 * Get API usage data (replaces Supabase RPC 'get_api_usage')
 */
export async function getApiUsage(
  fromDate: string,
  source?: string | null,
  endpoint?: string | null
): Promise<DbResult<any[]>> {
  await ensureSchema()
  try {
    const db = getDb()
    let sql = `SELECT date, source, endpoint, count FROM api_usage_daily WHERE date >= ?`
    const args: InValue[] = [fromDate]

    if (source) {
      sql += ` AND source = ?`
      args.push(source)
    }
    if (endpoint) {
      sql += ` AND endpoint = ?`
      args.push(endpoint)
    }

    sql += ` ORDER BY date ASC, source ASC, endpoint ASC`

    const result = await db.execute({ sql, args })
    const rows = result.rows.map(r => rowToObject(r))
    return { data: rows, error: null }
  } catch (err: any) {
    return { data: null, error: { message: err.message, code: err.code } }
  }
}
