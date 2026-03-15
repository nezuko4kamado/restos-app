-- Add code_description column to products table
-- This field stores the product code description extracted from Klippa OCR
-- Run this script in your Supabase SQL Editor

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS code_description TEXT DEFAULT '';

-- Add comment to document the column purpose
COMMENT ON COLUMN products.code_description IS 'Product code description extracted from Klippa OCR for easier product search';

-- Create index for faster search on code_description
CREATE INDEX IF NOT EXISTS idx_products_code_description ON products(code_description);

-- Verify the column was added successfully
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'products' AND column_name = 'code_description';