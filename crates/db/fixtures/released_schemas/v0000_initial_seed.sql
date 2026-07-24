-- Synthetic finance rows only.
INSERT INTO transaction_categories (id, name, description, created_at, updated_at)
VALUES ('cat-initial', 'Initial category', 'Initial fixture category', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

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
    'txn-initial',
    'Initial fixture transaction',
    1000,
    '2026-01-01 09:00:00',
    'expense',
    'cat-initial',
    'Initial fixture note',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
