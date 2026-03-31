'use client';

import { SiteHeader } from '@/components/site-header';
import { LandingSection } from '@/components/landing-section';
import { Translator } from '@/components/translator';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { useHomeTab, type HomeTab } from '@/components/home-tab-context';

export function HomeMain() {
  const { activeTab, setActiveTab } = useHomeTab();

  return (
    <Tabs
      className="flex min-h-0 flex-1 flex-col gap-0"
      value={activeTab}
      onValueChange={(v) => setActiveTab(v as HomeTab)}
    >
      <SiteHeader />
      <main className="container-yt mx-auto flex min-w-0 flex-1 flex-col pb-16 sm:pb-20">
        <TabsContent value="landing" className="mt-6 min-w-0 flex-1 sm:mt-8">
          <LandingSection />
        </TabsContent>

        <TabsContent value="translator" className="mt-6 min-w-0 flex-1 sm:mt-8" keepMounted>
          <Translator />
        </TabsContent>
      </main>
    </Tabs>
  );
}
