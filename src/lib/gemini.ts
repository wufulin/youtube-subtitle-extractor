const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent';

export async function streamTranslate(
  prompt: string,
  apiKey: string
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
        const decoded = new TextDecoder().decode(chunk);
        buffer += decoded;
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const json = line.slice(6).trim();
          if (!json || json === '[DONE]') continue;
          try {
            const parsed = JSON.parse(json);
            const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
            if (content) {
              controller.enqueue(encoder.encode(content));
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
              const parsed = JSON.parse(json);
              const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
              if (content) {
                controller.enqueue(encoder.encode(content));
              }
            } catch {
              // skip
            }
          }
        }
      },
    })
  );
}
