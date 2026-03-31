const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:streamGenerateContent';

function geminiTextFromSsePayload(raw: string): string | undefined {
  const json = raw.trim();
  if (!json || json === '[DONE]') return undefined;
  try {
    const parsed = JSON.parse(json) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return parsed.candidates?.[0]?.content?.parts?.[0]?.text;
  } catch {
    return undefined;
  }
}

function enqueueGeminiDelta(
  rawPayload: string,
  encoder: TextEncoder,
  controller: TransformStreamDefaultController<Uint8Array>,
): void {
  const text = geminiTextFromSsePayload(rawPayload);
  if (text) controller.enqueue(encoder.encode(text));
}

export async function streamTranslate(
  prompt: string,
  apiKey: string,
): Promise<ReadableStream<Uint8Array>> {
  const resp = await fetch(`${GEMINI_ENDPOINT}?alt=sse&key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Gemini API error ${resp.status}: ${text}`);
  }

  if (!resp.body) {
    throw new Error('Gemini API returned no response body');
  }

  const encoder = new TextEncoder();
  let buffer = '';

  return resp.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += new TextDecoder().decode(chunk);
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          enqueueGeminiDelta(line.slice(6), encoder, controller);
        }
      },
      flush(controller) {
        if (buffer.startsWith('data: ')) {
          enqueueGeminiDelta(buffer.slice(6), encoder, controller);
        }
      },
    }),
  );
}
