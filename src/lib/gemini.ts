const GEMINI_STREAM_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent';

const GEMINI_GENERATE_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

/** Enough for ~9 lines of Chinese per batch; avoids MAX_TOKENS truncation mid-batch. */
export const BATCH_TRANSLATE_MAX_OUTPUT_TOKENS = 4096;

type StreamBody = {
  contents: { parts: { text: string }[] }[];
  generationConfig?: { temperature: number; maxOutputTokens?: number };
};

function buildSseTextTransform(): TransformStream<Uint8Array, Uint8Array> {
  const encoder = new TextEncoder();
  let buffer = '';

  return new TransformStream<Uint8Array, Uint8Array>({
    transform(chunk, controller) {
      const decoded = new TextDecoder().decode(chunk);
      buffer += decoded;
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const json = line.slice(6).trim();
        if (!json || json === '[DONE]') continue;
        try {
          const parsed = JSON.parse(json) as {
            candidates?: { content?: { parts?: { text?: string }[] } }[];
          };
          const parts = parsed.candidates?.[0]?.content?.parts ?? [];
          const text = parts.map((p) => p.text ?? '').join('');
          if (text) {
            controller.enqueue(encoder.encode(text));
          }
        } catch {
          // skip malformed SSE chunks
        }
      }
    },
    flush(controller) {
      if (buffer.startsWith('data: ')) {
        const json = buffer.slice(6).trim();
        if (json && json !== '[DONE]') {
          try {
            const parsed = JSON.parse(json) as {
              candidates?: { content?: { parts?: { text?: string }[] } }[];
            };
            const parts = parsed.candidates?.[0]?.content?.parts ?? [];
            const text = parts.map((p) => p.text ?? '').join('');
            if (text) {
              controller.enqueue(encoder.encode(text));
            }
          } catch {
            // skip
          }
        }
      }
    },
  });
}

async function streamGenerateContentText(
  body: StreamBody,
  apiKey: string,
): Promise<ReadableStream<Uint8Array>> {
  const resp = await fetch(`${GEMINI_STREAM_ENDPOINT}?alt=sse&key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Gemini API error ${resp.status}: ${text}`);
  }

  if (!resp.body) {
    throw new Error('Gemini API returned no response body');
  }

  return resp.body.pipeThrough(buildSseTextTransform());
}

export async function streamTranslate(
  prompt: string,
  apiKey: string,
): Promise<ReadableStream<Uint8Array>> {
  return streamGenerateContentText(
    { contents: [{ parts: [{ text: prompt }] }] },
    apiKey,
  );
}

/** Batched indexed translation: temperature 0.2 for stable terminology. */
export async function streamTranslateBatch(
  prompt: string,
  apiKey: string,
): Promise<ReadableStream<Uint8Array>> {
  return streamGenerateContentText(
    {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2 },
    },
    apiKey,
  );
}

/**
 * Non-streaming batch translation — full response text in one round-trip.
 * More reliable than stream+SSE on edge (avoids incremental chunk / SSE parse issues).
 */
export async function generateTranslateBatchText(
  prompt: string,
  apiKey: string,
): Promise<string> {
  const resp = await fetch(`${GEMINI_GENERATE_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: BATCH_TRANSLATE_MAX_OUTPUT_TOKENS,
      },
    }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Gemini API error ${resp.status}: ${text}`);
  }

  const json = (await resp.json()) as {
    candidates?: {
      finishReason?: string;
      content?: { parts?: { text?: string }[] };
    }[];
    promptFeedback?: { blockReason?: string };
  };

  if (json.promptFeedback?.blockReason) {
    throw new Error(`Gemini blocked: ${json.promptFeedback.blockReason}`);
  }

  const cand = json.candidates?.[0];
  if (!cand) {
    throw new Error('Gemini returned no candidates');
  }
  if (cand.finishReason === 'SAFETY' || cand.finishReason === 'RECITATION') {
    throw new Error(`Gemini blocked: ${cand.finishReason}`);
  }

  const parts = cand.content?.parts ?? [];
  return parts.map((p) => p.text ?? '').join('');
}

/**
 * Models often output batch-local indices [0..n] instead of global [startIndex..].
 * Map local keys into the current batch's global range when no global keys are present.
 */
export function normalizeBatchIndices(
  extracted: Map<number, string>,
  startIndex: number,
  batchLen: number,
): Map<number, string> {
  const keys = [...extracted.keys()];
  if (keys.length === 0) return extracted;

  const inGlobalRange = (k: number) =>
    k >= startIndex && k < startIndex + batchLen;
  const hasGlobal = keys.some(inGlobalRange);

  const out = new Map<number, string>();
  if (hasGlobal) {
    for (const [k, v] of extracted) {
      if (inGlobalRange(k)) out.set(k, v);
    }
    return out;
  }

  const hasLocal = keys.some((k) => k >= 0 && k < batchLen);
  if (hasLocal) {
    for (const [k, v] of extracted) {
      if (k >= 0 && k < batchLen) out.set(startIndex + k, v);
    }
    return out;
  }

  return extracted;
}

/** Strip common markdown wrappers the model may add despite instructions. */
function stripModelNoise(text: string): string {
  return text
    .replace(/^```(?:json|text|markdown)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim();
}

/**
 * Extract [index] → translation from full model output.
 * Handles: one line per cue, multiple [n] on one line, Chinese brackets 【n】, optional `>>` prefixes.
 */
export function extractIndexedTranslations(full: string): Map<number, string> {
  const map = new Map<number, string>();
  const cleaned = stripModelNoise(full);
  if (!cleaned) return map;

  const setFirst = (idx: number, value: string) => {
    const t = value.replace(/^>>\s*/, '').trim();
    if (!t || map.has(idx)) return;
    map.set(idx, t);
  };

  const lineHeader =
    /^(?:>>\s*)?(?:\[(\d+)\]|【(\d+)】)\s*([\s\S]*)$/;

  // 1) Split at each [n] or 【n】 start (handles same-line multiple cues)
  const segments = cleaned.split(/\n*(?=(?:>>\s*)?(?:\[\d+\]|【\d+】))/);
  for (const seg of segments) {
    const s = seg.trim();
    if (!s) continue;
    const m = s.match(lineHeader);
    if (m) {
      const idx = m[1] ? parseInt(m[1], 10) : parseInt(m[2]!, 10);
      setFirst(idx, m[3]);
    }
  }

  // 2) Global scan if line split missed (e.g. no newlines)
  if (map.size === 0) {
    const re =
      /(?:>>\s*)?(?:\[|【)\s*(\d+)\s*(?:\]|】)\s*([\s\S]*?)(?=(?:>>\s*)?(?:\[|【)\s*\d+\s*(?:\]|】)|$)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(cleaned)) !== null) {
      setFirst(parseInt(m[1], 10), m[2]);
    }
  }

  // 3) Line-by-line fallback (ASCII brackets only)
  for (const raw of cleaned.split(/\n/)) {
    const line = raw.replace(/\r$/, '').trim();
    if (!line) continue;
    const m = line.match(/^(?:>>\s*)?\[(\d+)\]\s*(.*)$/);
    if (m) setFirst(parseInt(m[1], 10), m[2]);
  }

  return map;
}

/** When the model returns exactly N non-empty lines but no [index] markers, map by order within the batch. */
export function fallbackByLineOrder(
  full: string,
  startIndex: number,
  batchLen: number,
): Map<number, string> {
  const map = new Map<number, string>();
  const cleaned = stripModelNoise(full);
  const lines = cleaned
    .split(/\n/)
    .map((l) => l.trim().replace(/^>>\s*/, '').trim())
    .filter((l) => l.length > 0);
  if (lines.length !== batchLen) return map;
  for (let i = 0; i < batchLen; i++) {
    map.set(startIndex + i, lines[i]);
  }
  return map;
}
