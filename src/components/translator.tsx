'use client';

import { useState, useCallback, useRef } from 'react';
import { TranslateForm } from '@/components/translate-form';
import { StreamRenderer } from '@/components/stream-renderer';

export function Translator() {
  const [html, setHtml] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bufferRef = useRef('');
  const rafRef = useRef(0);

  const handleTranslate = useCallback(async (url: string) => {
    setHtml('');
    setError(null);
    setLoading(true);
    bufferRef.current = '';

    try {
      const resp = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      });

      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.error || 'Translation failed');
      }

      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        bufferRef.current += decoder.decode(value, { stream: true });

        if (!rafRef.current) {
          rafRef.current = requestAnimationFrame(() => {
            const chunk = bufferRef.current;
            bufferRef.current = '';
            rafRef.current = 0;
            setHtml((prev) => prev + chunk);
          });
        }
      }

      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
      if (bufferRef.current) {
        const remaining = bufferRef.current;
        bufferRef.current = '';
        setHtml((prev) => prev + remaining);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <>
      <TranslateForm onSubmit={handleTranslate} loading={loading} />
      <StreamRenderer html={html} loading={loading} error={error} />
    </>
  );
}
