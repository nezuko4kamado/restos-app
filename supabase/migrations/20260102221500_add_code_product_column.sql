-- Add code_product column to products table
-- This column stores the product code extracted from supplier invoices (e.g., from Klippa OCR)
-- It's nullable to support existing products without codes

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS code_product TEXT;

-- Add index for faster lookups by product code
CREATE INDEX IF NOT EXISTS idx_products_code_product 
ON products(code_product) 
WHERE code_product IS NOT NULL AND code_product != '';

-- Add comment for documentation
COMMENT ON COLUMN products.code_product IS 'Product code from supplier invoice (e.g., from Klippa OCR). Used for matching products across invoices.';