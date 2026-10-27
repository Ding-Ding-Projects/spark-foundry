# Spark Foundry

A small, self-contained incremental browser game about building a cosmic energy factory. Generate energy, automate production, unlock research, stabilize the reactor, and prestige for permanent star power.

- Responsive mouse, touch, and keyboard controls
- Four producer tiers with exponential costs and automatic production
- Per-run upgrades and permanent prestige bonuses
- Optional reactor timing challenge
- Versioned local saves, capped offline earnings, and validated export/import
- Sound off by default and reduced-motion support
- Searchable field guide in `docs.html`
- No runtime dependencies, accounts, third-party assets, ads, or purchases

## Play locally

Serve this directory over HTTP; JavaScript modules are not intended to run from a `file://` URL. With Python 3 installed:

```sh
python -m http.server 8080
```

Open `http://localhost:8080`. The same command works from `dist/` after building. You can use any equivalent static web server. The game stores progress in that browser and origin; local and published copies have separate saves.

## Test and build

Install Node.js 22 or newer. There are no package dependencies to install.

```sh
npm test
npm run build
```

Tests use Node's built-in test runner and cover the deterministic engine. The build runs tests, checks JavaScript syntax and HTML asset references, then copies an explicit allowlist of six public files into `dist/`. It does not copy environment files, repository metadata, source tests, or arbitrary local files.

On Windows, `build.bat` runs the same build. `build-installer.bat` intentionally reports that a desktop installer is not applicable and exits with code 1. This is a browser-only project, not a packaged desktop application.

## GitHub Pages

The deployable artifact is the contents of `dist/`. Publish those files to the root of a `gh-pages` branch and configure **Settings → Pages → Deploy from a branch → gh-pages / (root)**. This repository does not include a GitHub Actions workflow. Building alone does not publish the game; publication requires an authorized GitHub account and repository access.

All asset links are relative, so a GitHub Pages project subpath works without a custom base URL. No backend or secrets are required.

## Project structure

| File | Purpose |
| --- | --- |
| `index.html`, `style.css`, `app.js` | Game interface and browser integration |
| `engine.js` | Deterministic game rules and save validation |
| `engine.test.js` | Unit tests |
| `docs.html`, `docs.js` | Searchable player field guide |
| `scripts/build.mjs` | Validated, allowlisted static build |

## Save data and privacy

Progress stays in browser local storage. Export a save before clearing site data or switching devices. Offline production is capped at four hours. Save imports are validated but are not a security or anti-cheat mechanism: this is a single-player local game. There is no cloud save or multiplayer service. Reset removes local progress after confirmation; prestige is a separate mechanic that preserves permanent stars.

## Verification scope

`npm test` verifies engine behavior. `npm run build` additionally verifies source syntax and referenced public assets. Neither command alone proves browser rendering, accessibility, or a deployed site's availability; these require browser and deployment checks.
