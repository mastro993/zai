-- Source commit: a05d5b8 (2026-07-15). Synthetic finance rows only.
INSERT INTO transaction_categories (id, name, role, created_at, updated_at)
VALUES
    ('cat-root', 'Household', 'spending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('cat-child', 'Groceries', 'spending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

UPDATE transaction_categories
SET parent_id = 'cat-root'
WHERE id = 'cat-child';

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
    'txn-1',
    'Weekly shop',
    4200,
    CURRENT_TIMESTAMP,
    'expense',
    'cat-child',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
