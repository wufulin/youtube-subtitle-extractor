/**
 * Read a UTF-8 text body with periodic flushes so the UI updates smoothly
 * without repainting on every network chunk.
 */
export async function consumeThrottledTextStream(
  stream: ReadableStream<Uint8Array>,
  options: {
    isPaused: () => boolean;
    append: (chunk: string) => void;
    /** Minimum spacing between flushes (ms) */
    throttleMs?: number;
  },
): Promise<void> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let flushTimeout: ReturnType<typeof setTimeout> | null = null;
  let lastFlushAt = 0;
  const throttleMs = options.throttleMs ?? 800;

  try {
    for (;;) {
      while (options.isPaused()) {
        await new Promise((r) => setTimeout(r, 100));
      }

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      if (!flushTimeout) {
        const now = Date.now();
        const wait = Math.max(0, throttleMs - (now - lastFlushAt));
        flushTimeout = setTimeout(() => {
          flushTimeout = null;
          const chunk = buffer;
          buffer = '';
          lastFlushAt = Date.now();
          if (chunk) options.append(chunk);
        }, wait);
      }
    }

    if (flushTimeout) {
      clearTimeout(flushTimeout);
      flushTimeout = null;
    }
    if (buffer) {
      options.append(buffer);
    }
  } finally {
    reader.releaseLock();
  }
}
