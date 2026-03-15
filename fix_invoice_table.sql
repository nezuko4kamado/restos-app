-- Fix app_43909_invoices table schema
-- Add vat_breakdown column if it doesn't exist

ALTER TABLE app_43909_invoices 
ADD COLUMN IF NOT EXISTS vat_breakdown JSONB DEFAULT '[]'::jsonb;

-- Verify the table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'app_43909_invoices'
ORDER BY ordinal_position;