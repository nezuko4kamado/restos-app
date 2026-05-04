-- ============================================================
-- ESEGUI QUESTO SQL NEL SUPABASE DASHBOARD -> SQL Editor
-- Vai su: https://supabase.com/dashboard -> tuo progetto -> SQL Editor -> New Query
-- Incolla tutto e clicca "Run"
-- ============================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10,4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS discounted_price DECIMAL(10,4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_difference DECIMAL(10,4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS previous_price DECIMAL(10,4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS code_description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS notes TEXT;

-- Initialize price_history to empty array for existing rows
UPDATE products SET price_history = '[]'::jsonb WHERE price_history IS NULL;
