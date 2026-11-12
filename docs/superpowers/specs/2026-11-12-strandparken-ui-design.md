# Strandparken — UI Design Spec and Implementation Plan

**Status:** Direction chosen (D56). Ready for an implementation plan.
**Suggested repo path:** `docs/superpowers/specs/2026-11-12-strandparken-ui-design.md`
**Reference markup:** `docs/superpowers/specs/assets/strandparken-ui-reference.dc.html`
**Behaviour spec:** `docs/superpowers/specs/2026-11-11-strandparken-design.md` (called "the main spec" below)
**Spec language:** English. **UI copy:** Danish, exactly as written here and in the reference.

This document says how Strandparken looks. The main spec says what it does. Where the two disagree on appearance, this document wins; on behaviour, the main spec wins.

---

## 1. Direction

Mockup A, "Fotoforrest": white cards on a warm off-white ground, dish photography as the only strong colour, serif titles, deep green for actions. One change from the mockup as first shown: the bottom bar is the flat bar from mockup B. No item is raised, enlarged or filled.

Principles, in priority order:

1. **The photo carries the screen.** UI chrome is neutral; green is reserved for things you can press and for "today".
2. **One elevated thing per screen.** Cards are flat white on the off-white ground. Only the hero (tonight's dinner, the recipe photo) casts a shadow.
3. **Scannable in seconds.** One idea per card, one primary action per screen, never more than two lines of text in a row.
4. **Thumb-first.** Every control is at least 44 px; primary actions sit in the lower half or in a sticky bar.

Sources of truth, in order: this document → the reference markup (exact values) → the clickable mockup (feel and flow).

---

## 2. What the reference is and is not

The reference file is the source of mockup A in a canvas template format. It does not run on its own. Read it for exact inline CSS values, structure and Danish copy. Do not copy its code structure, its `{{ }}` template syntax, its `sc-if`/`sc-for` tags or its logic class.

| In the mockup | In the build |
|---|---|
| Dish "photos" are drawn plates on a coloured cloth | Real photos, cropped to fill (`object-fit: cover`). The plate drawings are stand-ins only. |
| Sample recipes, prices, health numbers and names | Real data. Nothing from the sample set ships. |
| Inline styles on every element | Tokens and components (§3, §5). No raw hex values in components. |
| Hand-drawn icon paths | `lucide-react` at 22 px, stroke width 1.8 (§5.14). |
| No empty, loading or error states | Required for every view (§7). |
| No toast and no undo | Required (§5.13). |
| Fixed 390 × 844 frame | Fluid from 360 px wide; centred column on larger screens (main spec D28). |
| Google Fonts link | Self-hosted fonts (§3.2). |

---

## 3. Tokens

Define these as CSS custom properties on the `/strandparken` root element in `src/styles/strandparken.css`, scoped so `/ferie` is untouched (main spec D26). Map them into Tailwind using whichever mechanism the repository's Tailwind version uses, and point the shadcn/ui theme variables at them inside the same scope so shadcn components inherit the look.

### 3.1 Colour

| Token | Value | Use |
|---|---|---|
| `--sp-bg` | `#F5F1E8` | Page ground, sheets, bottom bar |
| `--sp-surface` | `#FFFFFF` | Cards, rows, fields |
| `--sp-ink` | `#1B2620` | Text |
| `--sp-muted` | `#5C6259` | Secondary text, inactive navigation |
| `--sp-primary` | `#1F4D3A` | Primary buttons, active states, checked boxes, "I dag" |
| `--sp-on-primary` | `#FFFFFF` | Text and icons on primary |
| `--sp-primary-tint` | `#E8EFE6` | Step numbers, positive badges, explanation boxes |
| `--sp-track` | `#E9E3D4` | Segmented-control track, "Idé" tag, photo placeholder |
| `--sp-line` | `#E6E0D2` | Rules, bottom-bar border |
| `--sp-line-soft` | `#EFEADD` | Row separators inside cards |
| `--sp-dash` | `#A8A291` | Dashed outlines (empty day, idea card), unchecked box border |
| `--sp-danger` / `--sp-danger-tint` | `#7A2A16` / `#F6DFD6` | Overdue text and badge |
| `--sp-jonas` / `-tint` / `-ink` | `#2F6690` / `#EDF2F6` / `#24506F` | Jonas: avatar, tiles, labels |
| `--sp-camilla` / `-tint` / `-ink` | `#96486A` / `#F5ECF0` / `#7A3856` | Camilla: avatar, tiles, labels |
| `--sp-scrim` | `rgba(27, 38, 32, 0.45)` | Behind sheets |

The mockup uses two near-identical green tints and two near-identical tracks. The build uses the single values above.

### 3.2 Typography

Fonts: **Fraunces** (variable, weight 500, optical size automatic) for titles; **Figtree** (variable, 400–700) for everything else. Self-host both the way the rest of the site self-hosts fonts; if there is no existing approach, use the Fontsource variable packages. Fallbacks: `Georgia, serif` and `system-ui, sans-serif`.

| Role | Face | Size / line height | Use |
|---|---|---|---|
| `title-page` | Fraunces 500 | 32 / 1.1, tracking −0.01em | Tab titles, greeting |
| `title-recipe` | Fraunces 500 | 30 / 1.12, tracking −0.01em | Recipe title |
| `title-card` | Fraunces 500 | 24 / 1.15 | Sheet titles, tonight's dish, offer headline |
| `title-section` | Fraunces 500 | 20 / 1.2 | Section headings inside a tab |
| `title-group` | Fraunces 500 | 18 / 1.2 | Grocery category, link cards |
| `stat` | Fraunces 400 | 40 / 1.1 (large), 26 / 1.1 (small) | Health numbers |
| `body` | Figtree 400 | 15 / 1.4 | Default |
| `body-strong` | Figtree 500–600 | 15 / 1.4 | Row titles |
| `small` | Figtree 400 | 13.5 / 1.4 | Meta lines |
| `caption` | Figtree 400–600 | 12.5 / 1.35 | Sources, "from" lines, badges |
| `nav` | Figtree 600 | 11.5 / 1 | Bottom-bar labels |
| `button` | Figtree 600 | 14–16 | Buttons |
| `input` | Figtree 400 | 16 | Inputs (16 px stops iOS zooming on focus) |

Serif is for names of things (dishes, sections, screens). Never set body text, buttons or labels in Fraunces.

### 3.3 Shape, depth, space

| Token | Value | Use |
|---|---|---|
| `--sp-r-card` | 24 px | Cards and sections |
| `--sp-r-row` | 20 px | List groups, day rows, grid cards, fields that are not pills |
| `--sp-r-inset` | 16 px | Tiles inside a card |
| `--sp-r-sheet` | 30 px (top corners) | Sheets, recipe content sheet |
| `--sp-r-pill` | 999 px | Buttons, chips, steppers, segmented controls, search fields |
| `--sp-shadow-hero` | `0 12px 30px rgba(52, 60, 40, 0.12)` | Tonight's card only |
| `--sp-shadow-float` | `0 4px 12px rgba(40, 30, 15, 0.18)` | Floating round button over a photo |
| `--sp-shadow-seg` | `0 1px 3px rgba(0, 0, 0, 0.12)` | Active segment |

Spacing: page padding 28 px top, 20 px sides, 40 px bottom above the bar. Gap between sections 22 px on Hjem and 16 px elsewhere. Card padding 18 px. Grid gap 12 px. Row gap 8 px. Minimum row height 52 px; minimum touch target 44 × 44 px.

---

## 4. Layout

- One scrolling column per view. The bottom bar is fixed; content never sits under it.
- Width: fluid from 360 px. From 560 px and up, the column is centred at max 520 px (the recipe grid may widen to 960 px with more columns). The bar stays at the bottom at every width.
- Safe areas: add `env(safe-area-inset-bottom)` to the bar's height and to sticky action bars; add `env(safe-area-inset-top)` above page titles in the installed app.
- Overlays: the recipe page covers the whole view including the bar. Sheets slide up from the bottom over a scrim and never cover more than about 85 % of the height.

---

## 5. Components

Build these once in `src/components/strandparken/ui/`. Reuse shadcn/ui primitives where one exists (sheet or drawer, tabs, checkbox, toast) and restyle them through the tokens. Values not listed here are in the reference.

### 5.1 Bottom bar

Flat, from mockup B, in A's colours. Height 76 px plus the bottom safe area. Background `--sp-bg`, top border 1 px `--sp-line`, no shadow, no rounded corners. Five equal columns in this order: Hjem, Madplan, Indkøb, Sundhed, Opskrifter. Each item is one button filling its cell: icon 22 px above a `nav` label, 4 px apart. Inactive: `--sp-muted`. Active: `--sp-primary` plus a 2 px `--sp-primary` indicator along the top edge of the cell. No item differs in size, shape or fill.

### 5.2 Buttons

| Variant | Look | Use |
|---|---|---|
| Primary | Pill, `--sp-primary` fill, white text, min height 52 px (46 px inside cards) | One per screen: `Lav indkøbsliste`, `Læg på indkøbslisten`, `Vælg` |
| Outline | Pill, 1.5 px `--sp-primary` border and text, transparent | Secondary: `Tag opgaven`, `Nyt forslag`, `Til madplan`, `Sæt mål` |
| Quiet | Text only in `--sp-primary`, 600 | Tertiary: `Rediger`, `Ryd afkrydsede` |
| Icon | 44–48 px circle; white on the ground, primary fill for "add" | Back, close, add |

Pressed state: 4 % darker fill or a `--sp-track` wash. Focus: 2 px `--sp-primary` outline, 2 px offset. Disabled: 45 % opacity, no pointer.

### 5.3 Card

White, `--sp-r-card`, 18 px padding, no border, no shadow. Rows inside are separated by 1 px `--sp-line-soft`, never by boxes inside boxes.

### 5.4 Dish image

One component for every dish picture. Props: source, shape (`round` or `cover`), size. `cover` fills its box and crops from the centre. `round` is a circle (52 px in day rows, 56 px in the week strip, 64 px in pickers). Without a photo: `--sp-track` fill with the dish's first letter in Fraunces, `--sp-primary`. An empty slot (nothing planned) is a 1.5 px dashed `--sp-dash` circle with a plus.

### 5.5 Tonight card

A single button. Photo on top, 196 px tall, full width, `cover`. Below it on white: label `I aften` (13 px, 600, primary), dish name in `title-card`, meta line in `small` muted, and a primary pill `Se opskrift` at the right. Radius `--sp-r-card`, `--sp-shadow-hero`. Empty state: `--sp-track` ground, text "Ingen ret i aften", primary pill `Tilføj ret`.

### 5.6 Week strip and day rows

- **Week strip (Hjem):** four equal white tiles (`--sp-r-row`) for the remaining days: day and date in `caption` 600 muted, round dish image 56 px, dish name in 12.5 px on at most two lines.
- **Day row (Madplan):** a fixed 38 px date column outside the card (weekday 13.5 px 700, date 12.5 px muted; today's weekday in primary), then a white row, min height 64 px, `--sp-r-row`: round image 52 px, name in `body-strong`, meta in `caption`. Today has a 2 px primary ring and an `I dag` pill.
- **Empty day:** same height, 1.5 px dashed `--sp-dash`, centred plus and `Tilføj ret` in primary 600.

All seven rows, the title and the primary button must fit above the bar on a 390 × 844 screen.

### 5.7 Checkboxes, task rows, habit rows

- Task check: 26 px circle inside a 44 px target. Unchecked: white, 1.5 px `--sp-dash`. Checked: primary fill, white tick. A checked title is struck through and muted.
- Habit check: same, with a 9 px corner radius, so tasks and habits are told apart by shape.
- Task row: check, title and due line (overdue in `--sp-danger`), then either the claimer's avatar (30 px circle, person colour, white initial) or an outline `Tag opgaven`.
- Habit row: check, title, then a pill with the owner's name on the person colour (`Fælles` on primary).

### 5.8 Shopping row and add field

- Group: `title-group` heading, then a white group (`--sp-r-row`) of rows.
- Row: 26 px round check in a 44 px target, name in `body` 500 with the source dishes in `caption` muted below, amount at the right in 14 px muted. Min height 54 px. Checked rows are struck through.
- Add field: white pill, 50 px tall, placeholder `Tilføj vare`, with a 50 px primary circle button beside it.

### 5.9 Segmented control, chips, stepper

- **Segmented control:** `--sp-track` pill with 4 px padding; segments min height 44 px; active segment is white with `--sp-shadow-seg` and ink text; inactive is muted text. Used for `Alle | Aftensmadsidéer`, `Ingredienser | Fremgangsmåde | Næring`, and the three offer views.
- **Chip:** pill, min height 44 px, 16 px side padding, 14 px 600. Unselected: white, ink. Selected: primary fill, white.
- **Stepper:** primary-filled pill, 3 px padding; minus and plus are 44 px circles; the number sits between them in 17 px 700 white. Label `2 personer` to its left. Identical everywhere it appears.

### 5.10 Recipe card and idea card

- **Recipe card:** white, `--sp-r-row`, clipped. Photo 132 px tall, `cover`. Below: name in `body-strong` (two lines reserved), meta in `caption` muted. Two columns, 12 px gap.
- **Idea card:** same footprint, no fill, 1.5 px dashed `--sp-dash`; an `Idé` tag (pill on `--sp-track`) at the top and the idea in Fraunces 21 px at the bottom.

### 5.11 Recipe page

Top to bottom: photo 330 px tall, full bleed, `cover`, with a white 46 px back button floating at the top left (`--sp-shadow-float`). A white sheet overlaps the photo by 34 px with `--sp-r-sheet` top corners and 20 px side padding, containing: title (`title-recipe`), descriptor (muted), a three-cell stat row between two 1 px `--sp-line` rules with 1 px vertical rules between cells, the persons row with the stepper, the two personal-portion tiles when a goal applies (person tint ground, person ink label, `--sp-r-inset`), the segmented control, then the ingredient list (84 px bold amount column, 46 px rows, `--sp-line-soft` separators) or the steps (32 px `--sp-primary-tint` circle with the number in primary 700, text at 1.5 line height). A sticky white action bar, 84 px plus the safe area, holds an outline `Til madplan` and a primary `Læg på indkøbslisten` that takes the remaining width.

### 5.12 Sheets

Ground `--sp-bg`, `--sp-r-sheet` top corners, padding 22 / 20 / 26 px, a title in `title-card` with a 44 px white close button, scrim behind. Content inside uses white rows and cards. The four sheets: choose a dish (search pill, horizontal row of dish tiles, free-text chips `Rester` / `Ude at spise` / `Takeaway`, outline `Foreslå ret` that turns into a suggestion card with `Nyt forslag` and `Vælg`), offers (segmented control, headline, white list of name / shop / price, a caption stating what has no offer and when data was updated), add recipe (four white option rows), and the "har hjemme" review (same row style as the shopping list, all checked, primary `Læg på listen`).

### 5.13 Toast

A dark pill (`--sp-ink` ground, white text) above the bar, 4 seconds, with a `Fortryd` text button for destructive actions. One at a time.

### 5.14 Icons

`lucide-react`, 22 px, stroke 1.8, `currentColor`. Bottom bar: Home, CalendarDays, ShoppingBasket, Heart, BookOpen. Elsewhere: Plus, Minus, Check, ChevronLeft, ChevronRight, X, Percent, Clock. No emoji anywhere in the UI.

### 5.15 Avatars and badges

Avatar: circle with the person's photo from `public/ferie/avatars/`, or the initial in white on the person colour. Sizes 44 (header), 34 (card header), 30 (rows). Badge: pill, `caption` 600; overdue uses the danger pair, positive states use `--sp-primary-tint` with primary text.

---

## 6. Screens

Each list is top to bottom. Behaviour is in the main spec section named in brackets.

- **Hjem** (§5.6): date line and greeting with the avatar button at the right → tonight card → `Resten af ugen` with the week strip → `I dag` card (badge for overdue; task rows; `Vaner` sub-heading with `Rediger`; habit rows) → two link cards side by side, `Husholdning` and `Økonomi`, each with a one-line status.
- **Madplan** (§5.3.3): title at the left, week switcher pill at the right (‹ `Uge 46` ›) → seven day rows → primary `Lav indkøbsliste`.
- **Indkøb** (§5.3.4): title with the count line below ("3 af 12 varer er købt"), a white `Tilbud` pill at the right → add field → category groups in store-walk order → quiet `Ryd afkrydsede`.
- **Sundhed** (§5.4): title → Camilla's card (avatar, name, source and time, `Delt med Jonas` badge; two large stats split by a rule; explanation box on `--sp-primary-tint`) → Jonas's card (three small stats; one sentence of advice) → `Mål` card with one row per person → `Næring i aften` card.
- **Opskrifter** (§5.3.1, §5.3.2): title with a primary add button → segmented control → category chips (only under `Alle`) → two-column grid of recipe cards; under `Aftensmadsidéer`, dinner recipes followed by idea cards.
- **Opskrift** (§5.3.1): see §5.11.
- **Husholdning, Økonomi, settings:** not in the mockup. Build them from the same components: page title with a back button, cards with rows, one primary action.

---

## 7. States

Every view and card needs all four. None are in the mockup.

| State | Rule |
|---|---|
| Loading | Skeleton blocks in `--sp-track` with the final layout's shapes. No spinners on whole screens. |
| Empty | One sentence that says what belongs here and one button that adds it. Never a blank card. |
| Error | One sentence that says what failed and `Prøv igen`. The rest of the screen keeps working. |
| Offline | A slim `--sp-track` line under the title: "Offline – viser senest hentede". Indkøb stays fully usable (main spec D47). |

---

## 8. Motion

Motion only answers an action. Sheets slide up in 220 ms and the scrim fades; a tick fills in 120 ms; the recipe page slides in from the right in 220 ms. No entrance animations on load, no hover effects on cards. With `prefers-reduced-motion`, everything is instant.

---

## 9. Accessibility

- Text contrast at least 4.5:1 (3:1 from 24 px). The token pairs in §3.1 pass; do not introduce lighter greys.
- Real `<button>`, `<a>`, `<input>` with `<label>`. Icon-only buttons have an `aria-label` in Danish. The bottom bar is a `<nav aria-label="Hovedmenu">` and marks the current item with `aria-current="page"`.
- Sheets trap focus, close on Escape and return focus to the control that opened them.
- Person colours never carry meaning alone: the name or initial is always present.
- The layout holds with the system text size at 130 %.

---

## 10. Implementation plan

This covers main-spec slices 0.3 (design system) and 0.4 (app shell), then the screens as static views on fixture data so the look can be approved before the data layer exists. Each step is one small, closable piece of work.

| # | Step | Done when |
|---|---|---|
| U1 | Fonts and tokens | Fraunces and Figtree are self-hosted; all tokens in §3 exist as CSS variables scoped to `/strandparken`; Tailwind and shadcn/ui read from them; `/ferie` renders exactly as before. |
| U2 | Primitives | Button (four variants), Card, Avatar, Badge, Chip, SegmentedControl, Checkbox (round and square), Stepper, Field, Sheet, Toast and DishImage exist with focus, pressed and disabled states. |
| U3 | UI gallery | A development-only view shows every primitive in every state on the real ground colour. It is not included in the production build. |
| U4 | App shell | Bottom bar per §5.1, five hash routes, header avatar, centred column, safe areas, PWA manifest and icons. Refresh keeps the view. |
| U5 | Food components | TonightCard, WeekStrip, DayRow, EmptyDayRow, RecipeCard, IdeaCard, ShoppingGroup and ShoppingRow, AddItemField, built from primitives. |
| U6 | Static screens | Hjem, Madplan, Indkøb, Sundhed and Opskrifter render from one typed fixture file and match the reference at 390 px. |
| U7 | Recipe page and sheets | Recipe page per §5.11; the four sheets per §5.12; stepper scales fixture amounts. |
| U8 | States | Loading, empty, error and offline variants exist for every view and can be switched on in the gallery. |
| U9 | Checks | An automated accessibility scan passes on every view; screenshot baselines exist at 360, 390 and 768 px; the checklist in §11 is ticked. |

The fixture file in U6 is replaced screen by screen when the main-spec slices 1.1–1.5 connect real data. The components do not change at that point.

---

## 11. Acceptance criteria

- [ ] No component contains a raw colour, radius or font value; all come from tokens.
- [ ] The bottom bar has five items of equal size and shape, and the active item is marked only by colour and the top indicator.
- [ ] At 390 × 844, Hjem shows tonight's dinner without scrolling, and Madplan shows all seven days and `Lav indkøbsliste` without scrolling.
- [ ] The stepper, the checkboxes and the segmented control look and behave the same on every screen where they appear.
- [ ] A dish without a photo shows the letter placeholder, never a broken or empty image.
- [ ] Every interactive element is at least 44 × 44 px and reachable by keyboard with a visible focus ring.
- [ ] Every view has a loading, an empty and an error state.
- [ ] Nothing moves when `prefers-reduced-motion` is set.
- [ ] `/ferie` looks and behaves exactly as before the change.
- [ ] All UI copy is Danish and matches this document and the reference.
- [ ] Side-by-side with the mockup at 390 px, a screen differs only where §2 says it should.

---

## 12. Prompts for the coding agent

Put the three files in place first: the main spec and this document in `docs/superpowers/specs/`, the reference markup in `docs/superpowers/specs/assets/`. If you can, also export artboard A from the mockup canvas as images into the same `assets/` folder; screenshots help the agent judge proportions.

### 12.1 Planning prompt

```text
Read these files completely before doing anything else:

1. docs/superpowers/specs/2026-11-12-strandparken-ui-design.md  (visual source of truth)
2. docs/superpowers/specs/2026-11-11-strandparken-design.md     (behaviour; focus on §4.2, §4.3, §5.1, §5.2 and Phase 0 in §8)
3. docs/superpowers/specs/assets/strandparken-ui-reference.dc.html  (reference markup: read it for exact CSS values, structure and Danish copy; do not copy its template syntax, tags or logic)
4. AGENTS.md, and the existing /ferie implementation (page, components, styles, Tailwind and shadcn/ui setup, how fonts are self-hosted)

Then write an implementation plan for steps U1–U4 in §10 of the UI spec to docs/superpowers/plans/, following the existing plan convention in this repo. Do not write any application code yet.

The plan must:
- State which Tailwind and shadcn/ui versions the repo uses and how the tokens in §3 will be mapped in that setup, scoped so /ferie is unaffected.
- List every file to create or change.
- Break the work into small tasks, each with its own verification step.
- Name anything in the specs that is ambiguous or conflicts with the repo, as a question to me, instead of guessing.

Stop when the plan is written and summarise the open questions.
```

### 12.2 Execution prompt (after you have approved the plan)

```text
Execute the approved plan in docs/superpowers/plans/<plan file>, one task at a time.

Rules:
- The UI spec is the source of truth for appearance. Use tokens only: no raw hex colours, radii or font names inside components.
- Reuse shadcn/ui primitives where they exist and restyle them through the tokens; do not hand-roll a sheet, tabs or toast.
- The bottom bar follows §5.1 exactly: flat, five equal items, no emphasised item.
- Use real <button>, <a>, <input> and <label> elements; every icon-only button gets a Danish aria-label.
- Do not touch /ferie except for the shared sign-in extraction described in the main spec, and prove /ferie is unchanged.
- After each task: run the build and the tests, then check the result against §11 of the UI spec. Fix before moving on.
- Commit after each task with a message that names the step (for example "U2: primitives").

When U1–U4 are done, stop and show me the UI gallery and the app shell before starting U5.
```

### 12.3 Screen prompt (repeat per screen in U6 and U7)

```text
Build the <screen name> view as a static screen on fixture data, per §6 of the UI spec and the matching part of the reference markup.

- Compose it only from the components that already exist in src/components/strandparken/ui/ and the food components from U5. If a component is missing, add it there first.
- Fixture data lives in one typed file and uses the shapes from §6 of the main spec, so real data can replace it later without changing components.
- Include the loading, empty and error states from §7.
- Verify at 360, 390 and 768 px wide, then compare with the reference and list every remaining difference and whether §2 of the UI spec explains it.
```

### 12.4 Review prompt (use a fresh session)

```text
Review the /strandparken UI against docs/superpowers/specs/2026-11-12-strandparken-ui-design.md.

For each item in §11, say pass or fail with the file and line that proves it. Then list every raw colour, radius or font value found in src/components/strandparken/, every interactive element smaller than 44 px, and every view without loading, empty and error states. Do not fix anything; report only.
```
