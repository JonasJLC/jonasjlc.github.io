# jonasjlc.github.io

Personal landing page for the `jonasjlc` GitHub profile.

> Remember this project template: [https://github.com/alshedivat/al-folio](https://github.com/alshedivat/al-folio)

## 📁 Repository Structure

```
jonasjlc.github.io/
├── index.html           ← Main landing page
├── assets/              ← Landing page styles & images
│   ├── style.css
│   └── avatar.svg
├── jeopardy/            ← AI Jeopardy app (built files, DO NOT EDIT)
│   ├── index.html
│   └── assets/
└── README.md
```

## Getting started

- Open `index.html` locally in a browser to preview the static page.
- Update the hero text, project links, and contact details as needed.
- Customize the look and feel in `assets/style.css`. Fonts are loaded from Google Fonts; swap them out in the `<head>` block if preferred.
- Add images, icons, or downloadable assets to the `assets/` directory and reference them relative to the project root.

## 🎮 Jeopardy Subproject

The `jeopardy/` folder contains the **built** AI Jeopardy app.

> ⚠️ **Do NOT edit files in `jeopardy/` directly!** They are auto-generated from the source project.

### Where to make changes

| What | Where |
|------|-------|
| Landing page (jonasjlc.github.io) | Edit files in this repo directly |
| Jeopardy app (jonasjlc.github.io/jeopardy) | Edit source code in `../jeopardy/` and deploy |

### How to update the Jeopardy app

1. Make changes in the source project: `../jeopardy/src/`
2. Run the deploy script from the jeopardy project:
   ```powershell
   cd ..\jeopardy
   .\deploy.ps1
   ```
3. Changes will be live at https://jonasjlc.github.io/jeopardy

See the [jeopardy README](../jeopardy/README.md) for full documentation.

## Garmin redirect

The optional `garmin/` folder includes a simple HTML redirect to Garmin Connect. Replace the target URL if you host a static copy instead.

## 🚀 Deployment

Push the contents of this repository to the `main` branch. GitHub Pages will automatically serve the static site at https://jonasjlc.github.io.

```powershell
git add .
git commit -m "Your commit message"
git push
```

### Live URLs

| Page | URL |
|------|-----|
| Landing page | https://jonasjlc.github.io |
| Jeopardy app | https://jonasjlc.github.io/jeopardy |
