-- =============================================
-- Database Schema Migration
-- Version: 001
-- Description: Create initial tables and relationships
-- Created: 2024-03-XX
-- =============================================
-- Table of Contents:
-- 1. Transaction Categories Related Objects
--    - Main transaction categories table
--    - Indexes
--    - Update timestamp trigger
--    - Validation triggers
--
-- 2. Transactions Related Objects
--    - Main transactions table
--    - Indexes
--    - Update timestamp trigger
--
-- 3. Tags Related Objects
--    - Main tags table
--    - Indexes
--    - Update timestamp trigger
--
-- 4. Transaction-Tags Relationship
--    - Junction table
--    - Relationship indexes
--
-- 5. Currency Exchanges Related Objects
--    - Main currency exchanges table
--    - Indexes
--    - Update timestamp trigger
--    - Inverse rate triggers
-- Schema Notes:
-- - All monetary amounts stored as integers (smallest currency unit)
-- - All dates stored as TEXT in ISO8601 format
-- - Soft delete pattern used (deleted_at column)
-- - Automatic timestamp management for all tables
-- - Currency codes follow ISO 4217 (3 characters)
-- =============================================
-- TRANSACTION CATEGORIES RELATED OBJECTS
-- =============================================
-- Main transaction categories table
CREATE TABLE
    transaction_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        parent_id INTEGER,
        icon TEXT CHECK (length (icon) <= 8), -- Emoji length limit
        color TEXT CHECK (
            length (color) = 7
            AND color LIKE '#%'
        ), -- Hex color format (#RRGGBB)
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TEXT,
        FOREIGN KEY (parent_id) REFERENCES transaction_categories (id) ON DELETE RESTRICT
    );

-- Transaction categories indexes
CREATE INDEX idx_transaction_categories_parent_id ON transaction_categories (parent_id);

CREATE INDEX idx_transaction_categories_name ON transaction_categories (name);

-- Transaction categories update timestamp trigger
CREATE TRIGGER update_transaction_categories_timestamp AFTER
UPDATE ON transaction_categories BEGIN
UPDATE transaction_categories
SET
    updated_at = CURRENT_TIMESTAMP
WHERE
    id = NEW.id;

END;

-- Prevent circular references in parent_id relationships
CREATE TRIGGER prevent_circular_reference_categories BEFORE
UPDATE ON transaction_categories WHEN NEW.parent_id IS NOT NULL BEGIN
WITH RECURSIVE
    category_chain (id, parent_id) AS (
        -- Base case: start with the category being updated
        SELECT
            id,
            parent_id
        FROM
            transaction_categories
        WHERE
            id = NEW.parent_id
        UNION ALL
        -- Recursive case: join with parent categories
        SELECT
            c.id,
            c.parent_id
        FROM
            transaction_categories c
            INNER JOIN category_chain cc ON c.id = cc.parent_id
    )
SELECT
    CASE
        WHEN EXISTS (
            SELECT
                1
            FROM
                category_chain
            WHERE
                id = NEW.id
        ) THEN RAISE (
            ABORT,
            'Circular reference detected in category hierarchy'
        )
    END;

END;

-- Prevent deletion of categories with children
CREATE TRIGGER prevent_parent_category_deletion BEFORE DELETE ON transaction_categories WHEN EXISTS (
    SELECT
        1
    FROM
        transaction_categories
    WHERE
        parent_id = OLD.id
        AND deleted_at IS NULL
) BEGIN
SELECT
    RAISE (
        ABORT,
        'Cannot delete category with existing children'
    );

END;

-- =============================================
-- TRANSACTIONS RELATED OBJECTS
-- =============================================
-- Main transactions table
CREATE TABLE
    transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL DEFAULT CURRENT_DATE,
        name TEXT NOT NULL,
        amount INTEGER NOT NULL,
        currency TEXT NOT NULL DEFAULT 'USD' CHECK (length (currency) = 3),
        type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
        category_id INTEGER NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TEXT,
        FOREIGN KEY (category_id) REFERENCES transaction_categories (id) ON DELETE RESTRICT
    );

-- Transaction indexes
CREATE INDEX idx_transactions_date ON transactions (date);

CREATE INDEX idx_transactions_type ON transactions (type);

CREATE INDEX idx_transactions_category_id ON transactions (category_id);

-- Transaction update timestamp trigger
CREATE TRIGGER update_transactions_timestamp AFTER
UPDATE ON transactions BEGIN
UPDATE transactions
SET
    updated_at = CURRENT_TIMESTAMP
WHERE
    id = NEW.id;

END;

-- =============================================
-- TAGS RELATED OBJECTS
-- =============================================
-- Main tags table
CREATE TABLE
    transaction_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        color TEXT CHECK (
            length (color) = 7
            AND color LIKE '#%'
        ), -- Hex color format (#RRGGBB)
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TEXT
    );

-- Tags indexes
CREATE INDEX idx_transaction_tags_name ON transaction_tags (name);

-- Tags update timestamp trigger
CREATE TRIGGER update_transaction_tags_timestamp AFTER
UPDATE ON transaction_tags BEGIN
UPDATE transaction_tags
SET
    updated_at = CURRENT_TIMESTAMP
WHERE
    id = NEW.id;

END;

-- =============================================
-- TRANSACTION-TAGS RELATIONSHIP
-- =============================================
-- Junction table for many-to-many relationship
CREATE TABLE
    transaction_tag_relations (
        transaction_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (transaction_id) REFERENCES transactions (id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES transaction_tags (id) ON DELETE CASCADE,
        PRIMARY KEY (transaction_id, tag_id)
    );

-- Transaction-tags relationship indexes
CREATE INDEX idx_transaction_tag_relations_tag ON transaction_tag_relations (tag_id);

CREATE INDEX idx_transaction_tag_relations_transaction ON transaction_tag_relations (transaction_id);

-- =============================================
-- CURRENCY EXCHANGES RELATED OBJECTS
-- =============================================
-- Main currency exchanges table
CREATE TABLE
    currency_exchanges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_currency TEXT NOT NULL CHECK (length (from_currency) = 3),
        to_currency TEXT NOT NULL CHECK (length (to_currency) = 3),
        rate DECIMAL(20, 10) NOT NULL,
        date TEXT NOT NULL DEFAULT CURRENT_DATE,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        deleted_at TEXT,
        UNIQUE (from_currency, to_currency, date)
    );

-- Currency exchanges indexes
CREATE INDEX idx_currency_exchanges_date ON currency_exchanges (date);

CREATE INDEX idx_currency_exchanges_currencies ON currency_exchanges (from_currency, to_currency);

-- Currency exchanges update timestamp trigger
CREATE TRIGGER update_currency_exchanges_timestamp AFTER
UPDATE ON currency_exchanges BEGIN
UPDATE currency_exchanges
SET
    updated_at = CURRENT_TIMESTAMP
WHERE
    id = NEW.id;

END;

-- Automatic inverse rate creation trigger
CREATE TRIGGER create_inverse_exchange_rate AFTER INSERT ON currency_exchanges WHEN NOT EXISTS (
    SELECT
        1
    FROM
        currency_exchanges
    WHERE
        from_currency = NEW.to_currency
        AND to_currency = NEW.from_currency
        AND date = NEW.date
) BEGIN
INSERT INTO
    currency_exchanges (from_currency, to_currency, rate, date)
VALUES
    (
        NEW.to_currency,
        NEW.from_currency,
        1.0 / NEW.rate,
        NEW.date
    );

END;

-- Automatic inverse rate update trigger
CREATE TRIGGER update_inverse_exchange_rate AFTER
UPDATE OF rate ON currency_exchanges WHEN EXISTS (
    SELECT
        1
    FROM
        currency_exchanges
    WHERE
        from_currency = NEW.to_currency
        AND to_currency = NEW.from_currency
        AND date = NEW.date
) BEGIN
UPDATE currency_exchanges
SET
    rate = 1.0 / NEW.rate,
    updated_at = CURRENT_TIMESTAMP
WHERE
    from_currency = NEW.to_currency
    AND to_currency = NEW.from_currency
    AND date = NEW.date;

END;

/*
##################################################################################################################################################################################
##################################################################################################################################################################################
##################################################################################################################################################################################
SEED
##################################################################################################################################################################################
##################################################################################################################################################################################
##################################################################################################################################################################################
 */
-- =============================================
-- Database Seed Migration
-- Version: 002
-- Description: Seed initial data for testing
-- Created: 2024-03-XX
-- =============================================
-- =============================================
-- SEED TRANSACTION CATEGORIES
-- =============================================
INSERT INTO
    transaction_categories (name, icon, color, parent_id)
VALUES
    ('Income', '💰', '#4CAF50', NULL),
    ('Salary', '💵', '#66BB6A', 1),
    ('Investment', '📈', '#81C784', 1),
    ('Expenses', '💸', '#F44336', NULL),
    ('Food', '🍽️', '#EF5350', 4),
    ('Transportation', '🚗', '#E57373', 4),
    ('Housing', '🏠', '#EF9A9A', 4),
    ('Entertainment', '🎮', '#2196F3', 4),
    ('Shopping', '🛍️', '#90CAF9', 4),
    ('Healthcare', '🏥', '#9C27B0', 4),
    ('Utilities', '💡', '#BA68C8', 4);

-- =============================================
-- SEED TAGS
-- =============================================
INSERT INTO
    transaction_tags (name, description, color)
VALUES
    (
        'groceries',
        'Food and household items',
        '#4CAF50'
    ),
    ('rent', 'Monthly housing payments', '#2196F3'),
    (
        'utilities',
        'Electric, water, and other utility bills',
        '#FFC107'
    ),
    (
        'entertainment',
        'Movies, games, and fun activities',
        '#9C27B0'
    ),
    (
        'transportation',
        'Bus, train, and other transit costs',
        '#FF5722'
    ),
    (
        'healthcare',
        'Medical and health-related expenses',
        '#F44336'
    ),
    (
        'shopping',
        'Retail purchases and general shopping',
        '#3F51B5'
    ),
    ('salary', 'Regular employment income', '#009688'),
    (
        'investment',
        'Investment returns and dividends',
        '#795548'
    ),
    (
        'dining',
        'Restaurant and eating out expenses',
        '#E91E63'
    );

-- =============================================
-- SEED TRANSACTIONS
-- =============================================
-- Income transactions
INSERT INTO
    transactions (
        date,
        name,
        amount,
        currency,
        type,
        category_id,
        notes
    )
VALUES
    (
        '2024-03-01',
        'Monthly Salary',
        500000,
        'USD',
        'income',
        (
            SELECT
                id
            FROM
                transaction_categories
            WHERE
                name = 'Salary'
        ),
        'March salary'
    ),
    (
        '2024-03-15',
        'Freelance Payment',
        150000,
        'EUR',
        'income',
        (
            SELECT
                id
            FROM
                transaction_categories
            WHERE
                name = 'Salary'
        ),
        'Website project'
    ),
    (
        '2024-03-20',
        'Investment Return',
        75000,
        'USD',
        'income',
        (
            SELECT
                id
            FROM
                transaction_categories
            WHERE
                name = 'Investment'
        ),
        'Stock dividends'
    );

-- Expense transactions
INSERT INTO
    transactions (
        date,
        name,
        amount,
        currency,
        type,
        category_id,
        notes
    )
VALUES
    (
        '2024-03-02',
        'Grocery Shopping',
        12500,
        'USD',
        'expense',
        (
            SELECT
                id
            FROM
                transaction_categories
            WHERE
                name = 'Food'
        ),
        'Weekly groceries'
    ),
    (
        '2024-03-03',
        'Monthly Rent',
        200000,
        'USD',
        'expense',
        (
            SELECT
                id
            FROM
                transaction_categories
            WHERE
                name = 'Housing'
        ),
        'March rent'
    ),
    (
        '2024-03-04',
        'Electric Bill',
        8500,
        'USD',
        'expense',
        (
            SELECT
                id
            FROM
                transaction_categories
            WHERE
                name = 'Utilities'
        ),
        'February usage'
    ),
    (
        '2024-03-05',
        'Movie Night',
        2500,
        'USD',
        'expense',
        (
            SELECT
                id
            FROM
                transaction_categories
            WHERE
                name = 'Entertainment'
        ),
        'Cinema tickets'
    ),
    (
        '2024-03-06',
        'Bus Pass',
        9000,
        'USD',
        'expense',
        (
            SELECT
                id
            FROM
                transaction_categories
            WHERE
                name = 'Transportation'
        ),
        'Monthly transit pass'
    ),
    (
        '2024-03-07',
        'Restaurant',
        4500,
        'EUR',
        'expense',
        (
            SELECT
                id
            FROM
                transaction_categories
            WHERE
                name = 'Food'
        ),
        'Dinner with friends'
    ),
    (
        '2024-03-08',
        'Shopping',
        15000,
        'USD',
        'expense',
        (
            SELECT
                id
            FROM
                transaction_categories
            WHERE
                name = 'Shopping'
        ),
        'New clothes'
    );

-- =============================================
-- SEED TRANSACTION TAGS
-- =============================================
-- Tag income transactions
INSERT INTO
    transaction_tag_relations (transaction_id, tag_id)
SELECT
    t.id,
    tag.id
FROM
    transactions t,
    transaction_tags tag
WHERE
    t.name = 'Monthly Salary'
    AND tag.name = 'salary';

INSERT INTO
    transaction_tag_relations (transaction_id, tag_id)
SELECT
    t.id,
    tag.id
FROM
    transactions t,
    transaction_tags tag
WHERE
    t.name = 'Investment Return'
    AND tag.name = 'investment';

-- Tag expense transactions
INSERT INTO
    transaction_tag_relations (transaction_id, tag_id)
SELECT
    t.id,
    tag.id
FROM
    transactions t,
    transaction_tags tag
WHERE
    t.name = 'Grocery Shopping'
    AND tag.name = 'groceries';

INSERT INTO
    transaction_tag_relations (transaction_id, tag_id)
SELECT
    t.id,
    tag.id
FROM
    transactions t,
    transaction_tags tag
WHERE
    t.name = 'Monthly Rent'
    AND tag.name = 'rent';

INSERT INTO
    transaction_tag_relations (transaction_id, tag_id)
SELECT
    t.id,
    tag.id
FROM
    transactions t,
    transaction_tags tag
WHERE
    t.name = 'Electric Bill'
    AND tag.name = 'utilities';

INSERT INTO
    transaction_tag_relations (transaction_id, tag_id)
SELECT
    t.id,
    tag.id
FROM
    transactions t,
    transaction_tags tag
WHERE
    t.name = 'Movie Night'
    AND tag.name = 'entertainment';

INSERT INTO
    transaction_tag_relations (transaction_id, tag_id)
SELECT
    t.id,
    tag.id
FROM
    transactions t,
    transaction_tags tag
WHERE
    t.name = 'Bus Pass'
    AND tag.name = 'transportation';

INSERT INTO
    transaction_tag_relations (transaction_id, tag_id)
SELECT
    t.id,
    tag.id
FROM
    transactions t,
    transaction_tags tag
WHERE
    t.name = 'Restaurant'
    AND tag.name = 'dining';

INSERT INTO
    transaction_tag_relations (transaction_id, tag_id)
SELECT
    t.id,
    tag.id
FROM
    transactions t,
    transaction_tags tag
WHERE
    t.name = 'Shopping'
    AND tag.name = 'shopping';

-- =============================================
-- SEED CURRENCY EXCHANGES
-- =============================================
-- Add some recent exchange rates
INSERT INTO
    currency_exchanges (from_currency, to_currency, rate, date)
VALUES
    ('USD', 'EUR', 0.92, '2024-03-01'),
    ('USD', 'GBP', 0.79, '2024-03-01'),
    ('USD', 'JPY', 150.50, '2024-03-01'),
    ('USD', 'EUR', 0.91, '2024-03-15'),
    ('USD', 'GBP', 0.78, '2024-03-15'),
    ('USD', 'JPY', 149.80, '2024-03-15');