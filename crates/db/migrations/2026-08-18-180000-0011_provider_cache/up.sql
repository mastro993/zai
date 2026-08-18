CREATE TABLE provider_contracts (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL CHECK (provider = 'ECB'),
    version INTEGER NOT NULL CHECK (version >= 1),
    base_currency TEXT NOT NULL CHECK (
        length(base_currency) = 3
        AND base_currency = upper(base_currency)
    ),
    series_identity TEXT NOT NULL,
    value_date_time_zone TEXT NOT NULL,
    formula_version INTEGER NOT NULL CHECK (formula_version >= 1),
    created_at TIMESTAMP NOT NULL,
    UNIQUE (provider, version)
);

CREATE TABLE provider_rate_sets (
    id TEXT PRIMARY KEY,
    provider_contract_id TEXT NOT NULL REFERENCES provider_contracts (id),
    revision_identity TEXT NOT NULL,
    payload_digest TEXT NOT NULL,
    accepted_at TIMESTAMP NOT NULL,
    UNIQUE (provider_contract_id, revision_identity, payload_digest)
);

CREATE TABLE provider_rate_observations (
    id TEXT PRIMARY KEY,
    rate_set_id TEXT NOT NULL REFERENCES provider_rate_sets (id),
    currency TEXT NOT NULL CHECK (
        length(currency) = 3
        AND currency = upper(currency)
    ),
    series_id TEXT NOT NULL,
    value_date TEXT NOT NULL,
    original_decimal TEXT NOT NULL,
    coefficient INTEGER NOT NULL CHECK (coefficient > 0),
    scale INTEGER NOT NULL CHECK (scale >= 0),
    attribution TEXT NOT NULL,
    UNIQUE (rate_set_id, currency, value_date)
);

CREATE TABLE provider_heads (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    rate_set_id TEXT NOT NULL REFERENCES provider_rate_sets (id),
    switched_at TIMESTAMP NOT NULL
);

CREATE TABLE provider_refresh_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    provider_contract_id TEXT NOT NULL REFERENCES provider_contracts (id),
    last_attempt_at TIMESTAMP,
    last_success_at TIMESTAMP,
    failure_class TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0 CHECK (retry_count >= 0),
    last_etag TEXT,
    last_updated_after TEXT
);

CREATE INDEX provider_rate_observations_lookup
ON provider_rate_observations (rate_set_id, currency, value_date);

CREATE TRIGGER provider_contracts_immutable_update
BEFORE UPDATE ON provider_contracts
BEGIN
    SELECT RAISE(ABORT, 'provider_contracts are immutable');
END;

CREATE TRIGGER provider_contracts_immutable_delete
BEFORE DELETE ON provider_contracts
BEGIN
    SELECT RAISE(ABORT, 'provider_contracts are immutable');
END;

CREATE TRIGGER provider_rate_sets_immutable_update
BEFORE UPDATE ON provider_rate_sets
BEGIN
    SELECT RAISE(ABORT, 'provider_rate_sets are immutable');
END;

CREATE TRIGGER provider_rate_sets_immutable_delete
BEFORE DELETE ON provider_rate_sets
BEGIN
    SELECT RAISE(ABORT, 'provider_rate_sets are immutable');
END;

CREATE TRIGGER provider_rate_observations_immutable_update
BEFORE UPDATE ON provider_rate_observations
BEGIN
    SELECT RAISE(ABORT, 'provider_rate_observations are immutable');
END;

CREATE TRIGGER provider_rate_observations_immutable_delete
BEFORE DELETE ON provider_rate_observations
BEGIN
    SELECT RAISE(ABORT, 'provider_rate_observations are immutable');
END;

INSERT INTO provider_contracts (
    id,
    provider,
    version,
    base_currency,
    series_identity,
    value_date_time_zone,
    formula_version,
    created_at
)
VALUES (
    'ecb-exr-d-sp00-v1',
    'ECB',
    1,
    'EUR',
    'EXR.D.*.EUR.SP00.A',
    'Europe/Berlin',
    1,
    CURRENT_TIMESTAMP
);

INSERT INTO provider_refresh_state (
    id,
    provider_contract_id,
    last_attempt_at,
    last_success_at,
    failure_class,
    retry_count,
    last_etag,
    last_updated_after
)
VALUES (
    1,
    'ecb-exr-d-sp00-v1',
    NULL,
    NULL,
    NULL,
    0,
    NULL,
    NULL
);
