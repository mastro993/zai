# Plan 002: Remove the Hardcoded Stronghold Vault Password

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report. When done, update the status row for this plan in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat 86edd88..HEAD -- src/lib/stronghold.ts src/lib/storage.ts src/routes/settings/playgrounds/index.tsx src-tauri/src/main.rs src-tauri/capabilities/default.json package.json src-tauri/Cargo.toml`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: `plans/001-establish-verification-baseline.md`
- **Category**: security
- **Planned at**: commit `86edd88`, 2026-06-11

## Why this matters

The Stronghold vault password is currently a frontend constant. Anyone with the app bundle or repository can recover it, which means the local vault is not meaningfully protected against offline access. This plan moves password material out of committed frontend code and adds a migration-safe access path without reproducing the existing secret value anywhere.

## Current state

- `src/lib/stronghold.ts` — wraps `@tauri-apps/plugin-stronghold`; contains a committed vault password constant at line 6. Do not copy the value into code review comments, logs, plans, commits, or issues.
- `src/lib/storage.ts` — defines a Stronghold-backed Zustand storage adapter; it currently initializes Stronghold directly for each operation.
- `src/routes/settings/playgrounds/index.tsx` — dev playground calls `Stronghold.init()` and manually saves after mutations.
- `src-tauri/src/main.rs` — initializes the Tauri Stronghold plugin with Argon2 and a salt file path.

Relevant excerpts with secret values redacted:

```typescript
// src/lib/stronghold.ts:4-6
const CLIENT_NAME = "zai-client";
const VAULT_FILE = `vault.hold`;
const VAULT_PASSWORD = "<hardcoded vault password>";
```

```typescript
// src/lib/stronghold.ts:38-48
static async init(): Promise<Stronghold> {
  const vaultPath = `${await appDataDir()}/${VAULT_FILE}`;
  const stronghold = await tauri.Stronghold.load(vaultPath, VAULT_PASSWORD);

  let client: tauri.Client;
  try {
    client = await stronghold.loadClient(CLIENT_NAME);
  } catch {
    client = await stronghold.createClient(CLIENT_NAME);
  }
  return new Stronghold(client, stronghold);
}
```

```rust
// src-tauri/src/main.rs:50-57
let salt_path = app
    .path()
    .app_local_data_dir()
    .expect("could not resolve app local data path")
    .join("salt.txt");

app.handle()
    .plugin(tauri_plugin_stronghold::Builder::with_argon2(&salt_path).build())?;
```

Repo conventions to match:

- Frontend Tauri wrappers live under `src/lib/` or feature `commands.ts` files.
- Tauri commands should be registered in `src-tauri/src/main.rs`.
- Rust command errors currently return `Result<_, String>`; keep the existing style unless Plan 001 or another accepted plan changes it.
- Use `pnpm lint` and `pnpm tsc:check`; after Plan 001 lands, use `pnpm check`.

## Commands you will need

| Purpose | Command | Expected on success |
| --- | --- | --- |
| Typecheck | `pnpm tsc:check` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Rust check | `cargo check --workspace` | exit 0 |
| Full baseline after Plan 001 | `pnpm check` | exit 0 |

## Scope

**In scope**:

- `src/lib/stronghold.ts`
- `src/lib/storage.ts`
- `src/routes/settings/playgrounds/index.tsx` only if its call site must pass a new initialization parameter
- `src-tauri/src/main.rs`
- `src-tauri/src/commands/` if adding a narrow command for password bootstrap is needed
- `src-tauri/src/commands/mod.rs` if a new command module is added
- `src-tauri/capabilities/default.json` only if a new permission is required
- `src-tauri/Cargo.toml` only if a Tauri-supported credential/keychain crate is required
- `package.json` only if a Tauri plugin package is required on the frontend side

**Out of scope**:

- Encrypting the main SQLite database; this is a larger threat-model decision.
- Removing the Stronghold playground; that is Plan 003.
- Rewriting all storage abstractions.
- Introducing cloud sync, user accounts, or passphrase UX.
- Committing any existing or new secret value.

## Git workflow

- Branch: `advisor/002-remove-hardcoded-stronghold-password`
- Commit message style: `fix: remove hardcoded stronghold password`
- Do not push or open a PR unless the operator explicitly asks.

## Steps

### Step 1: Choose a runtime password source

Implement the smallest secure runtime source available in this Tauri app. Prefer this order:

1. OS credential store/keychain via an official or well-maintained Tauri-compatible approach.
2. A Rust-side command that creates a high-entropy random password once, stores it in OS-protected storage, and returns it to the frontend only during Stronghold initialization.
3. If OS credential storage is not available without a larger product decision, STOP and report. Do not replace the hardcoded password with an environment variable or another committed constant.

The generated password must be high entropy and stable across app restarts for the same user profile, because it must reopen the existing vault.

**Verify**: `rg "VAULT_PASSWORD|Stronghold.load" src src-tauri` → the only `Stronghold.load` call should receive runtime-provided password material, not a string literal or committed constant.

### Step 2: Remove the committed frontend password

Delete the hardcoded password constant from `src/lib/stronghold.ts`. Change `Stronghold.init()` to obtain the password at runtime before calling `tauri.Stronghold.load`.

Acceptable target shape:

```typescript
static async init(): Promise<Stronghold> {
  const vaultPath = `${await appDataDir()}/${VAULT_FILE}`;
  const vaultPassword = await getStrongholdVaultPassword();
  const stronghold = await tauri.Stronghold.load(vaultPath, vaultPassword);
  // existing client load/create flow remains
}
```

Keep password values out of logs and errors. If a command fails, return a generic user-facing error.

**Verify**: `pnpm tsc:check` → exit 0.

### Step 3: Handle existing vault migration deliberately

Existing users may already have a vault encrypted with the burned committed password. Add a deliberate migration path:

- First try opening with the runtime password.
- If the vault does not exist, create it with the runtime password.
- If the vault exists but cannot be opened, STOP unless you can implement a safe one-time migration without exposing the old value.

Because the old password value is burned, a true migration may require a temporary legacy-open path. If you must reference the legacy value, do not write it in source again. Ask the maintainer for an explicit migration decision instead of improvising.

**Verify**: In dev, start the app with no existing `vault.hold`; Stronghold initializes successfully and creates a client. If testing with an existing vault requires the legacy value, STOP and ask for maintainer direction.

### Step 4: Ensure mutations persist

While touching Stronghold, fix the adapter persistence gap if still present:

```typescript
// src/lib/storage.ts:39-45
async setItem(name, storageValue) {
  const stronghold = await Stronghold.init();
  await stronghold.insert(name, JSON.stringify(storageValue));
}
async removeItem(name) {
  const stronghold = await Stronghold.init();
  await stronghold.remove(name);
}
```

Call `await stronghold.save()` after `insert` and `remove`, matching the playground's current pattern. This is in scope because it prevents a false sense of secure persistence.

**Verify**: `pnpm tsc:check` → exit 0.

### Step 5: Add focused tests or a manual verification script

If there is no frontend test runner yet, do not introduce one just for this plan. Instead, document a manual Tauri verification in the PR body:

- Remove or move aside the local dev `vault.hold`.
- Start the app.
- Exercise one Stronghold write/read path.
- Restart the app.
- Confirm the value can still be read.
- Confirm no password value appears in app logs.

If Plan 001 added a test runner or the repo already has one by execution time, add a pure unit test around the password-provider wrapper where possible, mocking Tauri invoke/keychain APIs.

**Verify**: `pnpm lint && pnpm tsc:check && cargo check --workspace` → all exit 0.

## Test plan

- If test infrastructure exists, add tests for:
  - `Stronghold.init()` requests password material from the runtime provider.
  - `createStrongholdStorage().setItem` and `.removeItem` call `save()`.
  - Failure paths do not log or throw the password value.
- If no test infrastructure exists, complete the manual restart persistence test described in Step 5 and record it in the PR.
- Final verification: `pnpm check` if Plan 001 has landed; otherwise run `pnpm lint`, `pnpm tsc:check`, and `cargo check --workspace`.

## Done criteria

- [ ] No hardcoded Stronghold vault password remains in `src/lib/stronghold.ts` or any other committed file.
- [ ] `rg "VAULT_PASSWORD|vault password|Stronghold.load" src src-tauri` shows no committed secret value and no string-literal password.
- [ ] Stronghold initializes with a runtime-provided high-entropy password.
- [ ] Existing vault migration behavior is explicitly handled or documented as a maintainer decision.
- [ ] Stronghold storage adapter saves after mutations.
- [ ] `pnpm lint` exits 0.
- [ ] `pnpm tsc:check` exits 0.
- [ ] `cargo check --workspace` exits 0.
- [ ] `plans/README.md` status row updated.

## STOP conditions

Stop and report back if:

- The code at the current-state excerpts no longer matches.
- You cannot use an OS-protected runtime credential store without broad architecture changes.
- Existing vault migration requires reintroducing the burned password into source code.
- You are tempted to use an environment variable, `.env`, a static salt, or another committed value as the vault password.
- A fix requires removing the playground route; that belongs to Plan 003.
- A verification command fails twice after a reasonable fix attempt.

## Maintenance notes

Reviewers should search the diff carefully for accidental secret disclosure. Even after this plan lands, the old committed value must be considered burned; if any real user data was protected by it, the maintainer should decide whether to rotate/re-encrypt or notify affected users. This plan does not solve SQLite database-at-rest encryption.
