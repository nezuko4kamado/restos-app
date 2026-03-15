-- Check for duplicate products in database
SELECT name, supplier_id, COUNT(*) as count, 
       STRING_AGG(id::text, ', ') as ids,
       STRING_AGG(vat_rate::text, ', ') as vat_rates,
       STRING_AGG(created_at::text, ', ') as created_dates
FROM products
GROUP BY name, supplier_id
HAVING COUNT(*) > 1
ORDER BY count DESC;
