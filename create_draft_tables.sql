-- Create draft_orders table
CREATE TABLE IF NOT EXISTS draft_orders (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  temporary_ocr_products JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_draft_orders_user_id ON draft_orders(user_id);

-- Enable RLS
ALTER TABLE draft_orders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own draft orders" ON draft_orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own draft orders" ON draft_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own draft orders" ON draft_orders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own draft orders" ON draft_orders
  FOR DELETE USING (auth.uid() = user_id);

-- Create cancelled_draft_orders table
CREATE TABLE IF NOT EXISTS cancelled_draft_orders (
  id TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  temporary_ocr_products JSONB DEFAULT '[]'::jsonb,
  cancelled_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS idx_cancelled_draft_orders_user_id ON cancelled_draft_orders(user_id);

-- Enable RLS
ALTER TABLE cancelled_draft_orders ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own cancelled drafts" ON cancelled_draft_orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own cancelled drafts" ON cancelled_draft_orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own cancelled drafts" ON cancelled_draft_orders
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own cancelled drafts" ON cancelled_draft_orders
  FOR DELETE USING (auth.uid() = user_id);
