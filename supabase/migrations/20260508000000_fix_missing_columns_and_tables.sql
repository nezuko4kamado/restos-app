-- ============================================================================
-- Migration: Fix missing columns in products table + create invoice_product_links
-- Date: 2026-05-08
-- 
-- This migration is IDEMPOTENT (safe to run multiple times).
--
-- Fixes:
--   1. 400 errors on products upsert — adds all missing columns
--   2. 404 error on invoice_product_links — creates the table
-- ============================================================================

-- ============================================================================
-- 1. ADD ALL MISSING COLUMNS TO products TABLE
-- ============================================================================

ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_price        DECIMAL(10,4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS discounted_price  DECIMAL(10,4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_percent  DECIMAL(5,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_amount   DECIMAL(10,4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_difference  DECIMAL(10,4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS previous_price    DECIMAL(10,4);
ALTER TABLE products ADD COLUMN IF NOT EXISTS price_history     JSONB DEFAULT '[]'::jsonb;
ALTER TABLE products ADD COLUMN IF NOT EXISTS code_description  TEXT;
ALTER TABLE products ADD COLUMN IF NOT EXISTS vat_rate          DECIMAL(5,2);
ALTER TABLE products ADD COLUMN IF NOT EXISTS notes             TEXT;

-- Backfill price_history to empty array for any rows where it is NULL
UPDATE products
SET price_history = '[]'::jsonb
WHERE price_history IS NULL;

-- Indexes (safe to re-run)
CREATE INDEX IF NOT EXISTS idx_products_code_description
    ON products(code_description)
    WHERE code_description IS NOT NULL AND code_description != '';

CREATE INDEX IF NOT EXISTS idx_products_price_history
    ON products USING GIN (price_history)
    WHERE price_history IS NOT NULL;

-- ============================================================================
-- 2. CREATE invoice_product_links TABLE
-- ============================================================================
-- This table links invoices to the products they contain, enabling
-- product-level price tracking and analytics per invoice.

CREATE TABLE IF NOT EXISTS invoice_product_links (
    id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id         UUID REFERENCES auth.users NOT NULL,
    invoice_id      UUID REFERENCES app_43909_invoices(id) ON DELETE CASCADE,
    product_id      TEXT NOT NULL,
    product_name    TEXT,
    supplier_id     UUID,
    supplier_name   TEXT,
    quantity        DECIMAL(10,4) DEFAULT 1,
    unit_price      DECIMAL(10,4),
    discounted_price DECIMAL(10,4),
    discount_percent DECIMAL(5,2),
    discount_amount  DECIMAL(10,4),
    vat_rate        DECIMAL(5,2),
    line_total      DECIMAL(10,4),
    notes           TEXT,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at      TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes for invoice_product_links
CREATE INDEX IF NOT EXISTS idx_ipl_user_id     ON invoice_product_links(user_id);
CREATE INDEX IF NOT EXISTS idx_ipl_invoice_id  ON invoice_product_links(invoice_id);
CREATE INDEX IF NOT EXISTS idx_ipl_product_id  ON invoice_product_links(product_id);
CREATE INDEX IF NOT EXISTS idx_ipl_supplier_id ON invoice_product_links(supplier_id);
CREATE INDEX IF NOT EXISTS idx_ipl_created_at  ON invoice_product_links(created_at DESC);

-- Row Level Security
ALTER TABLE invoice_product_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "allow_select_own_ipl" ON invoice_product_links;
CREATE POLICY "allow_select_own_ipl" ON invoice_product_links
    FOR SELECT TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "allow_insert_own_ipl" ON invoice_product_links;
CREATE POLICY "allow_insert_own_ipl" ON invoice_product_links
    FOR INSERT TO authenticated
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "allow_update_own_ipl" ON invoice_product_links;
CREATE POLICY "allow_update_own_ipl" ON invoice_product_links
    FOR UPDATE TO authenticated
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "allow_delete_own_ipl" ON invoice_product_links;
CREATE POLICY "allow_delete_own_ipl" ON invoice_product_links
    FOR DELETE TO authenticated
    USING (auth.uid() = user_id);

-- updated_at trigger (reuse existing function if present)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_ipl_updated_at ON invoice_product_links;
CREATE TRIGGER update_ipl_updated_at
    BEFORE UPDATE ON invoice_product_links
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();