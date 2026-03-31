import { parseVideoId, extractSubtitles, type Subtitle } from '@/lib/youtube';
import { buildPrompt } from '@/lib/prompt';
import { streamTranslate } from '@/lib/gemini';
import { getD1Database, getCachedArticleHtml, upsertSubtitles } from '@/lib/d1-subtitles';

function wrapTranslationStreamWithD1(
  source: ReadableStream<Uint8Array>,
  opts: {
    signal: AbortSignal;
    videoId: string;
    title: string | undefined;
    subtitles: Subtitle[];
  },
): ReadableStream<Uint8Array> {
  const decoder = new TextDecoder();
  let accumulated = '';
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

  return new ReadableStream({
    async start(controller) {
      reader = source.getReader();
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          controller.enqueue(value);
        }
        accumulated += decoder.decode();

        if (!opts.signal.aborted && accumulated.trim()) {
          try {
            const persistDb = await getD1Database();
            if (persistDb) {
              await upsertSubtitles(persistDb, {
                videoId: opts.videoId,
                title: opts.title,
                lang: 'en',
                cues: opts.subtitles,
                articleHtml: accumulated,
              });
            }
          } catch (d1Err) {
            console.error('[/api/translate] D1 upsert', d1Err);
          }
        }

        controller.close();
      } catch (e) {
        controller.error(e);
      } finally {
        try {
          reader.releaseLock();
        } catch {
          /* already released */
        }
        reader = null;
      }
    },
    cancel(reason) {
      void reader?.cancel(reason);
    },
  });
}

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
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Cache-Control': 'no-cache, no-store',
            'X-Content-Type-Options': 'nosniff',
            'X-Cached-Translation': '1',
          },
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

    const prompt = buildPrompt(subtitles);
    const geminiStream = await streamTranslate(prompt, process.env.GEMINI_API_KEY!);

    const stream = wrapTranslationStreamWithD1(geminiStream, {
      signal: request.signal,
      videoId,
      title,
      subtitles,
    });

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
