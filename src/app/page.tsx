import { SiteHeader } from '@/components/site-header';
import { LandingSection } from '@/components/landing-section';
import { Translator } from '@/components/translator';

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="container-yt mx-auto flex min-w-0 flex-1 flex-col pb-16 sm:pb-20">
        <LandingSection />
        <Translator />
      </main>
    </>
  );
}
