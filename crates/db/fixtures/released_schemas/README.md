# Released schema fixtures

Immutable SQL snapshots of schema versions that may exist on user machines.
Each fixture is generated from Diesel migrations at commit `a05d5b8` and paired
with synthetic seed data in `*_seed.sql`.

## Policy

- Add a new fixture when a migration ships, not after a production failure.
- Never use a real user database as a writable fixture.
- Do not rewrite applied `up.sql` history; fix downgrade behavior in `down.sql`
  or add additive recovery migrations.
- Rollover downgrade (`0005_budget_rollover_modes/down.sql`) normalizes
  `previousPeriodOnly` and `cumulative` rows to `off` instead of refusing
  rollback mid-rebuild.

## Deferred follow-up

Application-managed pre-migration SQLite backups and post-migration integrity
gates at startup remain out of scope here. Track separately if product/security
requires automatic backup retention before `run_pending_migrations`.

## Regenerate schema snapshots

```bash
cargo test -p zai-db write_released_schema_fixtures -- --ignored
```
