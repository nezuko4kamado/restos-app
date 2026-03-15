-- Migration to add discount fields to invoices table
-- Run this in your Supabase SQL Editor

BEGIN;

-- Add discount columns to invoices table
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS original_amount NUMERIC(10, 2),
ADD COLUMN IF NOT EXISTS discount_percent NUMERIC(5, 2),
ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(10, 2);

-- Update the invoice_date column name if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invoices' AND column_name = 'invoice_date') THEN
        ALTER TABLE invoices RENAME COLUMN date TO invoice_date;
    END IF;
END $$;

-- Update the amount column name if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'invoices' AND column_name = 'amount') THEN
        ALTER TABLE invoices RENAME COLUMN total TO amount;
    END IF;
END $$;

-- Add notes column if it doesn't exist
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add file_url column if it doesn't exist
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS file_url TEXT;

-- Create index on invoice_date for better query performance
CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date);

-- Create index on supplier_id for better query performance
CREATE INDEX IF NOT EXISTS idx_invoices_supplier_id ON invoices(supplier_id);

COMMIT;

-- Verify the changes
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'invoices'
ORDER BY ordinal_position;