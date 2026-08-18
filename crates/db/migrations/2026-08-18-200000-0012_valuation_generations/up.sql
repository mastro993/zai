CREATE INDEX transaction_exchange_rate_revisions_pending_retry
ON transaction_exchange_rate_revisions (variant, created_at)
WHERE variant = 'pending';

ALTER TABLE currency_settings ADD COLUMN default_currency_revision INTEGER NOT NULL DEFAULT 1
    CHECK (default_currency_revision >= 1);

ALTER TABLE budget_configurations ADD COLUMN allowance_currency TEXT NOT NULL DEFAULT 'EUR'
    CHECK (
        length(allowance_currency) = 3
        AND allowance_currency = upper(allowance_currency)
    );

CREATE TABLE valuation_generations (
    id TEXT PRIMARY KEY,
    kind TEXT NOT NULL CHECK (kind = 'actual'),
    target_currency TEXT NOT NULL CHECK (
        length(target_currency) = 3
        AND target_currency = upper(target_currency)
    ),
    prior_currency TEXT CHECK (
        prior_currency IS NULL
        OR (
            length(prior_currency) = 3
            AND prior_currency = upper(prior_currency)
        )
    ),
    default_currency_revision INTEGER NOT NULL CHECK (default_currency_revision >= 1),
    status TEXT NOT NULL CHECK (status IN ('building', 'ready', 'active', 'superseded')),
    created_at TIMESTAMP NOT NULL,
    activated_at TIMESTAMP
);

CREATE UNIQUE INDEX valuation_generations_one_active
ON valuation_generations (kind)
WHERE status = 'active';

CREATE TABLE valuation_heads (
    kind TEXT PRIMARY KEY CHECK (kind = 'actual'),
    generation_id TEXT NOT NULL REFERENCES valuation_generations (id),
    switched_at TIMESTAMP NOT NULL
);

CREATE TABLE transaction_valuations (
    generation_id TEXT NOT NULL REFERENCES valuation_generations (id),
    transaction_id TEXT NOT NULL REFERENCES transactions (id),
    transaction_date TIMESTAMP NOT NULL,
    converted_amount BIGINT,
    converted_currency TEXT NOT NULL CHECK (
        length(converted_currency) = 3
        AND converted_currency = upper(converted_currency)
    ),
    complete INTEGER NOT NULL CHECK (complete IN (0, 1)),
    rate_revision_id TEXT REFERENCES transaction_exchange_rate_revisions (id),
    PRIMARY KEY (generation_id, transaction_id),
    CHECK (
        (complete = 1 AND converted_amount IS NOT NULL)
        OR (complete = 0)
    )
);

CREATE INDEX transaction_valuations_generation_date
ON transaction_valuations (generation_id, transaction_date);

CREATE INDEX transaction_valuations_generation_converted
ON transaction_valuations (generation_id, converted_amount);

CREATE INDEX transaction_valuations_generation_completeness
ON transaction_valuations (generation_id, complete);

CREATE TRIGGER valuation_generations_identity_immutable
BEFORE UPDATE ON valuation_generations
WHEN OLD.id != NEW.id
    OR OLD.kind != NEW.kind
    OR OLD.target_currency != NEW.target_currency
    OR OLD.prior_currency IS NOT NEW.prior_currency
    OR OLD.default_currency_revision != NEW.default_currency_revision
BEGIN
    SELECT RAISE(ABORT, 'valuation generation identity is immutable');
END;

CREATE TRIGGER transaction_valuations_ready_immutable_update
BEFORE UPDATE ON transaction_valuations
WHEN EXISTS (
    SELECT 1 FROM valuation_generations
    WHERE id = OLD.generation_id
      AND status IN ('ready', 'superseded')
)
BEGIN
    SELECT RAISE(ABORT, 'inactive valuation rows are immutable');
END;

CREATE TRIGGER transaction_valuations_ready_immutable_delete
BEFORE DELETE ON transaction_valuations
WHEN EXISTS (
    SELECT 1 FROM valuation_generations
    WHERE id = OLD.generation_id
      AND status IN ('ready', 'superseded')
)
BEGIN
    SELECT RAISE(ABORT, 'inactive valuation rows are immutable');
END;

INSERT INTO valuation_generations (
    id,
    kind,
    target_currency,
    prior_currency,
    default_currency_revision,
    status,
    created_at,
    activated_at
)
VALUES (
    'val-actual-1',
    'actual',
    'EUR',
    NULL,
    1,
    'active',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);

INSERT INTO valuation_heads (kind, generation_id, switched_at)
VALUES ('actual', 'val-actual-1', CURRENT_TIMESTAMP);

INSERT INTO transaction_valuations (
    generation_id,
    transaction_id,
    transaction_date,
    converted_amount,
    converted_currency,
    complete,
    rate_revision_id
)
SELECT
    'val-actual-1',
    t.id,
    t.transaction_date,
    CASE
        WHEN r.variant = 'pending' THEN NULL
        ELSE t.amount
    END,
    'EUR',
    CASE WHEN r.variant = 'pending' THEN 0 ELSE 1 END,
    r.id
FROM transactions t
JOIN transaction_exchange_rate_revisions r
    ON r.transaction_id = t.id
    AND r.sequence = (
        SELECT MAX(sequence)
        FROM transaction_exchange_rate_revisions r2
        WHERE r2.transaction_id = t.id
    );

ALTER TABLE budget_period_results RENAME TO budget_period_results_old;

CREATE TABLE budget_period_results (
    budget_id TEXT NOT NULL,
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    net_budget_spending BIGINT NOT NULL,
    effective_allowance BIGINT,
    remaining_allowance BIGINT,
    status TEXT CHECK (
        status IS NULL OR status IN ('onTrack', 'warning', 'overspent')
    ),
    generation_id TEXT NOT NULL REFERENCES valuation_generations (id),
    complete INTEGER NOT NULL CHECK (complete IN (0, 1)),
    PRIMARY KEY (budget_id, period_start),
    FOREIGN KEY (budget_id, period_start)
        REFERENCES budget_configurations (budget_id, period_start)
        ON DELETE CASCADE,
    CHECK (
        (
            complete = 1
            AND status IS NOT NULL
            AND effective_allowance IS NOT NULL
            AND remaining_allowance IS NOT NULL
        )
        OR (
            complete = 0
            AND status IS NULL
            AND effective_allowance IS NULL
            AND remaining_allowance IS NULL
        )
    )
);

INSERT INTO budget_period_results (
    budget_id,
    period_start,
    period_end,
    net_budget_spending,
    effective_allowance,
    remaining_allowance,
    status,
    generation_id,
    complete
)
SELECT
    budget_id,
    period_start,
    period_end,
    net_budget_spending,
    effective_allowance,
    remaining_allowance,
    status,
    'val-actual-1',
    1
FROM budget_period_results_old;

DROP TABLE budget_period_results_old;

CREATE INDEX budget_period_results_budget_period_index
ON budget_period_results (budget_id, period_start DESC);

CREATE TABLE __migration_assert (
    ok INTEGER NOT NULL CHECK (ok = 1)
);

INSERT INTO __migration_assert (ok)
SELECT CASE
    WHEN EXISTS (SELECT 1 FROM pragma_foreign_key_check) THEN 0
    ELSE 1
END;

DELETE FROM __migration_assert;

INSERT INTO __migration_assert (ok)
SELECT CASE
    WHEN (SELECT quick_check FROM pragma_quick_check LIMIT 1) = 'ok' THEN 1
    ELSE 0
END;

DROP TABLE __migration_assert;
