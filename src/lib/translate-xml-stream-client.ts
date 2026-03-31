/** Parsed `<t/>` entries inside `<timings>`. */
export type CueTiming = {
  index: number;
  startMs: number;
  durMs: number;
};

/** `<meta cueCount="…"/>` plus optional cue list (filled as stream progresses). */
export type MetaEventPayload = {
  cueCount: number;
  cues: CueTiming[];
};

export type CueEventPayload = {
  batchId: number;
  startIndex: number;
  lines: { index: number; text: string; status: 'ok' | 'fallback' }[];
};

function decodeXmlEntities(s: string): string {
  return s
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function parseCueElement(xml: string): {
  index: number;
  status: 'ok' | 'fallback';
  text: string;
} | null {
  const open = xml.match(/^<cue\b[^>]*\bindex\s*=\s*["'](\d+)["'][^>]*>/i);
  if (!open) return null;
  const index = parseInt(open[1], 10);
  const st = xml.match(/\bstatus\s*=\s*["'](ok|fallback)["']/i);
  const status = st?.[1] === 'fallback' ? 'fallback' : 'ok';

  const cdata = xml.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  if (cdata) {
    return { index, status, text: cdata[1] };
  }
  const inner = xml.replace(/^<cue\b[^>]*>/i, '').replace(/<\/cue>\s*$/i, '');
  return { index, status, text: decodeXmlEntities(inner.trim()) };
}

function parseTimingsBlock(inner: string): CueTiming[] {
  const cues: CueTiming[] = [];
  const tagRe = /<t\s+([^/]+)\/>/gi;
  for (const m of inner.matchAll(tagRe)) {
    const attrs = m[1];
    const index = attrs.match(/\bindex\s*=\s*["'](\d+)["']/i);
    const startMs = attrs.match(/\bstartMs\s*=\s*["'](\d+)["']/i);
    const durMs = attrs.match(/\bdurMs\s*=\s*["'](\d+)["']/i);
    if (index && startMs && durMs) {
      cues.push({
        index: parseInt(index[1], 10),
        startMs: parseInt(startMs[1], 10),
        durMs: parseInt(durMs[1], 10),
      });
    }
  }
  return cues;
}

/**
 * Incrementally consumes chunked translate XML from a fetch body (not SSE).
 */
export async function consumeTranslateXmlStream(
  body: ReadableStream<Uint8Array>,
  handlers: {
    onMeta?: (data: Partial<MetaEventPayload> & { cueCount: number }) => void | Promise<void>;
    onTimings?: (data: { cues: CueTiming[] }) => void | Promise<void>;
    onCue?: (data: CueEventPayload) => void | Promise<void>;
    onDone?: () => void | Promise<void>;
  },
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const emitCuePayload = async (index: number, text: string, status: 'ok' | 'fallback') => {
    const payload: CueEventPayload = {
      batchId: 0,
      startIndex: index,
      lines: [{ index, text, status }],
    };
    await Promise.resolve(handlers.onCue?.(payload));
  };

  const tryPeel = async (): Promise<void> => {
    let guard = 0;
    while (guard++ < 5000) {
      const trimmed = buffer.replace(/^\s+/, '');
      if (trimmed.length < buffer.length) buffer = trimmed;

      const xmlDecl = buffer.match(/^<\?xml[^?]*\?>\s*/);
      if (xmlDecl) {
        buffer = buffer.slice(xmlDecl[0].length);
        continue;
      }

      const translateOpen = buffer.match(/^<translate\s*>\s*/i);
      if (translateOpen) {
        buffer = buffer.slice(translateOpen[0].length);
        continue;
      }

      const translateClose = buffer.match(/^<\/translate>\s*/i);
      if (translateClose) {
        buffer = buffer.slice(translateClose[0].length);
        await Promise.resolve(handlers.onDone?.());
        continue;
      }

      const meta = buffer.match(/^<meta\s+cueCount\s*=\s*["'](\d+)["']\s*\/\s*>\s*/i);
      if (meta) {
        buffer = buffer.slice(meta[0].length);
        await Promise.resolve(
          handlers.onMeta?.({ cueCount: parseInt(meta[1], 10), cues: [] }),
        );
        continue;
      }

      const timingsStart = buffer.match(/^<timings\s*>\s*/i);
      if (timingsStart) {
        const closeIdx = buffer.indexOf('</timings>');
        if (closeIdx === -1) break;
        const inner = buffer.slice(timingsStart[0].length, closeIdx);
        const cues = parseTimingsBlock(inner);
        buffer = buffer.slice(closeIdx + '</timings>'.length).replace(/^\s+/, '');
        await Promise.resolve(handlers.onTimings?.({ cues }));
        continue;
      }

      const cueStart = buffer.indexOf('<cue');
      if (cueStart === -1) break;
      if (cueStart > 0) {
        buffer = buffer.slice(cueStart);
      }

      const closeTag = buffer.indexOf('</cue>');
      if (closeTag === -1) break;
      const slice = buffer.slice(0, closeTag + '</cue>'.length);
      const parsed = parseCueElement(slice);
      buffer = buffer.slice(closeTag + '</cue>'.length).replace(/^\s+/, '');
      if (parsed) {
        await emitCuePayload(parsed.index, parsed.text, parsed.status);
      }
      continue;
    }
  };

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      await tryPeel();
    }
    buffer += decoder.decode();
    await tryPeel();
  } finally {
    reader.releaseLock();
  }
}
