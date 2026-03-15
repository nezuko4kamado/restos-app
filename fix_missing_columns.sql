-- ============================================================================
-- FIX MISSING COLUMNS - Add only missing columns to existing tables
-- ============================================================================
-- This script adds missing columns without dropping or recreating tables
-- Safe to run - will not delete any existing data

BEGIN;

-- ============================================================================
-- FIX PRODUCTS TABLE - Add missing columns
-- ============================================================================

-- Add image column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'image'
    ) THEN
        ALTER TABLE products ADD COLUMN image text;
        COMMENT ON COLUMN products.image IS 'Product image URL or path';
    END IF;
END $$;

-- Add discount column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'discount'
    ) THEN
        ALTER TABLE products ADD COLUMN discount numeric DEFAULT 0;
        COMMENT ON COLUMN products.discount IS 'Discount amount';
    END IF;
END $$;

-- Add notes column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'notes'
    ) THEN
        ALTER TABLE products ADD COLUMN notes text;
        COMMENT ON COLUMN products.notes IS 'Additional notes about the product';
    END IF;
END $$;

-- ============================================================================
-- FIX SUPPLIERS TABLE - Add missing columns
-- ============================================================================

-- Add country column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'suppliers' AND column_name = 'country'
    ) THEN
        ALTER TABLE suppliers ADD COLUMN country text;
        COMMENT ON COLUMN suppliers.country IS 'Supplier country';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- VERIFICATION - Check that all required columns now exist
-- ============================================================================

-- Verify products table
SELECT 'Products table columns:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'products'
ORDER BY ordinal_position;

-- Verify suppliers table
SELECT 'Suppliers table columns:' as info;
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'suppliers'
ORDER BY ordinal_position;

-- Success message
SELECT '✅ All missing columns have been added successfully!' as result;