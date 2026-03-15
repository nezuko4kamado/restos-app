-- ============================================================================
-- ELIMINA PRODOTTI DUPLICATI - Mantiene solo il prodotto più recente
-- ============================================================================

-- PASSO 1: Visualizza tutti i prodotti attuali (per verifica prima di eliminare)
SELECT id, name, category, vat_rate, supplier_id, created_at, updated_at
FROM products
ORDER BY name, supplier_id, created_at DESC;

-- PASSO 2: Elimina i duplicati mantenendo solo il più recente per ogni nome+fornitore
-- Questa query mantiene il prodotto con la data created_at più recente
DELETE FROM products
WHERE id NOT IN (
    SELECT DISTINCT ON (name, supplier_id) id
    FROM products
    ORDER BY name, supplier_id, created_at DESC
);

-- PASSO 3: Verifica il risultato finale (dovresti vedere solo 4 prodotti unici)
SELECT id, name, category, vat_rate, supplier_id, created_at, updated_at
FROM products
ORDER BY name, created_at DESC;

-- PASSO 4: Conta i prodotti per nome per verificare che non ci siano duplicati
SELECT name, supplier_id, COUNT(*) as count
FROM products
GROUP BY name, supplier_id
HAVING COUNT(*) > 1;
