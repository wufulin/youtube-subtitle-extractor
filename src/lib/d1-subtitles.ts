import type { D1Database } from '@cloudflare/workers-types';
import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { Subtitle } from '@/lib/youtube';

export async function getD1Database(): Promise<D1Database | null> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    return env.DB ?? null;
  } catch {
    return null;
  }
}

export async function upsertSubtitles(
  db: D1Database,
  params: {
    videoId: string;
    title: string | undefined;
    lang: string;
    cues: Subtitle[];
  },
): Promise<void> {
  const now = Date.now();
  const cuesJson = JSON.stringify(params.cues);
  const cueCount = params.cues.length;

  await db
    .prepare(
      `INSERT INTO subtitles (video_id, title, lang, cues_json, cue_count, fetched_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(video_id) DO UPDATE SET
         title = excluded.title,
         lang = excluded.lang,
         cues_json = excluded.cues_json,
         cue_count = excluded.cue_count,
         updated_at = excluded.updated_at`,
    )
    .bind(
      params.videoId,
      params.title ?? null,
      params.lang,
      cuesJson,
      cueCount,
      now,
      now,
    )
    .run();
}

export type SubtitleListItem = {
  video_id: string;
  title: string | null;
  cue_count: number;
  updated_at: number;
};

export async function listSubtitles(
  db: D1Database,
  options: { limit: number; offset: number },
): Promise<{ items: SubtitleListItem[]; total: number }> {
  const totalRow = await db.prepare('SELECT COUNT(*) as c FROM subtitles').first<{ c: number }>();
  const total = totalRow?.c ?? 0;

  const { results } = await db
    .prepare(
      `SELECT video_id, title, cue_count, updated_at FROM subtitles
       ORDER BY updated_at DESC
       LIMIT ? OFFSET ?`,
    )
    .bind(options.limit, options.offset)
    .all<SubtitleListItem>();

  return { items: results ?? [], total };
}

export type StoredSubtitles = {
  video_id: string;
  title: string | null;
  lang: string;
  cues: Subtitle[];
  updated_at: number;
};

export async function getSubtitlesByVideoId(
  db: D1Database,
  videoId: string,
): Promise<StoredSubtitles | null> {
  const row = await db
    .prepare(
      `SELECT video_id, title, lang, cues_json, updated_at FROM subtitles WHERE video_id = ?`,
    )
    .bind(videoId)
    .first<{
      video_id: string;
      title: string | null;
      lang: string;
      cues_json: string;
      updated_at: number;
    }>();

  if (!row) return null;

  let cues: Subtitle[];
  try {
    cues = JSON.parse(row.cues_json) as Subtitle[];
  } catch {
    return null;
  }

  return {
    video_id: row.video_id,
    title: row.title,
    lang: row.lang,
    cues,
    updated_at: row.updated_at,
  };
}

export async function deleteSubtitlesByVideoId(db: D1Database, videoId: string): Promise<boolean> {
  const result = await db.prepare('DELETE FROM subtitles WHERE video_id = ?').bind(videoId).run();
  return (result.meta.changes ?? 0) > 0;
}
