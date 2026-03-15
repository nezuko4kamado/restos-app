-- ============================================================================
-- DELETE DUPLICATE PRODUCTS - Keep only the first 4 unique products
-- ============================================================================

-- First, let's see what products exist (for verification)
SELECT id, name, category, vat_rate, created_at, user_id
FROM products
ORDER BY created_at;

-- Delete duplicate products, keeping only the oldest entry for each unique product name
DELETE FROM products
WHERE id NOT IN (
    SELECT DISTINCT ON (name, category) id
    FROM products
    ORDER BY name, category, created_at ASC
);

-- Verify the result - should show only 4 products now
SELECT id, name, category, vat_rate, created_at
FROM products
ORDER BY name;
