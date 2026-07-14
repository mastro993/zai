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

CREATE UNIQUE INDEX domain_alerts_producer_occurrence_unique
ON domain_alerts (producer_key, occurrence_key);

CREATE INDEX domain_alerts_canonical_traversal_index
ON domain_alerts (created_at DESC, id DESC);

CREATE INDEX domain_alerts_unread_lookup_index
ON domain_alerts (read_at)
WHERE read_at IS NULL;
