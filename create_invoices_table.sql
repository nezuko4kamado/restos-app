-- Create invoices table for app_43909
BEGIN;

-- Drop table if exists (for clean slate)
DROP TABLE IF EXISTS app_43909_invoices CASCADE;

-- Create invoices table
CREATE TABLE app_43909_invoices (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users NOT NULL,
  invoice_number TEXT NOT NULL,
  supplier_name TEXT NOT NULL,
  date DATE NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  vat_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  is_paid BOOLEAN NOT NULL DEFAULT FALSE,
  payment_date DATE,
  notes TEXT,
  items JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create indexes for query optimization
CREATE INDEX IF NOT EXISTS app_43909_invoices_user_idx ON app_43909_invoices(user_id);
CREATE INDEX IF NOT EXISTS app_43909_invoices_date_idx ON app_43909_invoices(date DESC);
CREATE INDEX IF NOT EXISTS app_43909_invoices_supplier_idx ON app_43909_invoices(supplier_name);
CREATE INDEX IF NOT EXISTS app_43909_invoices_is_paid_idx ON app_43909_invoices(is_paid);

-- Setup Row Level Security (RLS)
ALTER TABLE app_43909_invoices ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own invoices
CREATE POLICY "allow_read_own_invoices" ON app_43909_invoices
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Policy: Users can insert their own invoices
CREATE POLICY "allow_insert_own_invoices" ON app_43909_invoices
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can update their own invoices
CREATE POLICY "allow_update_own_invoices" ON app_43909_invoices
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Policy: Users can delete their own invoices
CREATE POLICY "allow_delete_own_invoices" ON app_43909_invoices
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

COMMIT;
