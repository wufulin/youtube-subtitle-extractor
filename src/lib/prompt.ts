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

/** One [globalIndex] line per subtitle row; model must echo the same index prefix. */
export function buildBatchPrompt(batch: Subtitle[], startIndex: number): string {
  const lines = batch
    .map((s, i) => `[${startIndex + i}] ${s.text}`)
    .join('\n');

  const first = startIndex;
  const second = startIndex + 1;

  return `You are a professional translator. Translate each English YouTube subtitle line into natural Chinese.

Rules:
1. Output exactly one line per input line.
2. Each output line MUST start with the same [index] prefix as the corresponding INPUT line — the number in brackets must match exactly (use the same global indices as the Input, not 0,1,2…). Example: [${first}] … and [${second}] … if those appear in the Input.
3. Do not renumber from zero; do not use batch-local numbering. The bracket number before each translation must equal the bracket number on the same row in Input.
4. Do not use markdown, code fences, bullet points, or lines like "Translation:". Output ONLY the indexed lines — no preamble or epilogue.
5. Do not merge, reorder, skip, or add lines. Do not copy English without translating.
6. Keep each translation on a single line (no line breaks inside one translation).

Input:
${lines}`;
}
