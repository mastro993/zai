-- Synthetic finance and alert rows only.
INSERT INTO transaction_categories (id, name, role, created_at, updated_at)
VALUES ('cat-alerts', 'Alerts', 'spending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO transactions (
    id,
    description,
    amount,
    transaction_date,
    transaction_type,
    transaction_category_id,
    created_at,
    updated_at
)
VALUES (
    'txn-alerts',
    'Alert fixture transaction',
    4200,
    '2026-07-14 09:00:00',
    'expense',
    'cat-alerts',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
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
VALUES (
    'alert-release-fixture',
    'release.fixture',
    'fixture-1',
    'warning',
    'Fixture warning',
    'Synthetic alert retained during upgrade',
    NULL,
    NULL,
    CURRENT_TIMESTAMP,
    NULL
);
