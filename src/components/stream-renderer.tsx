'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { ArrowUpToLine } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';

interface StreamRendererProps {
  html: string;
  loading: boolean;
  error: string | null;
  scrollTranslationToTopRef?: React.RefObject<boolean | null>;
}

function scrollContainerToBottom(root: HTMLDivElement | null, onAfter?: () => void) {
  if (!root) {
    onAfter?.();
    return;
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      root.scrollTop = root.scrollHeight;
      onAfter?.();
    });
  });
}

export function StreamRenderer({ html, loading, error, scrollTranslationToTopRef }: StreamRendererProps) {
  const containerRef = useRef<HTMLElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sanitizeGenRef = useRef(0);
  const [canScrollTop, setCanScrollTop] = useState(false);

  const updateScrollTopState = useCallback(() => {
    const r = scrollRef.current;
    if (!r) return;
    setCanScrollTop(r.scrollTop > 8);
  }, []);

  const handleScrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

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
          ADD_TAGS: ['details', 'summary'],
          ADD_ATTR: ['open'],
        });
        el.querySelectorAll('.article-summary').forEach((node) => node.remove());
        if (scrollTranslationToTopRef?.current) {
          scrollTranslationToTopRef.current = false;
          requestAnimationFrame(() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = 0;
              updateScrollTopState();
            }
          });
        } else {
          scrollContainerToBottom(scrollRef.current, updateScrollTopState);
        }
      })
      .catch(() => {
        if (gen !== sanitizeGenRef.current) return;
        el.textContent = snapshot;
        if (scrollTranslationToTopRef?.current) {
          scrollTranslationToTopRef.current = false;
          requestAnimationFrame(() => {
            if (scrollRef.current) {
              scrollRef.current.scrollTop = 0;
              updateScrollTopState();
            }
          });
        } else {
          scrollContainerToBottom(scrollRef.current, updateScrollTopState);
        }
      });
  }, [html, updateScrollTopState, scrollTranslationToTopRef]);

  useEffect(() => {
    if (loading) return;
    if (scrollTranslationToTopRef?.current) return;
    scrollContainerToBottom(scrollRef.current, updateScrollTopState);
  }, [loading, html, updateScrollTopState, scrollTranslationToTopRef]);

  if (error) {
    return (
      <div className="border-destructive/50 bg-destructive/10 text-destructive mt-10 w-full min-w-0 rounded-xl border p-6 text-center">
        {error}
      </div>
    );
  }

  if (!html && !loading) return null;

  return (
    <div className="border-border/50 bg-card mt-2 w-full min-w-0 rounded-xl border px-3 py-2 shadow-sm sm:mt-3 sm:px-4 sm:py-3">
      <div className="relative">
        <div
          ref={scrollRef}
          onScroll={updateScrollTopState}
          className="max-h-[min(85vh,880px)] overflow-y-auto overflow-x-hidden [overflow-anchor:none]"
        >
          <article className="article-container min-h-[4rem] px-1 sm:px-2" ref={containerRef} />
          {loading && (
            <div className="space-y-3 pt-3">
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          )}
        </div>
        {canScrollTop ? (
          <div className="pointer-events-none absolute inset-0 flex items-end justify-end p-3">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              title="回顶部"
              aria-label="回顶部"
              className="pointer-events-auto h-10 w-10 shrink-0 rounded-full border border-border/70 bg-card/90 text-foreground shadow-md backdrop-blur-sm hover:bg-card"
              onClick={handleScrollToTop}
            >
              <ArrowUpToLine className="size-5" />
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
