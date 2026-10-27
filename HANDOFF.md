# Spark Foundry implementation handoff

## Current scope

This source expands the starter into a complete incremental campaign with optional side games and continued play, plus a Windows Electron packaging route. The phone/web edition remains supported. Read README.md for availability and docs.html for player-facing rules.

## Verification boundaries

Do not infer release success from source presence or a passing asset build. Record local tests, browser interaction checks, deployed-site checks, Windows packaging, clean installation, and real update-cycle testing separately. Windows release v1.5.1-run40585816616 was verified as normal and source-bound to b282549f6a6872f5361c974deacc9b1053ffa902, with all five artifact sizes and SHA-256 digests matching the downloaded source receipt. Native installation and update runtime remain unverified.

The expanded website has been deployed and checked. Cloud-browser evidence covers 320/390-pixel preview layouts, setup back/skip/resume, both optional puzzles, timing rewards, regex captures, and cooperative save transfer preserving a purchase between two tabs. Physical phone and native Windows execution remain separate, unverified stages.

## Commands and outputs

- `npm ci`: install locked desktop/build dependencies.
- `npm test`: local automated tests; run separately from build.
- `npm run build`: validate and build the seven public assets into `dist/`, without tests.
- `npm run desktop`: launch the Electron game after asset build.
- `npm run builder`: open Build Studio; operations require Windows.
- `build.bat` / `build-installer.bat`: Windows build/package entrypoints; inspect their current options before automation.
- Windows packaging targets the Squirrel game installer/update feed and portable builder/guide in `release/`.

## Important gameplay invariants

The ending requires all six chapter requirements in the current run and 5M stored energy after at least 15M earned. Side games, prestige and contracts are optional. Star spending must never reduce lifetime-star output power. A contract start resets the run without awarding stars; leaving it keeps the new run. Preserve permanent milestones and side-game cooldowns across supernova/contract starts. Only explicit erase removes permanent progress.

Version-1 starter saves migrate to version 2. Export/import must confirm replacement, reject malformed state, and preserve local-only privacy. Browser, local server, and desktop profiles are separate; no automatic sync is expected.

## Desktop release checks

Verify installer and package provenance, unsigned-publisher messaging, same-version installation behavior, uninstall, update failure/retry, ready/Later/restart, save acknowledgement before quitting, and update-feed correctness. Verify Build Studio uses a trusted source folder, reports actual process results, cancels child processes, and does not label partial output successful. Never claim these passed based solely on code inspection.

## Documentation ownership and public hygiene

Keep README.md, docs.html, ROADMAP.md and release notes aligned with actual shipped features. Replace pending availability only after checking the public URL and artifact. Public text must contain only professional product information: no private instruction material, personal data, local environment paths, credentials, or unpublished internal catalogues. Broader gaps are summarized in ordinary feature language in README.md and ROADMAP.md.
