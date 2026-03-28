# YouTube Subtitle Translator

Next.js app that reads **English YouTube captions** (via [`youtubei.js`](https://github.com/LuanRT/YouTube.js)), builds a prompt, and **streams** a Chinese HTML article from **Gemini** (`gemini-2.5-flash`). The UI lives under **`src/app/`** (App Router).

## Requirements

- Node.js 20+ (recommended)
- A **Google Gemini API key** ([Google AI Studio](https://aistudio.google.com/apikey))

## Environment

Copy the example file and add your key:

```bash
cp .env.example .env.local
```

| Variable           | Required | Purpose                                      |
| ------------------ | -------- | -------------------------------------------- |
| `GEMINI_API_KEY`   | Yes      | Used by `src/app/api/translate/route.ts`     |
| `HTTPS_PROXY` / `HTTP_PROXY` | No | Node dev only; see `src/instrumentation.ts` |

For **Cloudflare Workers**, set the same secret for production (do not commit keys):

```bash
npx wrangler secret put GEMINI_API_KEY
```

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Scripts

| Script            | Description                                                |
| ----------------- | ---------------------------------------------------------- |
| `npm run dev`     | Next.js dev server                                         |
| `npm run build`   | Production build (`next build --webpack`)                  |
| `npm run build:cloudflare` | OpenNext output for Workers (`.open-next/`); use for CF CI |
| `npm run start`   | Run the Node production server after `build`               |
| `npm run lint`    | ESLint on `src/`                                           |
| `npm run format`  | Prettier write                                             |
| `npm run preview` | OpenNext build + Cloudflare preview                        |
| `npm run deploy`  | OpenNext build + `wrangler deploy`                         |
| `npm run upload`  | OpenNext build + `wrangler upload`                         |

## Deploy (Cloudflare Workers)

Production is intended to run on **Cloudflare Workers** using [**OpenNext**](https://opennext.js.org/cloudflare) and [`wrangler.jsonc`](wrangler.jsonc):

1. Set `GEMINI_API_KEY` as a Wrangler secret (see above).
2. Run `npm run deploy` (or `upload` / `preview` as needed).

**Cloudflare Workers Builds / Git CI:** set the **build command** to `npm run build:cloudflare` (or `npx opennextjs-cloudflare build`). Do **not** use `npm run build` alone — that only runs `next build` and does not create `.open-next/`, so `npx wrangler deploy` will fail with “Could not find compiled Open Next config”. Keep the **deploy command** as `npx wrangler deploy` (or run `opennextjs-cloudflare deploy` via Wrangler as today).

You can still host with **`npm run build`** + **`npm run start`** on any Node platform if you prefer.

## Project layout

- `src/app/page.tsx` — Home (hero + translator)
- `src/app/api/translate/route.ts` — POST `{ "url": "<youtube-url>" }` → subtitle fetch → Gemini stream
- `src/lib/youtube.ts` — Video ID + captions (`youtubei.js` `/cf-worker` entry)
- `src/lib/prompt.ts`, `src/lib/gemini.ts` — Prompt + streaming Gemini client

## Git commits

- Prefer **[Conventional Commits](https://www.conventionalcommits.org/)** (`feat:`, `fix:`, `docs:`, `chore:`, …) so history stays scannable.
- Do **not** append tool banners such as `Made-with: Cursor` (or similar) to commit messages.

## Learn more

- [Next.js docs](https://nextjs.org/docs) — this repo targets **Next.js 16**; check `node_modules/next/dist/docs/` for version-specific APIs when in doubt.
