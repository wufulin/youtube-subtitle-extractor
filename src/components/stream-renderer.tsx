'use client';

import { useRef, useEffect, useMemo } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import type { MetaEventPayload } from '@/lib/subtitle-translate-pipeline';
import type { CueTranslationEntry } from '@/lib/export';

interface StreamRendererProps {
  /** Pre–cue-pipeline history: raw HTML article */
  legacyHtml?: string;
  meta: MetaEventPayload | null;
  translations: Record<number, CueTranslationEntry>;
  loading: boolean;
  error: string | null;
}

const NEAR_BOTTOM_PX = 80;
const SCROLL_THROTTLE_MS = 220;

function formatClock(ms: number): string {
  const totalMs = Math.max(0, Math.floor(ms));
  const h = Math.floor(totalMs / 3600000);
  const m = Math.floor((totalMs % 3600000) / 60000);
  const s = Math.floor((totalMs % 60000) / 1000);
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function StreamRenderer({
  legacyHtml = '',
  meta,
  translations,
  loading,
  error,
}: StreamRendererProps) {
  const containerRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sanitizeGenRef = useRef(0);
  const lastScrollAtRef = useRef(0);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const rows = useMemo(() => {
    if (!meta?.cues?.length) return [];
    return meta.cues.map((c) => ({
      ...c,
      tr: translations[c.index],
    }));
  }, [meta, translations]);

  useEffect(() => {
    if (meta) return;
    const el = containerRef.current;
    if (!el) return;

    const gen = ++sanitizeGenRef.current;
    const snapshot = legacyHtml;

    import('dompurify')
      .then(({ default: DOMPurify }) => {
        if (gen !== sanitizeGenRef.current) return;
        el.innerHTML = DOMPurify.sanitize(snapshot, {
          USE_PROFILES: { html: true },
        });
      })
      .catch(() => {
        if (gen !== sanitizeGenRef.current) return;
        el.textContent = snapshot;
      });
  }, [legacyHtml, meta]);

  useEffect(() => {
    const outer = scrollRef.current;
    if (!outer) return;

    const scrollToBottomIfPinned = () => {
      const { scrollTop, scrollHeight, clientHeight } = outer;
      const dist = scrollHeight - scrollTop - clientHeight;
      if (dist > NEAR_BOTTOM_PX) return;
      outer.scrollTop = outer.scrollHeight;
      lastScrollAtRef.current = Date.now();
    };

    const now = Date.now();
    const elapsed = now - lastScrollAtRef.current;
    if (elapsed >= SCROLL_THROTTLE_MS) {
      scrollToBottomIfPinned();
      return;
    }

    if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
    throttleTimerRef.current = setTimeout(() => {
      throttleTimerRef.current = null;
      scrollToBottomIfPinned();
    }, SCROLL_THROTTLE_MS - elapsed);

    return () => {
      if (throttleTimerRef.current) clearTimeout(throttleTimerRef.current);
    };
  }, [legacyHtml, meta, translations, rows]);

  if (error) {
    return (
      <div className="border-destructive/50 bg-destructive/10 text-destructive mt-10 w-full rounded-xl border p-6 text-center">
        {error}
      </div>
    );
  }

  if (meta) {
    return (
      <div
        ref={scrollRef}
        className="border-border/50 bg-card mt-10 max-h-[min(60vh,36rem)] w-full max-w-none overflow-y-auto overscroll-y-contain rounded-2xl border p-6 shadow-sm [scrollbar-gutter:stable] sm:p-8"
      >
        <div className="space-y-4 text-sm leading-relaxed">
          {rows.map((row) => {
            const fb = row.tr?.status === 'fallback';
            const text = row.tr?.text?.trim() ?? '';
            return (
              <div
                key={row.index}
                className="border-border/40 border-b pb-3 last:border-b-0 last:pb-0"
              >
                <div className="text-muted-foreground mb-1 flex flex-wrap items-baseline gap-2 font-mono text-xs">
                  <span aria-label="时间">{formatClock(row.startMs)}</span>
                  {fb ? (
                    <span className="text-destructive font-sans" role="status">
                      原文（翻译失败）
                    </span>
                  ) : null}
                </div>
                <p
                  className={
                    fb
                      ? 'text-destructive'
                      : 'text-foreground'
                  }
                >
                  {text || (loading ? '…' : '')}
                </p>
              </div>
            );
          })}
        </div>
        {loading && rows.length === 0 && (
          <div className="space-y-3 pt-4">
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}
      </div>
    );
  }

  if (!legacyHtml && !loading) return null;

  return (
    <div
      ref={scrollRef}
      className="border-border/50 bg-card mt-10 max-h-[min(60vh,36rem)] w-full max-w-none overflow-y-auto overscroll-y-contain rounded-2xl border p-6 shadow-sm [scrollbar-gutter:stable] sm:p-8"
    >
      <article className="article-container" ref={containerRef} />
      {loading && (
        <div className="space-y-3 pt-4">
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      )}
    </div>
  );
}
