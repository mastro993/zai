PRAGMA foreign_keys = OFF;

CREATE TEMP TABLE category_hue_transaction_refs AS
SELECT id, transaction_category_id
FROM transactions;

CREATE TEMP TABLE category_hue_recurring_refs AS
SELECT id, transaction_category_id
FROM recurring_template_revisions;

CREATE TABLE transaction_categories_new (
    id TEXT NOT NULL PRIMARY KEY,
    parent_id TEXT REFERENCES transaction_categories_new (id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT,
    hue INTEGER CHECK (hue IS NULL OR hue BETWEEN 0 AND 359),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP,
    role TEXT NOT NULL DEFAULT 'spending',
    CHECK (parent_id IS NULL OR hue IS NULL)
);

INSERT INTO transaction_categories_new (
    id,
    parent_id,
    name,
    description,
    hue,
    created_at,
    updated_at,
    deleted_at,
    role
)
SELECT
    id,
    parent_id,
    name,
    description,
    NULL,
    created_at,
    updated_at,
    deleted_at,
    role
FROM transaction_categories;

DROP TABLE transaction_categories;
ALTER TABLE transaction_categories_new RENAME TO transaction_categories;

CREATE UNIQUE INDEX transaction_categories_root_name_unique
ON transaction_categories (lower(trim(name)))
WHERE parent_id IS NULL AND deleted_at IS NULL;

CREATE UNIQUE INDEX transaction_categories_child_name_unique
ON transaction_categories (parent_id, lower(trim(name)))
WHERE parent_id IS NOT NULL AND deleted_at IS NULL;

UPDATE transactions
SET transaction_category_id = (
    SELECT transaction_category_id
    FROM category_hue_transaction_refs
    WHERE category_hue_transaction_refs.id = transactions.id
);

UPDATE recurring_template_revisions
SET transaction_category_id = (
    SELECT transaction_category_id
    FROM category_hue_recurring_refs
    WHERE category_hue_recurring_refs.id = recurring_template_revisions.id
);

DROP TABLE category_hue_transaction_refs;
DROP TABLE category_hue_recurring_refs;

PRAGMA foreign_keys = ON;
