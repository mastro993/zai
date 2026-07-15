-- Source commit: a05d5b8 (2026-07-15). Synthetic finance rows only.
INSERT INTO transaction_categories (id, name, role, created_at, updated_at)
VALUES ('cat-travel', 'Travel', 'spending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

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
VALUES
    (
        'budget-prev',
        'Travel previous-period',
        'month',
        'spending',
        5000,
        'previousPeriodOnly',
        CURRENT_TIMESTAMP,
        CURRENT_TIMESTAMP
    ),
    (
        'budget-cum',
        'Travel cumulative',
        'month',
        'spending',
        8000,
        'cumulative',
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
        'budget-prev',
        '2026-06-01 00:00:00',
        '2026-06-30 23:59:59',
        '["cat-travel"]',
        5000,
        'spending',
        'previousPeriodOnly'
    ),
    (
        'budget-cum',
        '2026-06-01 00:00:00',
        '2026-06-30 23:59:59',
        '["cat-travel"]',
        8000,
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
VALUES
    (
        'budget-prev',
        '2026-06-01 00:00:00',
        '2026-06-30 23:59:59',
        1200,
        5000,
        3800,
        'onTrack'
    ),
    (
        'budget-cum',
        '2026-06-01 00:00:00',
        '2026-06-30 23:59:59',
        6400,
        8000,
        1600,
        'warning'
    );
