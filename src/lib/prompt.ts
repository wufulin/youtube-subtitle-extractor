import type { Subtitle } from '@/lib/subtitle';

function formatTimestamp(seconds: string): string {
  const total = parseFloat(seconds);
  const m = Math.floor(total / 60);
  const s = Math.floor(total % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export function buildPrompt(subtitles: Subtitle[]): string {
  const transcript = subtitles.map((s) => `[${formatTimestamp(s.start)}] ${s.text}`).join('\n');

  return `You are a professional translator and editor. Translate the following YouTube English subtitles into Chinese and reformat as a structured dialogue article.

Rules:
1. Identify speakers from context; use the names used in the video (e.g. host/guest first names in Latin letters like Jen, Mark, John when that is how they address each other), or Speaker A/B if unknown.
2. Translation must be natural, idiomatic Chinese — no translationese.
3. Output raw HTML only (NO markdown code fences). Use ONLY the tags/classes below.

── Editorial structure (match this style) ──
Think in two outline levels **plus** the main title, like a polished Chinese transcript article:

• **Main title (h1)**: One strong line for the whole piece — often interview-style, e.g. 「对话〇〇：……之问」 or 「……深度对话」, combining guest/topic and a hook. Reflect the video’s core thesis.

• **Major chapters (h2)**: Short **macro** themes in **time order**. Prefer the pattern **「主题词：解释性副标题」** (two clauses separated by a full-width colon 「：」), e.g. 「技术革命：八十年一遇的AI巅峰」, 「智能经济：收入爆发与成本塌陷」, 「地缘博弈：中美竞速下的AI冷战」. Use **many** h2 blocks for long interviews (typical long-form: **about 8–15+** major chapters when the conversation keeps shifting big themes; never collapse the whole video into one or two h2s if more arcs exist).

• **Segment subtitles (inside each <summary>)**: **Finer** beats **within** the current chapter — new question threads, subtopics, or handoffs. Styles may be:
  - a compact noun phrase (e.g. 「AI公司的收入增长与产品演变」),
  - or **「子主题：副标题」**,
  - or a line ending with 「……的深度解析」 when it introduces an analytical block.
  Use **many** segments: for long videos aim for **roughly 18–40+** segments total across all chapters; for medium **12–22**; shorter clips **6–14**. **When in doubt, split** — mirror the density of a professional Chinese feature transcript.

• **Order**: After h1, repeat in transcript time: **<h2 class="article-section">…</h2>** then **one or more** <details class="article-segment">…</details> for that chapter; when the big theme changes, emit the next h2 and continue with more segments. Do **not** put all h2s first and all segments last.

── HTML shape (required) ──
1) First line of output:
   <h1 class="article-theme">…main Chinese title…</h1>

2) Then chronologically, for each major chapter and its segments:
   <h2 class="article-section">…major chapter title (prefer 主题：副标题 style)…</h2>
   <details class="article-segment" open>
     <summary class="article-segment-title">▼ …segment subtitle…</summary>
     <div class="article-segment-body">
       …one or more dialogue-turn blocks…
     </div>
   </details>
   (repeat <details>…</details> under the same h2 until the next major chapter)

3) Each dialogue turn **only** inside article-segment-body:
   <div class="dialogue-turn">
     <span class="speaker-label">Name</span>
     <span class="turn-time">MM:SS</span>
     <p class="turn-text">…spoken content in Chinese; should read naturally after the speaker (as in 「某某：……」 flow)…</p>
   </div>
   In speaker-label put **only** the speaker’s name (e.g. Jen, Mark, John) — **no** colon 「：」 or 「:」; the UI inserts the colon after the name.

4) Do not output article-summary or other wrappers.
5) Merge fragmented subtitle lines into coherent paragraphs per turn where natural.
6) Preserve timestamps from the transcript in each turn-time.

Subtitles:
${transcript}`;
}
