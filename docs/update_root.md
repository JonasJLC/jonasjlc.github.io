You're working in my personal site repo (Astro + pnpm, GitHub Pages, <https://jonasjlc.github.io/>). Goal: refresh the content so it reflects what I do now, and give it a modest UI/UX upgrade with a LaTeX-inspired typographic feel. Make surgical edits. Keep the existing architecture (single content file, project objects, static build). Do not rewrite wholesale.

## Step 0: Orient first (no edits)

1. Read: content file, layouts/components, global CSS, astro.config, package.json, deploy workflow.
2. Run `gh repo list jonasjlc --visibility public --limit 50` and read READMEs of the repos worth showcasing.
3. Reply with a short plan (files to touch, content changes, design tokens, open questions) and wait for my OK before editing.

## Facts about me (source of truth; don't invent beyond these)

- Jonas, Senior Automation & AI consultant at Columbus, Data & AI, working as both developer, consultant and platform architect. Based in Aarhus, Denmark (site currently says Copenhagen: fix).
- Focus areas: Microsoft Foundry platform, custom AI and governance; agent systems (multi-agent, etc.); infrastructure-as-code (Bicep); CI/CD (Azure DevOps, Github); RBAC/Entra ID; observability; moving teams from low-code (Copilot Studio/Power Platform) to pro-code.
- Earlier: ~4 years at Søstrene Grene, co-started its AI team. (Ask me before including.)
- Existing public items to keep: AI Jeopardy (/jeopardy/ URL must stay stable), this site, GitHub archive.

## Hard rules

- NEVER name clients or customers, or describe anything that identifies them. Describe work generically ("enterprise AI platform for critical infrastructure" at most, and ask me first).
- Only link public repos/URLs. Don't invent projects, metrics, dates, quotes, or testimonials. Unknown → mark as TODO in your plan and ask.
- Keep Method principles but propose updates as DRAFTS for my review (e.g. IaC-first, governance as code, small closeable increments, reusable frameworks over one-offs).

## Content changes

- Hero: replace the "Available for…" line with an accurate current-role line (confirm wording with me). Update tagline and location.
- Add a 3–4 line About.
- Add a "Focus" section (4–5 items from the focus areas above, one line each).
- Work: add worthwhile public repos found in Step 0. Each entry: title, year, status, one-line outcome, tags, link. No filler entries.
- Contact: fix the Email link (verify href/mailto); verify LinkedIn.
- Footer year computed at build time.
- Meta: proper description, OG title/description, canonical, `lang="en"`, favicon, sitemap + robots (@astrojs/sitemap).
- Non-goal: no i18n/Danish version now.

## UI/UX: LaTeX-inspired

- Aesthetic: academic-paper feel. Single column, ~65ch measure, numbered sections (1 Work, 2 Focus…), small-caps labels, hairline rules, tags styled like footnotes/marginalia. Keep the current warm off-white palette as the base token.
- Fonts: Latin Modern (LaTeX's default; Computer Modern family). Self-host woff2 via an npm package (e.g. Latin Modern Web, or the CM fonts shipped with KaTeX). Verify the licence permits web use. No runtime requests to Google Fonts.
  - Roman for body and headings, Mono for tags/meta, small caps via the font's caps cut or `font-variant-caps`.
  - Subset to Latin + Danish (æ ø å Æ Ø Å must render). `font-display: swap`, preload the primary face, system serif fallback stack with size-adjust to limit layout shift.
  - CM is thin on screens: body ~19–20px, line-height ~1.6, near-black text. Contrast ≥ WCAG AA.
- Dark mode via prefers-color-scheme, all colours as CSS variables.
- Visual-first: add ONE small inline SVG diagram (no libraries) showing the layers I work across (Agents / Platform / IaC & CI-CD / Governance). Keep text per section short.
- Details: visible focus rings, skip link, hover/active states, prefers-reduced-motion respected, mobile-first, minimal nav.
- No new JS or heavy dependencies unless essential.

## Process

- Work on branch `refresh-2026-11`. Small commits by concern: content → typography → layout → meta.
- `pnpm build` and `pnpm astro check` must pass. Preview with `pnpm preview`; if Playwright is available, screenshot at 375/768/1280px and summarise issues.
- Lighthouse target ≥ 95 on Performance, Accessibility, Best Practices, SEO.
- Do NOT push to main, change the deploy workflow, or touch /jeopardy/ without my approval.

## Final report

List: changes made, TODO placeholders I must fill, decisions I need to make.
