-- Source commit: a05d5b8 (2026-07-15). Synthetic finance rows only.
INSERT INTO transaction_categories (id, name, role, created_at, updated_at)
VALUES ('cat-util', 'Utilities', 'spending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

INSERT INTO budgets (
    id,
    name,
    cadence,
    measurement_mode,
    base_allowance,
    rollover_mode,
    revision,
    paused,
    created_at,
    updated_at
)
VALUES
    (
        'budget-active',
        'Utilities active',
        'month',
        'spending',
        12000,
        'cumulative',
        2,
        0,
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'budget-paused',
        'Utilities paused',
        'month',
        'spending',
        9000,
        'off',
        1,
        1,
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
VALUES
    (
        'budget-active',
        '2026-07-01 00:00:00',
        '2026-07-31 23:59:59',
        '["cat-util"]',
        12000,
        'spending',
        'cumulative'
    ),
    (
        'budget-paused',
        '2026-07-01 00:00:00',
        '2026-07-31 23:59:59',
        '["cat-util"]',
        9000,
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
VALUES
    (
        'budget-active',
        '2026-07-01 00:00:00',
        '2026-07-31 23:59:59',
        3000,
        12000,
        9000,
        'onTrack'
    ),
    (
        'budget-paused',
        '2026-07-01 00:00:00',
        '2026-07-31 23:59:59',
        0,
        9000,
        9000,
        'onTrack'
    );
