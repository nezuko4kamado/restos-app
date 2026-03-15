-- Test query to check if invoices table exists and has data
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'app_43909_invoices'
ORDER BY ordinal_position;

-- Check if there are any invoices
SELECT COUNT(*) as invoice_count FROM app_43909_invoices;

-- Get sample invoices
SELECT 
  id,
  invoice_number,
  supplier_name,
  date,
  total_amount,
  vat_amount,
  is_paid,
  created_at
FROM app_43909_invoices
ORDER BY created_at DESC
LIMIT 5;