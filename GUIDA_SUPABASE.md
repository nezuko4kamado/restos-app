# Guida: attivare le correzioni degli abbonamenti su Supabase (senza comandi)

Progetto Supabase: **tmxmkvinsvuzbzrjrucw**. Tutto si fa dal pannello web: https://supabase.com/dashboard/project/tmxmkvinsvuzbzrjrucw

> Non incollare mai chiavi o password in chat o su GitHub.

---

## 1. Prima di iniziare (controlli)

### 1.1 Attivare pg_cron
1. Menu a sinistra → **Database** → **Extensions**.
2. Cerca `pg_cron` → attiva l'interruttore (schema proposto: lascia quello predefinito).
3. `pg_net` **non serve** per questa modifica.

### 1.2 Controllare tabelle e colonne
Menu → **SQL Editor** → **New query**, incolla ed esegui (**Run**). Questa query **legge soltanto**, non modifica nulla:

```sql
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'user_subscriptions' AND column_name IN
      ('user_id','products_limit','invoices_limit','subscription_type','scans_used','invoices_this_month','updated_at'))
    OR (table_name = 'products' AND column_name = 'user_id')
    OR (table_name = 'app_43909_invoices' AND column_name IN ('user_id','created_at'))
  )
ORDER BY table_name, column_name;
```

**Risultato atteso: 10 righe**
- `app_43909_invoices`: created_at, user_id
- `products`: user_id
- `user_subscriptions`: invoices_limit, invoices_this_month, products_limit, scans_used, subscription_type, updated_at, user_id

Se ne mancano, **fermati** e segnala quali mancano: non eseguire il passo 2.

Controllo pg_cron (deve restituire 1 riga):

```sql
SELECT extname FROM pg_extension WHERE extname = 'pg_cron';
```

---

## 2. Database: limiti lato server e reset mensile

Cosa fa:
- blocca nel database l'inserimento di prodotti e fatture oltre il limite del piano (limite `-1` = illimitato; utente senza abbonamento registrato = illimitato);
- programma il reset mensile dei contatori il 1° di ogni mese alle 00:05 (UTC).

È **sicuro da rieseguire**: usa `CREATE OR REPLACE`, `DROP TRIGGER IF EXISTS` e rimuove il vecchio job prima di crearne uno nuovo.

**SQL Editor → New query** → incolla tutto il testo qui sotto → **Run**:

```sql
-- Server-side subscription limits + scheduled monthly reset.
-- Rules (must match stripe-webhook getPlanLimits):
--   limit = -1          -> unlimited (Premium)
--   no subscription row -> unlimited (existing project constraint)
--   free: invoices counted in total; paid: invoices counted per calendar month (UTC)

-- 1. Products limit -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_products_limit()
RETURNS trigger AS $$
DECLARE
  v_limit INTEGER;
  v_count INTEGER;
BEGIN
  SELECT products_limit INTO v_limit
  FROM public.user_subscriptions
  WHERE user_id = NEW.user_id;

  IF v_limit IS NULL OR v_limit = -1 THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.products WHERE user_id = NEW.user_id;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'PRODUCT_LIMIT_REACHED: % of % products used', v_count, v_limit
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_products_limit ON public.products;
CREATE TRIGGER trg_enforce_products_limit
  BEFORE INSERT ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.enforce_products_limit();

-- 2. Invoices limit -----------------------------------------------------------
CREATE OR REPLACE FUNCTION public.enforce_invoices_limit()
RETURNS trigger AS $$
DECLARE
  v_limit INTEGER;
  v_type  TEXT;
  v_count INTEGER;
BEGIN
  SELECT invoices_limit, subscription_type INTO v_limit, v_type
  FROM public.user_subscriptions
  WHERE user_id = NEW.user_id;

  IF v_limit IS NULL OR v_limit = -1 THEN
    RETURN NEW;
  END IF;

  IF COALESCE(v_type, 'free') = 'free' THEN
    SELECT COUNT(*) INTO v_count
    FROM public.app_43909_invoices WHERE user_id = NEW.user_id;
  ELSE
    SELECT COUNT(*) INTO v_count
    FROM public.app_43909_invoices
    WHERE user_id = NEW.user_id
      AND created_at >= date_trunc('month', NOW());
  END IF;

  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'INVOICE_LIMIT_REACHED: % of % invoices used', v_count, v_limit
      USING ERRCODE = 'P0001';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_enforce_invoices_limit ON public.app_43909_invoices;
CREATE TRIGGER trg_enforce_invoices_limit
  BEFORE INSERT ON public.app_43909_invoices
  FOR EACH ROW EXECUTE FUNCTION public.enforce_invoices_limit();

-- 3. Monthly reset ------------------------------------------------------------
-- The previous version only reset rows with current_period_end < NOW(), which never
-- matched paid users (Stripe renewals move current_period_end forward) and was not
-- scheduled at all. Reset now runs on the 1st of each month, aligned with the
-- calendar-month invoice counting used by the app and the trigger above.
CREATE OR REPLACE FUNCTION public.reset_monthly_usage()
RETURNS void AS $$
BEGIN
  -- Paid plans: monthly scans and invoices
  UPDATE public.user_subscriptions
  SET scans_used = 0,
      invoices_this_month = 0,
      updated_at = TIMEZONE('utc'::text, NOW())
  WHERE subscription_type <> 'free';

  -- Free plan: scans are lifetime, only the invoice counter is reset
  UPDATE public.user_subscriptions
  SET invoices_this_month = 0,
      updated_at = TIMEZONE('utc'::text, NOW())
  WHERE subscription_type = 'free';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE EXTENSION IF NOT EXISTS pg_cron;

DO $$
BEGIN
  PERFORM cron.unschedule(jobid) FROM cron.job WHERE jobname = 'reset-monthly-usage';
  PERFORM cron.schedule('reset-monthly-usage', '5 0 1 * *', 'SELECT public.reset_monthly_usage();');
END $$;
```

### 2.1 Verifica
```sql
-- Deve mostrare 2 trigger
SELECT tgname, tgrelid::regclass AS tabella
FROM pg_trigger
WHERE tgname IN ('trg_enforce_products_limit','trg_enforce_invoices_limit');

-- Deve mostrare 1 job con schedule '5 0 1 * *'
SELECT jobid, jobname, schedule, command FROM cron.job WHERE jobname = 'reset-monthly-usage';
```

---

## 3. Edge Functions

Le 4 funzioni da aggiornare (codice su GitHub, repository `nezuko4kamado/restos-app`, ramo `main`):

| Funzione | File da copiare | Verifica JWT |
|---|---|---|
| `create-checkout-session` | `supabase/functions/create-checkout-session/index.ts` | **ON** |
| `stripe-webhook` | `supabase/functions/stripe-webhook/index.ts` | **OFF** |
| `sync-user-subscription` | `supabase/functions/sync-user-subscription/index.ts` | **ON** |
| `setup-stripe-products` | `supabase/functions/setup-stripe-products/index.ts` | **ON** |

Nessuna di queste funzioni usa file condivisi (`_shared/`): basta copiare il solo `index.ts`.

Per ogni funzione:
1. Su GitHub apri il file → pulsante **Raw** → seleziona tutto e copia.
2. Supabase → **Edge Functions** → clicca sul nome della funzione → scheda **Code** (o **Edit**).
3. Cancella il codice esistente in `index.ts`, incolla il nuovo.
4. Clicca **Deploy** (o **Save and deploy**) e attendi la conferma.
5. Se la funzione non esiste ancora: **Deploy a new function** → **Via Editor**, usa esattamente il nome della tabella.

### Importante per `stripe-webhook`
Stripe non invia un token di login, quindi in **Edge Functions → stripe-webhook → Details/Settings** l'opzione **"Enforce JWT verification" deve essere DISATTIVATA**. Se resta attiva, tutti gli eventi Stripe falliscono con errore 401.
Il file `supabase/config.toml` del progetto non contiene impostazioni specifiche: va impostato dal pannello.

---

## 4. Segreti

Supabase → **Edge Functions** → **Secrets**. Devono esistere questi nomi (controlla solo che ci siano, non mostrare i valori):

| Nome | Usato da |
|---|---|
| `STRIPE_SECRET_KEY` | tutte e 4 |
| `STRIPE_WEBHOOK_SECRET` | stripe-webhook |
| `SUPABASE_URL` | checkout, webhook, sync (fornito automaticamente da Supabase) |
| `SUPABASE_ANON_KEY` | checkout, sync (automatico) |
| `SUPABASE_SERVICE_ROLE_KEY` | webhook, sync (automatico) |

Se mancano `STRIPE_SECRET_KEY` o `STRIPE_WEBHOOK_SECRET`, aggiungili con **Add new secret**. La chiave del webhook (`whsec_...`) si trova in Stripe → **Developers** → **Webhooks** → il tuo endpoint → **Signing secret**.

L'endpoint del webhook in Stripe deve puntare a:
`https://tmxmkvinsvuzbzrjrucw.supabase.co/functions/v1/stripe-webhook`
con almeno gli eventi `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.

---

## 5. Verifica finale (pagamento di prova)

> Va fatto con Stripe in **modalità test** (interruttore "Test mode" in Stripe). Con le chiavi live il pagamento è reale.
> Attenzione: i price ID nel codice sono quelli usati in produzione. Se sono price **live**, una prova in modalità test non li trova: in quel caso usa un abbonamento reale e rimborsalo subito da Stripe.

1. Accedi all'app → **Abbonamenti** → scegli un piano (es. Basic).
2. Carta di test: `4242 4242 4242 4242`, una data futura qualsiasi, CVC qualsiasi.
3. Dopo il pagamento torni alla pagina Abbonamenti: il piano deve risultare aggiornato.
4. Controlla i log:
   - Supabase → **Edge Functions** → `stripe-webhook` → **Logs**: deve comparire `checkout.session.completed ... plan=basic`.
   - Stripe → **Developers** → **Webhooks** → endpoint → gli eventi devono avere stato **200**.
5. Controlla il database (SQL Editor; sostituisci l'email):

```sql
SELECT s.subscription_type, s.status, s.products_limit, s.invoices_limit, s.scans_limit
FROM public.user_subscriptions s
JOIN auth.users u ON u.id = s.user_id
WHERE u.email = 'tua@email.it';
```

Valori attesi:

| Piano | products_limit | invoices_limit | scans_limit |
|---|---|---|---|
| free | 20 | 10 | 10 |
| basic (€4,99) | 40 | 20 | 20 |
| pro (€9,99) | 100 | 50 | 50 |
| premium (€14,99) | -1 | -1 | -1 |

---

## 6. Se qualcosa va storto

### Togliere limiti e job del database
```sql
DROP TRIGGER IF EXISTS trg_enforce_products_limit ON public.products;
DROP TRIGGER IF EXISTS trg_enforce_invoices_limit ON public.app_43909_invoices;
DROP FUNCTION IF EXISTS public.enforce_products_limit();
DROP FUNCTION IF EXISTS public.enforce_invoices_limit();
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'reset-monthly-usage';
```
(La funzione `reset_monthly_usage` resta, ma senza job non viene eseguita.)

### Tornare alla versione precedente di una funzione
1. Su GitHub apri la cronologia del file (pulsante **History**), scegli il commit precedente a `9b11355` → **Browse files** → apri il file → **Raw**.
2. Incolla quel codice nella funzione su Supabase → **Deploy**.

### Errori comuni
- **401 negli eventi Stripe**: la verifica JWT di `stripe-webhook` è attiva → disattivala.
- **"Webhook signature verification failed"**: `STRIPE_WEBHOOK_SECRET` non corrisponde all'endpoint configurato in Stripe.
- **"Invalid price ID"** al checkout: il prezzo scelto non è tra i tre piani attuali.
- **`PRODUCT_LIMIT_REACHED` / `INVOICE_LIMIT_REACHED`**: comportamento corretto, il limite del piano è stato raggiunto.
