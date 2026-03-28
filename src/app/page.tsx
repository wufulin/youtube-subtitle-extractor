import { HeroSection } from '@/components/hero-section';
import { Translator } from '@/components/translator';

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-4 pb-20">
      <HeroSection />
      <Translator />
    </main>
  );
}
