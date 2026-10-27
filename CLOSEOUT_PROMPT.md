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
