# Strandparken Idé 11: Sundhed-fanen — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Sundhed placeholder with a calm data view: a person switcher, today's sleep score, activity progress, steps and cycle day, a 7-day trend for sleep and activity, the source and last sync time, and per-member settings for what the other member may see. Numbers and trends only, with no interpretation or advice.

**Architecture:** `SundhedView` reads the route (`#sundhed`, `#sundhed/data/<person>`, later `#sundhed/vaner`) and renders a `SegmentedControl` with the panels "Data" and "Vaner". Only "Data" exists in this plan, so the control is not rendered until idea 15 adds "Vaner", but the panel structure and the routes are in place. The data comes only from `useHealth` (idea 10), which reads `sp_health_for`. The database has already removed what the viewer may not see, and the view leaves out anything listed in `hidden`. Pure view-model functions in `lib/health/view.ts` decide tiles, trend bars, averages and freshness, and are unit tested. Charts are plain HTML/CSS bars with no chart library.

**Source:** `docs/app_ideer_-_strandparken_rettet.docx`, Idé 11. Mockup: image5.png, right ("Sundhed").

**Depends on:** Idé 10 (`useHealth`, `sp_health_for`, `sp_health_sharing`). Roadmap Q6.

**Supersedes:** main spec §5.4 layout ("Sections, top to bottom…") and §5.4.1 for the data view. The curated cycle-phase explanation for Jonas (D38) is deferred (roadmap Q10). Goals (§5.4.3), nutrition (§5.4.2) and training (§5.4.4) stay future and are not shown.

**Status:** Draft, 2026-11-24. Index: [roadmap](2026-11-24-strandparken-ideer-roadmap.md).

> **⬜ Next up (as of 2026-11-24).** Plan 10 already built pieces this plan expected to create: `ui/switch.tsx`, `lib/health/{model,repo,use-health}.ts` (`useHealth`, `setSharing`, `toHealthView`), `useHealthSettings` and `settings/SharingConfirm.tsx`. Reuse them instead of rebuilding. Plan 14 added a generic `ui/progress-bar.tsx`, which plans 12 and 15 can reuse.

**Privacy (roadmap Q9):** mentions cycle-data sharing. Do not commit until Jonas decides.

---

## Current setup (as found on 2026-11-24)

| Area | What the repo has | Consequence |
|---|---|---|
| Sundhed view | `shell/views.tsx`: `placeholders.sundhed = 'Sundhed er ikke sat op endnu.'`; `ViewFor` falls through to a title + sentence. | New `sundhed/SundhedView.tsx`; `ViewFor` routes `sundhed` to it with `path`. |
| Routing | `lib/routes.ts`: `subPath(hash)` returns the segments after the view. | `#sundhed/data/camilla` → `['data', 'camilla']`. A pure `parseSundhedPath` is added and tested. |
| Primitives | `ui/segmented-control.tsx` (Radix Tabs, `options`, `SegmentedPanel`), `ui/card.tsx`, `ui/avatar.tsx`, `ui/badge.tsx`, `ui/toast.tsx` (`notify`). No switch primitive. | A `Switch` primitive is added (vendored Radix Switch, restyled with tokens). |
| People | `lib/people.ts`: `people[person].name`, person colours; keys `a`/`b` via `keyFromPerson`. | The switcher labels come from here. |
| Health data | Idea 10: `useHealth(person)` → `{ days, today, sources, hidden, status, reload }`, `setSharing(metric, shared)`. | No direct table reads in this plan. |

---

## Files

**Create**

| File | Purpose |
|---|---|
| `src/components/strandparken/sundhed/SundhedView.tsx` | Title, header slot for idea 15's `+`, segmented panels, person switcher. |
| `src/components/strandparken/sundhed/DataPanel.tsx` | Source line, tiles, trends, sharing settings. |
| `src/components/strandparken/sundhed/MetricTile.tsx` | One tile: icon, label, value or "Ingen data i nat". |
| `src/components/strandparken/sundhed/TrendBars.tsx` | 7 bars, weekday letters, "Snit 80", today highlighted, plus an accessible text summary. |
| `src/components/strandparken/sundhed/SharingSettings.tsx` | Own metrics only: what the other member may see. |
| `src/components/strandparken/ui/switch.tsx` | Switch primitive (Radix `Switch`), 44 px target. |
| `src/components/strandparken/lib/health/view.ts` | Pure view model. |
| `tests/strandparken-sundhed.test.ts` | Tests for `view.ts` and `parseSundhedPath`. |

**Modify**

| File | Change |
|---|---|
| `src/components/strandparken/shell/views.tsx` | Route `sundhed` to `SundhedView`; remove the placeholder entry. |
| `src/components/strandparken/lib/routes.ts` | `parseSundhedPath(path)` → `{ tab: 'data' \| 'vaner', person: Person \| null }`; `sundhedHref(person)`. |
| `src/styles/strandparken.css` | Tokens only if a new colour is needed (bars use `--sp-primary` and `--sp-primary-tint`; none expected). |
| `src/dev/strandparken/…` gallery | Add the switch and a tile/trend sample (dev only). |
| Main spec §5.4 | Task 6. |

---

## Data changes

None. This plan uses `sp_health_for` and `sp_health_sharing` from idea 10.

---

## Tasks

### Task 1: Routes (TDD)

- [ ] Add to `tests/strandparken-routes.test.ts` (or the new test file): `parseSundhedPath([])` → `{ tab: 'data', person: null }`; `['data', 'camilla']` → Camilla; `['data', 'x']` → person `null`; `['vaner']` → tab `vaner`. `sundhedHref('jonas')` → `#sundhed/data/jonas`.
- [ ] Implement in `lib/routes.ts`. `person: null` means "the signed-in person".

### Task 2: View model (TDD)

`tests/strandparken-sundhed.test.ts` first, then `lib/health/view.ts`:

- [ ] `todayTiles(day, hidden, isOwner)` returns tiles in the order Søvn, Aktivitet, Skridt, Cyklus:
  - a hidden metric produces **no tile** (not a blank tile);
  - `null` produces a tile with `value: null`, rendered as "Ingen data i nat" for sleep and "Ingen data i dag" for activity and steps;
  - Cyklus produces a tile only when the person has a cycle value or a period log, and it is not hidden;
  - activity is `Math.round(progress * 100) + '%'`, and values above 100 % are shown as they are;
  - steps use Danish grouping (`6.420`).
- [ ] `freshness(days, today)`: if the newest day is not `today`, today's tiles are `null` (never yesterday's values shown as today's; main spec §4.6), and the source line still shows the real last sync time.
- [ ] `trend(days, today, metric)` returns 7 entries ending today, `{ date, letter, value | null, isToday }`, with `average` rounded over non-null values only. When every value is `null`, the result is `null` and the chart is not drawn.
- [ ] `sourceLine(sources)` → "Oura · synk. 19.45", or two sources joined with " · ".
- [ ] `viewerCanSee(hidden)`: when every metric is hidden for the viewer, the panel shows the calm note "<Navn> deler ikke sine tal med dig." instead of empty tiles.

### Task 3: Switch primitive

- [ ] Vendor Radix `Switch` into `ui/switch.tsx` with token classes only (track `bg-sp-track`, checked `bg-sp-primary`, thumb `bg-sp-surface`, `shadow-sp-seg`), label slot, 44 px target, visible focus ring. The token-guard test must pass.

### Task 4: Sundhed view and Data panel

- [ ] `SundhedView`: `<h1 id="view-title">Sundhed</h1>` (focus target, same as other views) and a header action slot (idea 15 puts `+` there). Below it, the panel structure with `SegmentedPanel value="data"`. The `SegmentedControl` options list has only "Data" for now, and the control is hidden while it has one option.
- [ ] Person switcher: a `SegmentedControl` labelled "Person" with Camilla / Jonas, the signed-in person first selected by default. It drives the route (`#sundhed/data/<person>`) so idea 12 can deep-link and a refresh keeps the choice.
- [ ] `DataPanel` per mockup, top to bottom:
  1. Source line (`sp-small text-sp-muted`): "Oura · synk. 19.45".
  2. 2×2 tile grid (`MetricTile`): icon (lucide: `Moon` Søvn, `Activity` Aktivitet, `Footprints` Skridt, `CalendarHeart` Cyklus), label, value in `sp-stat-sm`. Cyklus shows "Dag 14".
  3. "Søvn, 7 dage" card with `TrendBars` and "Snit 80" on the right; then "Aktivitet, 7 dage" the same way, as a percentage of the goal.
  4. For the owner only: `SharingSettings`.
- [ ] `TrendBars`: seven bars in a fixed-height row, height proportional to the value (0–100 for sleep, 0–100 % capped visually at 100 for activity), `bg-sp-primary-tint` with today in `bg-sp-primary`; a missing day is a short dashed stub, not a zero bar. Weekday letters below (M T O T F L S). The chart is `aria-hidden`, and a visually hidden list gives "Fredag: 78" … for screen readers.
- [ ] Empty states: no source connected (owner) → "Forbind en enhed for at se dine tal her." with a button to the idea-10 connect sheet; no source (viewing the other person) → "<Navn> har ikke forbundet en enhed endnu."; loading → skeleton tiles; error → "Tallene kunne ikke hentes." + `Prøv igen`.

### Task 5: Sharing settings

- [ ] `SharingSettings` lists the owner's metrics with switches: "Vis min søvn for <navn>", "Vis min aktivitet for <navn>", "Vis mine skridt for <navn>", "Vis min cyklus for <navn>". Values come from `sp_health_sharing`; missing rows show as off.
- [ ] A change calls `setSharing(metric, shared)` (idea 10 repo), updates the UI optimistically, and on error reverts and shows `notify('Kunne ikke gemme. Prøv igen.')`. Turning a switch off takes effect immediately for the other member: `sp_health_for` reads the row on every call.
- [ ] Copy under the list: "Du bestemmer selv. Du kan ændre det når som helst."

### Task 6: Spec, backlog, verify, commit

- [ ] Main spec §5.4 / §5.4.1: describe the Data view, per-metric sharing (D40 as amended in idea 10), no interpretation; mark D38 explanations as deferred. UI spec §6: add the Sundhed screen anatomy.
- [ ] Backlog: D38 curated explanations deferred; goals, nutrition and training sections not yet on Sundhed.
- [ ] Verify (below). Suggested commit: `feat(strandparken): Sundhed data view`. Do not commit until roadmap Q9 is decided.

---

## Verification

- `node --test tests/`, `pnpm exec astro check`, `pnpm exec astro build`, `pnpm exec astro preview`.
- In the preview at 360 px and 520 px: tiles in a 2×2 grid, no horizontal scroll, text at 130 % size still fits (UI spec §9).
- As Camilla with cycle sharing off, sign in as Jonas: the Cyklus tile is absent (not blank), and the network response for `sp_health_for` has `cycle_day: null` with `hidden` containing it.
- Switch sharing off as the owner, reload as the other member: the metric disappears.
- With yesterday as the newest day: today's tiles say "Ingen data i nat", and the source line shows yesterday's sync time.
- Keyboard: switcher arrows, switches toggle with Space, focus visible; reduced motion: no bar animation.

## Acceptance criteria

- [ ] A person switcher at the top: Camilla / Jonas.
- [ ] Today: sleep score, activity progress, steps, and cycle day if available and allowed.
- [ ] A simple 7-day trend for sleep score and activity.
- [ ] Settings per member: which metrics the other member can see. Cycle data is private by default ("Vis min cyklus for [navn]").
- [ ] The source and last sync time are shown, e.g. "Oura · synk. 19.45".
- [ ] Calm style consistent with the rest of the app; numbers and trends only, with no medical interpretation or advice.
- [ ] The screen is the "Data" view, ready for idea 15's "Data" | "Vaner" switch.

## Open questions

1. **Order of the person switcher:** always Camilla, Jonas (as in the mockup), or the signed-in person first? Default: fixed order Camilla, Jonas, with the signed-in person selected.
2. **Activity trend unit:** percentage of goal (default) or steps?
3. **A second source per person** (Oura and HealthKit): show both names in the source line (default) or only the primary one?
