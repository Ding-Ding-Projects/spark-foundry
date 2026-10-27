# Spark Foundry roadmap

## Implemented in source

The game has seven producers, seven research breakthroughs, six campaign chapters and an ending, endless continuation, prestige, four constellation abilities, two contracts, six achievements, and three optional side games. Local saves, migration from the starter save format, validated export/import, offline earnings, basic audio/motion preferences, responsive controls, and the searchable field guide are included.

The Windows alternative includes an Electron shell, Squirrel installer/update integration, an offline guide package, and a build companion. This is source implementation, not a claim that downloadable binaries or native runtime verification are complete.

## Release gates

1. Run local tests and the asset build against the final source; keep tests out of the CI build job.
2. Verify the expanded web interface, saves, campaign ending, optional games, keyboard navigation, interrupted confirmations, and phone-width layouts.
3. Publish the exact verified web commit and check the public site for the expanded content, working guide, and current assets.
4. Build Windows x64 installer and portable companions on Windows, record source/version, and generate checksums.
5. Verify clean installation, launch, save/export/import, close/restart, uninstall, build cancellation/retry, and an installed-version update to a newer version. Do not substitute source inspection for these checks.
6. Publish release artifacts and update-feed files only after reviewing their contents. Replace pending documentation with exact release links and evidence-backed status.

## Broader capability gaps

The following remain outside the implemented game feature set, not hidden or implicitly complete:

- English/Cantonese/bilingual interface coverage and independent tone controls.
- Setup/resume onboarding beyond a welcome card and local personalization import.
- Settings search, a full regex workbench, command palette, notification history, reversible action history, comprehensive exports, and bulk actions.
- Advanced appearance and accessibility tools and a comprehensive assistive-technology audit.
- A general local converter, local-model manager, and server manager.
- Code signing, broad Windows hardware/version testing, and physical phone testing.

These need their own implementation, security, usability, and verification work. No delivery dates are promised. Accounts, multiplayer, cloud sync, and authoritative anti-cheat are not included.
