import { getD1Database, listSubtitles } from '@/lib/d1-subtitles';

export async function GET(request: Request) {
  const db = await getD1Database();
  if (!db) {
    return Response.json(
      { error: 'D1 database not available in this environment' },
      { status: 503 },
    );
  }

  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 100);
  const offset = Math.max(parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0);

  try {
    const { items, total } = await listSubtitles(db, { limit, offset });
    return Response.json({ items, total, limit, offset });
  } catch (err) {
    console.error('[/api/subtitles] GET', err);
    return Response.json({ error: 'Failed to list subtitles' }, { status: 500 });
  }
}
