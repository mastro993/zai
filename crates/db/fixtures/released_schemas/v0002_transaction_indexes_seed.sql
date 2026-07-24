-- Synthetic finance rows only.
INSERT INTO transaction_categories (id, name, description, created_at, updated_at)
VALUES ('cat-indexes', 'Index category', 'Index fixture category', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

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
    'txn-indexes',
    'Index fixture transaction',
    1200,
    '2026-03-01 09:00:00',
    'expense',
    'cat-indexes',
    'Index fixture note',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
