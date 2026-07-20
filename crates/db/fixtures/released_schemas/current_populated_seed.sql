-- Populated data for the current released schema (diesel head, before code
-- migration v1). Synthetic finance rows only.
INSERT INTO transaction_categories (id, name, role, created_at, updated_at)
VALUES ('cat-groceries', 'Groceries', 'spending', '2026-07-01 00:00:00', '2026-07-01 00:00:00');

INSERT INTO transactions (
    id, description, amount, transaction_date, transaction_type,
    transaction_category_id, notes, created_at, updated_at, deleted_at
)
VALUES
    ('txn-morning', 'Espresso', 250, '2026-07-15 08:30:00', 'expense',
     'cat-groceries', NULL, '2026-07-15 08:30:00', '2026-07-15 08:30:00', NULL),
    ('txn-midnight', 'Rent', 90000, '2026-07-01 00:00:00', 'expense',
     NULL, NULL, '2026-07-01 00:00:00', '2026-07-01 00:00:00', NULL),
    ('txn-dst-gap', 'Night bus', 400, '2026-03-29 02:30:00', 'expense',
     NULL, NULL, '2026-03-29 01:00:00', '2026-03-29 01:00:00', NULL),
    ('txn-deleted', 'Refund', 1200, '2026-06-30 22:15:00', 'income',
     NULL, 'gone', '2026-06-30 22:15:00', '2026-07-02 10:00:00', '2026-07-02 10:00:00');

INSERT INTO budgets (
    id, name, cadence, measurement_mode, base_allowance, rollover_mode,
    warning_percentage, created_at, updated_at, deleted_at, revision, paused
)
VALUES ('budget-food', 'Food', 'month', 'spending', 30000, 'cumulative',
        80, '2026-07-01 00:00:00', '2026-07-01 00:00:00', NULL, 3, 0);

INSERT INTO budget_configurations (
    budget_id, period_start, period_end, category_ids, base_allowance,
    measurement_mode, rollover_mode, warning_percentage
)
VALUES
    ('budget-food', '2026-06-01 00:00:00', '2026-06-30 23:59:59',
     '["cat-groceries"]', 30000, 'spending', 'cumulative', 80),
    ('budget-food', '2026-07-01 00:00:00', '2026-07-31 23:59:59',
     '["cat-groceries"]', 30000, 'spending', 'cumulative', 80);

INSERT INTO budget_period_results (
    budget_id, period_start, period_end, net_budget_spending,
    effective_allowance, remaining_allowance, status
)
VALUES
    ('budget-food', '2026-06-01 00:00:00', '2026-06-30 23:59:59',
     12000, 30000, 18000, 'onTrack'),
    ('budget-food', '2026-07-01 00:00:00', '2026-07-31 23:59:59',
     250, 48000, 47750, 'onTrack');

INSERT INTO domain_alerts (
    id, producer_key, occurrence_key, severity, title, body,
    destination, data, created_at, read_at
)
VALUES
    ('alert-warning', 'budgets.transition', 'budget-food:2026-07', 'warning',
     'Budget warning', 'Approaching limit', NULL, NULL, '2026-07-10 09:00:00', NULL),
    ('alert-read', 'budgets.transition', 'budget-food:2026-06', 'info',
     'Budget ok', 'All good', NULL, NULL, '2026-06-10 09:00:00', '2026-06-11 09:00:00');
