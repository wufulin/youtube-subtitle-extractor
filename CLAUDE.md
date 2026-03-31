@AGENTS.md

## youtube-subtitle-extractor

### Commands

- `npm run dev` — Next.js dev server (default port 3000).
- `npm run build` / `npm run start` — standard Node production server (`next build --webpack`).
- `npm run preview` — OpenNext build + Cloudflare preview.
- `npm run deploy` / `npm run upload` — OpenNext build + Wrangler deploy/upload.
- `npm run lint`, `npm run format` / `npm run format:check`

### Source layout

- App Router: `src/app/` (`page.tsx`, `layout.tsx`, `api/translate/route.ts`).
- YouTube + AI: `src/lib/youtube.ts` (captions via `youtubei.js` `/cf-worker`), `prompt.ts`, `gemini.ts`.
- UI: `src/components/` (`translator.tsx`, `stream-renderer.tsx`, shadcn-style `ui/`).
- Optional Node proxy: `src/instrumentation.ts` (`HTTP(S)_PROXY` + Undici).

### Environment

- `GEMINI_API_KEY` in `.env.local` for local runs (used by `src/lib/gemini.ts` and `src/app/api/translate/route.ts`).
- Production on Cloudflare: set matching secrets for Wrangler as required.

### Git commits

- Use **semantic / [Conventional Commits](https://www.conventionalcommits.org/)** messages: `feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, etc., with a short imperative subject (and optional body when useful).
- **Do not** add editor or tool footers to commits (e.g. `Made-with: Cursor`, gratuitous `Co-authored-by` lines from assistants). Keep `git log` readable and professional.

### Documentation (README)

- **`README.md`** holds **technical architecture**, **Mermaid flow diagrams**, HTTP API behavior, deploy/D1, and stack details.
- After **major code changes** (e.g. new or renamed API routes, different translate/cache/D1 persistence, deploy or OpenNext/Wrangler shape, default Gemini model or streaming contract, meaningful stack upgrades), **sync `README.md` in the same change** or in an immediate follow-up commit (prefer `docs:` when the diff is doc-only). Update diagrams and tables when the pictured flow or layers change.

### Gotchas

- Primary deploy path is **Cloudflare Workers** (`open-next.config.ts`, `wrangler.toml`, `preview` / `deploy` scripts). See `README.md` for env and scripts.
- Captions use unofficial InnerTube (`youtubei.js`); upstream YouTube changes can break fetching.
- Streamed article HTML is written with `innerHTML` in `stream-renderer.tsx`; sanitize or change rendering if untrusted output matters.
