# Gave Gift Reveal Experience Design

**Status:** Approved design, pending implementation plan

**Goal:** Build a Danish interactive gift reveal at `/gave/` that gradually leads from a confidential travel invitation to a cinematic Great Northern Spa reveal in Kerteminde. Aim for 5–7 minutes at a relaxed pace, without enforcing a minimum duration.

## Experience

The QR card is the intended entry point. The public homepage remains unchanged and does not link to the experience. The unlinked URL and its client-side content are still publicly accessible; this is a surprise presentation, not access control. The site is a single static page under `gave/`, with no additional route requirements. Use a neutral page title such as `En invitation til dig` and neutral page and sharing descriptions that do not disclose the destination.

The scenes progress in this order:

```text
intro → packing → location → namePuzzle → reveal → details
```

The opening shows only a classified reservation, purpose, and duration, followed by `Begynd`. The packing scene presents one item at a time with `PAK` and `LAD BLIVE HJEMME` actions. Either choice is accepted and gives a short warm or understated humorous response, possibly unlocking a clue. Keep feedback visible until she chooses `Næste ting`; do not auto-advance or demand a correct packing choice. Ignore repeated taps after a choice has been recorded.

The location scene reveals easy Danish clues progressively: Denmark, Funen, the sea, a town beginning with K, and finally `Kerte_____`. Add the clues about leaving Jutland and crossing a bridge only when the configured departure makes them accurate. The player enters Kerteminde in a forgiving text field. Normalize capitalization, whitespace, and punctuation, and accept explicitly listed common variations.

The name scene contains two small puzzles with Danish instructions. For `Modsat lille?`, accept `stor`, `big`, and `great`, using the same input normalization. Explain the chosen English word with `Stor kan også være GREAT. Gem det ord.` A simple compass puzzle highlights north and asks `Hvilken retning er markeret?`; accept `nord` and `north`, then explain `Nord hedder NORTH på engelsk.` End this scene with `GREAT + NORTH`. Assemble `GREAT NORTHERN` automatically during the cinematic reveal, never earlier and never as another required guess.

Both location and name puzzles offer a penalty-free progression: `Et lille hint`, a clearer clue, then `Vis mig svaret`. Revealing an answer must also offer `Fortsæt`, marking that puzzle complete. Hints remain available without requiring failed guesses.

The reveal scene changes to a full-viewport cinematic presentation. It shows, with restrained pauses and transitions:

```text
Destination identificeret.
Pak badetøj.
Du og jeg skal af sted.
GREAT NORTHERN
Kerteminde
```

The final `Fortæl mig alt` action opens the practical details scene. Details are configurable and may include date, check-in, check-out, hotel stay, dinner, spa access, treatments, breakfast, address, and a personal message.

## Pacing and editable content

Use approximately ten packing cards, short responses, progressive clue cards, and deliberate `Fortsæt` actions to create a relaxed rhythm. Time a real playthrough before adjusting the copy. Accept a shorter enjoyable experience rather than adding forced waits to reach 5–7 minutes. Keep cinematic pauses brief and provide `Fortsæt` to finish the sequence immediately for users who prefer to move on.

Keep gift details and copy in one exported configuration object in `src/content/gift.ts`, following the existing `src/content/site.ts` convention. Import it from the Astro page for static markup and from the browser script for interactive copy and validation. Unknown fields use empty values and are omitted from the rendered details; never show editing placeholders to the recipient. Dinner, treatments, and breakfast appear as included only when explicitly configured as confirmed inclusions. Do not infer package contents from the destination. Use a neutral greeting when the recipient name is empty. Content edits require rebuilding and deploying the site.

Personalization inputs are the preferred recipient name, departure location or applicable travel clues, and confirmed booking inclusions. These remain editable and do not block implementation. Optional personal messages are omitted when empty.

## Architecture

Use the existing Astro static build, with a central scene state and native browser APIs in a small TypeScript script. No additional framework, hydration library, bundler, backend, database, authentication, or runtime dependency is needed. Render or reveal one scene at a time while keeping the application on the same page.

The current project uses Astro 5, TypeScript, and pnpm 10.33.2. `astro.config.mjs` sets the site URL to `https://jonasjlc.github.io`. `.github/workflows/pages.yml` checks and builds on Node 20 and deploys the generated `dist/` artifact on pushes to `main`. Preserve this pipeline and the existing lockfile.

Create these files:

- `src/pages/gave/index.astro` — static `/gave/` route, Danish document shell, neutral metadata, semantic scene containers, controls, status regions, and a neutral `noscript` explanation.
- `src/styles/gave.css` — page-specific theme, responsive layout, scene transitions, reveal presentation, and reduced-motion behavior.
- `src/scripts/gave.ts` — browser-only state transitions, rendering, input handling, validation, local storage, restart, and reveal timing.
- `src/content/gift.ts` — exported editable gift details, Danish copy, packing items, clues, hints, and accepted answers. Keep this module free of DOM and storage access so both build and browser code can import it safely.
- `public/gave/assets/` — optional locally hosted, pre-optimized images supplied or approved for the experience; these are copied unchanged into the build.

Import `src/styles/gave.css` from the route's Astro frontmatter. Load `src/scripts/gave.ts` through a standard Astro-processed `<script>` import in the page, allowing the existing build to bundle it. Do not use `is:inline`, a global configuration variable, or a client framework island. DOM and local storage access belong only in the browser script, never in frontmatter. The result is static HTML plus browser JavaScript, with no server required at runtime.

Use a standalone document shell in this route because `src/layouts/BaseLayout.astro` hardcodes `lang="en"`, imports `src/styles/global.css`, and sets the sharing URL to the site root. Set `lang="da"`, neutral title and descriptions, and the canonical and sharing URL to `https://jonasjlc.github.io/gave/`. Reuse suitable accessibility and responsive conventions without importing the homepage's global layout or palette. Keep `src/pages/index.astro`, portfolio components, and `src/content/site.ts` unchanged; do not add a portfolio link to the gift page.

Let Astro manage imported script and stylesheet URLs; do not hardcode generated bundle names. Optional public images can use `./assets/<filename>` from `/gave/`. Do not create a competing `public/gave/index.html` or edit generated `dist/` files. No router, redirect fallback, or global Astro configuration change is needed for this single route.

Great Northern imagery must not be hotlinked. The first version must look finished using CSS gradients and abstract water, steam, stone, and nature motifs. Document an optional local image path in configuration and the expected asset location for the owner; do not render a placeholder or request a nonexistent file when no image is configured. A failed image load retains the polished gradient fallback. Supplied imagery should be optimized locally and given explicit dimensions to prevent layout shifts.

## State and persistence

Use one versioned storage key owned by the gift experience. Persist meaningful interaction checkpoints: current scene, packing index and pending feedback choice, unlocked clue identifiers, number of location clues shown, hint levels, puzzle completion flags, and reveal completion. On refresh, restore valid saved progress. Validate saved types, ranges, version, and scene; corrupt or incompatible data resets to `intro`. Catch storage read/write errors and continue in memory if storage is unavailable.

Refreshing during an unfinished reveal restarts the cinematic sequence cleanly. Once the reveal is complete, restoring the reveal scene shows its final frame; restoring `details` opens the details directly. `Start forfra` clears only this experience's storage key and returns to the beginning. Restarting or leaving a scene cancels its pending timers and animations so delayed callbacks cannot change the new scene. Guard transitions against rapid double taps.

The state machine should expose only the transitions needed by the six scenes. Every scene must have a forward path, and hints or forgiving validation must prevent permanent dead ends.

## Visual and interaction rules

The opening uses cream, charcoal, slate, thin borders, uppercase metadata, and restrained confidential-dossier details. It should feel like a private luxury invitation rather than a spy game. Packing and clue scenes use centered cards and large touch-friendly controls. Colors gradually become warmer and more natural as the destination approaches.

The reveal uses large editorial typography, slow fade or blur-to-focus effects, gentle scale movement, and a calm water or mist gradient. Animations must be subtle, and no audio should autoplay. The entire layout must avoid horizontal scrolling, work on narrow mobile screens and desktop, and never depend on hover.

## Accessibility

Use Danish `lang` metadata and descriptive page metadata. Use semantic headings, labeled inputs, native buttons, visible keyboard focus, adequate contrast, and touch targets of approximately 44px or larger. Use an `aria-live="polite"` region for feedback and unlocked clues. Do not communicate essential information through color alone. Support keyboard-only progression and `prefers-reduced-motion: reduce` by shortening or removing transitions while preserving content and order.

Inactive scenes must be hidden from display, keyboard navigation, and the accessibility tree, not merely made transparent. Move focus to the new scene's heading on scene transitions. Keep unrevealed destination text out of accessible names and live-region announcements. Reduced-motion mode must expose the same reveal content without waiting for animation completion events.

## Verification and deployment

Use the existing `.github/workflows/pages.yml`; the old `site-check.yml` no longer exists. Retain its frozen-lockfile install and `pnpm build` check, which runs both `astro check` and `astro build`. Add a nonempty-file assertion for `dist/gave/index.html` after the build. Upload and deploy the same `dist/` artifact through the existing Pages jobs. Pull requests build only; pushes to `main` build and deploy. The repository root is not served directly.

Use Node 20+ and the pinned pnpm 10.33.2 for local development. Install with `pnpm install --frozen-lockfile`, then use `pnpm dev`, `pnpm build`, and `pnpm preview` in a shell supporting the current package scripts' POSIX environment assignments. For native PowerShell, set `$env:ASTRO_TELEMETRY_DISABLED = '1'` and invoke `pnpm exec astro dev`, `pnpm exec astro check`, `pnpm exec astro build`, and `pnpm exec astro preview` as appropriate; both check and build must pass. Do not add a dependency solely to change shell behavior.

Test `/gave/` on the development server and on the preview of the production build. Verify the generated `dist/gave/index.html` and referenced bundles, then verify `/gave` and `/gave/` on GitHub Pages after an authorized deployment. Before handoff, test mobile and desktop behavior, all scene transitions, forgiving answers, hints, refresh recovery, restart, keyboard navigation, reduced motion, asset loading, and browser-console errors.

Update `README.md` during implementation with the gift content file, optional image directory, and preview URL. Align the obsolete root-HTML, stylesheet, generated Jeopardy path, and CI guidance in `AGENTS.md` with the current Astro structure as part of that implementation's documentation work.

File checks alone do not validate the experience. Include these behavioral checks:

- Scan the actual QR URL `/gave` on a phone and verify entry and asset loading after any trailing-slash redirect.
- Time a complete relaxed playthrough and check narrow-screen layout with the virtual keyboard open.
- Try both choices on packing cards, accepted Danish and English puzzle answers, wrong answers, and every hint-to-answer path.
- Refresh midway through every scene, including visible packing feedback, partial location clues, and the cinematic reveal.
- Test unavailable storage, malformed saved data, and an old storage version.
- Double-tap actions rapidly and restart during the reveal; ensure no stale callback advances the experience.
- Complete the whole experience using only the keyboard and again with reduced motion; verify focus and hidden-scene behavior with a screen reader.
- Verify neutral browser/share metadata, absent optional booking fields, and both missing and failed optional image configurations.

## Implementation checkpoints

The owner authorizes committing and pushing requested work directly to `main`. Work in coherent, reviewable increments, verify each increment, and commit and push as implementation progresses. No branch or pull request is required. Use the conventional commit format in `AGENTS.md`, such as `feat(gave): add packing scene`, without AI co-author trailers. Do not force-push or publish broken intermediate application states.

Keep the implementation plan current with completed tasks, remaining tasks, checks performed, and known limitations. At a pause or handoff, commit and push completed work where possible and record a concrete resume point. A successful push is not proof that the Pages build or deployment succeeded; report their status separately when checked.

## Simplifications

Do not build a real map, drag-and-drop inventory, swipe gesture dependency, audio system, analytics, or multi-page router. Button-based packing, clue cards, a text input, and CSS transitions provide the intended experience with fewer failure modes and less maintenance.
