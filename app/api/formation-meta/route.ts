import { NextResponse } from 'next/server';
import { loadOwnFormationMeta } from '@/src/services/formationResults';

/**
 * GET /api/formation-meta
 * Our own formation meta, from the competitive matches kept in formation_results, on the latest match engine.
 * The planner uses it in place of the bundled mfl-coach snapshot once it holds enough games. Cached for a day.
 */
export async function GET() {
  if (!process.env.TURSO_DATABASE_URL) {
    return NextResponse.json({ success: false, error: 'No database' }, { status: 503 });
  }
  try {
    const meta = await loadOwnFormationMeta();
    return NextResponse.json(
      { success: true, data: meta },
      { headers: { 'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=3600' } },
    );
  } catch (error) {
    console.error('[API] /api/formation-meta failed:', error);
    return NextResponse.json({ success: false, error: 'Could not load the formation meta' }, { status: 500 });
  }
}
