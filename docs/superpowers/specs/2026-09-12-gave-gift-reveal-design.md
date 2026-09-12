# Gave Gift Reveal Experience Design

**Status:** Approved design, pending implementation plan

**Goal:** Build a 5–7 minute Danish interactive gift reveal at `/gave/` that gradually leads from a confidential travel invitation to a cinematic Great Northern Spa reveal in Kerteminde.

## Experience

The QR card is the private entry point. The public homepage remains unchanged and does not link to the experience. The site is a single static page under `gave/`, with no additional route requirements.

The scenes progress in this order:

```text
intro → packing → location → namePuzzle → reveal → details
```

The opening shows only a classified reservation, purpose, and duration, followed by `Begynd`. The packing scene presents one item at a time with `PAK` and `BLIV HJEMME` actions. Each answer gives a short warm or understated humorous response and can unlock a clue. Packing choices do not permanently block progress.

The location scene reveals easy Danish clues progressively: Denmark, leaving Jutland, a bridge, Funen, the sea, a town beginning with K, and finally `Kerte_____`. The player enters Kerteminde in a forgiving text field. A hint is available without penalty.

The name scene contains two small puzzles. The answer to “Modsat lille?” is `GREAT`. A simple compass puzzle supplies `NORTH`. The interface combines the answers automatically into `GREAT NORTHERN`; the player never has to guess the full name manually.

The reveal scene changes to a full-viewport cinematic presentation. It shows, with restrained pauses and transitions:

```text
Destination identificeret.
Pak en badedragt.
Du og jeg skal af sted.
GREAT NORTHERN
Kerteminde
```

The final `Fortæl mig alt` action opens the practical details scene. Details are configurable and may include date, check-in, check-out, hotel stay, dinner, spa access, treatments, breakfast, address, and a personal message.

## Architecture

Use a central scene state and plain browser JavaScript. Do not introduce a framework, bundler, backend, database, authentication, or runtime dependency. Render or reveal one scene at a time while keeping the application on the same page.

Create these files:

- `gave/index.html` — semantic scene containers, controls, status regions, and script/style references.
- `gave/style.css` — page-specific theme, responsive layout, scene transitions, reveal presentation, and reduced-motion behavior.
- `gave/script.js` — state transitions, rendering, input handling, validation, local storage, restart, and reveal timing.
- `gave/config.js` — editable gift details, Danish copy, packing items, clues, hints, and accepted answers.
- `gave/assets/` — optional locally hosted, optimized images supplied or approved for the experience.

The page may reuse the existing Google font loading approach and visual conventions from `assets/style.css`, but it should use paths relative to `gave/`. Great Northern imagery must not be hotlinked. The first version should work with CSS gradients and abstract water, steam, stone, and nature motifs, with obvious local placeholders for later imagery.

## State and persistence

Use one versioned storage key owned by the gift experience. Persist the current scene, packing index, unlocked clue identifiers, and puzzle completion flags. On refresh, restore valid saved progress. If the saved version or scene is invalid, reset to `intro`. `Start forfra` clears this key and returns to the beginning.

The state machine should expose only the transitions needed by the six scenes. Every scene must have a forward path, and hints or forgiving validation must prevent permanent dead ends.

## Visual and interaction rules

The opening uses cream, charcoal, slate, thin borders, uppercase metadata, and restrained confidential-dossier details. It should feel like a private luxury invitation rather than a spy game. Packing and clue scenes use centered cards and large touch-friendly controls. Colors gradually become warmer and more natural as the destination approaches.

The reveal uses large editorial typography, slow fade or blur-to-focus effects, gentle scale movement, and a calm water or mist gradient. Animations must be subtle, and no audio should autoplay. The entire layout must avoid horizontal scrolling, work on narrow mobile screens and desktop, and never depend on hover.

## Accessibility

Use Danish `lang` metadata and descriptive page metadata. Use semantic headings, labeled inputs, native buttons, visible keyboard focus, adequate contrast, and touch targets of approximately 44px or larger. Use an `aria-live="polite"` region for feedback and unlocked clues. Do not communicate essential information through color alone. Support keyboard-only progression and `prefers-reduced-motion: reduce` by shortening or removing transitions while preserving content and order.

## Verification and deployment

Extend `.github/workflows/site-check.yml` with existence checks for the four required `gave/` files. Before handoff, test the page at `/gave/` on mobile and desktop, including all scene transitions, forgiving answers, hints, refresh recovery, restart, keyboard navigation, reduced-motion behavior, asset loading, and browser-console errors. GitHub Pages will serve `gave/index.html` directly from the `main` branch.

## Simplifications

Do not build a real map, drag-and-drop inventory, swipe gesture dependency, audio system, analytics, or multi-page router. Button-based packing, clue cards, a text input, and CSS transitions provide the intended experience with fewer failure modes and less maintenance.
