import type { MetaEventPayload } from '@/lib/subtitle-translate-pipeline';

export const CUE_TRANSLATE_V1 = 'cue-translate-v1' as const;

export type CueTranslationEntry = {
  text: string;
  status?: 'ok' | 'fallback';
};

export type CueTranslatePayloadV1 = {
  type: typeof CUE_TRANSLATE_V1;
  meta: MetaEventPayload;
  translations: Record<string, CueTranslationEntry>;
};

export function isCueTranslatePayloadV1(raw: unknown): raw is CueTranslatePayloadV1 {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    (raw as CueTranslatePayloadV1).type === CUE_TRANSLATE_V1 &&
    typeof (raw as CueTranslatePayloadV1).meta === 'object' &&
    (raw as CueTranslatePayloadV1).meta !== null &&
    typeof (raw as CueTranslatePayloadV1).translations === 'object' &&
    (raw as CueTranslatePayloadV1).translations !== null
  );
}

export function parseCueTranslatePayload(htmlField: string): CueTranslatePayloadV1 | null {
  try {
    const o = JSON.parse(htmlField) as unknown;
    return isCueTranslatePayloadV1(o) ? o : null;
  } catch {
    return null;
  }
}

export function serializeCueTranslatePayload(
  meta: MetaEventPayload,
  translations: Record<number, CueTranslationEntry>,
): string {
  const translationsStr: Record<string, CueTranslationEntry> = {};
  for (const [k, v] of Object.entries(translations)) {
    translationsStr[k] = v;
  }
  const payload: CueTranslatePayloadV1 = {
    type: CUE_TRANSLATE_V1,
    meta,
    translations: translationsStr,
  };
  return JSON.stringify(payload);
}

export function htmlToPlainText(html: string): string {
  if (typeof window === 'undefined') {
    return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent?.replace(/\s+/g, ' ').trim() ?? '';
}

/** Minimal SRT when timings are unavailable: single long cue. */
export function htmlToSrt(html: string, durationSeconds = 600): string {
  const text = htmlToPlainText(html);
  if (!text) return '';
  const end = formatSrtTimeSeconds(durationSeconds);
  return `1\n00:00:00,000 --> ${end}\n${text.replace(/\n/g, ' ')}\n`;
}

function formatSrtTimeSeconds(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const ms = 0;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function formatSrtTimeMs(ms: number): string {
  const totalMs = Math.max(0, Math.floor(ms));
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  const frac = totalMs % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(frac).padStart(3, '0')}`;
}

export function cuesToPlainText(
  meta: MetaEventPayload,
  translations: Record<number, CueTranslationEntry>,
): string {
  const lines: string[] = [];
  for (const c of meta.cues) {
    const t = translations[c.index]?.text?.trim();
    if (t) lines.push(t);
  }
  return lines.join('\n\n');
}

export function cuesToSrt(
  meta: MetaEventPayload,
  translations: Record<number, CueTranslationEntry>,
): string {
  const blocks: string[] = [];
  let n = 1;
  for (const c of meta.cues) {
    const text = translations[c.index]?.text?.trim();
    if (!text) continue;
    const start = formatSrtTimeMs(c.startMs);
    const end = formatSrtTimeMs(c.startMs + c.durMs);
    blocks.push(`${n}\n${start} --> ${end}\n${text}\n`);
    n++;
  }
  return blocks.join('\n');
}

export function downloadBlob(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
