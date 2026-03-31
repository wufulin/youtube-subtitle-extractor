-- D1: English subtitle snapshots per YouTube video
CREATE TABLE IF NOT EXISTS subtitles (
  video_id TEXT PRIMARY KEY NOT NULL,
  title TEXT,
  lang TEXT NOT NULL DEFAULT 'en',
  cues_json TEXT NOT NULL,
  cue_count INTEGER NOT NULL,
  fetched_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_subtitles_updated ON subtitles (updated_at DESC);
