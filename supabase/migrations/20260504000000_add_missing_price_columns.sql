-- ============================================================================
-- Migration: Add all missing price-related columns to products table
-- Fixes issues where unit_price, discounted_price, price_difference,
-- and price_history columns are referenced in code but don't exist in DB
-- ============================================================================

-- Add unit_price column (price per unit before discount)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10, 2);

-- Add discounted_price column (price after discount applied)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS discounted_price DECIMAL(10, 2);

-- Add price_difference column (difference between old and new price)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS price_difference DECIMAL(10, 2);

-- Add price_history column (JSON array of historical price entries)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS price_history JSONB DEFAULT '[]'::jsonb;

-- Add discount_percent column if missing
ALTER TABLE products
ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5, 2);

-- Add discount_amount column if missing
ALTER TABLE products
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2);

-- Index for price_history queries
CREATE INDEX IF NOT EXISTS idx_products_price_history
ON products USING GIN (price_history)
WHERE price_history IS NOT NULL;

-- Backfill price_history as empty array where null
UPDATE products
SET price_history = '[]'::jsonb
WHERE price_history IS NULL;

COMMENT ON COLUMN products.unit_price IS 'Price per unit before any discount is applied.';
COMMENT ON COLUMN products.discounted_price IS 'Final price after discount is applied.';
COMMENT ON COLUMN products.price_difference IS 'Difference between previous price and current price.';
COMMENT ON COLUMN products.price_history IS 'JSON array of historical price entries: [{date, price, supplier}].';
COMMENT ON COLUMN products.discount_percent IS 'Discount percentage applied to unit price.';
COMMENT ON COLUMN products.discount_amount IS 'Absolute discount amount applied to unit price.';
