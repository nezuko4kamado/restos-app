-- Migration: Add Advanced Features (Price History, Invoices, Supplier Whitelist)
-- Created: 2025-01-01

BEGIN;

-- ============================================================================
-- 1. INVOICES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS app_43909_invoices (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    invoice_number VARCHAR(100) NOT NULL,
    supplier_name VARCHAR(255) NOT NULL,
    invoice_date DATE NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    vat_amount DECIMAL(10, 2) NOT NULL,
    is_paid BOOLEAN DEFAULT false,
    payment_date DATE,
    notes TEXT,
    file_url TEXT,
    items JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes for invoices
CREATE INDEX IF NOT EXISTS invoices_user_idx ON app_43909_invoices(user_id);
CREATE INDEX IF NOT EXISTS invoices_date_idx ON app_43909_invoices(invoice_date DESC);
CREATE INDEX IF NOT EXISTS invoices_supplier_idx ON app_43909_invoices(supplier_name);
CREATE INDEX IF NOT EXISTS invoices_paid_idx ON app_43909_invoices(is_paid);

-- RLS for invoices
ALTER TABLE app_43909_invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_read_own_invoices" ON app_43909_invoices 
    FOR SELECT 
    TO authenticated 
    USING (auth.uid() = user_id);

CREATE POLICY "allow_insert_own_invoices" ON app_43909_invoices 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "allow_update_own_invoices" ON app_43909_invoices 
    FOR UPDATE 
    TO authenticated 
    USING (auth.uid() = user_id);

CREATE POLICY "allow_delete_own_invoices" ON app_43909_invoices 
    FOR DELETE 
    TO authenticated 
    USING (auth.uid() = user_id);

-- ============================================================================
-- 2. PRICE HISTORY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS app_43909_price_history (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    product_id VARCHAR(255) NOT NULL,
    product_name VARCHAR(500) NOT NULL,
    supplier_name VARCHAR(255) NOT NULL,
    old_price DECIMAL(10, 2),
    new_price DECIMAL(10, 2) NOT NULL,
    price_change_percent DECIMAL(5, 2),
    invoice_id UUID REFERENCES app_43909_invoices(id) ON DELETE SET NULL,
    change_date TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Indexes for price_history
CREATE INDEX IF NOT EXISTS price_history_user_idx ON app_43909_price_history(user_id);
CREATE INDEX IF NOT EXISTS price_history_product_idx ON app_43909_price_history(product_id);
CREATE INDEX IF NOT EXISTS price_history_supplier_idx ON app_43909_price_history(supplier_name);
CREATE INDEX IF NOT EXISTS price_history_date_idx ON app_43909_price_history(change_date DESC);

-- RLS for price_history
ALTER TABLE app_43909_price_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_read_own_price_history" ON app_43909_price_history 
    FOR SELECT 
    TO authenticated 
    USING (auth.uid() = user_id);

CREATE POLICY "allow_insert_own_price_history" ON app_43909_price_history 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- 3. SUPPLIER WHITELIST TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS app_43909_supplier_whitelist (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users NOT NULL,
    supplier_name VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    priority INTEGER DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE(user_id, supplier_name)
);

-- Indexes for supplier_whitelist
CREATE INDEX IF NOT EXISTS supplier_whitelist_user_idx ON app_43909_supplier_whitelist(user_id);
CREATE INDEX IF NOT EXISTS supplier_whitelist_active_idx ON app_43909_supplier_whitelist(is_active);
CREATE INDEX IF NOT EXISTS supplier_whitelist_priority_idx ON app_43909_supplier_whitelist(priority DESC);

-- RLS for supplier_whitelist
ALTER TABLE app_43909_supplier_whitelist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_read_own_whitelist" ON app_43909_supplier_whitelist 
    FOR SELECT 
    TO authenticated 
    USING (auth.uid() = user_id);

CREATE POLICY "allow_insert_own_whitelist" ON app_43909_supplier_whitelist 
    FOR INSERT 
    TO authenticated 
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "allow_update_own_whitelist" ON app_43909_supplier_whitelist 
    FOR UPDATE 
    TO authenticated 
    USING (auth.uid() = user_id);

CREATE POLICY "allow_delete_own_whitelist" ON app_43909_supplier_whitelist 
    FOR DELETE 
    TO authenticated 
    USING (auth.uid() = user_id);

-- ============================================================================
-- 4. PRODUCTS TABLE ENHANCEMENTS
-- ============================================================================
-- Add ean_code column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'app_43909_products' 
        AND column_name = 'ean_code'
    ) THEN
        ALTER TABLE app_43909_products ADD COLUMN ean_code VARCHAR(20);
        CREATE INDEX IF NOT EXISTS products_ean_idx ON app_43909_products(ean_code);
    END IF;
END $$;

-- Add price_history_data column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'app_43909_products' 
        AND column_name = 'price_history_data'
    ) THEN
        ALTER TABLE app_43909_products ADD COLUMN price_history_data JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- ============================================================================
-- 5. FUNCTIONS AND TRIGGERS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for invoices updated_at
DROP TRIGGER IF EXISTS update_invoices_updated_at ON app_43909_invoices;
CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON app_43909_invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Trigger for supplier_whitelist updated_at
DROP TRIGGER IF EXISTS update_supplier_whitelist_updated_at ON app_43909_supplier_whitelist;
CREATE TRIGGER update_supplier_whitelist_updated_at
    BEFORE UPDATE ON app_43909_supplier_whitelist
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMIT;