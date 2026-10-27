# Release closeout checklist

Use the final source revision, not an earlier intermediate build.

- Run local tests separately, then build assets without invoking tests in CI.
- Check the full campaign, ending/endless state, three optional games, permanent abilities, contracts, achievements, saves and starter-save migration.
- Exercise mouse, keyboard and phone-width flows, dialogs and cancellations, import/export, guide search and section navigation.
- Confirm the exact remote commit and deployed web content. Report failed or unrun checks explicitly.
- On Windows, build and verify the game installer, portable builder, and portable guide. Record version/source identity and checksums. Inspect packaging contents before publication.
- Perform a real clean install and update from an older installed version to a newer one. Check save-before-restart, Later, manual retry, offline failure, cancellation, and uninstall. Source checks are not native runtime tests.
- Verify public release attachments and update-feed files at their actual URLs. Do not describe an uploaded source archive as an installer.
- Update README.md and docs.html pending states only when corresponding publication or runtime evidence exists.
- Preserve the honest broader-feature gap list. A complete game loop is not evidence of complete application tooling, localization, onboarding, or platform verification.
- Finish with concise links, delivered features, verification results, and remaining blockers. Never expose private context, local paths, secrets, or private instruction catalogues in public content.

## Current continuation state (2026-10-27 UTC)

- Public repository and live game: Ding-Ding-Projects/spark-foundry; https://ding-ding-projects.github.io/spark-foundry/.
- Verified Windows baseline: https://github.com/Ding-Ding-Projects/spark-foundry/releases/tag/v1.5.1-run40585816616; exact source b282549f6a6872f5361c974deacc9b1053ffa902. Normal release, five required artifacts, exact tag source and artifact metadata verified; workflow also downloaded and hash-checked every asset.
- Local suite: 88 passing tests. Published web checks include phone-width layout, setup resume, three optional game rewards, regex captures, and switching save ownership between tabs while retaining a purchase. Actual physical-phone and Windows native behavior are not established by these checks.
- A current screenshot and provenance are included under screenshots/.
- Native installer/update/rollback/uninstall acceptance needs the selected Windows computer. Broader capability gaps remain in ROADMAP.md; do not label the complete requirements suite finished.
- External catalogue lookup is disabled unless ALLOW_PUBLIC_CATALOGUE_LOOKUP is explicitly enabled for an authorized public source. Missing catalogue identity never blocks installer publication.
- Preserve existing releases, saves and unrelated work. Never bypass warnings or treat an unsigned artifact as publisher-authenticated.

- Subsequent browser run reached all six chapters, 7/7 research, the beacon ending, home achievement and endless mode using normal UI controls from an existing synthetic test save. No fresh-save runtime claim is made.
