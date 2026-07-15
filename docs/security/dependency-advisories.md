# Dependency advisory scanning

Zai scans checked-in lockfiles for known vulnerabilities before CI and release builds complete.

## Why not `pnpm audit`?

`pnpm audit` calls npm registry audit endpoints that now return HTTP 410. The legacy quick-audit API was retired. We scan `pnpm-lock.yaml` with [OSV-Scanner](https://google.github.io/osv-scanner/) against the [OSV database](https://osv.dev/) instead.

## Scanners

| Ecosystem | Lockfile | Scanner | Local command |
| --- | --- | --- | --- |
| JavaScript | `pnpm-lock.yaml` | OSV-Scanner v2.3.8 | `pnpm audit:frontend` |
| Rust | `Cargo.lock` | `cargo-deny` advisories (RustSec DB) | `pnpm audit:backend` |

Run both:

```bash
pnpm audit
```

## Failure policy

- JavaScript: fail on `HIGH` or `CRITICAL` advisories.
- Rust: fail on RustSec vulnerability and unsound advisories matched by `cargo deny check advisories`.
- Unmaintained crate notices are not release blockers in the current policy (`unmaintained = "none"` in `deny.toml`).

Scanner or database fetch failures fail the job. There is no silent pass on errors.

## Exceptions

Temporary accepts live in:

- `osv-scanner.toml` for JavaScript (`[[IgnoredVulns]]`)
- `deny.toml` for Rust (`[advisories].ignore`)

Each exception must include:

- exact advisory ID (`GHSA-…` or `RUSTSEC-…`)
- `owner=…` in the reason (JavaScript) or `owner=…` in the comment (Rust)
- expiry date (`ignoreUntil` in JavaScript, `# expires=YYYY-MM-DD` comment in Rust)
- rationale for acceptance

Validate unexpired exceptions:

```bash
node scripts/check-advisory-exceptions.mjs
```

Expired exceptions fail CI. Renew or remove them in a reviewed change. Do not add blanket permanent ignores.

Dependency upgrades that clear advisories should stay in separate PRs from scanner or exception-policy changes.

## CI and release gates

- `.github/workflows/ci.yml` runs `frontend-advisory` and `rust-advisory` in parallel with existing quality jobs.
- `.github/workflows/publish.yml` requires both advisory jobs before `publish-tauri` starts.

## Gate test

```bash
pnpm test:advisory-gate
```

The fixture under `test-fixtures/advisory-gate/` verifies HIGH-severity blocking logic without mutating production lockfiles.

## Maintenance

- Review scanner versions when upgrading CI tooling.
- Review exception expiry dates at least monthly.
- Keep advisory exceptions separate from bulk dependency upgrades for auditable risk decisions.
