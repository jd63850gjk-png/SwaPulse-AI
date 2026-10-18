# SwaPulse AI

SwaPulse AI is an AI-powered operations control room for PHCs and CHCs. It turns register photos, voice/text updates, and natural-language commands into evidence-backed operational updates, alerts, and resource-transfer recommendations.

The first screen is a safe guest demo dashboard for the hackathon. It will later connect to Supabase and Gemini without exposing private keys in the browser.

## Stack

- Next.js 15 with TypeScript
- Supabase for Postgres, authentication, storage, and row-level security
- Gemini API for multimodal extraction and controlled actions
- Vercel for the judge-facing deployment

## Requirements

- Node.js 22.19.0 (see `.nvmrc`)
- npm 10+

## Local setup

```bash
npm ci
copy .env.example .env.local
npm run dev
```

On macOS/Linux, use `cp .env.example .env.local` instead of `copy`.

Open http://localhost:3000.

For a production-style local check, run `npm run build` first and then `npm run server` (use `npm run server -- -p 3001` if the dev server is already using port 3000).

Role Lottie files belong in `public/animations/roles/` as `admin.json`, `health-centre-manager.json`, and `health-worker.json`.

## Environment variables

Set these in `.env.local` locally and in the Vercel project settings. Never commit `.env.local`.

| Variable | Where to get it | Exposure |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project **Connect/API** settings | Browser-safe |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase project **Connect/API** settings; use the anon/publishable key | Browser-safe with RLS |
| `GEMINI_API_KEY` | Google AI Studio API key page | Server-only |
| `NEXT_PUBLIC_APP_MODE` | Set to `demo` for the seeded guest experience | Browser-safe |

Do **not** use or expose the Supabase `service_role` key in the frontend. The Gemini key must not start with `NEXT_PUBLIC_`.

## Checks

```bash
npm test
npm run typecheck
npm run build
```

`npm test` is the offline smoke test and does not need Supabase or Gemini. Typechecking and building use the installed local dependencies but do not need live service credentials for this initial screen.

## Vercel deployment

1. Push this repository to GitHub.
2. In Vercel, select **Add New → Project** and import the repository.
3. Keep the detected framework as **Next.js** and the root directory as the project folder.
4. Add the variables above under **Settings → Environment Variables** for Preview and Production.
5. Deploy and open the generated `vercel.app` URL.

The Gemini key should only be used by a server route or server action in a later step. Use Supabase Row Level Security before connecting any real database data.

## Product flow

The intended demo journey is: upload evidence or issue a command → Gemini extracts and reasons → the app previews or validates the action → Supabase updates the shared centre record → every role sees the change in its dashboard and action log.
