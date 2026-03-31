'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Download, Pause, Play, Square, FileText } from 'lucide-react';
import { TranslateForm } from '@/components/translate-form';
import { StreamRenderer } from '@/components/stream-renderer';
import { HistoryPanel } from '@/components/history-panel';
import { Button } from '@/components/ui/button';
import { parseVideoId } from '@/lib/youtube';
import {
  downloadBlob,
  htmlToPlainText,
  cuesToPlainText,
  cuesToSrt,
  htmlToSrt,
  serializeCueTranslatePayload,
  parseCueTranslatePayload,
  type CueTranslationEntry,
} from '@/lib/export';
import {
  loadDraft,
  saveDraft,
  addHistoryEntry,
  loadHistory,
  removeHistoryEntry,
  type HistoryEntry,
} from '@/lib/storage';
import { consumeTranslateSse } from '@/lib/sse-client';
import type { MetaEventPayload } from '@/lib/subtitle-translate-pipeline';

function titleFromLegacyHtml(html: string, url: string): string {
  const t = htmlToPlainText(html).slice(0, 80).trim();
  if (t) return t;
  const id = parseVideoId(url);
  return id ? `视频 ${id}` : '翻译记录';
}

function titleForSave(
  meta: MetaEventPayload | null,
  translations: Record<number, CueTranslationEntry>,
  legacyHtml: string,
  url: string,
): string {
  if (meta) {
    const t = cuesToPlainText(meta, translations).slice(0, 80).trim();
    if (t) return t;
  }
  if (legacyHtml.trim()) {
    return titleFromLegacyHtml(legacyHtml, url);
  }
  const id = parseVideoId(url);
  return id ? `视频 ${id}` : '翻译记录';
}

export function Translator() {
  const [url, setUrl] = useState('');
  const [legacyHtml, setLegacyHtml] = useState('');
  const [meta, setMeta] = useState<MetaEventPayload | null>(null);
  const [translations, setTranslations] = useState<Record<number, CueTranslationEntry>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const pausedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const userStoppedRef = useRef(false);
  const metaRef = useRef<MetaEventPayload | null>(null);
  const translationsRef = useRef<Record<number, CueTranslationEntry>>({});

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    metaRef.current = meta;
  }, [meta]);

  useEffect(() => {
    translationsRef.current = translations;
  }, [translations]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    const d = loadDraft();
    if (!d) return;
    setUrl(d.url);
    const parsed = parseCueTranslatePayload(d.html);
    if (parsed) {
      const tr: Record<number, CueTranslationEntry> = {};
      for (const [k, v] of Object.entries(parsed.translations)) {
        tr[Number(k)] = v;
      }
      setMeta(parsed.meta);
      setTranslations(tr);
      setLegacyHtml('');
    } else {
      setLegacyHtml(d.html);
      setMeta(null);
      setTranslations({});
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!url.trim() && !meta && !legacyHtml) return;
      const htmlField = meta
        ? serializeCueTranslatePayload(meta, translations)
        : legacyHtml;
      saveDraft({ url, html: htmlField, updatedAt: Date.now() });
    }, 700);
    return () => clearTimeout(t);
  }, [url, meta, legacyHtml, translations]);

  const handleTranslate = useCallback(async (videoUrl: string) => {
    setLegacyHtml('');
    setMeta(null);
    setTranslations({});
    metaRef.current = null;
    translationsRef.current = {};
    setError(null);
    setLoading(true);
    setPaused(false);
    pausedRef.current = false;
    userStoppedRef.current = false;

    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    try {
      const resp = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: videoUrl }),
        signal: ac.signal,
      });

      if (!resp.ok) {
        const data = (await resp.json()) as { error?: string };
        throw new Error(data.error || '翻译失败');
      }

      const body = resp.body;
      if (!body) throw new Error('无响应流');

      await consumeTranslateSse(body, {
        onMeta: (m) => {
          const next: MetaEventPayload = {
            cueCount: m.cueCount,
            cues: m.cues ?? [],
          };
          metaRef.current = next;
          setMeta(next);
        },
        onTimings: (t) => {
          setMeta((prev) => {
            if (!prev) return prev;
            const merged: MetaEventPayload = {
              ...prev,
              cues: [...prev.cues, ...(t.cues ?? [])],
            };
            metaRef.current = merged;
            return merged;
          });
        },
        onCue: async (payload) => {
          while (pausedRef.current) {
            await new Promise((r) => setTimeout(r, 100));
          }
          setTranslations((prev) => {
            const next = { ...prev };
            for (const line of payload.lines) {
              next[line.index] = {
                text: line.text,
                status: line.status === 'fallback' ? 'fallback' : 'ok',
              };
            }
            translationsRef.current = next;
            return next;
          });
        },
        onDone: () => {},
      });

      const finalMeta = metaRef.current;
      const finalTr = translationsRef.current;
      if (!userStoppedRef.current && finalMeta) {
        const vid = parseVideoId(videoUrl);
        addHistoryEntry({
          url: videoUrl,
          html: serializeCueTranslatePayload(finalMeta, finalTr),
          title: titleForSave(finalMeta, finalTr, '', videoUrl),
          videoId: vid,
        });
        setHistory(loadHistory());
      }
    } catch (err: unknown) {
      const aborted =
        (err instanceof DOMException && err.name === 'AbortError') ||
        (err instanceof Error && err.name === 'AbortError');
      if (aborted) {
        setError(null);
      } else {
        setError(err instanceof Error ? err.message : '发生错误');
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, []);

  const handlePause = () => {
    setPaused(true);
    pausedRef.current = true;
  };

  const handleResume = () => {
    setPaused(false);
    pausedRef.current = false;
  };

  const handleStop = () => {
    userStoppedRef.current = true;
    abortRef.current?.abort();
  };

  const handleExportTxt = () => {
    let text = '';
    if (meta) {
      text = cuesToPlainText(meta, translations);
    } else if (legacyHtml) {
      text = htmlToPlainText(legacyHtml);
    }
    if (!text) return;
    const id = parseVideoId(url) || 'export';
    downloadBlob(`youtube-${id}.txt`, text + '\n', 'text/plain;charset=utf-8');
  };

  const handleExportSrt = () => {
    let srt = '';
    if (meta) {
      srt = cuesToSrt(meta, translations);
    } else if (legacyHtml) {
      srt = htmlToSrt(legacyHtml);
    }
    if (!srt) return;
    const id = parseVideoId(url) || 'export';
    downloadBlob(`youtube-${id}.srt`, srt, 'application/x-subrip;charset=utf-8');
  };

  const handleLoadHistory = (entry: HistoryEntry) => {
    setUrl(entry.url);
    setError(null);
    const parsed = parseCueTranslatePayload(entry.html);
    if (parsed) {
      const tr: Record<number, CueTranslationEntry> = {};
      for (const [k, v] of Object.entries(parsed.translations)) {
        tr[Number(k)] = v;
      }
      setMeta(parsed.meta);
      setTranslations(tr);
      setLegacyHtml('');
    } else {
      setLegacyHtml(entry.html);
      setMeta(null);
      setTranslations({});
    }
    document.getElementById('translator')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleRemoveHistory = (id: string) => {
    removeHistoryEntry(id);
    setHistory(loadHistory());
  };

  const hasContent = Boolean(meta || legacyHtml.trim());

  return (
    <div className="space-y-8 sm:space-y-10">
      <section
        id="translator"
        className="border-border/60 bg-card/50 scroll-mt-24 rounded-2xl border p-4 shadow-sm backdrop-blur-sm sm:p-6 lg:p-8"
      >
        <div className="grid gap-6 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] lg:items-start lg:gap-8">
          <div className="order-1 flex min-w-0 flex-col lg:order-2">
            <div className="mb-6 flex flex-col gap-2 sm:mb-8">
              <h2 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">
                翻译工具
              </h2>
              <p className="text-muted-foreground text-sm">
                粘贴链接后开始翻译。进行中可使用暂停 / 恢复；关闭页面前草稿会自动保存在本地。
              </p>
            </div>

            <TranslateForm
              url={url}
              onUrlChange={setUrl}
              onSubmit={handleTranslate}
              loading={loading}
            />

            {(loading || hasContent) && (
              <div className="border-border/50 mt-4 flex flex-wrap items-center gap-2 border-t pt-4 sm:mt-6 sm:gap-3 sm:pt-6">
                {loading && (
                  <>
                    {paused ? (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="gap-1.5"
                        onClick={handleResume}
                      >
                        <Play className="size-4" />
                        恢复
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        className="gap-1.5"
                        onClick={handlePause}
                      >
                        <Pause className="size-4" />
                        暂停
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-destructive gap-1.5"
                      onClick={handleStop}
                    >
                      <Square className="size-4" />
                      停止
                    </Button>
                  </>
                )}

                {hasContent ? (
                  <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={handleExportTxt}
                    >
                      <FileText className="size-4" />
                      导出 TXT
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={handleExportSrt}
                    >
                      <Download className="size-4" />
                      导出 SRT
                    </Button>
                  </div>
                ) : null}
              </div>
            )}

            <StreamRenderer
              legacyHtml={legacyHtml}
              meta={meta}
              translations={translations}
              loading={loading}
              error={error}
            />
          </div>

          <aside
            className="order-2 min-w-0 lg:sticky lg:top-24 lg:order-1 lg:self-start"
            aria-label="翻译历史"
          >
            <HistoryPanel
              entries={history}
              onLoad={handleLoadHistory}
              onRemove={handleRemoveHistory}
            />
          </aside>
        </div>
      </section>
    </div>
  );
}
