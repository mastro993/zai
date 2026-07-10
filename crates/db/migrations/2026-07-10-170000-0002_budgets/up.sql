CREATE TABLE
    budgets (
        id TEXT NOT NULL PRIMARY KEY,
        name TEXT NOT NULL,
        cadence TEXT NOT NULL CHECK (
            cadence IN ('daily', 'weekly', 'monthly', 'yearly')
        ),
        first_period_start DATE NOT NULL,
        deactivated_at TIMESTAMP,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL
    );

CREATE TABLE
    budget_revisions (
        id TEXT NOT NULL PRIMARY KEY,
        budget_id TEXT NOT NULL REFERENCES budgets (id),
        effective_period_start DATE NOT NULL,
        allowance INTEGER NOT NULL CHECK (allowance >= 0),
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP NOT NULL,
        UNIQUE (budget_id, effective_period_start)
    );

CREATE TABLE
    budget_revision_scopes (
        revision_id TEXT NOT NULL REFERENCES budget_revisions (id),
        category_id TEXT NOT NULL REFERENCES transaction_categories (id),
        PRIMARY KEY (revision_id, category_id)
    );

CREATE INDEX budget_revisions_budget_period_idx ON budget_revisions (budget_id, effective_period_start);

CREATE INDEX budget_revision_scopes_category_idx ON budget_revision_scopes (category_id);

CREATE INDEX budgets_deactivated_at_idx ON budgets (deactivated_at);
