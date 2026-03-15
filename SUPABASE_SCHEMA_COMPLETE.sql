-- ============================================
-- COMPLETE SUPABASE SCHEMA FOR ALL 5 FEATURES
-- ============================================

-- 1. Complete user_settings table
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS store_name TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'light';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT true;

-- 2. Product Compatibility Table
CREATE TABLE IF NOT EXISTS product_compatibility (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id_1 UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  product_id_2 UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(product_id_1, product_id_2, user_id)
);

CREATE INDEX IF NOT EXISTS idx_product_compatibility_user ON product_compatibility(user_id);
CREATE INDEX IF NOT EXISTS idx_product_compatibility_product1 ON product_compatibility(product_id_1);
CREATE INDEX IF NOT EXISTS idx_product_compatibility_product2 ON product_compatibility(product_id_2);

-- RLS for product_compatibility
ALTER TABLE product_compatibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own product compatibility" ON product_compatibility
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own product compatibility" ON product_compatibility
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own product compatibility" ON product_compatibility
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- 3. Order Images Table
CREATE TABLE IF NOT EXISTS order_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  image_name TEXT,
  image_size INTEGER,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_images_order ON order_images(order_id);
CREATE INDEX IF NOT EXISTS idx_order_images_user ON order_images(user_id);

-- RLS for order_images
ALTER TABLE order_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own order images" ON order_images
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own order images" ON order_images
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own order images" ON order_images
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- 4. Search Filters Table
CREATE TABLE IF NOT EXISTS search_filters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  filter_name TEXT NOT NULL,
  filter_data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, filter_name)
);

CREATE INDEX IF NOT EXISTS idx_search_filters_user ON search_filters(user_id);

-- RLS for search_filters
ALTER TABLE search_filters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own search filters" ON search_filters
FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own search filters" ON search_filters
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own search filters" ON search_filters
FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own search filters" ON search_filters
FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- 5. Storage Bucket for Order Images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('order-images', 'order-images', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies
CREATE POLICY "Users can upload order images" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'order-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view their order images" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'order-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their order images" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'order-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public can view order images" ON storage.objects
FOR SELECT TO public
USING (bucket_id = 'order-images');
