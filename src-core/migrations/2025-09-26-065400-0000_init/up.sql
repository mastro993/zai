-- Create transaction_category table
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

CREATE TABLE
    transactions (
        id TEXT NOT NULL PRIMARY KEY,
        description TEXT NOT NULL,
        amount INTEGER NOT NULL,
        date DATE NOT NULL,
        type TEXT NOT NULL,
        category_id TEXT REFERENCES transaction_categories (id) ON DELETE SET NULL,
        notes TEXT,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TIMESTAMP
    );

-- Create indexes
CREATE INDEX transactions_type_index ON transactions (type);

CREATE INDEX transaction_categories_id_index ON transactions (category_id);