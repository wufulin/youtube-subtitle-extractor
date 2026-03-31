import { parseVideoId } from '@/lib/youtube-id';
import { extractSubtitles } from '@/lib/youtube';
import { buildPrompt } from '@/lib/prompt';
import { streamTranslate } from '@/lib/gemini';
import { getD1Database, getCachedArticleHtml } from '@/lib/d1-subtitles';
import { wrapTranslationStreamWithD1 } from '@/lib/translation-stream-persist';

const TRANSLATION_TEXT_HEADERS = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'no-cache, no-store',
  'X-Content-Type-Options': 'nosniff',
} as const;

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

    const db = await getD1Database();
    if (db) {
      const cached = await getCachedArticleHtml(db, videoId);
      if (cached) {
        return new Response(cached, {
          headers: { ...TRANSLATION_TEXT_HEADERS, 'X-Cached-Translation': '1' },
        });
      }
    }

    const { subtitles, title } = await extractSubtitles(videoId);
    if (!subtitles.length) {
      return Response.json(
        { error: 'No English subtitles found for this video' },
        { status: 404 },
      );
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return Response.json(
        { error: 'Server misconfiguration: missing GEMINI_API_KEY' },
        { status: 500 },
      );
    }

    const prompt = buildPrompt(subtitles);
    const geminiStream = await streamTranslate(prompt, apiKey);

    const stream = wrapTranslationStreamWithD1(geminiStream, {
      signal: request.signal,
      videoId,
      title,
      subtitles,
    });

    return new Response(stream, { headers: { ...TRANSLATION_TEXT_HEADERS } });
  } catch (err) {
    console.error('[/api/translate]', err);
    const message = err instanceof Error ? err.message : 'Internal server error';
    return Response.json({ error: message }, { status: 500 });
  }
}
