import { NextResponse } from 'next/server'
import { getDb } from '../../../src/lib/database'
import { initializeSchema } from '../../../src/lib/schema'
import { parseScoutFilters, type ScoutPreset } from '../../../src/utils/scoutFilters'

const MAX_PRESETS = 50

const clean = (preset: any): ScoutPreset | null => {
  const { id, name, sort } = preset ?? {}
  if (typeof id !== 'string' || !id || typeof name !== 'string' || !name.trim() || name.length > 60) return null
  if (typeof sort?.field !== 'string' || (sort.direction !== 'asc' && sort.direction !== 'desc')) return null
  return { id, name: name.trim(), filters: parseScoutFilters(preset.filters), sort: { field: sort.field, direction: sort.direction } }
}

export async function GET(request: Request) {
  const walletAddress = new URL(request.url).searchParams.get('walletAddress')
  if (!walletAddress) return NextResponse.json({ error: 'walletAddress is required' }, { status: 400 })

  try {
    await initializeSchema()
    const result = await getDb().execute({
      sql: 'SELECT id, name, data FROM scout_presets WHERE wallet_address = ? ORDER BY created_at, rowid',
      args: [walletAddress]
    })
    const presets = result.rows.flatMap(row => {
      const preset = clean({ ...JSON.parse(String(row.data)), id: String(row.id), name: String(row.name) })
      return preset ? [preset] : []
    })
    return NextResponse.json({ presets })
  } catch (error: any) {
    console.error('Error loading scout presets:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// Saves a preset; one with the same name replaces it
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const preset = clean(body?.preset)
    if (typeof body?.walletAddress !== 'string' || !body.walletAddress || !preset) {
      return NextResponse.json({ error: 'walletAddress and a valid preset are required' }, { status: 400 })
    }

    await initializeSchema()
    const db = getDb()
    const existing = await db.execute({ sql: 'SELECT id, name FROM scout_presets WHERE wallet_address = ?', args: [body.walletAddress] })
    const sameName = existing.rows.find(row => String(row.name).toLowerCase() === preset.name.toLowerCase())
    const isReplacing = sameName || existing.rows.some(row => String(row.id) === preset.id)
    if (!isReplacing && existing.rows.length >= MAX_PRESETS) {
      return NextResponse.json({ error: `You can save up to ${MAX_PRESETS} presets` }, { status: 400 })
    }

    const id = sameName ? String(sameName.id) : preset.id
    const name = sameName ? String(sameName.name) : preset.name
    await db.execute({
      sql: `INSERT INTO scout_presets (id, wallet_address, name, data) VALUES (?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET name = excluded.name, data = excluded.data, updated_at = datetime('now')`,
      args: [id, body.walletAddress, name, JSON.stringify({ filters: preset.filters, sort: preset.sort })]
    })
    return NextResponse.json({ preset: { ...preset, id, name } })
  } catch (error: any) {
    console.error('Error saving scout preset:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url)
  const walletAddress = searchParams.get('walletAddress')
  const id = searchParams.get('id')
  if (!walletAddress || !id) return NextResponse.json({ error: 'walletAddress and id are required' }, { status: 400 })

  try {
    await initializeSchema()
    await getDb().execute({ sql: 'DELETE FROM scout_presets WHERE wallet_address = ? AND id = ?', args: [walletAddress, id] })
    return NextResponse.json({ success: true })
  } catch (error: any) {
    console.error('Error deleting scout preset:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
