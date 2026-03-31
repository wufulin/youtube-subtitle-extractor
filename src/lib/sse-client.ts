import type {
  CueEventPayload,
  CueTiming,
  MetaEventPayload,
} from '@/lib/subtitle-translate-pipeline';

export type TimingsEventPayload = { cues: CueTiming[] };

export async function consumeTranslateSse(
  body: ReadableStream<Uint8Array>,
  handlers: {
    onMeta?: (data: Partial<MetaEventPayload> & { cueCount: number }) => void | Promise<void>;
    onTimings?: (data: TimingsEventPayload) => void | Promise<void>;
    onCue?: (data: CueEventPayload) => void | Promise<void>;
    onDone?: () => void | Promise<void>;
  },
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let eventName = '';
  const dataLines: string[] = [];

  const dispatch = async () => {
    if (dataLines.length === 0) return;
    const raw = dataLines.join('\n');
    dataLines.length = 0;
    const ev = eventName || 'message';
    eventName = '';
    try {
      const data = JSON.parse(raw) as unknown;
      if (ev === 'meta')
        await Promise.resolve(
          handlers.onMeta?.(data as Partial<MetaEventPayload> & { cueCount: number }),
        );
      else if (ev === 'timings')
        await Promise.resolve(handlers.onTimings?.(data as TimingsEventPayload));
      else if (ev === 'cue') await Promise.resolve(handlers.onCue?.(data as CueEventPayload));
      else if (ev === 'done') await Promise.resolve(handlers.onDone?.());
    } catch {
      // ignore malformed JSON
    }
  };

  const handleLine = async (line: string) => {
    if (line === '') {
      await dispatch();
      return;
    }
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trimStart());
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buffer.indexOf('\n')) >= 0) {
        const line = buffer.slice(0, nl).replace(/\r$/, '');
        buffer = buffer.slice(nl + 1);
        await handleLine(line);
      }
    }
    if (buffer.trim()) {
      await handleLine(buffer.replace(/\r$/, ''));
      await handleLine('');
    } else {
      await dispatch();
    }
  } finally {
    reader.releaseLock();
  }
}
