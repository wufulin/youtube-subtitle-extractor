'use client';

import { useRef, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface StreamRendererProps {
  html: string;
  loading: boolean;
  error: string | null;
}

const NEAR_BOTTOM_PX = 80;
const SCROLL_THROTTLE_MS = 220;

export function StreamRenderer({ html, loading, error }: StreamRendererProps) {
  const containerRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sanitizeGenRef = useRef(0);
  const lastScrollAtRef = useRef(0);
  const throttleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const gen = ++sanitizeGenRef.current;
    const snapshot = html;

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
  }, [html]);

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
  }, [html]);

  if (error) {
    return (
      <div className="border-destructive/50 bg-destructive/10 text-destructive mt-10 w-full rounded-xl border p-6 text-center">
        {error}
      </div>
    );
  }

  if (!html && !loading) return null;

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
