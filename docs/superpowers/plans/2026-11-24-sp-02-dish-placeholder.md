# Strandparken Idé 2: Pænere pladsholder, når der ikke er billede — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-letter tile shown for dishes without a photo. The new tile has a soft background chosen from the recipe's category or tags, with a simple food icon in a darker shade of the same colour. A list of recipes without photos should look calm and varied.

**Architecture:** A pure module, `lib/recipes/placeholder.ts`, maps a dish (title, category name, tags) to a tone key and a lucide icon. It checks tags first, then the category, then falls back to a stable hash of the title, so the same dish always gets the same tile and neighbouring tiles differ. The tones are new tokens in `src/styles/strandparken.css` (one background and one icon colour per tone), exposed through `@theme inline` as literal utility classes. `DishImage` takes the placeholder as a prop and renders it whenever there is no photo or the photo fails to load. Every caller passes the dish's category and tags.

**Source:** `docs/app_ideer_-_strandparken_rettet.docx`, Idé 2. Mockup: the first image in the document ("Idé 3 · Pladsholder uden billede"; the mockup labels use older numbers): a 2×3 Opskrifter grid in peach, green, honey, rose, mint and pink, captioned "Én dæmpet farve og ét ikon pr. kategori".
**Depends on:** nothing required. If Idé 1 is built first, the "Henter billede…" state sits on top of this tile.
**Supersedes:** UI spec §5.4 (dish image fallback: "`--sp-track` tile with the first letter") and §5.10 for ideas without a photo. Main spec §5.2 acceptance "Items without a photo look intentional, not broken" now has a concrete form.
**Status:** Draft 2026-11-24. See the [roadmap](2026-11-24-strandparken-ideer-roadmap.md).

---

## Current setup (as found on 2026-11-24)

| Area | What the repo has | Consequence |
|---|---|---|
| Component | `ui/dish-image.tsx`: `DishImage({ src, name, shape: 'round' \| 'cover', size })`. Without a photo it shows `bg-sp-track` with the first letter in `text-sp-primary`. `DishSlot` draws the dashed empty slot. | Change only the fallback branch; keep the props and the `onError` fallback. `DishSlot` is unchanged. |
| Callers | `RecipesView` (grid card, idea card), `RecipeDetail` (hero), `RecipeEditor` and `IdeaSheet` (photo preview), `MadplanView` `DayRow`, `DaySheet` (recipe and idea pickers, entry header), `home/Tonight.tsx` (I aften, week strip). | Each must pass `category` and `tags`. Plan entries get them from `dishOf`. |
| Dish model | `lib/madplan/model.ts` `dishOf` returns `{ title, recipe, imagePath }`; ideas have `tags` but no category; free text has neither. | Add `placeholder` to `Dish`, computed in `dishOf`, so plan rows need no lookups. |
| Categories | `sp_recipe_categories` rows, seeded with the D30 names; recipes hold `category_id`. `useRecipes` returns `categories`. | Map by category **name** (case-insensitive and accent-folded with `fold` from `lib/recipes/filter.ts`), because ids differ per household. |
| Tokens | `strandparken.css` defines colours on `:root[data-app='strandparken']` and maps them in `@theme inline`; `tests/strandparken-token-guard.test.mjs` forbids raw colours elsewhere; `tests/strandparken-contrast.test.mjs` checks text pairs. | New tones go in the stylesheet only, plus a contrast test for each icon/background pair. |
| Icons | `lucide-react` 1.76 exports `Soup`, `Salad`, `Sandwich`, `Croissant`, `CakeSlice`, `Cookie`, `CupSoda`, `Fish`, `Shrimp`, `Drumstick`, `Beef`, `Carrot`, `Leaf`, `Pizza`, `EggFried`, `IceCreamCone`, `Popcorn`, `Wine`, `Coffee`, `Wheat`, `Flame`, `Utensils`, `ChefHat`, `Hamburger`, `Cherry` (checked in `dist/lucide-react.d.ts`). There is no pepper icon. | The mockup's chili becomes `Flame` for "mexicansk"/"stærk". |

## Files

**Create**

| File | Purpose | Task |
|---|---|---|
| `src/components/strandparken/lib/recipes/placeholder.ts` | `placeholderFor({ title, category, tags })` → `{ tone, icon }`; tone and icon tables | 2 |
| `tests/strandparken-placeholder.test.ts` | Mapping, priority, stability and variety | 2 |

**Modify**

| File | Change | Task |
|---|---|---|
| `src/styles/strandparken.css` | Eight `--sp-tone-<key>` / `--sp-tone-<key>-ink` pairs on the root; `--color-sp-tone-*` in `@theme inline` | 1 |
| `tests/strandparken-contrast.test.mjs` | Icon on tile ≥ 3:1 for every tone | 1 |
| `src/components/strandparken/ui/dish-image.tsx` | `placeholder?: Placeholder` prop; tinted tile with the icon; letter fallback only when no placeholder is given | 3 |
| `src/components/strandparken/lib/madplan/model.ts` | `Dish.placeholder` | 4 |
| `RecipesView.tsx`, `RecipeDetail.tsx`, `RecipeEditor.tsx`, `IdeaSheet.tsx`, `MadplanView.tsx`, `DaySheet.tsx`, `home/Tonight.tsx` | Pass the placeholder | 4 |
| `src/dev/strandparken/Gallery.tsx` (the dev-only UI gallery) | Show all eight tones | 4 |

## Data changes

None. Category names and tags already exist.

## Tasks

### Task 1: Tone tokens
- [ ] Failing test first: extend `tests/strandparken-contrast.test.mjs` with a loop over the eight tone keys asserting `ratio(tone-<k>-ink, tone-<k>) >= 3` (WCAG 1.4.11 for a graphical object), plus `ratio(tone-<k>, surface) < 1.6`, so a tile never reads louder than a photo. Run it; it fails because the tokens are missing.
- [ ] Add the tokens to the root block in `strandparken.css`. Starting values, matched to the mockup and the beige/green palette; tune by eye on a phone, keeping the tests green:

```css
  /* Idé 2: dish placeholder tones. Soft ground, icon in a darker shade of the same hue. */
  --sp-tone-clay: #F6DED3;   --sp-tone-clay-ink: #8A3E22;
  --sp-tone-sage: #DCEBD5;   --sp-tone-sage-ink: #2F5E2C;
  --sp-tone-honey: #F5E4B8;  --sp-tone-honey-ink: #6F4E0E;
  --sp-tone-rose: #F4DADC;   --sp-tone-rose-ink: #8C2F3B;
  --sp-tone-mint: #D5ECE3;   --sp-tone-mint-ink: #1F5C48;
  --sp-tone-plum: #F2DCE7;   --sp-tone-plum-ink: #7F3356;
  --sp-tone-sky: #DDE7F1;    --sp-tone-sky-ink: #2C5376;
  --sp-tone-oat: #ECE5D4;    --sp-tone-oat-ink: #5A503C;
```

- [ ] Map them in `@theme inline` (`--color-sp-tone-clay: var(--sp-tone-clay);` and so on) so `bg-sp-tone-clay` and `text-sp-tone-clay-ink` exist. Contrast and token-guard tests pass.

### Task 2: The mapping
- [ ] Failing tests in `tests/strandparken-placeholder.test.ts`:
  - A tag beats the category: tags `['fisk']` in category Aftensmad → `{ tone: 'sky', icon: 'fish' }`.
  - Each D30 category maps to its own tone and icon: Aftensmad → clay/utensils, Tilbehør & salat → sage/salad, Frokost → honey/sandwich, Morgenmad & brunch → honey/egg, Bagværk → oat/croissant, Sødt → plum/cake, Snacks & dip → rose/popcorn, Drikke → mint/cup.
  - Matching folds case and accents (`'tilbehør & salat'`, `'TILBEHOER'` is not required).
  - Tag words: `fisk`, `laks`, `torsk` → sky/fish; `rejer`, `skaldyr` → sky/shrimp; `kylling` → honey/drumstick; `oksekød`, `bøf`, `burger` → clay/beef; `vegetar`, `vegansk`, `grønt` → sage/leaf; `suppe` → clay/soup; `pasta` → honey/wheat; `pizza` → rose/pizza; `mexicansk`, `stærk` → rose/flame; `dessert`, `kage` → plum/cake; `is` → mint/ice-cream; `salat` → sage/salad. The first matching tag in the recipe's own tag order wins.
  - No match: the tone comes from a stable hash of the folded title (`fnv1a(title) % 8`), and the icon is `utensils`. Calling twice gives the same result; ten different titles use at least four tones.
- [ ] Implement:

```ts
export type Tone = 'clay' | 'sage' | 'honey' | 'rose' | 'mint' | 'plum' | 'sky' | 'oat';
export type PlaceholderIcon = 'utensils' | 'salad' | 'sandwich' | 'egg' | 'croissant' | 'cake' | 'popcorn' | 'cup'
  | 'fish' | 'shrimp' | 'drumstick' | 'beef' | 'leaf' | 'soup' | 'wheat' | 'pizza' | 'flame' | 'ice-cream';
export type Placeholder = { tone: Tone; icon: PlaceholderIcon };
export function placeholderFor(d: { title: string; category?: string | null; tags?: readonly string[] }): Placeholder
```

  The module holds only data and strings; no React imports, so `node --test` runs it. Icons resolve to lucide components in `dish-image.tsx`.

### Task 3: `DishImage`
- [ ] Add `placeholder?: Placeholder`. Literal class maps (so Tailwind sees them): `toneClass: Record<Tone, string>`, for example `clay: 'bg-sp-tone-clay text-sp-tone-clay-ink'`, and `iconFor: Record<PlaceholderIcon, LucideIcon>`.
- [ ] Icon size: 40 % of the tile (round 52 → 22 px, 64 → 26 px; cover → 32 px), stroke 1.8 as in `ui/icon.tsx`, `aria-hidden`. The tile stays decorative, as before (the dish name is always shown next to it).
- [ ] Without a `placeholder` prop the old letter tile remains, so callers can move over one at a time and nothing breaks halfway.

### Task 4: Callers
- [ ] `Dish.placeholder` in `dishOf`: a recipe uses its category name (looked up from `categories`, passed in as a new optional argument) and tags; an idea uses its tags; free text uses the title hash. Extend `tests/strandparken-madplan.test.ts`.
- [ ] Pass `placeholder` in `RecipesView` (recipe cards and idea cards), `RecipeDetail` hero, `RecipeEditor` and `IdeaSheet` previews (live from the draft's category and tags), `MadplanView` rows, the `DaySheet` pickers and header, and `Tonight`.
- [ ] Add a "Pladsholdere" section to `src/dev/strandparken/Gallery.tsx`, showing all eight tones in both shapes.

### Task 5: Specs, verify, commit
- [ ] UI spec §5.4: replace the letter fallback with the tone tile and list the tone tokens in §3.1. Main spec §5.2: note the rule (tag, then category, then title hash).
- [ ] Verify (below). Commit: `feat(strandparken): category-coloured placeholders for dishes without a photo`.

## Verification

- `node --test tests/` (placeholder, madplan, contrast, token guard)
- `pnpm exec astro check` and `pnpm exec astro build`
- `pnpm exec astro preview` at 390 px width: an Opskrifter grid with six recipes without photos looks like the mockup (calm, varied, no two neighbours alike in the common case). Madplan rows, the recipe hero, the I aften card and the pickers show the same tile for the same dish. A broken photo address falls back to the tile, not a broken image.

## Acceptance criteria

- [ ] The single-letter circle is gone everywhere a recipe can appear without a photo.
- [ ] The placeholder has a muted background based on the recipe's main category or tag, and a simple food icon in a darker shade of the same colour.
- [ ] The colours are soft and fit the beige/green palette, and each icon reaches 3:1 on its tile.
- [ ] A list of recipes without photos looks calm and varied, not like a row of placeholders.
- [ ] It is used in the Opskrifter grid, the recipe page hero, Madplan rows and Hjem.

## Open questions

1. **Ideas and free-text dinners.** The source document names recipes. Default: ideas and free-text plan entries get the same tiles (from tags, or from the title hash), so Madplan looks consistent. "Rester", "Ude at spise" and "Takeaway" get fixed icons (`Utensils`, `Wine`, `Hamburger`) through a small title table.
