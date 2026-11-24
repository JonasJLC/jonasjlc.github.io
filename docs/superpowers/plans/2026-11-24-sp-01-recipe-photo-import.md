# Strandparken Idé 1: Billede af retten ved import fra link — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A recipe imported from a link gets the dish's photo. The photo is copied into Storage, resized to about 1200 px with a small thumbnail, and shown wherever the recipe appears. The recipe card is usable at once and shows "Henter billede…" until the photo arrives. Existing recipes that have a source link but no photo are tried once. On the recipe page, a person can replace or remove the photo.

**Architecture:** Picking the image is pure code in `supabase/functions/recipe-import/page.ts` (`pickImage`). `recipe-import` returns the chosen address with the draft and never fails because of it. A new edge function, `recipe-image`, does the download. It takes either an image address or a page address (for the backfill, so no model call is spent), fetches through the same hardened rules as page fetches, and returns the bytes as base64 JSON. The browser decodes and resizes with the existing canvas code (1200 px plus a 400 px thumbnail) and uploads both files to `sp-recipes`. Two reasons for this split: decoding large images inside an edge function risks its CPU limit, and the browser cannot fetch most recipe sites' images itself (CORS, and a cross-origin image taints the canvas). A small client-side photo-job store tracks which recipes are "henter billede" so every view can show the state.

**Source:** `docs/app_ideer_-_strandparken_rettet.docx`, Idé 1 (no mockup).
**Depends on:** nothing. Idé 2 (placeholder) builds on the same `DishImage` component.
**Supersedes:** main spec §4.6 "Images" for imported photos only (1200 px instead of 1600 px; camera photos keep 1600 px, per the roadmap's Q10). Main spec §5.3.1 acceptance "imports with title, photo, …" becomes true for link imports.
**Status:** Draft 2026-11-24. See the [roadmap](2026-11-24-strandparken-ideer-roadmap.md).

---

## Current setup (as found on 2026-11-24)

| Area | What the repo has | Consequence |
|---|---|---|
| Page parsing | `recipe-import/page.ts`: `recipeFromJsonLd`, `readableText` and `pageText` read JSON-LD `Recipe` nodes (including `@graph`) but ignore `image`, `og:image` and `twitter:image`. | Add `pickImage(html, pageUrl)` next to them, reusing the `nodes()` and `isRecipe()` helpers. |
| Fetching | `recipe-import/fetch.ts`: `checkUrl`, `assertPublic`, `readLimited` (2 MB cap) and `fetchPage`, which allows only `html`/`xml` content types and returns text. | Factor out a generic `fetchPublic(url, { accept, allowType, maxBytes })` that returns bytes. `fetchPage` becomes a thin wrapper, so its tests keep passing unchanged. |
| Function scaffold | `_shared/guard.ts` `handler({ fn, schema, run })` handles auth, membership, zod input and errors, and always replies with JSON. | `recipe-image` returns `{ mediaType, data }` (base64). That is ≤ ~7 MB of JSON for a 5 MB image and needs no change to the guard. |
| Import result | `logic.ts` `importRecipe` returns the model draft plus `sourceUrl` and `originalText`. `lib/recipes/import.ts` `ImportedRecipe` mirrors it. | Add `imageUrl: string \| null` to both. |
| Photo storage | `lib/recipes/repo.ts`: `shrinkImage(file)` (1600 px JPEG 0.82), `uploadPhoto`, `removePhoto`, `signedPhotoUrls`; `saveRecipe` takes `photo: {file} \| {remove} \| null`. `sp_recipes.thumb_path` exists but nothing writes or reads it. | Generalise `shrinkImage(blob, maxEdge)`. Write `thumb_path` for every new photo. Views read the thumbnail where they show a small image. |
| Photo links | `use-recipes.ts` builds `photos` from `image_path` only; `dishOf` (`lib/madplan/model.ts`) exposes `imagePath`. | Sign `thumb_path` too, and give `Dish` a `thumbPath`. |
| Photo editing | `RecipeEditor.tsx` can choose or remove a photo; `RecipeDetail.tsx` has no photo actions. | Add "Skift billede" and "Fjern billede" on the recipe page. |
| Deploy | `supabase/config.toml` lists each function with `verify_jwt = false`. | Add `[functions.recipe-image]`. |

## Files

**Create**

| File | Purpose | Task |
|---|---|---|
| `supabase/migrations/20261125090000_strandparken_recipe_image_fetch.sql` | `image_source_url`, `image_fetch_attempted_at` on `sp_recipes` | 1 |
| `supabase/functions/recipe-image/index.ts` | `Deno.serve(handler({ fn: 'recipe-image', … }))` | 4 |
| `supabase/functions/recipe-image/logic.ts` | Input schema, page-or-image fetch, type and size checks | 4 |
| `supabase/functions/recipe-image/logic.test.ts` | Deno tests with fake fetch and resolver | 4 |
| `src/components/strandparken/lib/recipes/photo-jobs.ts` | In-memory job store: `start(recipeId, source)`, `subscribe`, `statusOf`; runs fetch → resize → upload → row update | 6 |
| `src/components/strandparken/lib/recipes/photo-jobs-model.ts` | Pure parts: which recipes the backfill picks, `fitWithin(w, h, max)` | 6 |
| `tests/strandparken-recipe-photos.test.ts` | Node tests for the pure parts | 6 |

**Modify**

| File | Change | Task |
|---|---|---|
| `supabase/functions/recipe-import/page.ts` | `pickImage(html, pageUrl)` | 2 |
| `supabase/functions/recipe-import/page.test.ts` | Fixtures for every image source and shape | 2 |
| `supabase/functions/recipe-import/fetch.ts` / `fetch.test.ts` | `fetchPublic` with allowed types and size; `fetchPage` on top | 3 |
| `supabase/functions/recipe-import/logic.ts` / `logic.test.ts` | Return `imageUrl` for link imports (null otherwise) | 2 |
| `supabase/config.toml` | `[functions.recipe-image] verify_jwt = false` plus a comment | 4 |
| `src/components/strandparken/lib/recipes/import.ts` | `ImportedRecipe.imageUrl`; carry it on the draft | 5 |
| `src/components/strandparken/lib/recipes/model.ts` | `RecipeDraft.imageUrl?: string` | 5 |
| `src/components/strandparken/lib/recipes/repo.ts` | `shrinkImage(blob, maxEdge)`, `uploadPhotoPair`, `setPhoto`, `removePhoto` removes both files, `saveRecipe` stores `image_source_url` | 5 |
| `src/components/strandparken/lib/recipes/use-recipes.ts` | Sign thumbnails too; reload when a photo job finishes | 7 |
| `src/components/strandparken/lib/madplan/model.ts` | `Dish.thumbPath` | 7 |
| `RecipeEditor.tsx`, `RecipeDetail.tsx`, `RecipesView.tsx`, `MadplanView.tsx`, `DaySheet.tsx`, `home/Tonight.tsx` | Thumbnail in small places, "Henter billede…", photo actions on the recipe page | 7, 8 |
| `src/lib/supabase/database.types.ts` | Regenerated | 1 |

## Data changes

`supabase/migrations/20261125090000_strandparken_recipe_image_fetch.sql`:

```sql
-- Idé 1: the photo address an import found, and when the app last tried to fetch it ("try once" for the backfill).
alter table public.sp_recipes
  add column image_source_url text check (image_source_url is null or image_source_url ~ '^https://'),
  add column image_fetch_attempted_at timestamptz;
```

The existing household policies and the `sp_touch` trigger cover the new columns. Policy test: add one case to `supabase/tests/strandparken_policies.sql` showing that a member of the other household cannot update `image_fetch_attempted_at` (0 rows). Apply it the same way as earlier Strandparken migrations (dashboard or MCP `apply_migration`; see the roadmap), then regenerate `src/lib/supabase/database.types.ts`.

## Tasks

### Task 1: Migration
- [ ] Write the migration and the policy-test case; apply both; regenerate types; `pnpm exec astro check` passes.

### Task 2: `pickImage` and `imageUrl` from the import
- [ ] Failing Deno tests in `page.test.ts`: JSON-LD `image` as a string, as an array of strings, as an `ImageObject` with `url`/`width`/`height`, as an array of `ImageObject`s (the largest `width × height` wins; without sizes, the first one), inside `@graph`; `og:image` when there is no JSON-LD image; `twitter:image` last; relative and protocol-relative addresses resolved against the page URL; `http:`, `data:` and over-long addresses dropped (→ null); an HTML-entity-encoded `content` attribute decoded.
- [ ] Implement:

```ts
/** The dish photo a page names: schema.org Recipe image, then og:image, then twitter:image. Null when none is usable. */
export function pickImage(html: string, pageUrl: string): string | null
```

  Meta tags are matched in either attribute order (`property=… content=…` and `content=… property=…`). Only `https:` results are returned; an `http:` image is upgraded to `https:` and kept only if the host is the page's own host.
- [ ] `importRecipe` for `kind: 'url'`: `imageUrl: pickImage(page.html, page.url)`, wrapped so an exception yields `null`. For text and images it is `null`. Extend `logic.test.ts`.
- [ ] `deno test --node-modules-dir=none --no-lock --allow-env supabase/functions` passes.

### Task 3: A generic hardened fetch
- [ ] Failing tests in `fetch.test.ts`: `fetchPublic` refuses private addresses after a redirect, enforces `maxBytes` from both `content-length` and the streamed body, refuses a content type that is not allowed (`not_allowed_type`), and returns `{ bytes, url, contentType }`.
- [ ] Move the redirect loop out of `fetchPage` into `fetchPublic(rawUrl, { accept, allowType: RegExp, maxBytes }, deps)`. `fetchPage` calls it with `/html|xml/` and `MAX_BYTES`, then decodes. The existing `fetchPage` tests pass unchanged.

### Task 4: Edge function `recipe-image`
- [ ] Failing tests in `recipe-image/logic.test.ts` (fake `fetch` and `resolve`, as in `fetch.test.ts`):
  - `{ kind: 'image', url }` returns `{ mediaType: 'image/jpeg', data: <base64> }` for jpeg, png and webp.
  - SVG, HTML or a missing content type fails with `not_an_image`.
  - More than 5 MB fails with `too_large`.
  - `{ kind: 'page', url }` fetches the page, runs `pickImage`, then fetches the image. A page without an image fails with `no_image` (422).
- [ ] Input schema: `z.discriminatedUnion('kind', [{ kind: 'image', url }, { kind: 'page', url }])` with `url` an `https:` string of at most 2000 characters.
- [ ] `index.ts` mirrors `recipe-import/index.ts`. Add `[functions.recipe-image]` to `config.toml` with a comment: "Fetches a recipe photo for the browser to resize (Idé 1). Outbound network; no AI, no secrets beyond the platform's."
- [ ] Logs contain only the error class (the guard already does this); never the address.

### Task 5: Draft carries the photo; resize and upload
- [ ] `ImportedRecipe.imageUrl` and `RecipeDraft.imageUrl` are carried through `draftFromImport` (`lib/recipes/import.ts`). Extend `tests/strandparken-import.test.ts`.
- [ ] `repo.ts`: `shrinkImage(blob: Blob, maxEdge = 1600, quality = 0.82)`. `uploadPhotoPair(householdId, recipeId, blob, maxEdge)` uploads `<uuid>.jpg` and `<uuid>-thumb.jpg` (400 px long side) and returns `{ imagePath, thumbPath }`. `setPhoto(recipeId, paths | null)` updates the row and removes the old pair. `removePhoto` takes both paths.
- [ ] `saveRecipe`: a chosen file uses `uploadPhotoPair(…, 1600)`; a new recipe with `draft.imageUrl` and no chosen file stores `image_source_url` and leaves `image_path` null. JPEG stays the format: Safari's `canvas.toBlob('image/webp')` does not encode WebP everywhere.

### Task 6: Photo jobs and the one-off backfill
- [ ] Failing tests in `tests/strandparken-recipe-photos.test.ts`:
  - `fitWithin(4000, 3000, 1200)` → `{ w: 1200, h: 900 }`; never upscales.
  - `backfillCandidates(recipes)` picks recipes that are not archived and have `source_url` (or `image_source_url`), no `image_path`, and no `image_fetch_attempted_at`; social links (`detectSource(...).source !== 'web'`) are skipped.
- [ ] `photo-jobs.ts`: `start(recipeId, { kind: 'image' | 'page', url })` calls `recipe-image`, decodes the base64 to a `Blob`, then `uploadPhotoPair(…, 1200)`, `setPhoto`, and sets `image_fetch_attempted_at = now()`. It sets `image_fetch_attempted_at` on failure as well, so each recipe is tried once. At most one job per recipe and two at a time. `subscribe(fn)` notifies views when a job starts or ends.
- [ ] After a successful save of an import with `imageUrl`, `RecipeEditor` calls `start(id, { kind: 'image', url })` and navigates at once; the recipe is usable before the photo exists.
- [ ] Backfill: when `RecipesView` mounts with recipes loaded, it runs once per session (a module flag) over `backfillCandidates`, sequentially through the job store with `{ kind: 'page', url: source_url }`. The same path picks up imports whose job was interrupted because the app was closed (`image_source_url` set, not attempted).

### Task 7: Thumbnails everywhere and "Henter billede…"
- [ ] `use-recipes.ts` signs `image_path` and `thumb_path` in one `createSignedUrls` call and reloads when a photo job finishes (`photo-jobs.subscribe`).
- [ ] `Dish.thumbPath` in `lib/madplan/model.ts`; extend `tests/strandparken-madplan.test.ts`.
- [ ] Small images use `thumb_path ?? image_path`: the Opskrifter grid (`RecipesView` card), Madplan rows (`MadplanView` `DayRow`), the pickers in `DaySheet`, and `home/Tonight.tsx`. The recipe hero (`RecipeDetail`) uses `image_path`.
- [ ] While `statusOf(recipe.id) === 'running'`, `DishImage` shows the placeholder with a small "Henter billede…" caption (`sp-caption`, `aria-live="polite"` on the recipe page only, so a grid does not read it out many times).

### Task 8: Replace or remove the photo on the recipe page
- [ ] `RecipeDetail` gets a quiet button "Skift billede" over the hero and "Fjern billede" when a photo exists. The file input is `accept="image/*"`: iOS then offers the photo library and the camera. "Fjern billede" goes through `setPhoto(id, null)` with a `Fortryd` toast that restores the previous paths (the old files are removed only when the toast closes without undo).
- [ ] The editor's existing photo controls use the same `uploadPhotoPair`.

### Task 9: Specs, backlog, verify, commit
- [ ] Main spec §4.6 "Images" and §5.3.1 note the 1200 px imported photo and the thumbnail; §4.4 lists `recipe-image`; UI spec §5.4 notes the "Henter billede…" state.
- [ ] Backlog: remove nothing; add "Photo jobs run only while the app is open; an interrupted job is retried by the backfill on the next visit to Opskrifter."
- [ ] Verify (below), deploy `supabase functions deploy recipe-import recipe-image`, commit `feat(strandparken): fetch the dish photo when importing a recipe from a link`.

## Verification

- `deno test --node-modules-dir=none --no-lock --allow-env supabase/functions`
- `node --test tests/`
- `pnpm exec astro check` and `pnpm exec astro build`
- `pnpm exec astro preview`, then on a phone:
  - Import a page with JSON-LD (for example a Danish food site) and one with only `og:image`. Each recipe opens at once with "Henter billede…"; the photo appears within seconds.
  - Import a page with no image: the recipe saves without one and no error is shown.
  - The grid, Madplan rows and Hjem load the thumbnail (network tab: about 40 kB or less, main spec §4.6).
  - Replace the photo from the camera and from the library; remove it; undo the removal.
  - An existing recipe with a link and no photo gets a photo after Opskrifter is opened once. A second visit does not retry a page that had no image.

## Acceptance criteria

- [ ] Importing from a URL also fetches the dish's photo, in the order JSON-LD `image` (largest), `og:image`, `twitter:image`.
- [ ] No image found: the recipe is saved without one, and the import never fails because of the image.
- [ ] The image is downloaded and stored with the recipe; it is never hotlinked.
- [ ] Relative image addresses are resolved against the page URL.
- [ ] Stored images are at most ~1200 px on the long side, with a small thumbnail.
- [ ] The recipe card is usable immediately and shows "Henter billede…" while the image loads.
- [ ] On the recipe page the photo can be replaced (from photos or by taking a photo) or removed.
- [ ] The image appears in the Opskrifter grid, on the recipe page, in Madplan rows and in "I aften" on Hjem.
- [ ] Existing recipes with a source URL and no image are tried once.

## Open questions

1. **Rate limit for `recipe-image`.** It calls no model, so the AI limits in `_shared/usage.ts` do not apply. Default: no extra limit. Only household members can call it, and each call is capped by size and time, the same trust level as `recipe-import`. Add a per-person counter if logs show misuse.
2. **Which picture when JSON-LD lists several without sizes.** Default: the first one, which is the one sites mark as primary. Revisit if real imports pick crops or logos.
