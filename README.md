# Jonas JLC

Personal portfolio and project index for `jonasjlc`, built with Astro and deployed to GitHub Pages.

## Updating the site

Most updates should happen in one file:

```text
src/content/site.ts
```

Edit that file when you want to change the intro copy, links, highlights, or project cards. The page components render from that data, so adding a new project should usually mean adding one object to the `projects` array.

## Local development

This project uses `pnpm`.

```bash
pnpm install
pnpm dev
```

Useful commands:

```bash
pnpm check
pnpm build
pnpm preview
```

## Repository structure

```
jonasjlc.github.io/
├── src/                 - Astro source files
│   ├── components/      - Page sections
│   ├── content/site.ts  - Main update surface
│   ├── layouts/
│   ├── pages/
│   └── styles/
├── public/              - Static files copied into dist
│   ├── assets/
│   └── jeopardy/        - Built AI Jeopardy app
├── astro.config.mjs
├── package.json
├── pnpm-lock.yaml
└── README.md
```

## Jeopardy subproject

The `public/jeopardy/` folder contains the built AI Jeopardy app and is served at:

```text
https://jonasjlc.github.io/jeopardy/
```

Do not edit files in `public/jeopardy/` directly if they are generated from the source project.

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
3. Make sure the built files land in `public/jeopardy/`
4. Run `pnpm build` here before committing

## Deployment

GitHub Actions builds the Astro site and deploys the `dist/` directory to GitHub Pages on pushes to `main`. Pull requests run the same build without deploying.
