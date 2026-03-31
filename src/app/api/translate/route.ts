import { parseVideoId, extractSubtitles } from '@/lib/youtube';
import { buildPrompt } from '@/lib/prompt';
import { streamTranslate } from '@/lib/gemini';
import { getD1Database, upsertSubtitles } from '@/lib/d1-subtitles';

export async function POST(request: Request) {
  try {
    const { url } = await request.json();

    if (!url || typeof url !== 'string') {
      return Response.json({ error: 'Missing url field' }, { status: 400 });
    }

    const videoId = parseVideoId(url);
    if (!videoId) {
      return Response.json({ error: 'Invalid YouTube URL' }, { status: 400 });
    }

    const { subtitles, title } = await extractSubtitles(videoId);
    if (!subtitles.length) {
      return Response.json(
        { error: 'No English subtitles found for this video' },
        { status: 404 },
      );
    }

    try {
      const db = await getD1Database();
      if (db) {
        await upsertSubtitles(db, {
          videoId,
          title,
          lang: 'en',
          cues: subtitles,
        });
      }
    } catch (d1Err) {
      console.error('[/api/translate] D1 upsert', d1Err);
    }

    const prompt = buildPrompt(subtitles);
    const stream = await streamTranslate(prompt, process.env.GEMINI_API_KEY!);

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Cache-Control': 'no-cache, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    console.error('[/api/translate]', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return Response.json({ error: message }, { status: 500 });
  }
}
