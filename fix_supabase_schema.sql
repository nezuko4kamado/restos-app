-- ============================================================================
-- FIX SUPABASE SCHEMA - Complete Database Setup
-- ============================================================================
-- This script fixes all table structure issues and ensures compatibility
-- with the TypeScript code in storage.ts
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. DROP AND RECREATE user_settings TABLE (was 'settings')
-- ============================================================================
DROP TABLE IF EXISTS settings CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;

CREATE TABLE user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users ON DELETE CASCADE,
  country TEXT NOT NULL DEFAULT 'IT',
  language TEXT NOT NULL DEFAULT 'it',
  default_currency TEXT NOT NULL DEFAULT 'EUR',
  font_size TEXT NOT NULL DEFAULT 'medium',
  layout_mode TEXT NOT NULL DEFAULT 'expanded',
  price_change_threshold INTEGER NOT NULL DEFAULT 10,
  recurring_order_reminder_days INTEGER NOT NULL DEFAULT 3,
  enable_recurring_reminders BOOLEAN NOT NULL DEFAULT true,
  store_name TEXT NOT NULL DEFAULT 'Il Mio Ristorante',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_settings_user ON user_settings(user_id);

-- ============================================================================
-- 2. ENSURE suppliers TABLE HAS user_id COLUMN
-- ============================================================================
-- Check if suppliers table exists and add user_id if missing
DO $$ 
BEGIN
    -- If table doesn't exist, create it
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') THEN
        CREATE TABLE suppliers (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
          name TEXT NOT NULL,
          phone TEXT,
          mobile TEXT,
          email TEXT,
          products JSONB DEFAULT '[]'::jsonb,
          address TEXT,
          notes TEXT,
          country TEXT,
          is_whitelisted BOOLEAN DEFAULT false,
          contact TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    ELSE
        -- If table exists but missing user_id, add it
        IF NOT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'suppliers' AND column_name = 'user_id'
        ) THEN
            ALTER TABLE suppliers ADD COLUMN user_id UUID REFERENCES auth.users ON DELETE CASCADE;
            -- Set a default user_id for existing records (you may need to update this manually)
            -- UPDATE suppliers SET user_id = (SELECT id FROM auth.users LIMIT 1) WHERE user_id IS NULL;
            ALTER TABLE suppliers ALTER COLUMN user_id SET NOT NULL;
        END IF;
        
        -- Ensure other columns exist
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'mobile') THEN
            ALTER TABLE suppliers ADD COLUMN mobile TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'products') THEN
            ALTER TABLE suppliers ADD COLUMN products JSONB DEFAULT '[]'::jsonb;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'is_whitelisted') THEN
            ALTER TABLE suppliers ADD COLUMN is_whitelisted BOOLEAN DEFAULT false;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'suppliers' AND column_name = 'contact') THEN
            ALTER TABLE suppliers ADD COLUMN contact TEXT;
        END IF;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_suppliers_user ON suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

-- ============================================================================
-- 3. ENSURE products TABLE HAS ALL REQUIRED COLUMNS
-- ============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
        CREATE TABLE products (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
          name TEXT NOT NULL,
          price DECIMAL(10,2) NOT NULL,
          image TEXT,
          supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
          category TEXT DEFAULT 'general',
          price_history JSONB DEFAULT '[]'::jsonb,
          vat_rate DECIMAL(5,2),
          discount_percent DECIMAL(5,2),
          original_price DECIMAL(10,2),
          discount DECIMAL(10,2),
          unit TEXT DEFAULT 'kg',
          notes TEXT,
          code TEXT,
          ean_code TEXT,
          stock_quantity INTEGER,
          min_stock_level INTEGER,
          last_price_change TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    ELSE
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'user_id') THEN
            ALTER TABLE products ADD COLUMN user_id UUID REFERENCES auth.users ON DELETE CASCADE;
            ALTER TABLE products ALTER COLUMN user_id SET NOT NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'price_history') THEN
            ALTER TABLE products ADD COLUMN price_history JSONB DEFAULT '[]'::jsonb;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'vat_rate') THEN
            ALTER TABLE products ADD COLUMN vat_rate DECIMAL(5,2);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'discount_percent') THEN
            ALTER TABLE products ADD COLUMN discount_percent DECIMAL(5,2);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'original_price') THEN
            ALTER TABLE products ADD COLUMN original_price DECIMAL(10,2);
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'ean_code') THEN
            ALTER TABLE products ADD COLUMN ean_code TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'stock_quantity') THEN
            ALTER TABLE products ADD COLUMN stock_quantity INTEGER;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'min_stock_level') THEN
            ALTER TABLE products ADD COLUMN min_stock_level INTEGER;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'last_price_change') THEN
            ALTER TABLE products ADD COLUMN last_price_change TIMESTAMPTZ;
        END IF;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_products_user ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);

-- ============================================================================
-- 4. ENSURE orders TABLE HAS ALL REQUIRED COLUMNS
-- ============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
        CREATE TABLE orders (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
          supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
          order_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          items JSONB DEFAULT '[]'::jsonb,
          total DECIMAL(10,2) NOT NULL,
          status TEXT DEFAULT 'pending',
          is_recurring BOOLEAN DEFAULT false,
          recurrence_frequency TEXT,
          next_order_date TIMESTAMPTZ,
          order_number TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    ELSE
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'user_id') THEN
            ALTER TABLE orders ADD COLUMN user_id UUID REFERENCES auth.users ON DELETE CASCADE;
            ALTER TABLE orders ALTER COLUMN user_id SET NOT NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'items') THEN
            ALTER TABLE orders ADD COLUMN items JSONB DEFAULT '[]'::jsonb;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'is_recurring') THEN
            ALTER TABLE orders ADD COLUMN is_recurring BOOLEAN DEFAULT false;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'recurrence_frequency') THEN
            ALTER TABLE orders ADD COLUMN recurrence_frequency TEXT;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'next_order_date') THEN
            ALTER TABLE orders ADD COLUMN next_order_date TIMESTAMPTZ;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'order_number') THEN
            ALTER TABLE orders ADD COLUMN order_number TEXT;
        END IF;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_supplier ON orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date DESC);

-- ============================================================================
-- 5. ENSURE invoices TABLE HAS ALL REQUIRED COLUMNS
-- ============================================================================
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
        CREATE TABLE invoices (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
          supplier_id UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
          order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
          invoice_number TEXT NOT NULL,
          date TIMESTAMPTZ NOT NULL,
          amount DECIMAL(10,2) NOT NULL,
          total DECIMAL(10,2) NOT NULL,
          items JSONB DEFAULT '[]'::jsonb,
          notes TEXT,
          status TEXT DEFAULT 'unpaid',
          issued_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
    ELSE
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'user_id') THEN
            ALTER TABLE invoices ADD COLUMN user_id UUID REFERENCES auth.users ON DELETE CASCADE;
            ALTER TABLE invoices ALTER COLUMN user_id SET NOT NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'items') THEN
            ALTER TABLE invoices ADD COLUMN items JSONB DEFAULT '[]'::jsonb;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'total') THEN
            ALTER TABLE invoices ADD COLUMN total DECIMAL(10,2);
            UPDATE invoices SET total = amount WHERE total IS NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'status') THEN
            ALTER TABLE invoices ADD COLUMN status TEXT DEFAULT 'unpaid';
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'invoices' AND column_name = 'issued_at') THEN
            ALTER TABLE invoices ADD COLUMN issued_at TIMESTAMPTZ;
        END IF;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier ON invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date DESC);

-- ============================================================================
-- 6. CREATE DRAFT ORDERS TABLES
-- ============================================================================
CREATE TABLE IF NOT EXISTS draft_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  order_items JSONB DEFAULT '[]'::jsonb,
  temporary_ocr_products JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_draft_orders_user ON draft_orders(user_id);

CREATE TABLE IF NOT EXISTS cancelled_draft_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  order_items JSONB DEFAULT '[]'::jsonb,
  temporary_ocr_products JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cancelled_draft_orders_user ON cancelled_draft_orders(user_id);

-- ============================================================================
-- 7. ENABLE ROW LEVEL SECURITY ON ALL TABLES
-- ============================================================================
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE cancelled_draft_orders ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 8. CREATE RLS POLICIES
-- ============================================================================

-- user_settings policies
DROP POLICY IF EXISTS "allow_read_own_settings" ON user_settings;
DROP POLICY IF EXISTS "allow_insert_own_settings" ON user_settings;
DROP POLICY IF EXISTS "allow_update_own_settings" ON user_settings;

CREATE POLICY "allow_read_own_settings" ON user_settings 
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "allow_insert_own_settings" ON user_settings 
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "allow_update_own_settings" ON user_settings 
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- suppliers policies
DROP POLICY IF EXISTS "allow_read_own_suppliers" ON suppliers;
DROP POLICY IF EXISTS "allow_insert_own_suppliers" ON suppliers;
DROP POLICY IF EXISTS "allow_update_own_suppliers" ON suppliers;
DROP POLICY IF EXISTS "allow_delete_own_suppliers" ON suppliers;

CREATE POLICY "allow_read_own_suppliers" ON suppliers 
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "allow_insert_own_suppliers" ON suppliers 
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "allow_update_own_suppliers" ON suppliers 
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "allow_delete_own_suppliers" ON suppliers 
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- products policies
DROP POLICY IF EXISTS "allow_read_own_products" ON products;
DROP POLICY IF EXISTS "allow_insert_own_products" ON products;
DROP POLICY IF EXISTS "allow_update_own_products" ON products;
DROP POLICY IF EXISTS "allow_delete_own_products" ON products;

CREATE POLICY "allow_read_own_products" ON products 
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "allow_insert_own_products" ON products 
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "allow_update_own_products" ON products 
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "allow_delete_own_products" ON products 
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- orders policies
DROP POLICY IF EXISTS "allow_read_own_orders" ON orders;
DROP POLICY IF EXISTS "allow_insert_own_orders" ON orders;
DROP POLICY IF EXISTS "allow_update_own_orders" ON orders;
DROP POLICY IF EXISTS "allow_delete_own_orders" ON orders;

CREATE POLICY "allow_read_own_orders" ON orders 
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "allow_insert_own_orders" ON orders 
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "allow_update_own_orders" ON orders 
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "allow_delete_own_orders" ON orders 
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- invoices policies
DROP POLICY IF EXISTS "allow_read_own_invoices" ON invoices;
DROP POLICY IF EXISTS "allow_insert_own_invoices" ON invoices;
DROP POLICY IF EXISTS "allow_update_own_invoices" ON invoices;
DROP POLICY IF EXISTS "allow_delete_own_invoices" ON invoices;

CREATE POLICY "allow_read_own_invoices" ON invoices 
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "allow_insert_own_invoices" ON invoices 
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "allow_update_own_invoices" ON invoices 
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "allow_delete_own_invoices" ON invoices 
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- draft_orders policies
DROP POLICY IF EXISTS "allow_read_own_drafts" ON draft_orders;
DROP POLICY IF EXISTS "allow_insert_own_drafts" ON draft_orders;
DROP POLICY IF EXISTS "allow_update_own_drafts" ON draft_orders;
DROP POLICY IF EXISTS "allow_delete_own_drafts" ON draft_orders;

CREATE POLICY "allow_read_own_drafts" ON draft_orders 
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "allow_insert_own_drafts" ON draft_orders 
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "allow_update_own_drafts" ON draft_orders 
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "allow_delete_own_drafts" ON draft_orders 
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- cancelled_draft_orders policies
DROP POLICY IF EXISTS "allow_read_own_cancelled_drafts" ON cancelled_draft_orders;
DROP POLICY IF EXISTS "allow_insert_own_cancelled_drafts" ON cancelled_draft_orders;
DROP POLICY IF EXISTS "allow_delete_own_cancelled_drafts" ON cancelled_draft_orders;

CREATE POLICY "allow_read_own_cancelled_drafts" ON cancelled_draft_orders 
    FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "allow_insert_own_cancelled_drafts" ON cancelled_draft_orders 
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "allow_delete_own_cancelled_drafts" ON cancelled_draft_orders 
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- ============================================================================
-- 9. CREATE TRIGGERS FOR updated_at
-- ============================================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_settings_updated_at ON user_settings;
CREATE TRIGGER update_user_settings_updated_at
    BEFORE UPDATE ON user_settings
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_suppliers_updated_at ON suppliers;
CREATE TRIGGER update_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;
CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON invoices;
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_draft_orders_updated_at ON draft_orders;
CREATE TRIGGER update_draft_orders_updated_at
    BEFORE UPDATE ON draft_orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- ============================================================================
-- VERIFICATION QUERIES (Run these to verify the setup)
-- ============================================================================
-- SELECT table_name, column_name, data_type 
-- FROM information_schema.columns 
-- WHERE table_name IN ('user_settings', 'suppliers', 'products', 'orders', 'invoices')
-- ORDER BY table_name, ordinal_position;