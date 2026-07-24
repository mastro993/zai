-- Synthetic finance rows only.
INSERT INTO transaction_categories (id, name, role, created_at, updated_at)
VALUES ('cat-revisions', 'Revision category', 'spending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

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
    'txn-revisions',
    'Revision fixture transaction',
    1300,
    '2026-06-01 09:00:00',
    'expense',
    'cat-revisions',
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
    revision,
    created_at,
    updated_at
)
VALUES (
    'budget-revisions',
    'Revision budget',
    'month',
    'spending',
    10000,
    'cumulative',
    3,
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
    'budget-revisions',
    '2026-06-01 00:00:00',
    '2026-06-30 23:59:59',
    '["cat-revisions"]',
    10000,
    'spending',
    'cumulative'
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
    'budget-revisions',
    '2026-06-01 00:00:00',
    '2026-06-30 23:59:59',
    1300,
    10000,
    8700,
    'onTrack'
);
