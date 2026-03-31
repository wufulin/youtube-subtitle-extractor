import { getD1Database, getSubtitlesByVideoId, deleteSubtitlesByVideoId } from '@/lib/d1-subtitles';
import { isValidVideoId } from '@/lib/youtube-id';

export async function GET(
  _request: Request,
  context: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await context.params;
  if (!isValidVideoId(videoId)) {
    return Response.json({ error: 'Invalid video id' }, { status: 400 });
  }

  const db = await getD1Database();
  if (!db) {
    return Response.json(
      { error: 'D1 database not available in this environment' },
      { status: 503 },
    );
  }

  try {
    const row = await getSubtitlesByVideoId(db, videoId);
    if (!row) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    return Response.json(row);
  } catch (err) {
    console.error('[/api/subtitles/[videoId]] GET', err);
    return Response.json({ error: 'Failed to load subtitles' }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ videoId: string }> },
) {
  const { videoId } = await context.params;
  if (!isValidVideoId(videoId)) {
    return Response.json({ error: 'Invalid video id' }, { status: 400 });
  }

  const db = await getD1Database();
  if (!db) {
    return Response.json(
      { error: 'D1 database not available in this environment' },
      { status: 503 },
    );
  }

  try {
    const deleted = await deleteSubtitlesByVideoId(db, videoId);
    if (!deleted) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[/api/subtitles/[videoId]] DELETE', err);
    return Response.json({ error: 'Failed to delete subtitles' }, { status: 500 });
  }
}
