-- ============================================================
-- DATABASE STATUS VERIFICATION SCRIPT
-- ============================================================
-- Purpose: Verify the current state of the products database
-- Usage: Run these queries in Supabase SQL Editor
-- ============================================================

-- 1. COUNT TOTAL PRODUCTS
-- ============================================================
SELECT COUNT(*) as total_products
FROM products;

-- 2. CHECK FOR REMAINING DUPLICATES
-- ============================================================
-- This query identifies products with the same name (case-insensitive)
SELECT 
    LOWER(name) as product_name,
    COUNT(*) as duplicate_count,
    ARRAY_AGG(id ORDER BY created_at DESC) as product_ids,
    ARRAY_AGG(vat_rate ORDER BY created_at DESC) as vat_rates,
    ARRAY_AGG(created_at ORDER BY created_at DESC) as created_dates
FROM products
GROUP BY LOWER(name)
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 3. PRODUCTS GROUPED BY VAT RATE
-- ============================================================
SELECT 
    vat_rate,
    COUNT(*) as product_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM products), 2) as percentage
FROM products
GROUP BY vat_rate
ORDER BY vat_rate;

-- 4. PRODUCTS GROUPED BY SUPPLIER
-- ============================================================
SELECT 
    COALESCE(supplier_id::text, 'No Supplier') as supplier_id,
    COUNT(*) as product_count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM products), 2) as percentage
FROM products
GROUP BY supplier_id
ORDER BY product_count DESC;

-- 5. PRODUCTS WITHOUT SUPPLIER
-- ============================================================
SELECT 
    COUNT(*) as products_without_supplier
FROM products
WHERE supplier_id IS NULL;

-- 6. RECENT PRODUCTS (Last 10)
-- ============================================================
SELECT 
    id,
    name,
    vat_rate,
    supplier_id,
    created_at
FROM products
ORDER BY created_at DESC
LIMIT 10;

-- 7. SUMMARY STATISTICS
-- ============================================================
SELECT 
    COUNT(*) as total_products,
    COUNT(DISTINCT LOWER(name)) as unique_product_names,
    COUNT(*) - COUNT(DISTINCT LOWER(name)) as duplicate_records,
    COUNT(DISTINCT supplier_id) as unique_suppliers,
    COUNT(DISTINCT vat_rate) as unique_vat_rates,
    MIN(created_at) as oldest_product_date,
    MAX(created_at) as newest_product_date
FROM products;