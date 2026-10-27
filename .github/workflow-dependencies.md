# Windows release dependency inventory

The jobs are `publication-language` and `release` in `workflows/release.yml`. Their target is Windows x64 on the explicit `windows-2022` hosted image. Repository-accessible self-hosted inventory was empty when this workflow was prepared; organization-wide runner visibility was unavailable. No unavailable self-hosted label is selected.

| Phase | Dependency | Declared source / installation |
| --- | --- | --- |
| Workflow bootstrap | GitHub Actions runner, Windows command processor, Windows PowerShell 5.1, TLS and archive facilities | Windows hosted-image platform contract; ordinary Windows built-ins |
| Checkout | `actions/checkout@v4` | Official GitHub action; full history, credentials not persisted |
| Build bootstrap | Node.js 24.22.1, MinGit 2.56.0.windows.4 | `build-manifest.json` pins canonical archives and SHA-256; `download-dependencies.bat /s` activates project-local tools |
| Build/package | npm plus locked Electron, electron-builder, Squirrel.Windows tooling | `package-lock.json`, canonical npm and Electron/builder upstream downloads; root build scripts |
| Publication policy job | Node.js 24.22.1 via official `actions/setup-node@v4`; Git supplied by checkout platform; same-repository trusted scanner checkout at protected `PUBLICATION_SCAN_POLICY_SHA` | Candidate is read as data only; protected policy goes to scanner stdin, outside candidate. Missing pin, data or scanner fails closed. No dictionary is stored in source or artifacts |
| Release publishing | GitHub CLI 2.103.3 | `scripts/release-tools.json`, canonical ZIP SHA-256; project-local `scripts/bootstrap-release.ps1` |
| Evidence retention | `actions/upload-artifact@v4` | Official GitHub action; explicit safe artifact allowlist, 14 days |
| Signing | None | Squirrel and portable outputs are unsigned; no certificate or timestamp service |

Every build uses exact root `build.bat /s`; every installer operation uses exact root `build-installer.bat /s`. Publication does not run tests or lint. Package shape, digest, exact-source association, normal-release state and downloadable bytes are publication/build evidence, not code-quality gates.

## Bootstrap proof status

The dependency inventory is hand-maintained and covers both jobs. A genuine fresh Windows run has **not** been observed. Local source/configuration checks are not a substitute for that proof. Windows PowerShell bootstrap recovery, cancellation, Squirrel installation and update lifecycle remain unverified. No clean-machine success is claimed.

Trusted scanner source deployment, a reviewed immutable `PUBLICATION_SCAN_POLICY_SHA` repository variable, and protected `PUBLICATION_LANGUAGE_DATA` remain provisioning requirements. The workflow invokes the supported trusted CI entrypoint; it does not supply a successful placeholder. Manual dispatch checks the current tree only, not history. Branch creation with an all-zero event base fails closed because prior publication is unknown. The only `needs` gate is this expressly required publication policy enforcement.

## Release evidence

`release/source.json` binds built outputs and SHA-256 to the clean source. The publisher verifies main lineage, immutable tag binding, normal release status, all required Squirrel/companion assets, and downloads every published asset for digest comparison. `release/publication.json` records successful read-back evidence. Timing begins at the first API-reported job start and ends after publication and downloadable-byte verification; notes are then amended to carry those measured values. A failed final metadata operation leaves the release visibly incomplete and the job nonzero; no tag or asset is overwritten.

Tests remain local. With no CI test gate, a release can ship a defect that a test would have caught; release status does not imply runtime verification.
