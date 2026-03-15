-- ============================================
-- RESTO APP - Supabase Database Setup
-- ============================================
-- Run this SQL in your Supabase SQL Editor
-- This will create the missing tables for settings and draft orders

-- ============================================
-- 1. Settings Table
-- ============================================

CREATE TABLE IF NOT EXISTS settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  business_name TEXT DEFAULT '',
  country TEXT DEFAULT 'IT',
  default_currency TEXT DEFAULT 'EUR',
  language TEXT DEFAULT 'it',
  price_alert_threshold INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

-- Enable Row Level Security
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for settings
CREATE POLICY "Users can view their own settings"
  ON settings FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own settings"
  ON settings FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings"
  ON settings FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own settings"
  ON settings FOR DELETE 
  USING (auth.uid() = user_id);

-- ============================================
-- 2. Draft Orders Table
-- ============================================

CREATE TABLE IF NOT EXISTS draft_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  order_items JSONB NOT NULL,
  temporary_ocr_products JSONB DEFAULT '[]'::jsonb,
  is_cancelled BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_draft_orders_user_cancelled 
  ON draft_orders(user_id, is_cancelled);

-- Enable Row Level Security
ALTER TABLE draft_orders ENABLE ROW LEVEL SECURITY;

-- RLS Policies for draft_orders
CREATE POLICY "Users can view their own draft orders"
  ON draft_orders FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own draft orders"
  ON draft_orders FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own draft orders"
  ON draft_orders FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own draft orders"
  ON draft_orders FOR DELETE 
  USING (auth.uid() = user_id);

-- ============================================
-- 3. Verification Queries
-- ============================================

-- Run these to verify the tables were created successfully:
-- SELECT * FROM settings;
-- SELECT * FROM draft_orders;

-- Check RLS policies:
-- SELECT tablename, policyname FROM pg_policies WHERE tablename IN ('settings', 'draft_orders');