-- Source commit: a05d5b8 (2026-07-15). Synthetic finance rows only.
INSERT INTO transaction_categories (id, name, role, created_at, updated_at)
VALUES ('cat-food', 'Food', 'spending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO transactions (
    id,
    amount,
    transaction_date,
    transaction_type,
    transaction_category_id,
    created_at,
    updated_at
)
VALUES (
    'txn-food-1',
    1500,
    CURRENT_TIMESTAMP,
    'expense',
    'cat-food',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

INSERT INTO budgets (
    id,
    name,
    cadence,
    measurement_mode,
    base_allowance,
    rollover_mode,
    created_at,
    updated_at
)
VALUES (
    'budget-off',
    'Monthly food',
    'month',
    'spending',
    10000,
    'off',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

INSERT INTO budget_configurations (
    budget_id,
    period_start,
    period_end,
    category_ids,
    base_allowance,
    measurement_mode,
    rollover_mode
)
VALUES (
    'budget-off',
    '2026-07-01 00:00:00',
    '2026-07-31 23:59:59',
    '["cat-food"]',
    10000,
    'spending',
    'off'
);

INSERT INTO budget_period_results (
    budget_id,
    period_start,
    period_end,
    net_budget_spending,
    effective_allowance,
    remaining_allowance,
    status
)
VALUES (
    'budget-off',
    '2026-07-01 00:00:00',
    '2026-07-31 23:59:59',
    1500,
    10000,
    8500,
    'onTrack'
);
