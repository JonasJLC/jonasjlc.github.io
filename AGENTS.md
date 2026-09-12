# Agent Instructions for jonasjlc.github.io – Personal GitHub Pages site

## Summary

- Read this file before making changes in the repository.
- Read `README.md` for the public project structure and deployment context.
- Read `.github/workflows/site-check.yml` when changing files that affect CI verification.
- This repository is a static GitHub Pages site. Keep changes dependency free unless the task explicitly requires otherwise.

## Project structure

The root `index.html` is the personal landing page. Shared landing page styles and images live in `assets/`. A page-specific static site should live in its own directory, such as `gave/index.html`, and should reference shared assets with paths relative to that directory.

The `jeopardy/` directory contains generated build output. Do not edit files inside it directly. Changes to that app belong in the sibling source project described in `README.md`; regenerate the build through that project's deployment script.

## Must-follow rules

- Preserve the existing static hosting layout and use relative URLs that work when served from a subdirectory.
- Keep `index.html` and other pages valid, semantic HTML with a viewport meta tag, descriptive page metadata, and accessible link text.
- Reuse `assets/style.css` and existing visual conventions when adding pages. Add a page-specific stylesheet only when shared styles cannot express the page cleanly.
- Do not add a framework, bundler, or package dependency for a static page change.
- Do not commit secrets, private URLs, credentials, generated debug output, or large unrelated assets.
- Preserve unrelated working-tree changes and keep each change narrowly scoped.

## GitHub and git operations

The agent has access to the `gh` CLI and may use it to query and work with GitHub directly when the task requires it. Use `gh` for repository, issue, pull request, workflow, and related GitHub operations instead of guessing remote state. Do not send messages, create external changes, or perform other expansive GitHub actions unless the user has requested them.

Commit messages must follow this format:

```text
<type>(scope): <description>

[- body1
- body2
- body3]
```

Use a clean commit with the appropriate type, optional scope, and concise description. Never add `Co-authored-by: Claude`, `Co-authored-by: Codex`, or any similar AI co-author trailer to a commit. Commits must contain only the project's normal author information and the formatted message above.

## Editing conventions

Use two-space indentation in HTML and CSS. Keep content and labels consistent with the page language. Prefer clear class names, native HTML elements, and CSS media queries over JavaScript. Add JavaScript only for behavior that cannot be implemented with HTML and CSS, and keep it small and local to the page.

When linking from the root page to a subpage, use a directory URL such as `gave/`. From a subpage, use `../` for the root and `../assets/...` for shared assets. Test both root and subdirectory paths after changing links.

## Verification

Run the repository's static checks from the root before handing off a change:

```powershell
if (-not (Test-Path -Path index.html -PathType Leaf)) { throw 'index.html is missing' }
if (-not (Test-Path -Path assets/style.css -PathType Leaf)) { throw 'assets/style.css is missing' }
```

For page or style changes, open the affected HTML file in a browser and check desktop and narrow mobile layouts, navigation, asset loading, focus states, and the browser console. The GitHub Actions workflow runs the equivalent existence checks on pushes to `main` and pull requests.

## Deployment

Deployment is handled by GitHub Pages from the `main` branch. Follow the commit and push instructions in `README.md`. Do not edit generated `jeopardy/` output as part of landing-page work.
