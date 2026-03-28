import type { Subtitle } from './youtube';

function formatTimestamp(seconds: string): string {
  const total = parseFloat(seconds);
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function buildPrompt(subtitles: Subtitle[]): string {
  const transcript = subtitles.map((s) => `[${formatTimestamp(s.start)}] ${s.text}`).join('\n');

  return `You are a professional translator and editor. Translate the following YouTube English subtitles into Chinese and reformat as an elegant dialogue article.

Rules:
1. Identify different speakers from context. Label them with inferred identities or Speaker A / B / C.
2. Translation must be natural, idiomatic Chinese — no translationese.
3. Output raw HTML fragments directly (NO markdown code fences), using these classes:
   - <div class="article-summary">Summary text here</div> (one opening summary paragraph)
   - <div class="dialogue-turn">
       <span class="speaker-label">Speaker Name</span>
       <span class="turn-time">00:00</span>
       <p class="turn-text">Translated content</p>
     </div>
4. Merge fragmented consecutive subtitle lines into coherent natural paragraphs.
5. Preserve original timestamps in each dialogue-turn.

Subtitles:
${transcript}`;
}
