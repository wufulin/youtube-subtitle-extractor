import { Innertube } from 'youtubei.js/cf-worker';
import type { Subtitle } from '@/lib/subtitle';

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

  const res = await fetch(track.base_url);

  if (!res.ok) {
    throw new Error(`Failed to fetch captions: ${res.status}`);
  }

  return {
    subtitles: parseCaptionXml(await res.text()),
    title,
  };
}
