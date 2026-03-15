# Guida: Rimozione Trial Period e Sincronizzazione

## Problema
L'app non riconosce che l'utente ha pagato perché:
1. Il trial period di 7 giorni è ancora attivo nel database
2. La sincronizzazione con Stripe non funziona correttamente

## Soluzione

### Step 1: Applica la Migration SQL

1. Vai su Supabase Dashboard:
   https://supabase.com/dashboard/project/tmxmkvinsvuzbzrjrucw/editor

2. Clicca su "SQL Editor" nel menu a sinistra

3. Clicca su "+ New Query"

4. Copia e incolla questo SQL:

```sql
-- Remove trial period from existing subscriptions
UPDATE user_subscriptions
SET 
  status = 'active',
  trial_end = NULL,
  current_period_start = CURRENT_TIMESTAMP,
  current_period_end = CURRENT_TIMESTAMP + INTERVAL '1 month'
WHERE status = 'trialing';

-- Drop the old trigger that creates trial subscriptions
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user_subscription();

-- Create new trigger WITHOUT trial period
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  -- Create inactive subscription (will be activated after payment)
  INSERT INTO public.user_subscriptions (
    user_id,
    status,
    current_period_start,
    current_period_end
  ) VALUES (
    NEW.id,
    'inactive',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP + INTERVAL '1 month'
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_subscription();
```

5. Clicca "Run" (o premi Ctrl+Enter)

### Step 2: Verifica Webhook Stripe

1. Vai su Stripe Dashboard:
   https://dashboard.stripe.com/webhooks

2. Verifica che il webhook sia attivo e punti a:
   `https://tmxmkvinsvuzbzrjrucw.supabase.co/functions/v1/stripe-webhook`

3. Verifica che questi eventi siano abilitati:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `checkout.session.completed`

### Step 3: Test

1. Fai logout dall'app
2. Fai login di nuovo
3. L'app dovrebbe ora mostrare lo stato corretto dell'abbonamento

### Step 4: Se ancora non funziona

Usa il pannello Admin per sincronizzare manualmente:
1. Vai al pannello Admin
2. Cerca l'utente per email
3. Clicca "Sync with Stripe"

## Cosa è stato modificato

✅ **PRIMA:**
- Nuovi utenti ricevevano 7 giorni di trial automatico
- Status: "trialing"
- Trial end: +7 giorni

✅ **ADESSO:**
- Nuovi utenti iniziano con status "inactive"
- Devono pagare per attivare l'abbonamento
- Nessun trial period

## File Modificati

1. `/workspace/shadcn-ui/supabase/functions/create-checkout-session/index.ts`
   - Rimosso `trial_period_days: 7`

2. `/workspace/shadcn-ui/supabase/migrations/20250118_remove_trial.sql`
   - Aggiornato trigger per rimuovere trial
   - Aggiornati abbonamenti esistenti

## Note

- Tutti gli abbonamenti con status "trialing" saranno convertiti in "active"
- Il trial_end sarà impostato a NULL
- I nuovi utenti non avranno più trial automatico
