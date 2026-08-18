ALTER TABLE transactions ADD COLUMN currency TEXT NOT NULL DEFAULT 'EUR'
    CHECK (length(currency) = 3 AND currency = upper(currency));

ALTER TABLE recurring_template_revisions ADD COLUMN currency TEXT NOT NULL DEFAULT 'EUR'
    CHECK (length(currency) = 3 AND currency = upper(currency));

CREATE TABLE application_format (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    format TEXT NOT NULL CHECK (format = 'multi-currency-v1'),
    activated_at TIMESTAMP NOT NULL
);

CREATE TABLE currency_settings (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    default_currency TEXT NOT NULL CHECK (
        length(default_currency) = 3
        AND default_currency = upper(default_currency)
    ),
    setup_completed_at TIMESTAMP
);

CREATE TABLE enabled_currencies (
    code TEXT PRIMARY KEY CHECK (
        length(code) = 3
        AND code = upper(code)
    ),
    enabled_at TIMESTAMP NOT NULL,
    disabled_at TIMESTAMP
);

CREATE TABLE transaction_exchange_rate_revisions (
    id TEXT NOT NULL PRIMARY KEY,
    transaction_id TEXT NOT NULL REFERENCES transactions (id),
    sequence INTEGER NOT NULL CHECK (sequence >= 1),
    variant TEXT NOT NULL CHECK (
        variant IN ('identity', 'automatic', 'manual', 'pending')
    ),
    rate_date TIMESTAMP,
    original_decimal TEXT,
    coefficient INTEGER,
    scale INTEGER,
    formula_version INTEGER NOT NULL CHECK (formula_version >= 1),
    created_at TIMESTAMP NOT NULL,
    UNIQUE (transaction_id, sequence),
    CHECK (
        (
            variant = 'identity'
            AND original_decimal IS NULL
            AND coefficient IS NULL
            AND scale IS NULL
        )
        OR (
            variant IN ('automatic', 'manual')
            AND original_decimal IS NOT NULL
            AND coefficient IS NOT NULL
            AND scale IS NOT NULL
        )
        OR (
            variant = 'pending'
            AND original_decimal IS NULL
            AND coefficient IS NULL
            AND scale IS NULL
        )
    )
);

INSERT INTO application_format (id, format, activated_at)
VALUES (1, 'multi-currency-v1', CURRENT_TIMESTAMP);

INSERT INTO enabled_currencies (code, enabled_at)
VALUES ('EUR', CURRENT_TIMESTAMP);

INSERT INTO currency_settings (id, default_currency, setup_completed_at)
VALUES (1, 'EUR', NULL);

INSERT INTO transaction_exchange_rate_revisions (
    id,
    transaction_id,
    sequence,
    variant,
    rate_date,
    original_decimal,
    coefficient,
    scale,
    formula_version,
    created_at
)
SELECT
    'txr-' || id,
    id,
    1,
    'identity',
    transaction_date,
    NULL,
    NULL,
    NULL,
    1,
    CURRENT_TIMESTAMP
FROM transactions;

CREATE TABLE __migration_assert (
    ok INTEGER NOT NULL CHECK (ok = 1)
);

INSERT INTO __migration_assert (ok)
SELECT CASE
    WHEN EXISTS (SELECT 1 FROM pragma_foreign_key_check) THEN 0
    ELSE 1
END;

DELETE FROM __migration_assert;

INSERT INTO __migration_assert (ok)
SELECT CASE
    WHEN (SELECT quick_check FROM pragma_quick_check LIMIT 1) = 'ok' THEN 1
    ELSE 0
END;

DROP TABLE __migration_assert;
