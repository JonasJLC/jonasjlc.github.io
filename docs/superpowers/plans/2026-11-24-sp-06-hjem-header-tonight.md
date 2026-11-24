# Strandparken Idé 6: Nyt Hjem, del 1 (header og I aften) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Start turning Hjem into a household dashboard. This plan covers the header (date, time-based greeting, both members' avatars) and a compact horizontal "I aften" card, and removes the "Resten af ugen" strip. Later plans add the calendar (idea 7), "Jeres dag" (idea 12) and "Mangler at handle" (idea 8).

**Architecture:** `HomeView` in `src/components/strandparken/shell/views.tsx` keeps owning the header and the settings sheet. It gains a second, decorative avatar for the other person. `home/Tonight.tsx` is reduced to one compact card. It still reads today's entry through `usePlan`, `useRecipes` and `useIdeas`, and its pure parts (which dish, which link, which meta line) move to a small tested module. The week strip and its range query are removed. Hjem gets fixed vertical slots so ideas 7, 8 and 12 can drop their sections in without re-flowing the page. Madplan learns one new route, `#madplan/<date>/dag`, which opens that day's sheet, so the empty state's "Planlæg i aften" goes straight to today.

**Source:** `docs/app_ideer_-_strandparken_rettet.docx`, Idé 6. Mockups: `image3.png` (finished dashboard, for reference) and `image4.png` left (the "Hvad skal I have i aften?" empty state, labelled "Idé 1" in the image's older numbering).

**Depends on:** Idé 2 (the placeholder that `DishImage` shows without a photo). Idé 1 is helpful (thumbnails), not required.

**Supersedes:** main spec §5.6 items 1–3 and D23 (roadmap Q7); UI spec §5.5 (Tonight card) and the week-strip half of §5.6.

**Status:** ✅ Implemented 2026-11-24 (commits afd9718). Manual checks: `docs/strandparken-manual-checks.md`. Part of the [roadmap](2026-11-24-strandparken-ideer-roadmap.md).

---

## Current setup (as found on 2026-11-24)

| Area | What the repo has | Consequence |
|---|---|---|
| Header | `HomeView` (`shell/views.tsx`) renders `dateLine(now)`, `greetingFor(now)`, `people[person].name`, and one `AvatarButton` that opens the `Indstillinger` sheet (`ProfileSection`). | Greeting and date already match the source document ("Torsdag 19. november", Godmorgen/Goddag/Godaften). Only the second avatar and the layout change. |
| Greeting rule | `lib/greeting.ts`: 04–10 Godmorgen, 11–17 Goddag, 18–03 Godaften, in Europe/Copenhagen; tested in `tests/strandparken-greeting.test.ts`. | Kept as is. |
| I aften | `home/Tonight.tsx`: a vertical card with a 64 px round photo, `sp-title-card`, time and persons, and a `Se opskrift` button; empty state "Der er ikke planlagt aftensmad i dag." with `Tilføj ret` → `#madplan`. | Replaced by a compact horizontal card where the whole card is the link. |
| Week strip | Same file: "Resten af ugen", four tiles for the next days. `usePlan` loads today → Sunday. | Removed. `usePlan` only needs today. |
| Avatars | `ui/avatar.tsx`: `Avatar({ person, size = 44, photo, decorative })` and `AvatarButton({ person, label })`. | Both exist; the overlap is styling. |
| Madplan day sheet | `MadplanView` keeps the open day in local state (`setOpen(date)`); the hash only names the week (`#madplan/2026-11-16`). | A link cannot open a day today. Add `#madplan/<date>/dag`. |
| Dish picture | `ui/dish-image.tsx`: `shape="cover"` fills its parent, which `RecipeEditor` already wraps in a `size-20 rounded-sp-inset` box. After Idé 2 the fallback is the category placeholder. | The thumbnail is a 64 px `rounded-sp-inset` box with `DishImage shape="cover"`. No new primitive. |

---

## Files

**Create**

| File | Purpose | Task |
|---|---|---|
| `src/components/strandparken/lib/home/tonight.ts` | Pure: `tonightCard(entry, recipes, ideas, photos, today)` returns `{ kind: 'planned', title, meta, href, photo, category, tags } \| { kind: 'empty', weekdayLong }`. | 1 |
| `tests/strandparken-home.test.ts` | Tests for `tonightCard` (and later for ideas 7, 8 and 12). | 1 |

**Modify**

| File | Change | Task |
|---|---|---|
| `src/components/strandparken/shell/views.tsx` | New header layout with two avatars; Hjem section slots. | 3 |
| `src/components/strandparken/home/Tonight.tsx` | Compact card, new empty state, week strip removed, `usePlan(householdId, today, today)`. | 4 |
| `src/components/strandparken/madplan/MadplanView.tsx` | `#madplan/<date>/dag` opens that day's sheet; closing it returns to the week hash. | 2 |
| `tests/strandparken-routes.test.ts` | Case for the day route (`subPath('#madplan/2026-11-19/dag')`). | 2 |
| `docs/superpowers/specs/2026-11-11-strandparken-design.md`, `…-ui-design.md`, `docs/strandparken-backlog.md` | Spec and backlog updates. | 5 |

---

## Data changes

None.

---

## Tasks

### Task 1: Pure "I aften" model

- [ ] Write failing tests in `tests/strandparken-home.test.ts`:
  - recipe entry → `kind: 'planned'`, `href: '#opskrifter/<recipeId>'`, meta `"25 min · 2 pers."` (time left out when `total_minutes` is null: `"2 pers."`);
  - idea entry and free-text entry → `href: '#madplan/<today>/dag'`; meta has persons only;
  - no entry → `{ kind: 'empty', weekdayLong: 'fredag' }` (from `longDate`'s weekday names in `lib/madplan/dates.ts`);
  - the photo is the recipe's thumbnail URL when one exists (Idé 1), else its image URL, else `undefined`.
- [ ] Implement `lib/home/tonight.ts` on top of `dishOf` and `entryOn` (`lib/madplan/model.ts`) and `personsLabel` (`lib/stepper.ts`). Export a `weekdayLong(iso)` helper from `dates.ts` instead of parsing `longDate`.
- [ ] `node --test tests/strandparken-home.test.ts` passes.

```ts
export type TonightCard =
  | { kind: 'planned'; title: string; meta: string; href: string; photo?: string; categoryId: string | null; tags: string[] }
  | { kind: 'empty'; weekdayLong: string };
```

### Task 2: Open a Madplan day from a link

- [ ] Test first in `tests/strandparken-routes.test.ts`: `subPath('#madplan/2026-11-19/dag')` is `['2026-11-19', 'dag']` (it already is; the test pins it).
- [ ] In `MadplanView`, when `path[1] === 'dag'` and `path[0]` is a valid ISO date, open the `DaySheet` for that date after the plan has loaded. On close, `history.replaceState` to the week hash (`#madplan` for this week, else `#madplan/<monday>`) so Back does not reopen the sheet.
- [ ] Focus: the sheet traps focus as before; the view-title focus in `AppShell` must not steal focus from the sheet (check the `useEffect` on `path`).

### Task 3: Header

- [ ] Layout per `image3.png`: date line (`sp-small`, muted) above the greeting (`sp-title-page`), avatars top right.
- [ ] Two avatars, overlapping by about a third. The other person's `Avatar` is drawn first and is `decorative`. The signed-in person's `AvatarButton` sits in front and keeps `label="Indstillinger"`, so the accessible name and the settings sheet are unchanged. Add a visually hidden "Camilla og Jonas" text only if a screen reader test shows the pair is otherwise unannounced. Person colours never carry meaning alone (UI spec §9): initials or photos stay.
- [ ] Section slots: `HomeView` renders, in order, `{/* Idé 7: Kalender */}`, `<Tonight />`, `{/* Idé 12: Jeres dag */}`, `{/* Idé 8: Mangler at handle */}`, with `gap-sp-gap` (16 px) instead of `gap-sp-gap-home` (22 px) to keep the dashboard to about one screen. If that needs a new spacing token, add it in `strandparken.css` only.

### Task 4: Compact "I aften" card

- [ ] Planned: one `<a href={card.href}>` styled as a white card (`rounded-sp-card`, `shadow-sp-hero` as today, padding 12–14 px). Left a 64 px `rounded-sp-inset` box with `DishImage shape="cover"` (placeholder from Idé 2 when there is no photo; pass category and tags). Middle: eyebrow `I aften` (`sp-caption`, muted), the name (`sp-body-strong`, up to 2 lines), the meta (`sp-small`, muted). Right: a `ChevronRight` icon (decorative). The link's accessible name reads "I aften: Quesadillas med oksekød, 25 min, 2 personer".
- [ ] Empty, per `image4.png` left: a card with a 1.5 px dashed `--sp-dash` border, a small calendar-plus icon in primary, `Hvad skal I have i aften?` (`sp-title-section`), `Der er ikke planlagt noget til {weekdayLong} endnu.` (`sp-body`, muted), a primary button `Planlæg i aften` → `#madplan/<today>/dag`, and a quiet link `Vælg fra opskrifter` → `#opskrifter`.
- [ ] Loading: a card of the same height with "Henter aftensmad …" (`aria-live="polite"`). Error: keep the current error card with `Prøv igen`.
- [ ] Delete the "Resten af ugen" section and its imports. `usePlan(householdId, today, today)`.
- [ ] Keyboard: the card is one tab stop; the focus ring follows the card radius.

### Task 5: Specs, backlog, verify, commit

- [ ] Main spec §5.6: replace items 1–3 with the dashboard order from roadmap Q7 (header, Kalender, I aften, Jeres dag, Mangler at handle), drop "Ugen", and mark D23 as amended by the 2026-11 ideas. Note in §5.6 that tasks and habits are no longer on Hjem (Q3, Q4).
- [ ] UI spec §5.5: describe the compact card and the dashed empty state; §5.6: remove the week strip bullet, keep day rows.
- [ ] Backlog: remove "Hjem v1 (1.5) has no tasks, habits or Husholdning and Økonomi links" and replace it with "Husholdning and Økonomi links are not placed on Hjem until those pages exist (roadmap Q7)".
- [ ] Run the checks in Verification.
- [ ] Commit: `feat(strandparken): compact Hjem header and I aften card`.

---

## Verification

- `pnpm exec astro check`, `node --test tests/`, `pnpm exec astro build`, then `pnpm exec astro preview` at 390 × 844 and 360 × 740.
- Today planned with a recipe: the card opens the recipe. With an idea or free text: it opens today's Madplan sheet. Nothing planned: the empty state's button opens today's sheet, and closing it leaves `#madplan` in the address bar.
- At 6:00, 12:00 and 20:00 (change the system clock or stub `Date`), the greeting reads Godmorgen, Goddag, Godaften.
- Keyboard: Tab reaches the settings avatar and then the card. VoiceOver reads the avatar as "Indstillinger" and the card as one link.
- Text size 130 %: name wraps to two lines, the chevron stays visible, no horizontal scroll.
- Both phones: tapping the own avatar still opens settings.

---

## Acceptance criteria

- [ ] The header shows the date ("Torsdag 19. november"), a greeting by time of day (Godmorgen / Goddag / Godaften) with the signed-in person's first name, and both members' avatars on the right.
- [ ] "I aften" is a compact horizontal card with thumbnail, name, time and portions, showing today's meal from Madplan.
- [ ] Tapping the card opens the recipe.
- [ ] The "Resten af ugen" section is gone; Hjem shows no week overview.
- [ ] Header and card together take well under half of a 390 × 844 screen, leaving room for the later sections.

---

## Open questions

1. **What does tapping an idea or free-text dinner open?** The source says "tap opens the recipe", and these have none. Default: today's Madplan day sheet.
2. **Tapping the other person's avatar.** Default: it does nothing (decorative). After Idé 12, it could open Sundhed for that person instead.
