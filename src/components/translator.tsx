'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Pause, Play, Square, FileText, Eraser } from 'lucide-react';
import { TranslateForm } from '@/components/translate-form';
import { StreamRenderer } from '@/components/stream-renderer';
import { HistoryPanel } from '@/components/history-panel';
import { Button } from '@/components/ui/button';
import { parseVideoId } from '@/lib/youtube';
import { downloadBlob, htmlToPlainText, htmlToMarkdown } from '@/lib/export';
import {
  clearDraft,
  saveDraft,
  addHistoryEntry,
  loadHistory,
  removeHistoryEntry,
  type HistoryEntry,
} from '@/lib/storage';

function titleFromHtml(html: string, url: string): string {
  const t = htmlToPlainText(html).slice(0, 80).trim();
  if (t) return t;
  const id = parseVideoId(url);
  return id ? `视频 ${id}` : '翻译记录';
}

export function Translator() {
  const [url, setUrl] = useState('');
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  const bufferRef = useRef('');
  const flushTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFlushAtRef = useRef(0);
  const pausedRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const userStoppedRef = useRef(false);
  const contentRef = useRef('');
  const scrollTranslationToTopRef = useRef(false);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    clearDraft();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (!url.trim() && !html) return;
      saveDraft({ url, html, updatedAt: Date.now() });
    }, 700);
    return () => clearTimeout(t);
  }, [url, html]);

  const flushAppend = useCallback((chunk: string) => {
    if (!chunk) return;
    setHtml((prev) => {
      const next = prev + chunk;
      contentRef.current = next;
      return next;
    });
  }, []);

  const handleTranslate = useCallback(
    async (videoUrl: string) => {
      setHtml('');
      setError(null);
      setLoading(true);
      setPaused(false);
      pausedRef.current = false;
      userStoppedRef.current = false;
      bufferRef.current = '';
      contentRef.current = '';
      if (flushTimeoutRef.current) {
        clearTimeout(flushTimeoutRef.current);
        flushTimeoutRef.current = null;
      }
      lastFlushAtRef.current = 0;

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
          const data = await resp.json();
          throw new Error(data.error || '翻译失败');
        }

        if (resp.headers.get('X-Cached-Translation') === '1') {
          const finalHtml = await resp.text();
          setHtml(finalHtml);
          contentRef.current = finalHtml;
          if (!userStoppedRef.current && finalHtml.trim()) {
            const vid = parseVideoId(videoUrl);
            addHistoryEntry({
              url: videoUrl,
              html: finalHtml,
              title: titleFromHtml(finalHtml, videoUrl),
              videoId: vid,
            });
            setHistory(loadHistory());
          }
          return;
        }

        const reader = resp.body!.getReader();
        const decoder = new TextDecoder();

        for (;;) {
          while (pausedRef.current) {
            await new Promise((r) => setTimeout(r, 100));
          }

          const { done, value } = await reader.read();
          if (done) break;

          bufferRef.current += decoder.decode(value, { stream: true });

          if (!flushTimeoutRef.current) {
            const now = Date.now();
            const wait = Math.max(0, 800 - (now - lastFlushAtRef.current));
            flushTimeoutRef.current = setTimeout(() => {
              flushTimeoutRef.current = null;
              const chunk = bufferRef.current;
              bufferRef.current = '';
              lastFlushAtRef.current = Date.now();
              if (chunk) flushAppend(chunk);
            }, wait);
          }
        }

        if (flushTimeoutRef.current) {
          clearTimeout(flushTimeoutRef.current);
          flushTimeoutRef.current = null;
        }
        if (bufferRef.current) {
          const remaining = bufferRef.current;
          bufferRef.current = '';
          flushAppend(remaining);
        }

        const finalHtml = contentRef.current;
        if (!userStoppedRef.current && finalHtml.trim()) {
          const vid = parseVideoId(videoUrl);
          addHistoryEntry({
            url: videoUrl,
            html: finalHtml,
            title: titleFromHtml(finalHtml, videoUrl),
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
    },
    [flushAppend],
  );

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

  const handleClearTranslation = () => {
    userStoppedRef.current = true;
    abortRef.current?.abort();
    bufferRef.current = '';
    if (flushTimeoutRef.current) {
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
    lastFlushAtRef.current = 0;
    setHtml('');
    contentRef.current = '';
    setError(null);
    setPaused(false);
    pausedRef.current = false;
  };

  const handleExportMarkdown = () => {
    const md = htmlToMarkdown(html);
    if (!md) return;
    const id = parseVideoId(url) || 'export';
    downloadBlob(`youtube-${id}.md`, md + '\n', 'text/markdown;charset=utf-8');
  };

  const handleLoadHistory = (entry: HistoryEntry) => {
    scrollTranslationToTopRef.current = true;
    setUrl(entry.url);
    setHtml(entry.html);
    contentRef.current = entry.html;
    setError(null);
    document.getElementById('translator')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleRemoveHistory = (id: string) => {
    removeHistoryEntry(id);
    setHistory(loadHistory());
  };

  return (
    <div className="grid gap-8 sm:gap-10 lg:grid-cols-[minmax(0,280px)_minmax(0,1fr)] lg:items-start">
      <aside className="order-2 min-w-0 lg:sticky lg:top-24 lg:order-1 lg:self-start">
        <HistoryPanel entries={history} onLoad={handleLoadHistory} onRemove={handleRemoveHistory} />
      </aside>

      <section
        id="translator"
        className="border-border/60 bg-card/50 order-1 min-w-0 scroll-mt-24 rounded-2xl border p-4 shadow-sm backdrop-blur-sm sm:p-6 lg:order-2 lg:p-8"
      >
        <div className="mb-6 flex flex-col gap-2 sm:mb-8">
          <h2 className="text-foreground text-xl font-bold tracking-tight sm:text-2xl">翻译</h2>
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

        {(loading || html) && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border/50 pt-4 sm:mt-6 sm:gap-3 sm:pt-6">
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

            <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="text-destructive hover:bg-destructive/10 gap-1.5"
                onClick={handleClearTranslation}
              >
                <Eraser className="size-4" />
                清空译文
              </Button>
              {html ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  onClick={handleExportMarkdown}
                >
                  <FileText className="size-4" />
                  导出 Markdown
                </Button>
              ) : null}
            </div>
          </div>
        )}

        <StreamRenderer
          html={html}
          loading={loading}
          error={error}
          scrollTranslationToTopRef={scrollTranslationToTopRef}
        />
      </section>
    </div>
  );
}
