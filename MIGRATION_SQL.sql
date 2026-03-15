-- ============================================
-- RESTO - MIGRAZIONE COMPLETA A SUPABASE
-- Eseguire questo script nella dashboard Supabase
-- SQL Editor -> Incolla questo codice -> Run
-- ============================================

-- ============================================
-- STEP 1: COMPLETARE USER_SETTINGS
-- ============================================
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS store_name TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'light';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS font_size TEXT DEFAULT 'medium';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS layout_mode TEXT DEFAULT 'expanded';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS notifications_enabled BOOLEAN DEFAULT true;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS price_change_threshold INTEGER DEFAULT 10;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS recurring_order_reminder_days INTEGER DEFAULT 3;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS enable_recurring_reminders BOOLEAN DEFAULT true;

COMMENT ON COLUMN user_settings.store_name IS 'Custom store/business name';
COMMENT ON COLUMN user_settings.theme IS 'UI theme: light or dark';
COMMENT ON COLUMN user_settings.font_size IS 'Font size: small, medium, or large';
COMMENT ON COLUMN user_settings.layout_mode IS 'Layout mode: compact or expanded';
COMMENT ON COLUMN user_settings.notifications_enabled IS 'Enable/disable all notifications';
COMMENT ON COLUMN user_settings.price_change_threshold IS 'Percentage threshold for price change alerts';
COMMENT ON COLUMN user_settings.recurring_order_reminder_days IS 'Days before next order to send reminder';
COMMENT ON COLUMN user_settings.enable_recurring_reminders IS 'Enable/disable recurring order reminders';

-- ============================================
-- STEP 2: DRAFT ORDERS (per salvare ordini in bozza)
-- ============================================
CREATE TABLE IF NOT EXISTS draft_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  order_items JSONB NOT NULL,
  temporary_ocr_products JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS draft_orders_user_idx ON draft_orders(user_id);

COMMENT ON TABLE draft_orders IS 'Stores draft orders that users are currently working on';
COMMENT ON COLUMN draft_orders.order_items IS 'Array of order items with product_id, quantity, price';
COMMENT ON COLUMN draft_orders.temporary_ocr_products IS 'Temporary products extracted from OCR that are not yet saved';

-- RLS per draft_orders
ALTER TABLE draft_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own draft orders" ON draft_orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own draft orders" ON draft_orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own draft orders" ON draft_orders FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own draft orders" ON draft_orders FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- STEP 3: CANCELLED DRAFT ORDERS (per ripristino)
-- ============================================
CREATE TABLE IF NOT EXISTS cancelled_draft_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  order_items JSONB NOT NULL,
  temporary_ocr_products JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS cancelled_draft_orders_user_idx ON cancelled_draft_orders(user_id);

COMMENT ON TABLE cancelled_draft_orders IS 'Stores cancelled draft orders for potential restoration';
COMMENT ON COLUMN cancelled_draft_orders.order_items IS 'Array of order items from cancelled draft';
COMMENT ON COLUMN cancelled_draft_orders.temporary_ocr_products IS 'Temporary products from cancelled draft';

-- RLS per cancelled_draft_orders
ALTER TABLE cancelled_draft_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own cancelled drafts" ON cancelled_draft_orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cancelled drafts" ON cancelled_draft_orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own cancelled drafts" ON cancelled_draft_orders FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- STEP 4: ADMIN SESSIONS (per sostituire localStorage admin)
-- ============================================
CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  session_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_sessions_token_idx ON admin_sessions(session_token);
CREATE INDEX IF NOT EXISTS admin_sessions_user_idx ON admin_sessions(user_id);
CREATE INDEX IF NOT EXISTS admin_sessions_expires_idx ON admin_sessions(expires_at);

COMMENT ON TABLE admin_sessions IS 'Stores admin session tokens for authentication';
COMMENT ON COLUMN admin_sessions.session_token IS 'Unique session token for admin authentication';
COMMENT ON COLUMN admin_sessions.expires_at IS 'Session expiration timestamp';

-- RLS per admin_sessions
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own admin sessions" ON admin_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own admin sessions" ON admin_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own admin sessions" ON admin_sessions FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- STEP 5: FUNZIONE PER PULIZIA AUTOMATICA SESSIONI SCADUTE
-- ============================================
CREATE OR REPLACE FUNCTION cleanup_expired_admin_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM admin_sessions WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_expired_admin_sessions IS 'Removes expired admin sessions from the database';

-- ============================================
-- VERIFICA FINALE
-- ============================================
-- Verifica che tutte le tabelle esistano
DO $$
BEGIN
  -- Verifica user_settings
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_settings') THEN
    RAISE EXCEPTION 'Tabella user_settings non trovata!';
  END IF;
  
  -- Verifica products
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'products') THEN
    RAISE EXCEPTION 'Tabella products non trovata!';
  END IF;
  
  -- Verifica suppliers
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'suppliers') THEN
    RAISE EXCEPTION 'Tabella suppliers non trovata!';
  END IF;
  
  -- Verifica orders
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
    RAISE EXCEPTION 'Tabella orders non trovata!';
  END IF;
  
  -- Verifica invoices
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
    RAISE EXCEPTION 'Tabella invoices non trovata!';
  END IF;
  
  -- Verifica draft_orders
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'draft_orders') THEN
    RAISE EXCEPTION 'Tabella draft_orders non trovata!';
  END IF;
  
  -- Verifica cancelled_draft_orders
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cancelled_draft_orders') THEN
    RAISE EXCEPTION 'Tabella cancelled_draft_orders non trovata!';
  END IF;
  
  -- Verifica admin_sessions
  IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_sessions') THEN
    RAISE EXCEPTION 'Tabella admin_sessions non trovata!';
  END IF;
  
  RAISE NOTICE '✅ Tutte le tabelle sono state create con successo!';
END $$;

-- ============================================
-- FINE SCRIPT
-- ============================================