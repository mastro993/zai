# Recurring transaction release gate

Issue #220 owns release evidence for recurring transactions. It adds no
migration. Missing schema belongs to issue #205.

## Fixed contracts

- Feed and occurrence pages default to 50 and cap at 100.
- Failure history defaults to 20 and caps at 100.
- Query cursors use stable descending keysets. Index and statement-count tests
  cover feed, due discovery, occurrences, provenance, and failure history.
- Processing slices allow at most 100 occurrence attempts and 50 milliseconds.
  Structural tests assert both values without wall-clock assertions.
- Tests use fixed fixture identities, `ManualClock`, explicit barriers, and
  database/core failpoints. The reference workload uses replayable seed `220`.

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
included. It uses a temporary SQLite directory and removes it after success.

## Completion evidence

```bash
pnpm check
pnpm test:e2e:web
pnpm benchmark:recurring
cargo test -p zai --lib native_recurring_workflow_smoke_boots_processes_and_resolves_links
```

The native smoke requires the workspace `dist/index.html` stub when run alone;
`pnpm check:backend` creates it as part of the backend gate.
