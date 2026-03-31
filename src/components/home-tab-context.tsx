'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

export type HomeTab = 'landing' | 'translator';

type HomeTabContextValue = {
  activeTab: HomeTab;
  setActiveTab: (tab: HomeTab) => void;
  goToTranslator: (scrollTarget?: 'translator' | 'history') => void;
  goToLanding: () => void;
};

const HomeTabContext = createContext<HomeTabContextValue | null>(null);

function scrollToId(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export function HomeTabProvider({ children }: { children: ReactNode }) {
  const [activeTab, setActiveTab] = useState<HomeTab>('landing');

  const goToTranslator = useCallback((scrollTarget: 'translator' | 'history' = 'translator') => {
    setActiveTab('translator');
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToId(scrollTarget === 'history' ? 'history' : 'translator');
        });
      });
    });
  }, []);

  const goToLanding = useCallback(() => {
    setActiveTab('landing');
    queueMicrotask(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          scrollToId('top');
        });
      });
    });
  }, []);

  const value = useMemo(
    () => ({ activeTab, setActiveTab, goToTranslator, goToLanding }),
    [activeTab, goToTranslator, goToLanding]
  );

  return <HomeTabContext.Provider value={value}>{children}</HomeTabContext.Provider>;
}

export function useHomeTab() {
  const ctx = useContext(HomeTabContext);
  if (!ctx) {
    throw new Error('useHomeTab must be used within HomeTabProvider');
  }
  return ctx;
}
