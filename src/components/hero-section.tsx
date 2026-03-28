import { Badge } from '@/components/ui/badge';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-20 pb-12 text-center">
      <div className="pointer-events-none absolute -top-40 -left-40 h-80 w-80 rounded-full bg-purple-500/20 blur-3xl" />
      <div className="pointer-events-none absolute top-0 -right-40 h-80 w-80 rounded-full bg-blue-500/15 blur-3xl" />

      <h1 className="relative text-4xl font-bold tracking-tight sm:text-5xl">
        YouTube Subtitle
        <span className="bg-gradient-to-r from-purple-600 to-blue-500 bg-clip-text text-transparent">
          {' '}
          Translator
        </span>
      </h1>

      <p className="text-muted-foreground relative mx-auto mt-4 max-w-xl text-lg">
        Paste a YouTube link. Get an elegantly formatted Chinese dialogue article, streamed in
        real-time by Gemini AI.
      </p>

      <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
        <Badge variant="secondary" className="px-3 py-1 text-sm">
          Gemini 2.5 Flash
        </Badge>
        <Badge variant="secondary" className="px-3 py-1 text-sm">
          Streaming Output
        </Badge>
        <Badge variant="secondary" className="px-3 py-1 text-sm">
          Edge Runtime
        </Badge>
      </div>
    </section>
  );
}
