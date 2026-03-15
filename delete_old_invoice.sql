-- Script per eliminare la fattura problematica senza supplier_id
-- Fattura ID: 4dc08f29-a6a9-454c-9f4e-e18b2c373cd4
-- Numero fattura: 3050153
-- Data creazione: 2025-12-02 18:12

DELETE FROM app_43909_invoices 
WHERE id = '4dc08f29-a6a9-454c-9f4e-e18b2c373cd4';

-- Verifica che la fattura sia stata eliminata
SELECT COUNT(*) as remaining_count 
FROM app_43909_invoices 
WHERE id = '4dc08f29-a6a9-454c-9f4e-e18b2c373cd4';