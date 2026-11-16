# Jonas JLC

Personal site for `jonasjlc`, built with Astro 7 and deployed to GitHub Pages from `main`.

**Live site:** https://jonasjlc.github.io

## What the site contains

| Route | What it is | Listed on the homepage |
|---|---|---|
| `/` | Portfolio and project index | – |
| `/gave/` | Gift reveal behind a nickname gate | No |
| `/ferie/` | Ferieplan, a holiday planner (React) | No, and `noindex` |
| `/ferie/privatliv/` | Ferieplan privacy policy | No, and `noindex` |
| `/strandparken/` | Strandparken, a household app (React) | No, and `noindex` |
| `/jeopardy/` | AI Jeopardy, built in a sibling project | Via `site.ts` |

`/gave/`, `/ferie/` and `/strandparken/` are left out of the sitemap (`astro.config.mjs`). Only `/ferie/` and `/strandparken/` use React, Tailwind and shadcn/ui; every other page is plain Astro with no client framework.

## Local development

**Requirements:** Node 22.23.4+ and pnpm 10.33.2 (pinned in `package.json` under `packageManager`). The edge function tests also need Deno 2.

```bash
pnpm install --frozen-lockfile
pnpm dev                       # http://localhost:4321
```

Other commands:

```bash
pnpm check                     # Astro and TypeScript type check
pnpm build                     # Type check, then build to dist/
pnpm preview                   # Serve dist/ locally
node --test tests/*.test.*     # Unit tests for /gave/ and /strandparken/
deno test --node-modules-dir=none --no-lock --allow-env supabase/functions   # Edge function tests, no network
```

The package scripts set `ASTRO_TELEMETRY_DISABLED=1` with POSIX syntax. In native PowerShell, set `$env:ASTRO_TELEMETRY_DISABLED = '1'` and run `pnpm exec astro check`, `pnpm exec astro build` and `pnpm exec astro preview` instead.

To work on `/ferie/` or `/strandparken/` without Supabase, build with `PUBLIC_SUPABASE_URL=` (empty). The apps then skip sign-in and sync and keep data in the browser only.

## Homepage

Edit `src/content/site.ts` to change the intro, about text, focus items, method principles, links and project cards. The components in `src/components/` render from that file, so a new project is one new object in the `projects` array. The page is `src/pages/index.astro`; shared styles are in `src/styles/global.css`, and fonts are self-hosted Latin Modern subsets in `src/assets/fonts/`.

## Gift reveal (`/gave/`)

| What | Where |
|---|---|
| Nickname gate, riddle, hints, images, booking details | `src/content/gift.ts` |
| Page | `src/pages/gave/index.astro` |
| Browser behaviour | `src/scripts/gave.ts`, with testable logic in `src/scripts/gave-logic.mjs` |
| Styles | `src/styles/gave.css` |
| Images | `public/gave/assets/` (sources listed in `SOURCES.md`) |

The gate is a game, not security: the answers and all content ship in the static page. Progress is saved in local storage under `gave-reveal-v2`; if storage is unavailable, it is kept in memory for the visit. “Start forfra” returns to the gate. Images must be local and optimized, and the invitation stays readable if they fail to load.

## Ferieplan (`/ferie/`)

A holiday planner for one household. Code is in `src/components/ferie/`, styles in `src/styles/ferie.css`, and icons and avatars in `public/ferie/`. It has four tabs:

- **Feriedage**: holiday balances, calendar and trips.
- **Rejsekassen**: travel fund, a savings recommendation and budgets.
- **Rejseplan**: day-by-day itinerary, bookings, packing list and destination tips.
- **Forslag**: an AI chat where a household member describes a feature wish; the result is saved as a structured request and mirrored to a GitHub issue.

The app asks for Google sign-in and shows content only to invited accounts. The household shares one JSON document (`ferie_state`), protected by row-level security. Sync code is in `lib/remote.ts`, `lib/use-sync.ts` and `AuthGate.tsx`; local data sits behind the `FerieStore` interface in `lib/store.ts` under the key `ferie-v1`. On first sign-in, data already on the device is uploaded. If a shared copy already exists, the shared copy is kept and the local one is saved under `ferie-v1-backup`.

**Adding shadcn components:** run `pnpm dlx shadcn@latest add <name>`. The CLI adds a stray `cn` npm package and rewrites imports to `import { cn } from "cn"`. Change those imports to `@/components/ferie/lib/utils` and run `pnpm remove cn`.

## Strandparken (`/strandparken/`)

A household app with five views, kept in the URL hash so a refresh or shared link opens the same screen: `#hjem`, `#madplan` (meal plan), `#indkob` (shopping list), `#sundhed` (not built yet) and `#opskrifter` (recipes). Recipes can be imported from pasted text, a screenshot or a link, and the meal plan can ask for an AI dinner suggestion.

| What | Where |
|---|---|
| Page | `src/pages/strandparken/index.astro` |
| UI primitives | `src/components/strandparken/ui/` |
| App shell, sign-in gate, bottom bar | `src/components/strandparken/shell/` |
| Views | `home/`, `madplan/`, `shopping/`, `recipes/`, `settings/` in the same folder |
| Logic without UI (tested in `tests/`) | `src/components/strandparken/lib/` |
| Styles and all design tokens | `src/styles/strandparken.css` |
| Icons and web manifest | `public/strandparken/` |

**Design tokens.** Colours, radii, shadows, spacing, type roles and motion are defined only in `strandparken.css`. Components use token classes. `tests/strandparken-token-guard.test.mjs` fails if a component contains a raw colour, radius, shadow or font value, and `tests/strandparken-contrast.test.mjs` checks colour contrast.

**UI gallery.** With `pnpm dev` running, open `/strandparken/galleri`. The route is added only for `astro dev` (`src/dev/strandparken/`), so it never reaches `dist/`.

**Design documents.** The UI source of truth is `docs/superpowers/specs/2026-11-12-strandparken-ui-design.md`; the product design is `2026-11-11-strandparken-design.md` in the same folder. Decisions are in `docs/adr/`, and known gaps and untested paths are in `docs/strandparken-backlog.md`.

## Supabase backend

`/ferie/` and `/strandparken/` use one Supabase project and one Google sign-in. The shared client is in `src/lib/supabase/`. `config.ts` holds the public project URL, the publishable key and the Google OAuth client ID; all three are meant to ship in the browser. Row-level security in the database protects the data, not the key. Never commit a `service_role` or secret key.

| What | Where |
|---|---|
| Schema changes | `supabase/migrations/` |
| SQL tests (run in a transaction that is rolled back) | `supabase/tests/` |
| Auth and function settings | `supabase/config.toml` |
| Edge functions | `supabase/functions/` |

### Edge functions

| Function | Used by | What it does |
|---|---|---|
| `feature-chat` | Ferieplan | Turns a feature wish into a structured request, asking one follow-up question if needed. Saves nothing. |
| `create-issue` | Ferieplan | Posts a saved request to a GitHub issue. Only the structured request is published, never the chat, emails or surnames. |
| `destination-tips` | Ferieplan | Reads the Danish foreign ministry's travel advice (um.dk) for a destination and summarises entry, health and local rules. Saves nothing. |
| `sp-status` | Strandparken | Returns who the caller is and how much of the AI budget is left. Makes no model call; used as the deploy smoke test. |
| `recipe-import` | Strandparken | Turns pasted text, a screenshot or a link into a recipe. For links it reads schema.org recipe data first and falls back to the page text. |
| `meal-suggest` | Strandparken | Picks a dinner for an empty day from candidate recipes sent by the app. |

Every function has `verify_jwt = false` because it checks the caller's token and household membership itself. The Strandparken functions do this in `_shared/guard.ts` and call the model only through `_shared/anthropic.ts`, which enforces these limits (ADR-07):

- 60 AI calls per person per day, then `429 rate_limited`.
- 50 kr. per household per month, then `402 budget_exceeded`.
- The cost is an estimate from the price table in `_shared/usage.ts`, not the invoice.

Function secrets, set with `supabase secrets set NAME=value` and never committed:

| Secret | Needed by | Default |
|---|---|---|
| `ANTHROPIC_API_KEY` | All AI functions | – |
| `GITHUB_ISSUES_TOKEN` | `create-issue` (fine-grained token, this repo only, Issues read/write) | – |
| `SP_AI_MODEL` | Strandparken text calls | `claude-haiku-5-5` |
| `SP_AI_MODEL_VISION` | `recipe-import` screenshots | `claude-sonnet-5-5` |
| `AI_DAILY_CALLS_PER_PERSON` | Strandparken | `60` |
| `AI_MONTHLY_CAP_DKK` | Strandparken | `50` |
| `AI_USD_DKK` | Strandparken cost estimate | `7` |

Deploy a function with `supabase functions deploy <name> --project-ref kmytekaexgfqhwxapwbw`.

### One-time setup

Step 1 must be done in a browser; the rest uses the Supabase CLI.

1. **Google Cloud Console.** Create a project. In Google Auth Platform, set up the consent screen (External, publishing status *Testing*, both Gmail addresses added as test users), add the scopes `openid`, `userinfo.email` and `userinfo.profile`, and create an OAuth client of type *Web application* with JavaScript origins `https://jonasjlc.github.io` and `http://localhost:4321` and redirect URI `https://kmytekaexgfqhwxapwbw.supabase.co/auth/v1/callback`.
2. Run `cp .env.example .env` and fill in the client ID and secret. `.env` is git-ignored; do not paste the secret into a chat or commit it.
3. Run `supabase login`. Preview the auth settings (site URL, redirect URLs, Google provider, email sign-up off) with `supabase config diff --project-ref kmytekaexgfqhwxapwbw`, then apply them with `supabase config push --project-ref kmytekaexgfqhwxapwbw`.
4. Apply each migration with `supabase db query --linked -f supabase/migrations/<file>.sql`. This uses the Management API, so no database password is needed. Check the result with the matching file in `supabase/tests/`; each returns `failures = 0` when the policies hold.
5. Invite each Google account: `supabase db query --linked "select private.invite('f8ea36f6-2ce9-4b26-994a-0858c948c9f1', 'name@gmail.com');"`. An invite is claimed only once Google has verified the email.

Do not use `supabase db push` yet: production received the Strandparken migrations through the dashboard, so its migration history does not match the file names. Run `supabase migration repair` first (see `docs/strandparken-backlog.md`).

## Jeopardy

`public/jeopardy/` holds the built AI Jeopardy app, served at https://jonasjlc.github.io/jeopardy/. Do not edit it here; the files are generated by the sibling project.

1. Change the source in `../jeopardy/src/`.
2. Run the deploy script from that project:
   ```powershell
   cd ..\jeopardy
   .\deploy.ps1
   ```
3. Check that the built files landed in `public/jeopardy/`.
4. Commit them in this repo.

## Garmin dashboard

`garmin-dashboard/` is a built app with its data, committed by the deploy job of the `JonasJLC/garmin-dashboard` repository. Do not edit it here. It sits outside `src/` and `public/`, so the Astro build does not include it and GitHub Pages does not serve it.

## CI and deployment

| Workflow | Runs on | What it does |
|---|---|---|
| `pages.yml` | Push to `main`, pull requests | Installs with the frozen lockfile, runs the Node tests and the Deno edge function tests, builds, and checks that `dist/gave/`, `dist/ferie/` and `dist/strandparken/` each have a non-empty `index.html`. On `main` it then deploys `dist/` to GitHub Pages. |
| `security.yml` | Push to `main`, pull requests, Mondays 06:00 UTC, manual | Runs `pnpm audit` against the lockfile. |
| `dependabot-automerge.yml` | Dependabot pull requests | Turns on auto-merge for patch and minor updates once checks pass. Major updates need a manual merge. |
| `claude-code-review.yml` | Pull requests not opened by Dependabot | Claude reviews the pull request. |
| `claude.yml` | Owner comments containing `@claude` | Runs Claude Code on the issue or pull request. |

Edge functions and database migrations are not deployed by CI; apply them with the Supabase CLI as described above.

## Repository structure

```
jonasjlc.github.io/
├── src/
│   ├── assets/fonts/          Self-hosted Latin Modern subsets and licence
│   ├── components/            Homepage sections (Hero, About, Focus, ProjectList, Notes, Contact)
│   │   ├── ferie/             Ferieplan React app
│   │   └── strandparken/      Strandparken React app
│   ├── content/               site.ts (homepage) and gift.ts (/gave/)
│   ├── dev/strandparken/      Development-only UI gallery
│   ├── layouts/BaseLayout.astro
│   ├── lib/supabase/          Shared Supabase client, config and Google sign-in
│   ├── pages/                 index, gave/, ferie/ (with privatliv), strandparken/
│   ├── scripts/               /gave/ browser code
│   └── styles/                global.css, gave.css, ferie.css, strandparken.css
├── public/                    Static files: icons, og.png, robots.txt, ferie/, strandparken/, gave/assets/, jeopardy/
├── supabase/                  config.toml, migrations/, tests/, functions/
├── tests/                     Node unit tests
├── docs/                      Design specs, plans, ADRs, Strandparken backlog
├── garmin-dashboard/          Built Garmin dashboard (not deployed by this repo's build)
├── .github/workflows/         CI, deploy, security audit, Dependabot, Claude
├── astro.config.mjs           Site URL, React, sitemap filter, dev-only gallery route
├── CLAUDE.md, AGENTS.md       Instructions for coding agents
└── package.json, pnpm-lock.yaml
```
