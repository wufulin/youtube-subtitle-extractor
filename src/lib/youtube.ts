import { Innertube } from 'youtubei.js';
import { ProxyAgent } from 'undici';

export interface Subtitle {
  start: string;
  dur: string;
  text: string;
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

const proxyUrl = process.env.HTTPS_PROXY || process.env.HTTP_PROXY;
const dispatcher = proxyUrl ? new ProxyAgent(proxyUrl) : undefined;

type FetchFn = typeof globalThis.fetch;

const proxyFetch: FetchFn | undefined = dispatcher
  ? (input, init) => fetch(input, { ...init, dispatcher } as RequestInit)
  : undefined;

let innertubeInstance: Innertube | null = null;

async function getInnertube(): Promise<Innertube> {
  if (!innertubeInstance) {
    innertubeInstance = await Innertube.create({
      generate_session_locally: true,
      lang: 'en',
      location: 'US',
      fetch: proxyFetch,
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

function parseCaptionXml(xml: string): Subtitle[] {
  const results: Subtitle[] = [];
  const regex =
    /<text\s+start="([\d.]+)"\s+dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  let m: RegExpExecArray | null;

  while ((m = regex.exec(xml)) !== null) {
    const text = decodeHtmlEntities(m[3].replace(/<[^>]+>/g, '').trim());
    if (text) {
      results.push({ start: m[1], dur: m[2], text });
    }
  }

  return results;
}

export async function extractSubtitles(
  videoId: string,
  lang = 'en',
): Promise<Subtitle[]> {
  const yt = await getInnertube();
  const info = await yt.getBasicInfo(videoId);

  const tracks = info.captions?.caption_tracks;
  if (!tracks?.length) return [];

  const track =
    tracks.find((t) => t.language_code === lang && t.kind !== 'asr') ??
    tracks.find((t) => t.language_code === lang) ??
    tracks[0];

  if (!track?.base_url) return [];

  const fetchFn = proxyFetch ?? fetch;
  const res = await fetchFn(track.base_url);

  if (!res.ok) {
    throw new Error(`Failed to fetch captions: ${res.status}`);
  }

  return parseCaptionXml(await res.text());
}
