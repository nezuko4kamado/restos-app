# 🎯 Guida Completa: Configurazione Automatica Subscriptions

## 📋 Problema Risolto

**Prima:**
- ❌ Utenti registrati NON apparivano in `user_subscriptions`
- ❌ Nessun periodo di prova automatico
- ❌ Nessuno stato di abbonamento visibile

**Dopo:**
- ✅ Ogni nuovo utente riceve automaticamente 7 giorni di prova
- ✅ Gli utenti esistenti ricevono retroattivamente il periodo di prova
- ✅ Tutto gestito automaticamente dal database

---

## 🚀 Come Deployare (3 Metodi)

### **Metodo 1: Supabase SQL Editor (CONSIGLIATO - PIÙ SEMPLICE)**

1. **Apri Supabase Dashboard**
   - Vai su https://supabase.com/dashboard
   - Seleziona il tuo progetto

2. **Apri SQL Editor**
   - Nel menu laterale sinistro, clicca su "SQL Editor"
   - Clicca su "+ New query"

3. **Copia e Incolla**
   - Apri il file: `/workspace/shadcn-ui/supabase/deploy_subscription_trigger.sql`
   - Copia TUTTO il contenuto
   - Incollalo nell'editor SQL di Supabase

4. **Esegui**
   - Clicca sul pulsante "Run" (o premi Ctrl+Enter / Cmd+Enter)
   - Vedrai i risultati che mostrano:
     - Numero totale di utenti
     - Numero di utenti con subscription
     - Numero di subscription in trial
     - Lista completa di tutti gli utenti con i loro stati

5. **Verifica**
   - Nella sezione "Table Editor" → "user_subscriptions"
   - Dovresti vedere tutti i tuoi utenti con `status = 'trialing'`
   - Ogni utente avrà `current_period_end` = oggi + 7 giorni

---

### **Metodo 2: Supabase CLI (Per Sviluppatori)**

Se hai installato Supabase CLI:

```bash
# Dalla cartella del progetto
cd /workspace/shadcn-ui

# Applica la migration
supabase db push

# Oppure applica solo questa migration specifica
supabase migration up --file supabase/migrations/20250118_auto_create_subscription.sql
```

---

### **Metodo 3: Manuale via Database**

Se preferisci eseguire i comandi uno alla volta:

**Passo 1 - Crea la funzione:**
```sql
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
```

**Passo 2 - Crea il trigger:**
```sql
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_subscription();
```

**Passo 3 - Backfill utenti esistenti:**
```sql
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
```

---

## 🧪 Come Testare

### Test 1: Verifica Utenti Esistenti
```sql
-- Controlla che tutti gli utenti abbiano una subscription
SELECT 
  u.email,
  s.status,
  s.current_period_end,
  EXTRACT(DAY FROM (s.current_period_end - NOW())) as giorni_rimanenti
FROM auth.users u
LEFT JOIN user_subscriptions s ON u.id = s.user_id
ORDER BY u.created_at DESC;
```

### Test 2: Registra un Nuovo Utente
1. Vai alla tua app
2. Registra un nuovo utente di test
3. Vai su Supabase → Table Editor → user_subscriptions
4. Verifica che il nuovo utente appaia immediatamente con:
   - `status = 'trialing'`
   - `current_period_end` = data odierna + 7 giorni

### Test 3: Verifica il Trigger
```sql
-- Questo dovrebbe mostrare il trigger attivo
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created_subscription';
```

---

## 📊 Query Utili per Monitoraggio

### Statistiche Subscriptions
```sql
SELECT 
  status,
  COUNT(*) as numero_utenti,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentuale
FROM user_subscriptions
GROUP BY status
ORDER BY numero_utenti DESC;
```

### Subscriptions in Scadenza (prossimi 3 giorni)
```sql
SELECT 
  u.email,
  s.status,
  s.current_period_end,
  EXTRACT(DAY FROM (s.current_period_end - NOW())) as giorni_rimanenti
FROM user_subscriptions s
JOIN auth.users u ON s.user_id = u.id
WHERE s.current_period_end BETWEEN NOW() AND NOW() + INTERVAL '3 days'
  AND s.status = 'trialing'
ORDER BY s.current_period_end ASC;
```

### Subscriptions Scadute
```sql
SELECT 
  u.email,
  s.status,
  s.current_period_end,
  NOW() - s.current_period_end as tempo_scaduto
FROM user_subscriptions s
JOIN auth.users u ON s.user_id = u.id
WHERE s.current_period_end < NOW()
  AND s.status = 'trialing'
ORDER BY s.current_period_end DESC;
```

---

## 🔧 Risoluzione Problemi

### Problema: "Permission denied for table user_subscriptions"
**Soluzione:** Esegui questo comando:
```sql
GRANT SELECT, INSERT, UPDATE ON public.user_subscriptions TO authenticated;
```

### Problema: "Trigger already exists"
**Soluzione:** Il trigger esiste già, è normale. Puoi ignorare l'errore o eseguire:
```sql
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
```
E poi ricreare il trigger.

### Problema: "Function already exists"
**Soluzione:** Usa `CREATE OR REPLACE FUNCTION` invece di `CREATE FUNCTION`.

---

## 📝 Note Importanti

1. **Sicurezza:** La funzione usa `SECURITY DEFINER` per avere i permessi necessari per inserire nella tabella `user_subscriptions`.

2. **Idempotenza:** Lo script usa `ON CONFLICT (user_id) DO NOTHING` per evitare duplicati.

3. **Backfill:** Lo script crea automaticamente subscriptions per tutti gli utenti esistenti che non ne hanno una.

4. **Periodo di Prova:** Ogni nuovo utente riceve automaticamente 7 giorni di prova dalla data di registrazione.

5. **Stripe Integration:** Quando un utente attiva un abbonamento a pagamento tramite Stripe, il webhook aggiornerà automaticamente il record con `stripe_customer_id` e `stripe_subscription_id`.

---

## ✅ Checklist Finale

- [ ] Script SQL eseguito con successo in Supabase
- [ ] Tutti gli utenti esistenti hanno una subscription
- [ ] Registrato un nuovo utente di test
- [ ] Il nuovo utente appare automaticamente in user_subscriptions
- [ ] Lo stato è 'trialing' con 7 giorni di validità
- [ ] Nessun errore nei log di Supabase

---

## 🎉 Risultato Finale

Dopo aver completato questa configurazione:

1. **Ogni nuovo utente** che si registra riceverà automaticamente:
   - Status: `trialing`
   - Periodo: 7 giorni dalla registrazione
   - Visibilità immediata nella tabella subscriptions

2. **Utenti esistenti** riceveranno retroattivamente:
   - Status: `trialing`
   - Periodo: 7 giorni da oggi
   - Record creato nella tabella subscriptions

3. **Nessuna modifica al codice** dell'applicazione necessaria - tutto gestito dal database!

---

## 📞 Supporto

Se riscontri problemi:
1. Controlla i log di Supabase (Dashboard → Logs)
2. Verifica i permessi RLS (Dashboard → Authentication → Policies)
3. Testa le query SQL fornite sopra per diagnosticare il problema