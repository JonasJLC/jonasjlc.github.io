# Agent Instructions for jonasjlc.github.io

## Project

This is a static Astro 5 site deployed to GitHub Pages from `main`. Read `README.md` before changes. Keep changes dependency free unless the task explicitly requires a dependency.

The public landing page is `src/pages/index.astro`; its editable content is `src/content/site.ts`. Shared components and styles are in `src/components/` and `src/styles/`. The private gift reveal is `src/pages/gave/index.astro`, with editable content in `src/content/gift.ts`, browser behavior in `src/scripts/gave.ts`, and page-specific styling in `src/styles/gave.css`.

`public/jeopardy/` contains generated output from the sibling Jeopardy project. Do not edit it directly. Optional gift images belong in `public/gave/assets/` and must be locally hosted and optimized.

## Rules

- Preserve the Astro static-hosting layout and use generated Astro asset URLs instead of hardcoded bundle names.
- Keep HTML semantic, responsive, and accessible. Every page needs a viewport tag and descriptive metadata.
- Do not link the public homepage to `/gave/` unless explicitly asked.
- Do not add frameworks, client islands, runtime dependencies, secrets, private URLs, generated debug output, or unrelated assets.
- Preserve unrelated working-tree changes. Stage only files belonging to the task.
- Read `.github/workflows/pages.yml` when changing CI; it installs with the frozen lockfile, runs the Astro build, and verifies `dist/gave/index.html`.

## Git and deployment

The owner authorizes coherent commits and pushes directly to `main` for requested work. Verify each checkpoint before pushing it. Do not force-push or overwrite unrelated work. Commit messages use:

```text
<type>(scope): <description>

[- body]
```

Do not add AI co-author trailers. GitHub Pages deploys the `dist/` artifact after a successful push to `main`; verify workflow status separately when deployment status matters.

## Verification

Use Node 20+ and pnpm 10.33.2. In native PowerShell, set `$env:ASTRO_TELEMETRY_DISABLED = '1'` and run `pnpm exec astro check`, `pnpm exec astro build`, and `pnpm exec astro preview` rather than package scripts that use POSIX environment assignments. Run `pnpm install --frozen-lockfile` before local checks when dependencies are absent.

For `/gave/`, test the preview at `/gave/` and `/gave`; desktop and narrow layouts; keyboard focus; reduced motion; answer and hint paths; refresh recovery; restart; local-storage failure; and browser console output. Confirm `dist/gave/index.html` is nonempty after a build.
