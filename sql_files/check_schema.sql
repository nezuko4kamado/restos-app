-- ============================================
-- VERIFICA SCHEMA DATABASE - TABELLA PRODUCTS
-- ============================================
-- Questo script verifica la struttura della tabella products
-- e mostra informazioni dettagliate su colonne, indici e vincoli.

-- 1. INFORMAZIONI COLONNE
SELECT 
    column_name AS "Nome Colonna",
    data_type AS "Tipo Dati",
    character_maximum_length AS "Lunghezza Max",
    is_nullable AS "Nullable",
    column_default AS "Valore Default"
FROM 
    information_schema.columns
WHERE 
    table_schema = 'public' 
    AND table_name = 'products'
ORDER BY 
    ordinal_position;

-- 2. INDICI DELLA TABELLA
SELECT
    indexname AS "Nome Indice",
    indexdef AS "Definizione Indice"
FROM
    pg_indexes
WHERE
    schemaname = 'public'
    AND tablename = 'products';

-- 3. VINCOLI (CONSTRAINTS)
SELECT
    conname AS "Nome Vincolo",
    contype AS "Tipo Vincolo",
    pg_get_constraintdef(oid) AS "Definizione"
FROM
    pg_constraint
WHERE
    conrelid = 'public.products'::regclass;

-- 4. STATISTICHE TABELLA
SELECT
    schemaname AS "Schema",
    tablename AS "Tabella",
    n_live_tup AS "Righe Totali",
    n_dead_tup AS "Righe Morte",
    last_vacuum AS "Ultimo Vacuum",
    last_autovacuum AS "Ultimo Autovacuum",
    last_analyze AS "Ultima Analisi"
FROM
    pg_stat_user_tables
WHERE
    schemaname = 'public'
    AND tablename = 'products';

-- 5. DIMENSIONE TABELLA
SELECT
    pg_size_pretty(pg_total_relation_size('public.products')) AS "Dimensione Totale",
    pg_size_pretty(pg_relation_size('public.products')) AS "Dimensione Dati",
    pg_size_pretty(pg_total_relation_size('public.products') - pg_relation_size('public.products')) AS "Dimensione Indici";