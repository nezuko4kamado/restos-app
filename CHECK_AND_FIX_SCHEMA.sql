-- ============================================================================
-- CHECK AND FIX: Verifica e aggiunge colonne mancanti in app_43909_products
-- Esegui questo script nel SQL Editor di Supabase
-- ============================================================================

-- 1. Verifica colonne esistenti nella tabella
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'app_43909_products'
ORDER BY ordinal_position;

-- 2. Aggiungi price_history_data se mancante
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'app_43909_products' 
        AND column_name = 'price_history_data'
    ) THEN
        ALTER TABLE app_43909_products ADD COLUMN price_history_data JSONB DEFAULT '[]'::jsonb;
        RAISE NOTICE 'Colonna price_history_data aggiunta con successo';
    ELSE
        RAISE NOTICE 'Colonna price_history_data già esistente';
    END IF;
END $$;

-- 3. Aggiungi price_difference se mancante
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'app_43909_products' 
        AND column_name = 'price_difference'
    ) THEN
        ALTER TABLE app_43909_products ADD COLUMN price_difference NUMERIC DEFAULT 0;
        RAISE NOTICE 'Colonna price_difference aggiunta con successo';
    ELSE
        RAISE NOTICE 'Colonna price_difference già esistente';
    END IF;
END $$;

-- 4. Aggiungi code_description se mancante
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'app_43909_products' 
        AND column_name = 'code_description'
    ) THEN
        ALTER TABLE app_43909_products ADD COLUMN code_description TEXT DEFAULT '';
        RAISE NOTICE 'Colonna code_description aggiunta con successo';
    ELSE
        RAISE NOTICE 'Colonna code_description già esistente';
    END IF;
END $$;

-- 5. Aggiungi updated_at se mancante
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'app_43909_products' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE app_43909_products ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
        RAISE NOTICE 'Colonna updated_at aggiunta con successo';
    ELSE
        RAISE NOTICE 'Colonna updated_at già esistente';
    END IF;
END $$;

-- 6. Verifica finale colonne dopo le modifiche
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'app_43909_products'
ORDER BY ordinal_position;

-- 7. Conta i prodotti per user_id (verifica dati esistenti)
SELECT user_id, COUNT(*) as product_count
FROM app_43909_products
GROUP BY user_id
ORDER BY product_count DESC;
