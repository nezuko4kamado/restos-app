-- ============================================
-- INTELLIGENT RLS POLICY CLEANUP - FIXED VERSION
-- Handles UUID columns correctly
-- ============================================

-- Step 1: Backup products table
CREATE TABLE IF NOT EXISTS products_backup_20251226 AS SELECT * FROM products;

-- Step 2: Analyze current RLS policies
SELECT 
  '=== CURRENT RLS POLICIES ANALYSIS ===' as section;

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
DROP POLICY IF EXISTS "products_select_policy" ON products;
DROP POLICY IF EXISTS "Allow public read access to products" ON products;
DROP POLICY IF EXISTS "allow_read_own_products" ON products;
DROP POLICY IF EXISTS "Users can view own products" ON products;
DROP POLICY IF EXISTS "Users can view their own products" ON products;

DROP POLICY IF EXISTS "products_insert_policy" ON products;
DROP POLICY IF EXISTS "Allow public insert access to products" ON products;
DROP POLICY IF EXISTS "allow_insert_own_products" ON products;
DROP POLICY IF EXISTS "Users can insert own products" ON products;
DROP POLICY IF EXISTS "Users can insert their own products" ON products;

DROP POLICY IF EXISTS "products_update_policy" ON products;
DROP POLICY IF EXISTS "Allow public update access to products" ON products;
DROP POLICY IF EXISTS "allow_update_own_products" ON products;
DROP POLICY IF EXISTS "Users can update own products" ON products;
DROP POLICY IF EXISTS "Users can update their own products" ON products;

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

-- Step 6: Remove duplicate products (FIXED - handles UUID properly)
-- Keep the most recent version of each duplicate
DELETE FROM products 
WHERE id IN (
  SELECT id
  FROM (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY name, supplier_id 
        ORDER BY created_at DESC
      ) as rn
    FROM products
  ) t
  WHERE rn > 1
);

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

-- Show VAT rates distribution
SELECT 
  vat_rate,
  COUNT(*) as product_count
FROM products
GROUP BY vat_rate
ORDER BY vat_rate;
