import type { Subtitle } from '@/lib/subtitle';
import { getD1Database, upsertSubtitles } from '@/lib/d1-subtitles';

/**
 * Passes bytes through while accumulating decoded text; on completion, upserts
 * article HTML to D1 (unless aborted or empty).
 */
export function wrapTranslationStreamWithD1(
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
