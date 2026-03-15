-- ============================================================================
-- SCHEMA VERIFICATION QUERIES
-- ============================================================================
-- Run these queries in Supabase SQL Editor and send me the results

-- 1. Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('products', 'suppliers', 'user_settings', 'orders', 'invoices')
ORDER BY table_name;

-- 2. Check products table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'products'
ORDER BY ordinal_position;

-- 3. Check suppliers table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'suppliers'
ORDER BY ordinal_position;

-- 4. Check user_settings table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'user_settings'
ORDER BY ordinal_position;

-- 5. Check orders table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'orders'
ORDER BY ordinal_position;

-- 6. Check invoices table structure
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'invoices'
ORDER BY ordinal_position;

-- 7. Check RLS policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies
WHERE tablename IN ('products', 'suppliers', 'user_settings', 'orders', 'invoices')
ORDER BY tablename, policyname;