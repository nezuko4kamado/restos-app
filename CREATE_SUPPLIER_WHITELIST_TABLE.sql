-- ============================================
-- Esegui questo script nel SQL Editor di Supabase
-- https://supabase.com/dashboard → SQL Editor
-- ============================================

CREATE TABLE IF NOT EXISTS public.supplier_whitelist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supplier_name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Indici per performance
CREATE INDEX IF NOT EXISTS idx_supplier_whitelist_user_id 
  ON public.supplier_whitelist(user_id);

CREATE INDEX IF NOT EXISTS idx_supplier_whitelist_supplier_name 
  ON public.supplier_whitelist(supplier_name);

-- Abilita Row Level Security
ALTER TABLE public.supplier_whitelist ENABLE ROW LEVEL SECURITY;

-- Policy: ogni utente gestisce solo i propri dati
DROP POLICY IF EXISTS "Users can manage their own whitelist" ON public.supplier_whitelist;
CREATE POLICY "Users can manage their own whitelist" 
  ON public.supplier_whitelist
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Verifica creazione
SELECT 'supplier_whitelist table created successfully!' as status;
