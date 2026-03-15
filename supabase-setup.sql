-- Restaurant Management App - Supabase Database Setup
-- This script creates the necessary tables without authentication requirements

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Products table
CREATE TABLE IF NOT EXISTS products (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
  price DECIMAL(10, 2) NOT NULL,
  unit TEXT NOT NULL,
  price_history JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Suppliers table
CREATE TABLE IF NOT EXISTS suppliers (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  supplier_id UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  order_date DATE NOT NULL,
  products JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_amount DECIMAL(10, 2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'cancelled')),
  is_recurring BOOLEAN DEFAULT FALSE,
  recurring_frequency TEXT CHECK (recurring_frequency IN ('daily', 'weekly', 'monthly')),
  next_order_date DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
CREATE INDEX IF NOT EXISTS idx_products_supplier ON products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_orders_supplier ON orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);

-- Enable Row Level Security (RLS) but allow public access
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Create policies to allow public access (no authentication required)
-- Products policies
CREATE POLICY "Allow public read access to products" 
  ON products FOR SELECT 
  USING (true);

CREATE POLICY "Allow public insert access to products" 
  ON products FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow public update access to products" 
  ON products FOR UPDATE 
  USING (true);

CREATE POLICY "Allow public delete access to products" 
  ON products FOR DELETE 
  USING (true);

-- Suppliers policies
CREATE POLICY "Allow public read access to suppliers" 
  ON suppliers FOR SELECT 
  USING (true);

CREATE POLICY "Allow public insert access to suppliers" 
  ON suppliers FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow public update access to suppliers" 
  ON suppliers FOR UPDATE 
  USING (true);

CREATE POLICY "Allow public delete access to suppliers" 
  ON suppliers FOR DELETE 
  USING (true);

-- Orders policies
CREATE POLICY "Allow public read access to orders" 
  ON orders FOR SELECT 
  USING (true);

CREATE POLICY "Allow public insert access to orders" 
  ON orders FOR INSERT 
  WITH CHECK (true);

CREATE POLICY "Allow public update access to orders" 
  ON orders FOR UPDATE 
  USING (true);

CREATE POLICY "Allow public delete access to orders" 
  ON orders FOR DELETE 
  USING (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically update updated_at
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