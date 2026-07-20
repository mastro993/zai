CREATE TABLE __migration_assert (
    ok INTEGER NOT NULL CHECK (ok = 1)
);

INSERT INTO __migration_assert (ok)
SELECT CASE
    WHEN EXISTS (SELECT 1 FROM recurring_transactions)
      OR EXISTS (SELECT 1 FROM recurring_schedule_revisions)
      OR EXISTS (SELECT 1 FROM recurring_template_revisions)
      OR EXISTS (SELECT 1 FROM recurring_occurrence_heads)
      OR EXISTS (SELECT 1 FROM recurring_occurrences)
      OR EXISTS (SELECT 1 FROM recurring_generation_failures)
    THEN 0
    ELSE 1
END;

DROP TABLE __migration_assert;

PRAGMA foreign_keys = OFF;

DROP TABLE IF EXISTS recurring_generation_failures;
DROP TABLE IF EXISTS recurring_occurrences;
DROP TABLE IF EXISTS recurring_occurrence_heads;
DROP TABLE IF EXISTS recurring_template_revisions;
DROP TABLE IF EXISTS recurring_schedule_revisions;
DROP TABLE IF EXISTS recurring_transactions;

ALTER TABLE domain_alerts RENAME TO domain_alerts_new;

CREATE TABLE domain_alerts (
    id TEXT NOT NULL PRIMARY KEY,
    producer_key TEXT NOT NULL CHECK (length(trim(producer_key)) > 0),
    occurrence_key TEXT NOT NULL CHECK (length(trim(occurrence_key)) > 0),
    severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    body TEXT NOT NULL CHECK (length(trim(body)) > 0),
    destination TEXT,
    data TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP
);

INSERT INTO domain_alerts (
    id,
    producer_key,
    occurrence_key,
    severity,
    title,
    body,
    destination,
    data,
    created_at,
    read_at
)
SELECT
    id,
    producer_key,
    occurrence_key,
    severity,
    title,
    body,
    destination,
    data,
    created_at,
    read_at
FROM domain_alerts_new;

DROP TABLE domain_alerts_new;

CREATE UNIQUE INDEX domain_alerts_producer_occurrence_unique
ON domain_alerts (producer_key, occurrence_key);

CREATE INDEX domain_alerts_canonical_traversal_index
ON domain_alerts (created_at DESC, id DESC);

CREATE INDEX domain_alerts_unread_lookup_index
ON domain_alerts (read_at)
WHERE read_at IS NULL;

PRAGMA foreign_keys = ON;
