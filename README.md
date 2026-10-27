# Spark Foundry

[Play on web or phone](https://ding-ding-projects.github.io/spark-foundry/) · [Player field guide](https://ding-ding-projects.github.io/spark-foundry/docs.html) · [Source](https://github.com/Ding-Ding-Projects/spark-foundry) · [Releases](https://github.com/Ding-Ding-Projects/spark-foundry/releases)

Build a cosmic energy factory, complete a six-chapter campaign, and launch a beacon to relight the expanse. Keep building afterward in endless play, or start stronger runs through supernova. Three optional side games offer a break without blocking the campaign.

## What is included

- Seven producer tiers and seven research breakthroughs.
- Six campaign chapters, a playable ending, and continued endless progression.
- Supernova prestige, four permanent constellation abilities, two optional expedition contracts, and six achievements.
- Reactor resonance timing, Echo relay memory sequences, and Lightway conduit puzzles.
- Responsive mouse, touch, keyboard, and press-and-hold controls.
- Local saves, validated export/import, starter-save migration, and up to four hours of offline earnings.
- Sound off by default, reduced-motion preferences, and a searchable player handbook.
- Browser/phone play plus an Electron-based Windows desktop alternative sharing the same game assets.
- No accounts, ads, purchases, third-party game assets, or cloud-save service.

## Publication status

The public Pages site initially hosts the starter edition. Publication of the expanded version is pending verification. Windows packaging and update code is included in source, but no Windows installer, portable companion, or native Windows verification is claimed here. Consult official release notes for the actual published version and attached files; a source checkout is not a tested binary release.

## Start playing

Ignite the core to earn 12 J, buy a Spark collector in Build, then research Conductive gloves for 35 J. Follow the chapter objectives: each requires run earnings, a machine, and research. The final launch requires all six chapters and 5,000,000 J stored. Side games, supernova, and contracts are optional.

The [field guide](docs.html) covers every machine, research item, chapter, star ability, contract, achievement, puzzle, save control, and download limitation. Settings is the gear button. Export a backup before moving to another device or edition.

## Run the web game locally

With Python 3 installed, serve the repository or `dist/`:

```sh
python -m http.server 8080
```

Open `http://localhost:8080`. Do not double-click `index.html`: browser modules require HTTP hosting. The hosted site is not an installable native phone app and does not guarantee cached offline startup. The desktop edition bundles its own assets.

## Development and static build

Node.js 22 or newer is required for the source scripts. The web game has no third-party runtime dependencies; desktop development and packaging **do** require the locked npm dependencies, including Electron and electron-builder.

```sh
npm ci
npm test
npm run build
```

`npm test` runs local engine, gameplay, static, and available desktop-source checks with Node's test runner. **`npm run build` does not run tests.** It validates asset existence, JavaScript syntax and HTML references, fingerprints asset URLs, and copies an explicit seven-file public allowlist to `dist/`. It excludes repository metadata, private configuration, tests, and arbitrary local files.

```sh
npm run desktop  # launch the game after building dist/ and installing dependencies
npm run builder  # launch Build Studio; build operations require Windows
```

## Windows desktop alternative

The desktop application uses Electron, not a separately rewritten native game engine. Windows x64 packaging is designed to produce:

| Output | Purpose | Current status |
| --- | --- | --- |
| `release/game/squirrel-windows/SparkFoundrySetup.exe` | Unsigned Squirrel.Windows game installer | Packaging source; binary and Windows install verification pending |
| `release/game/squirrel-windows/RELEASES` and `*-full.nupkg` | Squirrel update feed and package | Publication and end-to-end update verification pending |
| `release/builder/SparkFoundryBuilder-VERSION.exe` | Portable build companion | Packaging source; Windows execution pending |
| `release/guide/SparkFoundryGuide-VERSION.exe` | Portable offline handbook | Packaging source; Windows execution pending |

On a trusted Windows source checkout, use `build.bat` for build preparation and `build-installer.bat` for packaging. Build Studio provides source-folder selection, build/run/installer actions, output logs, cancellation, and retry feedback. Only select source you trust: build scripts execute code from that folder. Initial dependency/bootstrap downloads require internet access. Packaging is Windows-only; a successful static build on another platform does not produce an installer.

When an installer is published, download it only from the official Releases page and check its release notes and checksum. Binaries are unsigned; Windows may report an unknown publisher. Do not disable security protections for an untrusted download. Browser and desktop saves are separate; transfer progress using Export save and Import save.

The installed Windows game is designed to check the official HTTPS Squirrel feed after startup and every four hours. It offers status, retry, Later, release notes, and a save-confirmed restart. Portable companions and development runs do not install updates. These flows still require actual Windows installation and update-cycle verification.

## Availability and gaps

| Area | Available in source | Not complete or not verified |
| --- | --- | --- |
| Gameplay | Full six-chapter loop, ending, endless play, progression and three side games | Broad long-session balance and physical-device playtesting |
| Web and phone | Responsive controls, local saves, preview widths | Expanded deployment verification; native phone application; guaranteed offline website startup |
| Desktop delivery | Electron shell, build UI, Squirrel packaging/update integration, portable guide | Published binaries, Windows installation/uninstallation, restart/update/cancellation runtime verification; code signing |
| Language and writing preferences | English interface | Cantonese and bilingual coverage; independent tone controls |
| Setup and personalization | Game welcome card and basic settings | Real setup/resume onboarding; local personalization import |
| Productivity controls | Searchable handbook and game-specific confirmations | Settings search, full regex workbench, command palette, notification history, reversible action history, comprehensive exports and bulk actions |
| Appearance and accessibility | Responsive layout, keyboard controls, zoom and reduced motion | Advanced customization and accessibility tools; comprehensive assistive-technology audit |
| Local utilities | Game save import/export | General converter, local-model manager, and server manager |
| Online services | None needed for core gameplay | Cloud sync, multiplayer, accounts, authoritative anti-cheat |

The complete game loop does not mean every broader application capability is implemented. See [ROADMAP.md](ROADMAP.md) for remaining work.

## Deployment and verification

`dist/` is the public website artifact. Asset links are relative and work under a GitHub Pages project subpath. Publishing requires authorized repository access; building alone does not deploy. Local tests do not prove browser rendering, accessibility, release availability, or Windows runtime behavior. Deployment and platform checks must be recorded separately for the exact published commit.

`preview.html` offers live 320, 390, and 430-pixel browser frames. It shares the same-origin save and is not physical touch hardware or Safari emulation.

## Project map

| Files | Purpose |
| --- | --- |
| `index.html`, `style.css`, `app.js` | Game interface and browser integration |
| `engine.js` | Deterministic game rules and save validation |
| `*.test.js` | Local automated checks |
| `docs.html`, `docs.js` | Searchable player handbook |
| `desktop/` | Desktop shell, preload, packaging configuration and build companion |
| `scripts/`, `build.bat`, `build-installer.bat` | Asset build and Windows build/package entrypoints |
| `ROADMAP.md`, `HANDOFF.md`, `CLOSEOUT_PROMPT.md` | Public implementation and release handoff |

## Privacy and saves

Progress stays in local storage for the current browser profile/origin or desktop profile. No automatic device sync exists. Reset erases permanent progress after confirmation; supernova preserves permanent progression. Export backups before clearing data. Save validation protects state structure, not competitive integrity: this is a local single-player game.
