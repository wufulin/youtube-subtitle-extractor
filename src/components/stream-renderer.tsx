'use client';

import { useRef, useEffect } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

interface StreamRendererProps {
  html: string;
  loading: boolean;
  error: string | null;
}

export function StreamRenderer({ html, loading, error }: StreamRendererProps) {
  const containerRef = useRef<HTMLElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const sanitizeGenRef = useRef(0);

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
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [html]);

  if (error) {
    return (
      <div className="border-destructive/50 bg-destructive/10 text-destructive mx-auto mt-10 max-w-2xl rounded-xl border p-6 text-center">
        {error}
      </div>
    );
  }

  if (!html && !loading) return null;

  return (
    <div className="border-border/50 bg-card mx-auto mt-10 max-w-2xl rounded-2xl border p-8 shadow-sm">
      <article className="article-container" ref={containerRef} />
      {loading && (
        <div className="space-y-3 pt-4">
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
