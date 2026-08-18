CREATE TABLE __migration_assert (
    ok INTEGER NOT NULL CHECK (ok = 1)
);

INSERT INTO __migration_assert (ok)
SELECT CASE
    WHEN EXISTS (SELECT 1 FROM application_format) THEN 0
    ELSE 1
END;

DROP TABLE __migration_assert;

DROP TRIGGER IF EXISTS provider_rate_observations_immutable_delete;
DROP TRIGGER IF EXISTS provider_rate_observations_immutable_update;
DROP TRIGGER IF EXISTS provider_rate_sets_immutable_delete;
DROP TRIGGER IF EXISTS provider_rate_sets_immutable_update;
DROP TRIGGER IF EXISTS provider_contracts_immutable_delete;
DROP TRIGGER IF EXISTS provider_contracts_immutable_update;
DROP TABLE IF EXISTS provider_refresh_state;
DROP TABLE IF EXISTS provider_heads;
DROP TABLE IF EXISTS provider_rate_observations;
DROP TABLE IF EXISTS provider_rate_sets;
DROP TABLE IF EXISTS provider_contracts;
