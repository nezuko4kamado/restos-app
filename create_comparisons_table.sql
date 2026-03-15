BEGIN;

-- Create product_comparisons table
CREATE TABLE IF NOT EXISTS product_comparisons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_a_id TEXT NOT NULL,
  product_a_name TEXT NOT NULL,
  product_b_id TEXT NOT NULL,
  product_b_name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create unique constraint to prevent duplicate comparisons
CREATE UNIQUE INDEX IF NOT EXISTS unique_user_comparison 
  ON product_comparisons(user_id, product_a_id, product_b_id);

-- Enable Row Level Security
ALTER TABLE product_comparisons ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own comparisons
DROP POLICY IF EXISTS "Users can view own comparisons" ON product_comparisons;
CREATE POLICY "Users can view own comparisons"
  ON product_comparisons FOR SELECT
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own comparisons
DROP POLICY IF EXISTS "Users can insert own comparisons" ON product_comparisons;
CREATE POLICY "Users can insert own comparisons"
  ON product_comparisons FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own comparisons
DROP POLICY IF EXISTS "Users can delete own comparisons" ON product_comparisons;
CREATE POLICY "Users can delete own comparisons"
  ON product_comparisons FOR DELETE
  USING (auth.uid() = user_id);

COMMIT;
