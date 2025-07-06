-- Create transaction_category table
CREATE TABLE transaction_category (
      id INTEGER NOT NULL PRIMARY KEY,
      parent_id INTEGER REFERENCES transaction_category(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      color TEXT,
      description TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP
  );

  -- Create transaction table
  CREATE TABLE "transaction" (
      id INTEGER NOT NULL PRIMARY KEY,
      description TEXT NOT NULL,
      amount INTEGER NOT NULL,
      date DATE NOT NULL,
      type TEXT NOT NULL,
      category_id INTEGER REFERENCES transaction_category(id) ON DELETE SET NULL,
      notes TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP
  );

  -- Create indexes
  CREATE INDEX transaction_type_index ON "transaction"(type);
  CREATE INDEX transaction_category_id_index ON "transaction"(category_id);