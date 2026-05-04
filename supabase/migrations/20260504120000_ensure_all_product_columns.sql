-- ============================================================================
-- Migration: Ensure ALL required product columns exist (idempotent)
-- This migration is safe to run multiple times (IF NOT EXISTS on all columns)
-- ============================================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS code_description TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS code_product TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS previous_price DECIMAL(10,4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10,4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS discounted_price DECIMAL(10,4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_difference DECIMAL(10,4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10,4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_history JSONB DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS ean_code TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS notes TEXT;

-- Backfill price_history as empty array where null
UPDATE products SET price_history = '[]'::jsonb WHERE price_history IS NULL;

-- Copy code_product → code_description where missing
UPDATE products
SET code_description = code_product
WHERE code_product IS NOT NULL AND code_product != ''
  AND (code_description IS NULL OR code_description = '');

-- Indexes
CREATE INDEX IF NOT EXISTS idx_products_code_description ON products(code_description) WHERE code_description IS NOT NULL AND code_description != '';
CREATE INDEX IF NOT EXISTS idx_products_code_product ON products(code_product) WHERE code_product IS NOT NULL AND code_product != '';
CREATE INDEX IF NOT EXISTS idx_products_price_history ON products USING GIN (price_history) WHERE price_history IS NOT NULL;