-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing objects
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
DROP FUNCTION IF EXISTS update_updated_at_column CASCADE;

-- Create update function with simpler syntax
CREATE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Create suppliers table first (referenced by products)
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users,
  name TEXT NOT NULL,
  contact TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create products table
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users,
  name TEXT NOT NULL,
  price NUMERIC(10, 2) NOT NULL,
  original_price NUMERIC(10, 2),
  discount NUMERIC(5, 2),
  unit TEXT NOT NULL,
  supplier_id UUID REFERENCES suppliers(id),
  category TEXT,
  notes TEXT,
  last_price_change TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create orders table
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users,
  supplier_id UUID REFERENCES suppliers(id),
  items JSONB NOT NULL,
  total NUMERIC(10, 2) NOT NULL,
  status TEXT NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create settings table
CREATE TABLE settings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users,
  country TEXT NOT NULL DEFAULT 'IT',
  language TEXT NOT NULL DEFAULT 'it',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes
CREATE INDEX idx_products_user ON products(user_id);
CREATE INDEX idx_suppliers_user ON suppliers(user_id);
CREATE INDEX idx_orders_user ON orders(user_id);
CREATE INDEX idx_settings_user ON settings(user_id);

-- Enable Row Level Security
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Products policies
CREATE POLICY products_select ON products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY products_insert ON products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY products_update ON products FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY products_delete ON products FOR DELETE USING (auth.uid() = user_id);

-- Suppliers policies
CREATE POLICY suppliers_select ON suppliers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY suppliers_insert ON suppliers FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY suppliers_update ON suppliers FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY suppliers_delete ON suppliers FOR DELETE USING (auth.uid() = user_id);

-- Orders policies
CREATE POLICY orders_select ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY orders_insert ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY orders_update ON orders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY orders_delete ON orders FOR DELETE USING (auth.uid() = user_id);

-- Settings policies
CREATE POLICY settings_select ON settings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY settings_insert ON settings FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY settings_update ON settings FOR UPDATE USING (auth.uid() = user_id);

-- Create triggers
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_suppliers_updated BEFORE UPDATE ON suppliers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_orders_updated BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_settings_updated BEFORE UPDATE ON settings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();