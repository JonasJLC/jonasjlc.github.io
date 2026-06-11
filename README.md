# Jonas JLC

Personal portfolio and project index for `jonasjlc`, built with Astro and deployed to GitHub Pages.

**Live site:** https://jonasjlc.github.io

## Updating the site

Most updates happen in one file:

```text
src/content/site.ts
```

Edit that file to change intro copy, links, highlights, or project cards. The page components render from that data, so adding a new project means adding one object to the `projects` array.

## Local development

**Requirements:** Node 20+, pnpm 10.33.2 (pinned via `packageManager` in `package.json`)

```bash
pnpm install
pnpm dev
```

Useful commands:

```bash
pnpm check       # TypeScript + Astro type check only
pnpm build       # Type check + build to dist/
pnpm preview     # Serve the built dist/ locally
```

## Repository structure

```
jonasjlc.github.io/
├── src/
│   ├── components/          - Page sections (Hero, ProjectList, Notes, Contact)
│   ├── content/site.ts      - Main update surface
│   ├── layouts/BaseLayout.astro
│   ├── pages/index.astro
│   └── styles/global.css
├── public/
│   ├── assets/avatar.svg    - Static assets
│   └── jeopardy/            - Built AI Jeopardy app (do not edit directly)
├── astro.config.mjs         - Sets canonical site URL for GitHub Pages
├── package.json
├── pnpm-lock.yaml
└── README.md
```

## Jeopardy subproject

The `public/jeopardy/` folder contains the built AI Jeopardy app, served at:

```text
https://jonasjlc.github.io/jeopardy/
```

Do not edit files in `public/jeopardy/` directly — they are generated from the source project.

| What | Where |
|------|-------|
| Portfolio content | `src/content/site.ts` |
| Portfolio layout/design | `src/components/`, `src/pages/`, `src/styles/` |
| Jeopardy app source | `../jeopardy/` |
| Built Jeopardy files in this repo | `public/jeopardy/` |

### How to update the Jeopardy app

1. Make changes in the source project: `../jeopardy/src/`
2. Run the deploy script from the jeopardy project:
   ```powershell
   cd ..\jeopardy
   .\deploy.ps1
   ```
3. Confirm built files land in `public/jeopardy/`
4. Commit the updated files in this repo

## Deployment

GitHub Actions builds the Astro site on every push to `main` and deploys the `dist/` directory to GitHub Pages. Pull requests run the build only (no deploy) to catch type errors and build failures early.
