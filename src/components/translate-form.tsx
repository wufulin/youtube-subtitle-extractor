'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface TranslateFormProps {
  onSubmit: (url: string) => void;
  loading: boolean;
}

export function TranslateForm({ onSubmit, loading }: TranslateFormProps) {
  const [url, setUrl] = useState('');

  const handleSubmit = () => {
    const trimmed = url.trim();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <div className="mx-auto flex max-w-2xl gap-3">
      <Input
        className="border-border/50 bg-muted/50 h-12 rounded-full px-5 text-base shadow-sm backdrop-blur focus-visible:ring-purple-500/30"
        placeholder="Paste YouTube video URL here..."
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        disabled={loading}
      />
      <Button
        className="h-12 shrink-0 rounded-full bg-gradient-to-r from-purple-600 to-blue-500 px-8 text-base font-semibold text-white shadow-md transition-all hover:shadow-lg hover:shadow-purple-500/25 disabled:opacity-50"
        onClick={handleSubmit}
        disabled={loading || !url.trim()}
      >
        {loading ? 'Translating...' : 'Generate Article'}
      </Button>
    </div>
  );
}
