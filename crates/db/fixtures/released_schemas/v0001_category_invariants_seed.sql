-- Synthetic finance rows only.
INSERT INTO transaction_categories (id, name, description, created_at, updated_at)
VALUES ('cat-invariants', 'Invariant category', 'Invariant fixture category', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO transactions (
    id,
    description,
    amount,
    transaction_date,
    transaction_type,
    transaction_category_id,
    notes,
    created_at,
    updated_at
)
VALUES (
    'txn-invariants',
    'Invariant fixture transaction',
    1100,
    '2026-02-01 09:00:00',
    'expense',
    'cat-invariants',
    'Invariant fixture note',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
