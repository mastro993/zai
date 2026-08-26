# Releasing Zai

Zai ships desktop builds through one `Release` workflow with two channels. Both
channels run the same checks, commit a version to `main`, create a GitHub
Release, build the same platform artifacts, and publish signed updater
manifests to GitHub Pages.

## Channels

- **Nightly** runs from `main` every day at 05:00 UTC and by manual dispatch.
  Scheduled runs skip successfully when no non-release commit exists after the
  latest Nightly tag. Manual runs intentionally create another build. Nightly tags are
  `nightly-Y.M.D.B`; their GitHub Releases are prereleases named
  `Zai Nightly Y.M.D.B`.
- **Stable** runs only by manual dispatch from `main`. Stable tags are
  `Y.M.D.B`; their GitHub Releases are full releases named `Zai Y.M.D.B`.

All dates are UTC and unpadded. Both channels share one daily build sequence:
`B` starts at zero and increments the Release Version already committed on
`main`; a new UTC day resets it to zero. The committed value reserves a build
after failed-release cleanup removes its tag. `B` cannot exceed 999. Existing
tags are collision guards, not allocation state, and old tag formats are
intentionally ignored.

Nightly change detection excludes merge commits and release commits authored by
GitHub Actions. A manual Nightly always allocates a new build.

## Versions

The public **Release Version** is `Y.M.D.B`. Cargo, npm, and Tauri require
SemVer, so committed manifests use `Y.M.P`, where `P = D × 1000 + B`.

For example:

| Use | Version |
| --- | --- |
| UI, tag, release, artifact filename | `2026.8.25.1` |
| Cargo, npm, Tauri, updater comparison | `2026.8.25001` |

Every release commits the internal version to these files:

- `Cargo.toml`
- `Cargo.lock`
- `package.json`
- `apps/frontend/package.json`
- `apps/tauri/tauri.conf.json`

The commit is titled `chore(release): Y.M.D.B`. An annotated release tag points
at that exact commit. Versions remain committed after release; ordinary builds
therefore report the latest committed Release Version until the next release.

## Workflow modules

`release.yml` is the channel-agnostic orchestrator. Each phase has one focused
reusable workflow:

| Workflow | Responsibility |
| --- | --- |
| `release-detect-changes.yml` | Skip scheduled Nightlies without source changes |
| `release-prepare.yml` | Preflight, checks, version commit, tag, and draft release |
| `release-build-artifacts.yml` | Cross-platform signed artifact matrix |
| `release-publish.yml` | Complete-set validation, upload, and release publication |
| `publish-updater-manifests.yml` | Normal and recovery Pages publication |
| `release-cleanup.yml` | Compare-and-delete cleanup for failed drafts |

Comments above every workflow step state both operation and reason. Keep phase
internals in their owning reusable workflow; keep `release.yml` limited to job
ordering, permissions, inputs, and failure policy.

## Release sequence

GitHub Actions concurrency serializes Release workflow runs on `main`.

1. Verify required signing credentials and GitHub Pages configuration.
2. Run `pnpm install --frozen-lockfile` and `pnpm check` against the selected
   `main` commit.
3. Confirm `main` has not advanced. If it has, stop and require a fresh run.
4. Allocate the next Release Version from the version committed on `main`.
5. Update manifests, regenerate `Cargo.lock`, validate the exact changed-file
   set, commit, and atomically push `main` plus the annotated tag.
6. Create a draft GitHub Release.
7. Build and verify every platform artifact.
8. Attach the exact verified artifact set and publish the GitHub Release.
9. Reconstruct both updater channels from published GitHub Releases and deploy
   the complete manifest set atomically to GitHub Pages.

The workflow never rebases untested code into a release and never replaces an
existing tag or GitHub Release.

## Artifact contract

Every release must contain:

- macOS arm64: Developer ID signed and notarized app, DMG, Tauri updater archive,
  and updater signature;
- macOS x86_64: Developer ID signed and notarized app, DMG, Tauri updater
  archive, and updater signature;
- Linux x86_64: DEB, RPM, AppImage, and Tauri updater signature;
- Windows x86_64: NSIS installer and Tauri updater signature.

Windows Authenticode signing is not configured. Windows and SmartScreen may
show an unknown-publisher warning. Tauri updater signatures remain mandatory
and protect update integrity.

Any missing build, installer, updater archive, or updater signature fails the
release. Asset names must be unique, and the uploaded GitHub Release asset set
must exactly match the locally verified set.

## Failure behavior

- Existing generated tag or release: stop without replacing it.
- Version push failure: stop before creating the release.
- Draft creation, build, verification, or artifact upload failure: delete only
  the draft and tag created by that run. Keep the version commit on `main`;
  retry with a new build number.
- GitHub Pages publication failure: keep the already published release and tag.
  The previous Pages deployment remains active. Recover with the dedicated
  manifest workflow.

Cleanup uses compare-and-delete semantics. It refuses to delete a tag that has
changed or any release that is no longer a draft.

## Updater manifests

Tauri reads manifests from:

```text
https://mastro993.github.io/zai/updater/{{target}}.json
```

Pages contains one rolling manifest for each channel and target:

```text
updater/stable-macos-aarch64.json
updater/stable-macos-x86_64.json
updater/stable-linux-x86_64.json
updater/stable-windows-x86_64.json
updater/nightly-macos-aarch64.json
updater/nightly-macos-x86_64.json
updater/nightly-linux-x86_64.json
updater/nightly-windows-x86_64.json
```

Each file contains the internal SemVer, publication time, release note, updater
signature, and immutable GitHub Release asset URL. Before deployment, the
workflow validates every manifest and downloads every referenced asset URL.

Pages is a rebuildable projection. Each deployment generates the selected
channel from its new release, finds the latest published release in the other
channel, and regenerates that channel too. If the other channel has never
shipped, only the selected channel is present.

### Recover manifest publication

Run `Publish updater manifests` manually with the channel and exact existing
tag. Recovery requires a published, non-draft release whose prerelease state,
tag, complete artifact set, and signatures match the selected channel. It only
rebuilds and deploys Pages; it never changes `main`, a tag, or a release.

## Required secrets

Configure these under **Settings → Secrets and variables → Actions**:

| Secret | Value |
| --- | --- |
| `SSH_DEPLOY_KEY` | Private half of a write-enabled, repository-scoped deploy key allowed to bypass the `main` ruleset |
| `TAURI_SIGNING_PRIVATE_KEY` | Tauri updater private key file content |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Updater key password, when encrypted |
| `APPLE_CERTIFICATE` | Base64 Developer ID Application `.p12` |
| `APPLE_CERTIFICATE_PASSWORD` | `.p12` export password |
| `APPLE_SIGNING_IDENTITY` | Developer ID Application identity name |
| `APPLE_API_ISSUER` | App Store Connect API issuer ID |
| `APPLE_API_KEY` | App Store Connect API key ID |
| `APPLE_API_PRIVATE_KEY` | App Store Connect API `.p8` content |

The signing-key password is optional only for an unencrypted updater key.
Private values must never enter command arguments, logs, committed files, or
documentation.

`GITHUB_TOKEN` cannot push the version commit through the PR-only `main`
ruleset. Create a dedicated Ed25519 deploy key, add its public half under
**Settings → Deploy keys** with write access, allow deploy keys to bypass the
`main` ruleset, and store its private half as `SSH_DEPLOY_KEY`. Use this key only
for release version pushes.

Generate and store a Tauri updater key with:

```sh
pnpm tauri signer generate -w ~/.tauri/zai.key
gh secret set TAURI_SIGNING_PRIVATE_KEY < ~/.tauri/zai.key
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

The matching public key remains committed in `apps/tauri/tauri.conf.json`.
Rotate public and private updater keys together.
