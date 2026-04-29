-- ============================================================================
-- Migration: Add missing columns to products table
-- Fixes product matching failures caused by missing code_description column
-- and missing previous_price column
-- ============================================================================

-- Add code_description column (used by productMatcher.ts for exact invoice matching)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS code_description TEXT;

-- Add previous_price column (used for price change tracking and alerts)
ALTER TABLE products
ADD COLUMN IF NOT EXISTS previous_price DECIMAL(10, 2);

-- Index for fast exact lookups by code_description per user
CREATE INDEX IF NOT EXISTS idx_products_code_description
ON products(code_description)
WHERE code_description IS NOT NULL AND code_description != '';

-- Copy any existing data from code_product → code_description (if code_product exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'code_product'
  ) THEN
    UPDATE products
    SET code_description = code_product
    WHERE code_product IS NOT NULL AND code_product != ''
      AND (code_description IS NULL OR code_description = '');
  END IF;
END $$;

COMMENT ON COLUMN products.code_description IS 'Product code from supplier invoice (e.g., from Klippa OCR). Used for exact matching products across invoices.';
COMMENT ON COLUMN products.previous_price IS 'Previous price before last update. Used for price change tracking and alerts.';
