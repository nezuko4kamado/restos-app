-- Check if supplier_id column exists in invoices table
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'app_43909_invoices'
ORDER BY ordinal_position;
