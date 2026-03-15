-- ============================================
-- Add supplier_id column to app_43909_invoices
-- ============================================
-- This migration adds a supplier_id foreign key to link invoices with suppliers
-- Run this in Supabase SQL Editor

BEGIN;

-- Step 1: Add supplier_id column (nullable initially to handle existing data)
ALTER TABLE app_43909_invoices 
ADD COLUMN IF NOT EXISTS supplier_id UUID;

-- Step 2: Add foreign key constraint with CASCADE DELETE
-- This ensures that when a supplier is deleted, all their invoices are also deleted
ALTER TABLE app_43909_invoices
ADD CONSTRAINT fk_app_43909_invoices_supplier_id 
FOREIGN KEY (supplier_id) 
REFERENCES suppliers(id) 
ON DELETE CASCADE;

-- Step 3: Create an index for better query performance
CREATE INDEX IF NOT EXISTS idx_app_43909_invoices_supplier_id 
ON app_43909_invoices(supplier_id);

-- Step 4: Update existing invoices to link them with suppliers based on supplier_name
-- This will match invoices to suppliers by name (case-insensitive)
UPDATE app_43909_invoices AS inv
SET supplier_id = s.id
FROM suppliers AS s
WHERE inv.supplier_id IS NULL 
  AND LOWER(TRIM(inv.supplier_name)) = LOWER(TRIM(s.name));

COMMIT;

-- ============================================
-- Verification Query (run after migration)
-- ============================================
-- Check if the column was added successfully
-- SELECT column_name, data_type, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'app_43909_invoices' AND column_name = 'supplier_id';

-- Check how many invoices have supplier_id populated
-- SELECT 
--   COUNT(*) as total_invoices,
--   COUNT(supplier_id) as invoices_with_supplier_id,
--   COUNT(*) - COUNT(supplier_id) as invoices_without_supplier_id
-- FROM app_43909_invoices;