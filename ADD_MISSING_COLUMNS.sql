-- ============================================
-- AGGIUNGI COLONNE MANCANTI A app_43909_products
-- Eseguire nel Supabase Dashboard > SQL Editor
-- ============================================

-- 1. Aggiungi price_history_data (storico prezzi in formato JSONB)
ALTER TABLE app_43909_products 
ADD COLUMN IF NOT EXISTS price_history_data JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN app_43909_products.price_history_data IS 'Array of price history entries: [{price, date}]';

-- 2. Aggiungi code_description (codice prodotto dalla fattura)
ALTER TABLE app_43909_products 
ADD COLUMN IF NOT EXISTS code_description TEXT DEFAULT '';

COMMENT ON COLUMN app_43909_products.code_description IS 'Product code from invoice for matching';

-- 3. Aggiungi price_difference (variazione percentuale prezzo)
ALTER TABLE app_43909_products 
ADD COLUMN IF NOT EXISTS price_difference DECIMAL(10,2) DEFAULT 0;

COMMENT ON COLUMN app_43909_products.price_difference IS 'Percentage change from previous price';

-- 4. Verifica che le colonne siano state aggiunte
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'app_43909_products'
AND column_name IN ('price_history_data', 'code_description', 'price_difference')
ORDER BY column_name;
