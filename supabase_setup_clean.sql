-- =====================================================
-- SUPABASE DATABASE SETUP SQL
-- Restaurant Management App
-- =====================================================
-- Execute this SQL in your Supabase SQL Editor
-- Dashboard -> SQL Editor -> New Query -> Paste and Run
-- =====================================================

-- =====================================================
-- 1. CREATE TABLES
-- =====================================================

-- Products Table
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    supplier_id UUID NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    vat_rate NUMERIC(5, 2) DEFAULT 0,
    discount_percent NUMERIC(5, 2) DEFAULT 0,
    price_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Suppliers Table
CREATE TABLE IF NOT EXISTS suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    contact TEXT,
    email TEXT,
    phone TEXT,
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    supplier_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    total NUMERIC(10, 2) NOT NULL,
    notes TEXT,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    order_date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Invoices Table
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    supplier_id UUID NOT NULL,
    invoice_number TEXT NOT NULL,
    date DATE NOT NULL,
    total NUMERIC(10, 2) NOT NULL,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Price History Table
CREATE TABLE IF NOT EXISTS price_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    date TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    source TEXT,
    invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
    change_percent NUMERIC(5, 2),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- =====================================================
-- 2. CREATE INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_products_user_id ON products(user_id);
CREATE INDEX IF NOT EXISTS idx_products_supplier_id ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_created_at ON products(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_suppliers_user_id ON suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_created_at ON suppliers(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_supplier_id ON orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier_id ON invoices(supplier_id);
CREATE INDEX IF NOT EXISTS idx_invoices_date ON invoices(date DESC);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON invoices(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_price_history_user_id ON price_history(user_id);
CREATE INDEX IF NOT EXISTS idx_price_history_product_id ON price_history(product_id);
CREATE INDEX IF NOT EXISTS idx_price_history_date ON price_history(date DESC);

-- =====================================================
-- 3. ENABLE ROW LEVEL SECURITY
-- =====================================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_history ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 4. CREATE RLS POLICIES
-- =====================================================

-- Products Policies
CREATE POLICY users_view_own_products
    ON products FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY users_insert_own_products
    ON products FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY users_update_own_products
    ON products FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY users_delete_own_products
    ON products FOR DELETE
    USING (auth.uid() = user_id);

-- Suppliers Policies
CREATE POLICY users_view_own_suppliers
    ON suppliers FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY users_insert_own_suppliers
    ON suppliers FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY users_update_own_suppliers
    ON suppliers FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY users_delete_own_suppliers
    ON suppliers FOR DELETE
    USING (auth.uid() = user_id);

-- Orders Policies
CREATE POLICY users_view_own_orders
    ON orders FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY users_insert_own_orders
    ON orders FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY users_update_own_orders
    ON orders FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY users_delete_own_orders
    ON orders FOR DELETE
    USING (auth.uid() = user_id);

-- Invoices Policies
CREATE POLICY users_view_own_invoices
    ON invoices FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY users_insert_own_invoices
    ON invoices FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY users_update_own_invoices
    ON invoices FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY users_delete_own_invoices
    ON invoices FOR DELETE
    USING (auth.uid() = user_id);

-- Price History Policies
CREATE POLICY users_view_own_price_history
    ON price_history FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY users_insert_own_price_history
    ON price_history FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY users_update_own_price_history
    ON price_history FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY users_delete_own_price_history
    ON price_history FOR DELETE
    USING (auth.uid() = user_id);

-- =====================================================
-- 5. CREATE FUNCTIONS FOR AUTOMATIC TIMESTAMPS
-- =====================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- 6. CREATE TRIGGERS FOR AUTOMATIC TIMESTAMPS
-- =====================================================

CREATE TRIGGER update_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- SETUP COMPLETE
-- =====================================================