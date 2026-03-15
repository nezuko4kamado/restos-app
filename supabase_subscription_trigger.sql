-- ============================================
-- COPIA E INCOLLA QUESTO CODICE IN SUPABASE SQL EDITOR
-- ============================================
-- Questo script crea un trigger automatico che assegna
-- 7 giorni di prova a ogni nuovo utente registrato
-- ============================================

-- Step 1: Crea la funzione per gestire nuovi utenti
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_subscriptions (
    user_id,
    status,
    current_period_start,
    current_period_end
  )
  VALUES (
    NEW.id,
    'trialing',
    NOW(),
    NOW() + INTERVAL '7 days'
  )
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 2: Crea il trigger su auth.users
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_subscription();

-- Step 3: Aggiungi subscriptions agli utenti esistenti che non ce l'hanno
INSERT INTO public.user_subscriptions (user_id, status, current_period_start, current_period_end)
SELECT 
  u.id,
  'trialing',
  NOW(),
  NOW() + INTERVAL '7 days'
FROM auth.users u
LEFT JOIN public.user_subscriptions s ON u.id = s.user_id
WHERE s.user_id IS NULL
ON CONFLICT (user_id) DO NOTHING;

-- Step 4: Verifica il risultato
SELECT 
  'Utenti totali' as descrizione,
  COUNT(*) as numero
FROM auth.users
UNION ALL
SELECT 
  'Utenti con subscription' as descrizione,
  COUNT(*) as numero
FROM user_subscriptions
UNION ALL
SELECT 
  'Subscription in trial' as descrizione,
  COUNT(*) as numero
FROM user_subscriptions
WHERE status = 'trialing';

-- Step 5: Mostra tutti gli utenti con le loro subscriptions
SELECT 
  u.email,
  s.status,
  s.current_period_start as inizio_periodo,
  s.current_period_end as fine_periodo,
  CASE 
    WHEN s.current_period_end > NOW() THEN 
      CONCAT(EXTRACT(DAY FROM (s.current_period_end - NOW())), ' giorni rimanenti')
    ELSE 
      'Scaduto'
  END as tempo_rimanente
FROM auth.users u
LEFT JOIN user_subscriptions s ON u.id = s.user_id
ORDER BY u.created_at DESC;