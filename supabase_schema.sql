-- Create scanned_products table for caching Open Food Facts data
CREATE TABLE IF NOT EXISTS scanned_products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ean TEXT NOT NULL UNIQUE,
  product_name TEXT NOT NULL,
  brand TEXT,
  image_url TEXT,
  quantity TEXT,
  category TEXT,
  source TEXT DEFAULT 'openfoodfacts',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create index on EAN for fast lookups
CREATE INDEX IF NOT EXISTS scanned_products_ean_idx ON scanned_products(ean);

-- Enable Row Level Security
ALTER TABLE scanned_products ENABLE ROW LEVEL SECURITY;

-- Allow public read access (anyone can view cached products)
CREATE POLICY "allow_public_read_scanned_products" ON scanned_products
  FOR SELECT
  USING (true);

-- Allow authenticated users to insert new products
CREATE POLICY "allow_authenticated_insert_scanned_products" ON scanned_products
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to update existing products
CREATE POLICY "allow_authenticated_update_scanned_products" ON scanned_products
  FOR UPDATE
  TO authenticated
  USING (true);
