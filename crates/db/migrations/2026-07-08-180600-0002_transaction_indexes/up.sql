CREATE INDEX transactions_active_date_index ON transactions (transaction_date DESC) WHERE deleted_at IS NULL;

CREATE INDEX transactions_active_category_date_index ON transactions (transaction_category_id, transaction_date DESC) WHERE deleted_at IS NULL;
