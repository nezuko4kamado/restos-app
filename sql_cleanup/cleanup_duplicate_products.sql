-- ============================================
-- SCRIPT PER LA PULIZIA DEI PRODOTTI DUPLICATI
-- ============================================
-- Questo script identifica ed elimina i prodotti duplicati nella tabella 'products'
-- mantenendo solo la versione più recente di ogni prodotto (basata su created_at)
--
-- ATTENZIONE: Esegui prima la sezione di verifica per vedere quanti duplicati esistono
-- prima di procedere con l'eliminazione!
-- ============================================

-- ============================================
-- SEZIONE 1: VERIFICA DUPLICATI ESISTENTI
-- ============================================
-- Questa query mostra tutti i prodotti duplicati (stesso nome, case-insensitive)
-- con il conteggio di quante volte appaiono

SELECT 
    LOWER(TRIM(name)) as normalized_name,
    COUNT(*) as duplicate_count,
    STRING_AGG(id::text, ', ') as product_ids,
    STRING_AGG(created_at::text, ', ') as creation_dates
FROM products
GROUP BY LOWER(TRIM(name))
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- Query per contare il numero totale di duplicati da eliminare
SELECT 
    COUNT(*) as total_duplicates_to_remove
FROM (
    SELECT 
        id,
        ROW_NUMBER() OVER (
            PARTITION BY LOWER(TRIM(name)) 
            ORDER BY created_at DESC
        ) as row_num
    FROM products
) ranked
WHERE row_num > 1;

-- ============================================
-- SEZIONE 2: ELIMINAZIONE DUPLICATI
-- ============================================
-- Questa query elimina tutti i prodotti duplicati TRANNE la versione più recente
-- La versione più recente è determinata dal campo 'created_at'
--
-- COME FUNZIONA:
-- 1. Raggruppa i prodotti per nome (case-insensitive)
-- 2. Per ogni gruppo, ordina per created_at in ordine decrescente
-- 3. Assegna un numero di riga (row_num) dove 1 = più recente
-- 4. Elimina tutti i record dove row_num > 1 (cioè tutti tranne il più recente)

DELETE FROM products
WHERE id IN (
    SELECT id
    FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (
                PARTITION BY LOWER(TRIM(name)) 
                ORDER BY created_at DESC
            ) as row_num
        FROM products
    ) ranked
    WHERE row_num > 1
);

-- ============================================
-- SEZIONE 3: VERIFICA FINALE
-- ============================================
-- Dopo l'eliminazione, verifica che non ci siano più duplicati

-- Questa query dovrebbe restituire 0 righe se tutti i duplicati sono stati rimossi
SELECT 
    LOWER(TRIM(name)) as normalized_name,
    COUNT(*) as duplicate_count
FROM products
GROUP BY LOWER(TRIM(name))
HAVING COUNT(*) > 1;

-- Query per contare il numero totale di prodotti rimanenti
SELECT COUNT(*) as total_products_remaining FROM products;

-- ============================================
-- ISTRUZIONI PER L'USO
-- ============================================
-- 1. Esegui prima la SEZIONE 1 per vedere quanti duplicati esistono
-- 2. Se sei soddisfatto dei risultati, esegui la SEZIONE 2 per eliminare i duplicati
-- 3. Esegui la SEZIONE 3 per verificare che l'operazione sia andata a buon fine
--
-- NOTA: Questa operazione è IRREVERSIBILE. Assicurati di avere un backup
-- dei dati prima di eseguire la SEZIONE 2!
-- ============================================