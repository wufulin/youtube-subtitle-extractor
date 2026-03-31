'use client';

import { useSyncExternalStore } from 'react';
import { LogOut, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getDisplayName } from '@/lib/storage';
import { cn } from '@/lib/utils';

function scrollToId(id: string) {
  const el = document.getElementById(id);
  el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function SiteHeader() {
  const name = useSyncExternalStore(
    () => () => {},
    getDisplayName,
    () => '访客',
  );

  return (
    <header className="border-border/60 bg-background/80 sticky top-0 z-50 border-b backdrop-blur-md">
      <div className="container-yt flex h-14 items-center justify-between gap-4 sm:h-16">
        <button
          type="button"
          onClick={() => scrollToId('top')}
          className="flex min-w-0 items-center gap-2 text-left"
        >
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-white shadow-sm sm:size-10"
            style={{ background: 'var(--gradient-primary)' }}
          >
            <Play className="size-4 fill-current sm:size-5" aria-hidden />
          </span>
          <span className="text-foreground truncate text-base font-semibold tracking-tight sm:text-lg">
            字幕翻译
          </span>
        </button>

        <nav className="hidden items-center gap-1 sm:flex" aria-label="主导航">
          <button
            type="button"
            onClick={() => scrollToId('translator')}
            className="text-muted-foreground hover:text-foreground rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          >
            翻译工具
          </button>
          <button
            type="button"
            onClick={() => scrollToId('history')}
            className="text-muted-foreground hover:text-foreground rounded-lg px-3 py-2 text-sm font-medium transition-colors"
          >
            历史记录
          </button>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className="bg-muted text-muted-foreground hidden size-8 shrink-0 items-center justify-center rounded-full text-xs font-medium sm:flex sm:size-9"
            aria-hidden
          >
            {name.slice(0, 1).toUpperCase()}
          </div>
          <span
            className="text-foreground hidden max-w-[8rem] truncate text-sm sm:inline"
            suppressHydrationWarning
          >
            {name}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="text-muted-foreground h-8 gap-1 px-2 text-xs sm:h-9 sm:gap-1.5 sm:px-3 sm:text-sm"
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') window.location.reload();
            }}
          >
            <LogOut className="size-3.5 sm:size-4" />
            <span className="hidden sm:inline">退出</span>
          </Button>
        </div>
      </div>

      <nav
        className={cn(
          'border-border/40 flex items-center justify-center gap-2 border-t py-2 sm:hidden',
        )}
        aria-label="主导航"
      >
        <button
          type="button"
          onClick={() => scrollToId('translator')}
          className="text-muted-foreground hover:text-foreground rounded-lg px-4 py-1.5 text-sm font-medium"
        >
          翻译工具
        </button>
        <button
          type="button"
          onClick={() => scrollToId('history')}
          className="text-muted-foreground hover:text-foreground rounded-lg px-4 py-1.5 text-sm font-medium"
        >
          历史记录
        </button>
      </nav>
    </header>
  );
}
