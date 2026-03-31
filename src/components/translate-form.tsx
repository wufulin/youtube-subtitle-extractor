'use client';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface TranslateFormProps {
  url: string;
  onUrlChange: (url: string) => void;
  onSubmit: (url: string) => void;
  loading: boolean;
  disabled?: boolean;
}

export function TranslateForm({
  url,
  onUrlChange,
  onSubmit,
  loading,
  disabled,
}: TranslateFormProps) {
  const handleSubmit = () => {
    const trimmed = url.trim();
    if (trimmed) onSubmit(trimmed);
  };

  return (
    <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-3">
      <Input
        className="input-modern h-12 rounded-xl border-border/60 bg-background/80 text-base shadow-sm backdrop-blur sm:min-h-12 sm:flex-1"
        placeholder="在此粘贴 YouTube 视频链接…"
        value={url}
        onChange={(e) => onUrlChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
        disabled={loading || disabled}
      />
      <Button
        type="button"
        className="btn-gradient h-12 shrink-0 rounded-xl px-6 text-base font-semibold shadow-md disabled:opacity-50 sm:px-8"
        onClick={handleSubmit}
        disabled={loading || disabled || !url.trim()}
      >
        {loading ? '翻译中…' : '生成译文'}
      </Button>
    </div>
  );
}
