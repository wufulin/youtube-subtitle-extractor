import { buildBatchPrompt } from '@/lib/prompt';
import {
  extractIndexedTranslations,
  fallbackByLineOrder,
  generateTranslateBatchText,
  normalizeBatchIndices,
} from '@/lib/gemini';
import type { Subtitle } from '@/lib/youtube';

export const DEFAULT_MAX_CUES_PER_BATCH = 9;
export const DEFAULT_MAX_WINDOW_MS = 30000;
export const DEFAULT_HIGH_WATER_MARK = 5;

export type CueLine = {
  index: number;
  text: string;
  status?: 'ok' | 'fallback';
};

export type CueEventPayload = {
  batchId: number;
  startIndex: number;
  lines: CueLine[];
};

export type CueTiming = { index: number; startMs: number; durMs: number };

/** First SSE may send only `cueCount`; `timings` events append `cues` chunks. */
export type MetaEventPayload = {
  cueCount: number;
  cues: CueTiming[];
};

export const TIMINGS_CHUNK_SIZE = 512;

export function splitIntoBatches(
  subtitles: Subtitle[],
  maxCuesPerBatch = DEFAULT_MAX_CUES_PER_BATCH,
  maxWindowMs = DEFAULT_MAX_WINDOW_MS,
): Subtitle[][] {
  const batches: Subtitle[][] = [];
  let i = 0;
  while (i < subtitles.length) {
    const batch: Subtitle[] = [];
    const windowStartMs = subtitles[i].startMs;
    while (i < subtitles.length) {
      if (batch.length >= maxCuesPerBatch) break;
      if (batch.length > 0 && subtitles[i].startMs - windowStartMs >= maxWindowMs) break;
      batch.push(subtitles[i]);
      i++;
    }
    batches.push(batch);
  }
  return batches;
}

function pLimit(concurrency: number) {
  const queue: Array<() => void> = [];
  let activeCount = 0;

  const next = () => {
    activeCount--;
    const run = queue.shift();
    if (run) run();
  };

  return function run<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const runFn = () => {
        activeCount++;
        fn()
          .then(resolve, reject)
          .finally(next);
      };
      if (activeCount < concurrency) {
        runFn();
      } else {
        queue.push(runFn);
      }
    });
  };
}

function encodeSse(event: string, data: unknown): Uint8Array {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  return new TextEncoder().encode(payload);
}

async function translateOneBatch(
  batch: Subtitle[],
  batchId: number,
  startIndex: number,
  apiKey: string,
  enqueue: (chunk: Uint8Array) => void,
): Promise<void> {
  const prompt = buildBatchPrompt(batch, startIndex);

  let full: string;
  try {
    full = await generateTranslateBatchText(prompt, apiKey);
  } catch {
    for (let i = 0; i < batch.length; i++) {
      enqueue(
        encodeSse('cue', {
          batchId,
          startIndex,
          lines: [
            {
              index: startIndex + i,
              text: batch[i].text,
              status: 'fallback',
            },
          ],
        }),
      );
    }
    return;
  }

  const seen = new Set<number>();
  try {
    let extracted = extractIndexedTranslations(full);
    extracted = normalizeBatchIndices(extracted, startIndex, batch.length);
    if (extracted.size === 0) {
      const byOrder = fallbackByLineOrder(full, startIndex, batch.length);
      for (const [k, v] of byOrder) extracted.set(k, v);
    }

    for (const [index, text] of extracted) {
      if (index >= startIndex && index < startIndex + batch.length) {
        seen.add(index);
        enqueue(
          encodeSse('cue', {
            batchId,
            startIndex,
            lines: [{ index, text, status: 'ok' }],
          }),
        );
      }
    }
  } catch {
    // fill missing below
  }

  for (let i = 0; i < batch.length; i++) {
    const idx = startIndex + i;
    if (!seen.has(idx)) {
      enqueue(
        encodeSse('cue', {
          batchId,
          startIndex,
          lines: [{ index: idx, text: batch[i].text, status: 'fallback' }],
        }),
      );
    }
  }
}

export function createSubtitleTranslateSseStream(
  subtitles: Subtitle[],
  apiKey: string,
  options?: {
    highWaterMark?: number;
    maxCuesPerBatch?: number;
    maxWindowMs?: number;
  },
): ReadableStream<Uint8Array> {
  const highWaterMark = options?.highWaterMark ?? DEFAULT_HIGH_WATER_MARK;
  const maxCues = options?.maxCuesPerBatch ?? DEFAULT_MAX_CUES_PER_BATCH;
  const maxWindowMs = options?.maxWindowMs ?? DEFAULT_MAX_WINDOW_MS;

  const batches = splitIntoBatches(subtitles, maxCues, maxWindowMs);
  const startIndices: number[] = [];
  {
    let acc = 0;
    for (const b of batches) {
      startIndices.push(acc);
      acc += b.length;
    }
  }
  const limit = pLimit(highWaterMark);

  return new ReadableStream({
    start(controller) {
      void (async () => {
        try {
          controller.enqueue(
            encodeSse('meta', { cueCount: subtitles.length }),
          );
          for (let i = 0; i < subtitles.length; i += TIMINGS_CHUNK_SIZE) {
            const cues = subtitles.slice(i, i + TIMINGS_CHUNK_SIZE).map((s, j) => ({
              index: i + j,
              startMs: s.startMs,
              durMs: s.durMs,
            }));
            controller.enqueue(encodeSse('timings', { cues }));
          }

          await Promise.all(
            batches.map((batch, batchId) =>
              limit(() =>
                translateOneBatch(
                  batch,
                  batchId,
                  startIndices[batchId]!,
                  apiKey,
                  (chunk) => controller.enqueue(chunk),
                ),
              ),
            ),
          );
          controller.enqueue(encodeSse('done', {}));
          controller.close();
        } catch (err) {
          controller.error(err);
        }
      })();
    },
  });
}
