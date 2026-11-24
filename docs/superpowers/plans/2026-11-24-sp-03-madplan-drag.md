# Strandparken Idé 3: Flyt retter i Madplan med træk og slip — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In Madplan, a planned meal can be moved to another day by long-pressing and dragging it, including to another week. Dropping on an empty day moves the meal; dropping on a day that has a meal swaps the two. A normal tap still opens the meal's sheet and normal scrolling still works. The sheet also gets "Flyt til…" with a day picker that can reach other weeks.

**Architecture:** Use `@dnd-kit/core`, which is already a dependency (`/ferie`'s `plan/Plan.tsx` uses it with `PointerSensor` and `KeyboardSensor`). `MadplanView` wraps the day list in a `DndContext`. A `TouchSensor` with a 350 ms delay handles phones, a `MouseSensor` with a small distance handles desktops, and the `KeyboardSensor` covers keyboards. Each planned row is a draggable; each day row and the two week arrows are droppables. A `DragOverlay` renders the lifted card. The decision of what a drop means is a pure function, `dropOutcome`, tested in Node. Persisting reuses `moveEntry` and `swapEntries` from `lib/madplan/repo.ts`, which keep the row's id, so servings and linked shopping rows follow the meal. While a drag is active, the shown week is held in component state instead of the URL hash, so hovering a week arrow can switch week without unmounting the drag. The hash is updated once the drop is done.

**Source:** `docs/app_ideer_-_strandparken_rettet.docx`, Idé 3 (no mockup).
**Depends on:** nothing.
**Supersedes:** main spec §5.3.3 "Per day: … move or swap with another day" gains drag and drop and cross-week moves; UI spec §5.6 (day rows) and §8 (motion) gain the lifted state.
**Status:** Draft 2026-11-24. See the [roadmap](2026-11-24-strandparken-ideer-roadmap.md).

---

## Current setup (as found on 2026-11-24)

| Area | What the repo has | Consequence |
|---|---|---|
| Week view | `madplan/MadplanView.tsx`: the week comes from the hash (`#madplan` or `#madplan/<date>`); the ‹ › arrows are `<a href>` links; `DayRow` is a `<button>` that opens `DaySheet`; `usePlan(householdId, days[0], days[6])` loads one week. | The arrows must also be droppables. A hash change during a drag would re-render the week, so the drag holds its own week state. |
| Move and swap | `lib/madplan/repo.ts`: `moveEntry(id, toDate)` (one `update`), `swapEntries(a, b)` (park on `0001-01-01`, move, move back, with rollback). The date is unique per household. | Both work across weeks; no repository change is needed. |
| Sheet | `madplan/DaySheet.tsx`: "Flyt eller byt" lists the other six days of the visible week, with toasts and undo through `run()`. | Turn it into "Flyt til…" with a week switcher. |
| Toast | `ui/toast.tsx` `notify(message, { onUndo })`. MadplanView's `changed()` reloads and toasts. | Reuse it for "Flyttet til fredag · Fortryd". |
| Dates | `lib/madplan/dates.ts`: `addDays`, `mondayOf`, `weekDays`, `isoWeek`, `weekdayShort`, `longDate` (Copenhagen time, D53). | The toast's weekday name comes from a new `weekdayLong(iso)` (lower case: "fredag"). |
| Realtime | `sp_meal_plan_entries` is published with full replica identity. | The other phone sees the move without any extra work. |
| Haptics | iOS Safari has no `navigator.vibrate`. | Best effort per roadmap Q10. |
| Motion | `motion` is installed; the UI spec §8 requires reduced-motion support, and the base layer makes transitions instant. | The lift uses a CSS transform plus the shadow token, which the reduced-motion block already neutralises. |

## Files

**Create**

| File | Purpose | Task |
|---|---|---|
| `src/components/strandparken/lib/madplan/drag.ts` | `dropOutcome`, `moveMessage`, `edgeWeek` (pure) | 1 |
| `src/components/strandparken/lib/haptics.ts` | `tapHaptic()`: `navigator.vibrate?.(10)`, plus the iOS switch-input technique behind a feature check | 4 |
| `src/components/strandparken/madplan/WeekPicker.tsx` | Week arrows and seven day buttons, used by "Flyt til…" | 5 |

**Modify**

| File | Change | Task |
|---|---|---|
| `tests/strandparken-madplan.test.ts` | Tests for `drag.ts` and `weekdayLong` | 1 |
| `src/components/strandparken/lib/madplan/dates.ts` | `weekdayLong(iso)` | 1 |
| `src/components/strandparken/madplan/MadplanView.tsx` | `DndContext`, sensors, draggable and droppable rows, droppable arrows, `DragOverlay`, week held in state while dragging | 2, 3 |
| `src/components/strandparken/madplan/DaySheet.tsx` | "Flyt til…" with `WeekPicker` across weeks | 5 |
| `src/styles/strandparken.css` | `sp-row-lifted` (scale 1.03, `--sp-shadow-float`) and `sp-row-drop-target` (ring in `--sp-primary`, `--sp-primary-tint` ground) utilities | 3 |

## Data changes

None. `moveEntry` and `swapEntries` keep the row and its `servings`. Shopping rows point at the entry by `plan_entry_id`, so they follow automatically. Plan entries have no note field today; "keep notes" is satisfied because the whole row moves.

## Tasks

### Task 1: Pure drop rules
- [ ] Failing tests in `tests/strandparken-madplan.test.ts`:
  - `dropOutcome('2026-11-24', '2026-11-24', entries)` → `{ kind: 'none' }` (own day).
  - `dropOutcome(from, null, entries)` → `{ kind: 'none' }` (dropped outside a day).
  - The target day has no entry → `{ kind: 'move', to }`.
  - The target day has an entry → `{ kind: 'swap', with: entry }`.
  - A target date in another week works the same way, given that week's entries.
  - `moveMessage('move', '2026-11-27')` → `'Flyttet til fredag'`; `moveMessage('swap', …, otherTitle)` → `'Byttet med <titel>'`.
  - `weekdayLong('2026-11-27')` → `'fredag'`.
- [ ] Implement in `lib/madplan/drag.ts`:

```ts
export type DropOutcome = { kind: 'none' } | { kind: 'move'; to: IsoDate } | { kind: 'swap'; with: PlanEntry };
export function dropOutcome(from: IsoDate, to: IsoDate | null, entriesOfTargetWeek: readonly PlanEntry[]): DropOutcome
```

### Task 2: Sensors and draggable rows
- [ ] `MadplanView`: `useSensors(useSensor(TouchSensor, { activationConstraint: { delay: 350, tolerance: 8 } }), useSensor(MouseSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor))`. Before the delay the touch is an ordinary scroll or tap; moving more than 8 px cancels the long press, so scrolling is untouched.
- [ ] `DayRow` for a planned day uses `useDraggable({ id: entry.id, data: { date } })`. The draggable listeners sit on the existing `<button>`, so a tap still calls `onOpen`. dnd-kit suppresses the click after a real drag. Set `touch-action: manipulation` on the row; `none` would block scrolling.
- [ ] Every day row uses `useDroppable({ id: 'day:' + date })`. While a row is `isOver`, it gets `sp-row-drop-target`.
- [ ] `<DragOverlay>` renders a copy of the row with `sp-row-lifted`. The source row stays in place at 40 % opacity.
- [ ] `autoScroll` on `DndContext` (the default; set `threshold: { x: 0, y: 0.15 }`). Check that it scrolls the window: the shell has no inner scroll container (`AppShell` uses the page).
- [ ] Screen-reader announcements in Danish through `accessibility.announcements` (for example "Løftede Lasagne fra tirsdag", "Over fredag", "Flyttet til fredag", "Annulleret").

### Task 3: Drop, persist, toast, cross-week
- [ ] `onDragEnd`: `dropOutcome(...)`. For `move`, call `moveEntry(id, to)`; for `swap`, call `swapEntries(entry, other)`. Reload and `notify('Flyttet til fredag', { onUndo })`, or `'Byttet med Tacos'`. Undo calls the reverse (`moveEntry(id, from)`, or `swapEntries` again). Update the list optimistically and roll back with "Det lykkedes ikke. Prøv igen." on error.
- [ ] Week arrows become droppables (`'week:prev'`, `'week:next'`) and keep working as links. When an arrow has been hovered for 600 ms during a drag, the held week (`dragWeek` state) moves by ±7 days and `usePlan` loads that week. The overlay stays under the finger, and the timer restarts for another week. The source row can unmount with the old week; the drag continues because the overlay holds it. Test this specifically on iOS.
- [ ] On drag end or cancel, if `dragWeek` differs from the hash week, write it with `history.replaceState` and dispatch nothing (no scroll jump). The view now shows the week where the meal landed.
- [ ] Today's ring (`sp-ring-today`) and the `I dag` badge are unaffected.

### Task 4: Lift and haptic
- [ ] `sp-row-lifted`: `transform: scale(1.03); box-shadow: var(--sp-shadow-float);`. Under `prefers-reduced-motion` the scale is removed (keep the shadow), via the existing reduced-motion block in `strandparken.css`.
- [ ] `onDragStart` calls `tapHaptic()`: `navigator.vibrate?.(10)` on Android. On iOS, try the iOS 18 technique (toggling a hidden `<input type="checkbox" switch>` through its `<label>` triggers the system haptic). Keep it only if it fires reliably on both phones and causes no focus or scroll side effects; otherwise ship with the visual lift only.

### Task 5: "Flyt til…" in the sheet
- [ ] Rename the "Flyt eller byt" button to "Flyt til…". The panel shows `WeekPicker`: "Uge 48" with ‹ ›, then the seven days of that week. Each day reads "Tom" or "Byt med <titel>"; the meal's own day is disabled. The picker loads the target week through the same `loadEntries(from, to)`.
- [ ] Choosing a day runs the same `dropOutcome` → `moveEntry` or `swapEntries` path and the same toast, so both ways behave identically.
- [ ] Keyboard and screen readers use this as the alternative to dragging. dnd-kit's `KeyboardSensor` also works (space to lift, arrows, space to drop).

### Task 6: Specs, verify, commit
- [ ] Main spec §5.3.3: describe long-press drag, swap on drop, cross-week moves through the arrows, and "Flyt til…". UI spec §5.6 and §8: the lifted row, the drop-target highlight, and the reduced-motion rule.
- [ ] Backlog: add "Haptic on iOS is best effort" if the switch technique was dropped.
- [ ] Verify (below). Commit: `feat(strandparken): move meals in Madplan by drag and drop`.

## Verification

- `node --test tests/strandparken-madplan.test.ts`, `pnpm exec astro check`, `pnpm exec astro build`.
- `pnpm exec astro preview` on both phones (installed PWA):
  - A tap opens the sheet; a quick swipe scrolls; a long press (~⅓ s) lifts the row.
  - Drop on an empty day moves the meal; drop on a planned day swaps; drop on the same day or outside does nothing.
  - Dragging near the top or bottom edge scrolls the page.
  - Hovering › switches to the next week; dropping there moves the meal across weeks, and the other phone shows it within a few seconds.
  - The toast reads "Flyttet til fredag · Fortryd" and undo restores the meal.
  - Servings are kept; shopping rows for the meal show the new day once Idé 8 adds day tags.
  - Desktop: mouse drag works; with the keyboard, Tab to a row, Space, arrows, Space.
  - With reduced motion turned on, there is no scale animation.

## Acceptance criteria

- [ ] A long press (~350 ms) lifts the meal (slightly scaled up, with a light haptic tap on iOS where the platform allows). A normal tap still opens the meal's bottom sheet, and normal scrolling still works.
- [ ] While dragging, the day row under the finger is highlighted.
- [ ] Dropping on an empty day moves the meal; dropping on a day with a meal swaps the two; dropping outside a day or on its own day changes nothing.
- [ ] The page auto-scrolls near the top and bottom edges.
- [ ] Hovering over the week arrows (Uge 47 ‹ ›) switches week, so meals can move across weeks.
- [ ] The change is saved immediately, and portions and notes stay with the meal.
- [ ] After a move, a toast shows "Flyttet til fredag · Fortryd".
- [ ] The meal's bottom sheet has "Flyt til…" with a day picker, as an alternative to dragging.

## Open questions

1. **iOS haptic.** Safari offers no vibration API. Default: try the switch-input technique in Task 4 and keep it only if it is reliable; otherwise the lift is visual only, and the source document's "light haptic tap on iOS" is recorded in the backlog as not possible in a PWA.
