# Jonas JLC

Personal portfolio and project index for `jonasjlc`, built with Astro and deployed to GitHub Pages.

**Live site:** https://jonasjlc.github.io

## Updating the site

Most updates happen in one file:

```text
src/content/site.ts
```

Edit that file to change intro copy, links, highlights, or project cards. The page components render from that data, so adding a new project means adding one object to the `projects` array.

The gift reveal is available at [`/gave/`](https://jonasjlc.github.io/gave/). Its nickname gate, destination riddle, hints, local images, and booking details live in `src/content/gift.ts`. The gate is a playful browser interaction, not secure authentication; its answers and content are included in the static site.

Images belong in `public/gave/assets/` and should be optimized before being added. Set local paths in `gift.images`; the invitation remains readable if images fail to load. Progress is saved under `gave-reveal-v2`, with an in-memory fallback when storage is unavailable. “Start forfra” returns to the nickname gate.

The holiday planner is available at `/ferie/` (unlisted, noindex). It is a React + Tailwind + shadcn/ui island under `src/components/ferie/` with three tabs: **Feriedage** (balances, calendar, trips), **Rejsekassen** (travel fund, recommendation, budgets) and **Rejseplan** (day-by-day itinerary, bookings, packing list). Data is stored in the browser (`ferie-v1`) behind the `FerieStore` interface in `lib/store.ts`, so a Supabase store can replace it later. **Shared storage (Supabase).** `/ferie/` asks for a Google sign-in and only shows the app to invited accounts. Signed-in users share one JSON document per household (`ferie_state`), protected by row-level security; the sign-in screen is a convenience, the database rules are the security boundary. Setup lives in `supabase/migrations/`; the client is `lib/remote.ts`, `lib/use-sync.ts` and `AuthGate.tsx`. Build with `PUBLIC_SUPABASE_URL= PUBLIC_SUPABASE_KEY=` (empty) to run without sync and without the gate for local UI testing.

One-time setup (everything except step 1 is scripted):
1. **Google Cloud Console** (browser, no CLI exists for this client type). Create a project, then in Google Auth Platform: set up the consent screen (External, keep publishing status *Testing* and add both Gmail addresses as test users), add the scopes `openid`, `userinfo.email` and `userinfo.profile`, and create an OAuth client of type *Web application* with authorized JavaScript origins `https://jonasjlc.github.io` and `http://localhost:4321` and authorized redirect URI `https://kmytekaexgfqhwxapwbw.supabase.co/auth/v1/callback`.
2. `cp .env.example .env` and fill in the client ID and secret (`.env` is git-ignored; never paste the secret into chat or commit it).
3. `supabase login`, then preview and push the auth settings (Site URL, redirect URLs, Google provider, email signup off): `supabase config diff --project-ref kmytekaexgfqhwxapwbw` and `supabase config push --project-ref kmytekaexgfqhwxapwbw`.
4. Apply database changes with `supabase db query --linked -f supabase/migrations/<file>.sql` (Management API, no database password needed) and check them with the files in `supabase/tests/`.
5. Invite each Google email: `supabase db query --linked "select private.invite('f8ea36f6-2ce9-4b26-994a-0858c948c9f1', 'name@gmail.com');"`.

On first sign-in the data already on the device is imported; if the shared copy already exists it wins and the local copy is kept under `ferie-v1-backup`.

Add shadcn components with `pnpm dlx shadcn@latest add <name>`; the CLI currently adds a stray `cn` npm package and rewrites `import { cn } from "cn"`, so fix those imports to `@/components/ferie/lib/utils` and run `pnpm remove cn` afterwards.

## Local development

**Requirements:** Node 22.23.4+, pnpm 10.33.2 (pinned via `packageManager` in `package.json`)

```bash
pnpm install
pnpm dev
```

Useful commands:

```bash
pnpm check       # TypeScript + Astro type check only
pnpm build       # Type check + build to dist/
pnpm preview     # Serve the built dist/ locally
```

## Repository structure

```
jonasjlc.github.io/
├── src/
│   ├── components/          - Page sections (Hero, ProjectList, Notes, Contact)
│   ├── content/site.ts      - Main update surface
│   ├── content/gift.ts      - Gift reveal content and booking details
│   ├── layouts/BaseLayout.astro
│   ├── pages/index.astro
│   ├── pages/gave/index.astro - Private gift reveal route
│   ├── scripts/gave.ts      - Gift reveal browser interactions
│   └── styles/global.css
├── public/
│   ├── assets/avatar.svg    - Static assets
│   ├── gave/assets/         - Optional gift reveal images
│   └── jeopardy/            - Built AI Jeopardy app (do not edit directly)
├── astro.config.mjs         - Sets canonical site URL for GitHub Pages
├── package.json
├── pnpm-lock.yaml
└── README.md
```

## Jeopardy subproject

The `public/jeopardy/` folder contains the built AI Jeopardy app, served at:

```text
https://jonasjlc.github.io/jeopardy/
```

Do not edit files in `public/jeopardy/` directly — they are generated from the source project.

| What | Where |
|------|-------|
| Portfolio content | `src/content/site.ts` |
| Portfolio layout/design | `src/components/`, `src/pages/`, `src/styles/` |
| Gift reveal content | `src/content/gift.ts` |
| Gift reveal preview | `http://localhost:4321/gave/` |
| Jeopardy app source | `../jeopardy/` |
| Built Jeopardy files in this repo | `public/jeopardy/` |

### How to update the Jeopardy app

1. Make changes in the source project: `../jeopardy/src/`
2. Run the deploy script from the jeopardy project:
   ```powershell
   cd ..\jeopardy
   .\deploy.ps1
   ```
3. Confirm built files land in `public/jeopardy/`
4. Commit the updated files in this repo

## Deployment

GitHub Actions builds the Astro site on every push to `main` and deploys the `dist/` directory to GitHub Pages. Pull requests run the build only (no deploy) to catch type errors and build failures early.
