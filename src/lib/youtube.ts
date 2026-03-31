import { Innertube } from 'youtubei.js/cf-worker';

export interface Subtitle {
  start: string;
  dur: string;
  text: string;
  /** Milliseconds from json3 `tStartMs` or derived from XML seconds */
  startMs: number;
  /** Milliseconds from json3 `dDurationMs` or derived from XML seconds */
  durMs: number;
}

const VIDEO_ID_PATTERNS = [
  /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
  /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
  /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
];

export function parseVideoId(url: string): string | null {
  for (const pattern of VIDEO_ID_PATTERNS) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

let innertubeInstance: Innertube | null = null;

async function getInnertube(): Promise<Innertube> {
  if (!innertubeInstance) {
    innertubeInstance = await Innertube.create({
      generate_session_locally: true,
      lang: 'en',
      location: 'US',
    });
  }
  return innertubeInstance;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9A-Fa-f]+);/g, (_, hex: string) =>
      String.fromCodePoint(parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, dec: string) =>
      String.fromCodePoint(parseInt(dec, 10)),
    );
}

function subtitleFromSeconds(startSec: number, durSec: number, text: string): Subtitle {
  const startMs = Math.round(startSec * 1000);
  const durMs = Math.round(durSec * 1000);
  return {
    start: String(startSec),
    dur: String(durSec),
    text,
    startMs,
    durMs,
  };
}

function parseCaptionXml(xml: string): Subtitle[] {
  const results: Subtitle[] = [];
  const regex =
    /<text\s+start="([\d.]+)"\s+dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(xml)) !== null) {
    const text = decodeHtmlEntities(m[3].replace(/<[^>]+>/g, '').trim());
    if (text) {
      const startSec = parseFloat(m[1]);
      const durSec = parseFloat(m[2]);
      results.push(subtitleFromSeconds(startSec, durSec, text));
    }
  }

  return results;
}

interface Json3Seg {
  utf8?: string;
}

interface Json3Event {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: Json3Seg[];
}

interface Json3Root {
  events?: Json3Event[];
}

function parseCaptionJson3(json: string): Subtitle[] {
  let root: Json3Root;
  try {
    root = JSON.parse(json) as Json3Root;
  } catch {
    return [];
  }

  const events = root.events;
  if (!Array.isArray(events)) return [];

  const results: Subtitle[] = [];

  for (const ev of events) {
    const segs = ev.segs;
    if (!Array.isArray(segs) || segs.length === 0) continue;

    const parts: string[] = [];
    for (const s of segs) {
      const u = s.utf8;
      if (typeof u === 'string' && u.trim()) parts.push(u);
    }

    const text = decodeHtmlEntities(parts.join('').replace(/<[^>]+>/g, '').trim());
    if (!text) continue;

    const tStartMs = typeof ev.tStartMs === 'number' ? ev.tStartMs : 0;
    const dDurationMs =
      typeof ev.dDurationMs === 'number' && ev.dDurationMs > 0 ? ev.dDurationMs : 1000;

    const startSec = tStartMs / 1000;
    const durSec = dDurationMs / 1000;

    results.push({
      start: String(startSec),
      dur: String(durSec),
      text,
      startMs: tStartMs,
      durMs: dDurationMs,
    });
  }

  return results;
}

function captionUrlWithFmt(baseUrl: string, fmt: string): string {
  try {
    const u = new URL(baseUrl);
    u.searchParams.set('fmt', fmt);
    return u.toString();
  } catch {
    const sep = baseUrl.includes('?') ? '&' : '?';
    return `${baseUrl}${sep}fmt=${encodeURIComponent(fmt)}`;
  }
}

export interface ExtractSubtitlesResult {
  subtitles: Subtitle[];
  /** Video title from player metadata, when available */
  title?: string;
}

export async function extractSubtitles(
  videoId: string,
  lang = 'en',
): Promise<ExtractSubtitlesResult> {
  const yt = await getInnertube();
  const info = await yt.getBasicInfo(videoId);

  const title =
    typeof info.basic_info?.title === 'string' ? info.basic_info.title : undefined;

  const tracks = info.captions?.caption_tracks;
  if (!tracks?.length) return { subtitles: [], title };

  const track =
    tracks.find((t) => t.language_code === lang && t.kind !== 'asr') ??
    tracks.find((t) => t.language_code === lang) ??
    tracks[0];

  if (!track?.base_url) return { subtitles: [], title };

  const jsonUrl = captionUrlWithFmt(track.base_url, 'json3');
  let res = await fetch(jsonUrl);

  if (res.ok) {
    const text = await res.text();
    const trimmed = text.trim();
    if (trimmed.startsWith('{')) {
      const parsed = parseCaptionJson3(text);
      if (parsed.length > 0) {
        return { subtitles: parsed, title };
      }
    }
  }

  res = await fetch(track.base_url);
  if (!res.ok) {
    throw new Error(`Failed to fetch captions: ${res.status}`);
  }

  return {
    subtitles: parseCaptionXml(await res.text()),
    title,
  };
}
