# Releasing Zai

The `Release` workflow builds signed desktop artifacts for every supported
target before it publishes a tag or GitHub Release. Each run waits for older
incomplete runs of the same workflow before allocating a version. This native
API gate avoids GitHub Actions concurrency's single-pending-run cancellation
behavior.

## Channels

- **Nightly** runs daily at 05:00 UTC from `main` and can also be dispatched
  manually from any branch. It skips when the selected commit is already the latest Nightly,
  uses tag `nightly-vY.M.D.B`, release name `Zai Nightly vY.M.D.B`, and is a
  prerelease.
- **Stable** is manual-only and must be dispatched from `main`. It uses tag
  `vY.M.D.B`, release name `Zai vY.M.D.B`, and is a full release.

Both channels share the daily `B` sequence. The first build is zero; later
builds use the maximum build number found in matching Nightly and Stable tags
for the current UTC date plus one. `B` cannot exceed 999; the workflow fails
clearly instead of minting an incompatible version.

Stable dispatches validate that `main` was selected. Every job checks out the
exact trigger SHA, including Nightlies dispatched from another branch.
Scheduled releases likewise keep their trigger SHA even if `main` advances
while a run waits in the queue.

Allocation uses existing tags as its only history. Release tags must not be
deleted when their version numbers must remain reserved; deleting the maximum
tag for a date can make that number available for reuse.

Nightly notes are generated since the previous Nightly. Stable notes use
`release-notes/<tag>.md` when that file exists and otherwise are generated
since the previous Stable.

The canonical Release Version has four numeric components. Because Cargo, npm,
and Tauri require SemVer, build manifests use packed internal version `Y.M.P`,
where `P = D × 1000 + B`. For example, Release Version `2026.8.25.1` is built
internally as `2026.8.25001`. This preserves ordering and avoids prerelease
suffixes. Tags, GitHub Release names, release-note paths, and artifact
filenames keep the visible `Y.M.D.B` Release Version.

## Required repository secrets and variables

Open the repository on GitHub and go to **Settings → Secrets and variables →
Actions**. Add private values under **Secrets** and the updater public key under
**Variables**. With GitHub CLI, authenticate with `gh auth login`, change to
the repository directory, and use `gh secret set` or `gh variable set`.
Do not put private values directly in command arguments, shell history, logs,
or documentation.

| Secret                               | Value                                         |
| ------------------------------------ | --------------------------------------------- |
| `TAURI_SIGNING_PRIVATE_KEY`          | Tauri updater private key file content        |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Updater key password, if the key is encrypted |
| `APPLE_CERTIFICATE`                  | Base64 Developer ID Application `.p12`        |
| `APPLE_CERTIFICATE_PASSWORD`         | `.p12` export password                        |
| `APPLE_SIGNING_IDENTITY`             | Developer ID Application identity name        |
| `APPLE_API_ISSUER`                   | App Store Connect API issuer ID               |
| `APPLE_API_KEY`                      | App Store Connect API key ID                  |
| `APPLE_API_PRIVATE_KEY`              | App Store Connect API `.p8` file content      |

Add one repository variable:

| Variable                   | Value                                 |
| -------------------------- | ------------------------------------- |
| `TAURI_SIGNING_PUBLIC_KEY` | Tauri updater public key file content |

The workflow checks required secrets before starting platform builds.
`TAURI_SIGNING_PRIVATE_KEY_PASSWORD` is optional only when the updater key is
not encrypted.

### Tauri updater key

Generate the key once and back it up securely:

```sh
pnpm tauri signer generate -w ~/.tauri/zai.key
gh secret set TAURI_SIGNING_PRIVATE_KEY < ~/.tauri/zai.key
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD
gh variable set TAURI_SIGNING_PUBLIC_KEY < ~/.tauri/zai.key.pub
```

The password command prompts without exposing the password. Omit that secret
for an unencrypted key. The public key is safe to share and is embedded in the
release build because Tauri requires `plugins.updater.pubkey` when generating
updater artifacts. This workflow does not add the in-app updater runtime.

For the GitHub web form, copy the private key file content directly from a
trusted local editor into `TAURI_SIGNING_PRIVATE_KEY`.

### Apple Developer ID Application certificate

1. In **Keychain Access → Certificate Assistant**, create a certificate
   signing request.
2. In Apple Developer **Certificates, Identifiers & Profiles**, create and
   download a **Developer ID Application** certificate from that request.
3. Install it, then export the certificate and its private key from **My
   Certificates** as a password-protected `.p12`.
4. Find the identity name without exposing private material:

   ```sh
   security find-identity -v -p codesigning
   ```

5. Set the secrets through stdin or a prompt:

   ```sh
   openssl base64 -A -in DeveloperIDApplication.p12 | gh secret set APPLE_CERTIFICATE
   gh secret set APPLE_CERTIFICATE_PASSWORD
   gh secret set APPLE_SIGNING_IDENTITY
   ```

For the web form, use
`openssl base64 -A -in DeveloperIDApplication.p12 | pbcopy`, paste into
`APPLE_CERTIFICATE`, then clear the clipboard. Set the password and exact
identity name in their own secret fields.

The workflow imports the certificate into an ephemeral keychain, adds that
keychain to the user search list for Tauri and `codesign`, and removes the
keychain and certificate file after the build.

### App Store Connect notarization key

1. In App Store Connect, open **Users and Access → Integrations → App Store
   Connect API**.
2. Create a team key with **Developer** access.
3. Record the issuer ID and key ID, then download the `.p8` private key. Apple
   permits downloading it only once.
4. Set the values without printing the private key:

   ```sh
   gh secret set APPLE_API_ISSUER
   gh secret set APPLE_API_KEY
   gh secret set APPLE_API_PRIVATE_KEY < AuthKey_KEYID.p8
   ```

For the web form, paste the issuer ID and key ID into their fields and load the
`.p8` in a trusted local editor for `APPLE_API_PRIVATE_KEY`. During a macOS
build, the workflow writes it to a runner temporary file and sets
`APPLE_API_KEY_PATH`.

## Publication guarantees

The build matrix preserves macOS arm64 and x86_64, Linux x86_64, and Windows
x86_64 coverage. Tauri updater signatures are required on every generated
updater artifact. macOS builds require Developer ID signing and notarization.
Windows publishes the NSIS `.exe` without Authenticode signing on a best-effort
basis, so Windows and SmartScreen can show an unknown-publisher warning.

Each platform uploads a one-day workflow artifact. Only after every platform
succeeds does the publish job validate the complete set. macOS updater
archives and their matching signatures include both Release Version and
architecture in the filename. The workflow then creates a tag pointing to the
exact trigger SHA, assembles and verifies a draft GitHub Release, and publishes
it. Failed publication cleanup targets only the draft release ID and tag
created by that run; pre-existing tags and releases are never replaced or
deleted.
