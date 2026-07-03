-- transaction_categories
CREATE TABLE
    transaction_categories (
        id TEXT NOT NULL PRIMARY KEY,
        parent_id TEXT REFERENCES transaction_categories (id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        description TEXT,
        color TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
    );

-- transactions
CREATE TABLE
    transactions (
        id TEXT NOT NULL PRIMARY KEY,
        description TEXT,
        amount INTEGER NOT NULL,
        transaction_date TIMESTAMP NOT NULL,
        transaction_type TEXT NOT NULL,
        transaction_category_id TEXT REFERENCES transaction_categories (id) ON DELETE SET NULL,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
    );

CREATE INDEX transactions_type_index ON transactions (transaction_type);

CREATE INDEX transaction_categories_id_index ON transactions (transaction_category_id);