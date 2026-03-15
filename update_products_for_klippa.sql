-- ============================================
-- AGGIORNAMENTO SCHEMA PRODOTTI PER KLIPPA
-- Eseguire questo script nella dashboard Supabase
-- ============================================

-- 1. AGGIORNARE TABELLA INVOICES per supportare nuova struttura Klippa
ALTER TABLE app_43909_invoices ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR';
ALTER TABLE app_43909_invoices ADD COLUMN IF NOT EXISTS supplier_data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE app_43909_invoices ADD COLUMN IF NOT EXISTS vat_breakdown JSONB DEFAULT '[]'::jsonb;

-- Commenti per chiarezza
COMMENT ON COLUMN app_43909_invoices.currency IS 'Valuta fattura (EUR, USD, GBP, CHF, etc.)';
COMMENT ON COLUMN app_43909_invoices.supplier_data IS 'Dati completi fornitore: {name, phone, email, address, vat_number}';
COMMENT ON COLUMN app_43909_invoices.vat_breakdown IS 'Dettaglio IVA per aliquota: [{rate: 22, vatAmount: 45.50}]';

-- 2. VERIFICARE/CREARE TABELLA PRODUCTS con nuova struttura
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT DEFAULT 'Food',
  
  -- NUOVA STRUTTURA PREZZI KLIPPA
  unit_price DECIMAL(10, 4) NOT NULL DEFAULT 0,           -- Prezzo base unitario
  discounted_price DECIMAL(10, 4) NOT NULL DEFAULT 0,     -- Prezzo finale dopo sconto
  discount_amount DECIMAL(10, 4) NOT NULL DEFAULT 0,      -- Importo sconto in valuta
  discount_percent DECIMAL(5, 2) NOT NULL DEFAULT 0,      -- Percentuale sconto (0-100)
  
  -- SUPPORTO MULTI-VALUTA
  currency TEXT DEFAULT 'EUR',                            -- Valuta prodotto
  
  -- IVA DINAMICA PER PAESE
  vat_rate DECIMAL(5, 2) NOT NULL DEFAULT 22,            -- Aliquota IVA variabile
  
  -- METADATI
  supplier_id UUID,
  image TEXT,
  stock_quantity INTEGER DEFAULT 0,
  min_stock_level INTEGER DEFAULT 0,
  
  -- TIMESTAMP
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Commenti per la nuova struttura
COMMENT ON COLUMN products.unit_price IS 'Prezzo base unitario (senza sconto)';
COMMENT ON COLUMN products.discounted_price IS 'Prezzo finale dopo applicazione sconto';
COMMENT ON COLUMN products.discount_amount IS 'Importo sconto in valuta (calcolato automaticamente)';
COMMENT ON COLUMN products.discount_percent IS 'Percentuale sconto 0-100% (supporta decimali)';
COMMENT ON COLUMN products.currency IS 'Valuta prodotto: EUR, USD, GBP, CHF, CAD, AUD, JPY, etc.';
COMMENT ON COLUMN products.vat_rate IS 'Aliquota IVA variabile per paese (es: IT=4%,10%,22% | ES=4%,10%,21% | FR=5.5%,10%,20%)';

-- 3. AGGIUNGERE COLONNE MANCANTI SE LA TABELLA ESISTE GIÀ
ALTER TABLE products ADD COLUMN IF NOT EXISTS unit_price DECIMAL(10, 4) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS discounted_price DECIMAL(10, 4) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 4) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5, 2) NOT NULL DEFAULT 0;
ALTER TABLE products ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'EUR';
ALTER TABLE products ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5, 2) NOT NULL DEFAULT 22;

-- 4. AGGIORNARE COLONNA PRICE ESISTENTE (se esiste) per compatibilità
-- Copiare il valore di 'price' in 'unit_price' e 'discounted_price' se non sono già popolati
UPDATE products 
SET 
  unit_price = COALESCE(NULLIF(unit_price, 0), price, 0),
  discounted_price = COALESCE(NULLIF(discounted_price, 0), price, 0)
WHERE (unit_price = 0 OR discounted_price = 0) 
  AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'price');

-- 5. CREARE INDICI PER PERFORMANCE
CREATE INDEX IF NOT EXISTS products_user_idx ON products(user_id);
CREATE INDEX IF NOT EXISTS products_category_idx ON products(category);
CREATE INDEX IF NOT EXISTS products_currency_idx ON products(currency);
CREATE INDEX IF NOT EXISTS products_supplier_idx ON products(supplier_id);
CREATE INDEX IF NOT EXISTS products_discount_idx ON products(discount_percent) WHERE discount_percent > 0;

-- 6. SETUP ROW LEVEL SECURITY per products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Politiche RLS per products (se non esistono già)
DROP POLICY IF EXISTS "Users can view own products" ON products;
DROP POLICY IF EXISTS "Users can insert own products" ON products;
DROP POLICY IF EXISTS "Users can update own products" ON products;
DROP POLICY IF EXISTS "Users can delete own products" ON products;

CREATE POLICY "Users can view own products" ON products FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own products" ON products FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own products" ON products FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own products" ON products FOR DELETE USING (auth.uid() = user_id);

-- 7. FUNZIONE PER CALCOLO AUTOMATICO SCONTI
CREATE OR REPLACE FUNCTION calculate_product_discount()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcola discount_amount se discount_percent è cambiato
  IF NEW.discount_percent != OLD.discount_percent OR NEW.unit_price != OLD.unit_price THEN
    NEW.discount_amount = (NEW.unit_price * NEW.discount_percent / 100);
    NEW.discounted_price = NEW.unit_price - NEW.discount_amount;
  END IF;
  
  -- Assicurati che discounted_price non sia negativo
  IF NEW.discounted_price < 0 THEN
    NEW.discounted_price = 0;
  END IF;
  
  -- Aggiorna timestamp
  NEW.updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger per calcolo automatico
DROP TRIGGER IF EXISTS products_calculate_discount ON products;
CREATE TRIGGER products_calculate_discount
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION calculate_product_discount();

-- 8. VERIFICA FINALE
DO $$
BEGIN
  -- Verifica che tutte le colonne esistano
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'unit_price') THEN
    RAISE EXCEPTION 'Colonna unit_price non trovata!';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'discounted_price') THEN
    RAISE EXCEPTION 'Colonna discounted_price non trovata!';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'discount_amount') THEN
    RAISE EXCEPTION 'Colonna discount_amount non trovata!';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'discount_percent') THEN
    RAISE EXCEPTION 'Colonna discount_percent non trovata!';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'currency') THEN
    RAISE EXCEPTION 'Colonna currency non trovata!';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'vat_rate') THEN
    RAISE EXCEPTION 'Colonna vat_rate non trovata!';
  END IF;
  
  RAISE NOTICE '✅ Schema prodotti aggiornato con successo per Klippa!';
  RAISE NOTICE '📋 Nuove colonne: unit_price, discounted_price, discount_amount, discount_percent, currency, vat_rate';
  RAISE NOTICE '🔧 Trigger automatico per calcolo sconti attivato';
END $$;