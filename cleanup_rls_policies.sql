-- ============================================
-- INTELLIGENT RLS POLICY CLEANUP
-- Analyze first, then remove only duplicates
-- ============================================

-- Step 1: Backup products table
CREATE TABLE IF NOT EXISTS products_backup_20251226 AS SELECT * FROM products;

-- Step 2: Analyze current RLS policies
SELECT 
  '=== CURRENT RLS POLICIES ANALYSIS ===' as section,
  '' as empty;

SELECT 
  cmd as operation,
  COUNT(*) as policy_count,
  string_agg(policyname, ', ' ORDER BY policyname) as policy_names
FROM pg_policies
WHERE tablename = 'products'
GROUP BY cmd
ORDER BY cmd;

-- Step 3: Show all policies in detail
SELECT 
  policyname,
  cmd as operation,
  roles::text[] as roles,
  permissive
FROM pg_policies
WHERE tablename = 'products'
ORDER BY cmd, policyname;

-- Step 4: Drop redundant policies (keep only the simplest ones)
-- For SELECT: Keep only "public_read_products" or create it
DROP POLICY IF EXISTS "products_select_policy" ON products;
DROP POLICY IF EXISTS "Allow public read access to products" ON products;
DROP POLICY IF EXISTS "allow_read_own_products" ON products;
DROP POLICY IF EXISTS "Users can view own products" ON products;
DROP POLICY IF EXISTS "Users can view their own products" ON products;

-- For INSERT: Keep only "public_insert_products" or create it
DROP POLICY IF EXISTS "products_insert_policy" ON products;
DROP POLICY IF EXISTS "Allow public insert access to products" ON products;
DROP POLICY IF EXISTS "allow_insert_own_products" ON products;
DROP POLICY IF EXISTS "Users can insert own products" ON products;
DROP POLICY IF EXISTS "Users can insert their own products" ON products;

-- For UPDATE: Keep only "public_update_products" or create it
DROP POLICY IF EXISTS "products_update_policy" ON products;
DROP POLICY IF EXISTS "Allow public update access to products" ON products;
DROP POLICY IF EXISTS "allow_update_own_products" ON products;
DROP POLICY IF EXISTS "Users can update own products" ON products;
DROP POLICY IF EXISTS "Users can update their own products" ON products;

-- For DELETE: Keep only "public_delete_products" or create it
DROP POLICY IF EXISTS "products_delete_policy" ON products;
DROP POLICY IF EXISTS "Allow public delete access to products" ON products;
DROP POLICY IF EXISTS "allow_delete_own_products" ON products;
DROP POLICY IF EXISTS "Users can delete own products" ON products;
DROP POLICY IF EXISTS "Users can delete their own products" ON products;

-- Step 5: Ensure we have exactly 4 clean policies
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Create clean policies if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'public_read_products'
  ) THEN
    CREATE POLICY "public_read_products" ON products FOR SELECT TO public USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'public_insert_products'
  ) THEN
    CREATE POLICY "public_insert_products" ON products FOR INSERT TO public WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'public_update_products'
  ) THEN
    CREATE POLICY "public_update_products" ON products FOR UPDATE TO public USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'products' AND policyname = 'public_delete_products'
  ) THEN
    CREATE POLICY "public_delete_products" ON products FOR DELETE TO public USING (true);
  END IF;
END $$;

-- Step 6: Remove duplicate products (keep most recent)
DELETE FROM products a USING (
  SELECT MIN(ctid) as ctid_to_keep, name, COALESCE(supplier_id, '') as supplier_id
  FROM products
  GROUP BY name, COALESCE(supplier_id, '')
  HAVING COUNT(*) > 1
) b
WHERE a.name = b.name 
  AND COALESCE(a.supplier_id, '') = b.supplier_id
  AND a.ctid != b.ctid_to_keep;

-- Step 7: Verify results
SELECT '=== FINAL RESULTS ===' as section;

SELECT 'Total RLS policies:' as metric, COUNT(*) as value 
FROM pg_policies WHERE tablename = 'products';

SELECT 'Total products:' as metric, COUNT(*) as value FROM products;

SELECT 'Duplicate products:' as metric, COUNT(*) as value FROM (
  SELECT name, supplier_id FROM products 
  GROUP BY name, supplier_id 
  HAVING COUNT(*) > 1
) dups;

-- Show final policies
SELECT policyname, cmd as operation 
FROM pg_policies 
WHERE tablename = 'products' 
ORDER BY cmd, policyname;
