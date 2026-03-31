'use client';

import { useEffect, useState, useSyncExternalStore } from 'react';
import { LogOut, Play } from 'lucide-react';
import { useHomeTab } from '@/components/home-tab-context';
import { getDisplayName } from '@/lib/storage';
import { cn } from '@/lib/utils';

export function SiteHeader() {
  const { activeTab, goToLanding, goToTranslator } = useHomeTab();
  const [scrolled, setScrolled] = useState(false);
  const name = useSyncExternalStore(
    () => () => {},
    getDisplayName,
    () => '访客'
  );

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={cn('site-header-root', scrolled && 'site-header-scrolled')}>
      <div className={cn('header-container', scrolled && 'header-scrolled')}>
        <button type="button" onClick={() => goToLanding()} className="brand-section">
          <span className="brand-icon">
            <Play className="size-4 fill-current" aria-hidden />
          </span>
          <span className="brand-text">字幕翻译</span>
        </button>

        <div className="header-nav-center">
          <nav className="flex shrink-0 justify-center" aria-label="页面切换">
            <div className="header-segment" role="group">
              <button
                type="button"
                aria-pressed={activeTab === 'landing'}
                aria-current={activeTab === 'landing' ? 'page' : undefined}
                onClick={() => goToLanding()}
                className={cn(
                  'header-segment-btn',
                  activeTab === 'landing'
                    ? 'header-segment-btn--active'
                    : 'header-segment-btn--inactive'
                )}
              >
                首页
              </button>
              <button
                type="button"
                aria-pressed={activeTab === 'translator'}
                aria-current={activeTab === 'translator' ? 'page' : undefined}
                onClick={() => goToTranslator('translator')}
                className={cn(
                  'header-segment-btn header-segment-btn--wide',
                  activeTab === 'translator'
                    ? 'header-segment-btn--active'
                    : 'header-segment-btn--inactive'
                )}
              >
                字幕翻译
              </button>
            </div>
          </nav>
        </div>

        <div className="user-section">
          <div className="user-card">
            <span className="user-avatar" aria-hidden>
              {name.slice(0, 1).toUpperCase()}
            </span>
            <span className="user-name" suppressHydrationWarning>
              {name}
            </span>
          </div>

          <button
            type="button"
            className="logout-btn"
            onClick={() => {
              if (typeof window !== 'undefined') window.location.reload();
            }}
          >
            <LogOut className="size-3.5 sm:size-4" aria-hidden />
            <span className="hidden sm:inline">退出</span>
          </button>
        </div>
      </div>
    </header>
  );
}
