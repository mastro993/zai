# Recurring transaction release gate

Issue #277 owns release evidence for recurring transactions. It adds no
migration. Missing schema belongs to issue #205. Issue #220 established the
performance contracts retained here.

## Fixed contracts

- Feed and occurrence pages default to 50 and cap at 100.
- Failure history defaults to 20 and caps at 100.
- Query cursors use stable descending keysets. Index and statement-count tests
  cover feed, due discovery, occurrences, provenance, and failure history.
- Processing slices allow at most 100 occurrence attempts and 50 milliseconds.
  Structural tests assert both values without wall-clock assertions.
- Tests use fixed fixture identities, `ManualClock`, explicit barriers, and
  database/core failpoints. The reference workload uses replayable seed `220`.
- Release-evidence tests use replayable seed `277` for generated schedule
  properties, metamorphic schedule checks, lifecycle model transitions,
  exactly-once replay, revision boundaries, and bulk partial commits.

## Release-evidence matrix

The standard backend gate includes the complete released-schema fixture matrix
through `v0009_recurring_transactions`, transport parity, recursive privacy
canaries, and native Tauri smoke. The matrix preserves populated finance,
alert, and recurring rows while upgrading to head. No migration is added by
this gate.
Native smoke boots the application context with a fixed clock, registers the
production Tauri command handler in a headless mock runtime, and exercises
frontend-shaped IPC payloads plus forwarded processing events. It does not
call recurring core services directly.

## Reference workload

Run:

```bash
pnpm benchmark:recurring
```

The runner builds one fixed binary, creates 100 finite sources with 100 due
daily occurrences each using a deterministic seeded sequence and fixed local
clock, processes all 10,000 occurrences, and checks every persisted count. The
wrapper measures child working set from the runner's `READY` barrier (`vmmap`
physical footprint on macOS, `VmRSS` on Linux) and fails when processing
exceeds 60 seconds or working-set growth exceeds 64 MiB. Build time is not
included. It records platform, architecture, operating-system release, CPU
model, and host memory. It uses a temporary SQLite directory and removes it
after success.

The recurring benchmark runs in its own workflow after commits reach `main`.
It is not part of pull-request or functional CI checks.

## Completion evidence

```bash
pnpm check
pnpm test:e2e:web
pnpm benchmark:recurring
cargo test -p zai --lib native_recurring_workflow_smoke_boots_processes_and_resolves_links
pnpm --filter frontend exec vitest run src/features/recurring-transactions/commands/__tests__/native-adapter.test.ts
```

The native smoke requires the workspace `dist/index.html` stub when run alone;
`pnpm check:backend` creates it as part of the backend gate. No migration is
added or changed by this gate.
