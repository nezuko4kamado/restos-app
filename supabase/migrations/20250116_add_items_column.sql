-- =====================================================
-- Add items column to invoices table
-- Migration: 20250116_add_items_column
-- =====================================================

-- Add items column if it doesn't exist
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;

-- Add notes column if it doesn't exist (for compatibility)
ALTER TABLE invoices 
ADD COLUMN IF NOT EXISTS notes TEXT;

-- Create index on items for better query performance
CREATE INDEX IF NOT EXISTS idx_invoices_items ON invoices USING gin(items);

-- Update existing invoices to have empty items array if NULL
UPDATE invoices 
SET items = '[]'::jsonb 
WHERE items IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN invoices.items IS 'JSONB array of invoice line items with product details, quantities, and prices';
COMMENT ON COLUMN invoices.notes IS 'Additional notes or comments for the invoice';