# Stripe Webhook Setup Guide

Questa guida spiega come configurare i webhook di Stripe per attivare automaticamente gli abbonamenti quando gli utenti pagano.

## 🎯 Obiettivo

Quando un utente completa il pagamento tramite Stripe Checkout, il webhook aggiorna automaticamente il database Supabase per attivare l'abbonamento senza intervento manuale.

## 📋 Prerequisiti

1. Account Stripe attivo
2. Progetto Supabase configurato
3. Edge Function deployata su Supabase

## 🚀 Step 1: Deploy della Edge Function

La Edge Function è già stata creata in:
```
/workspace/shadcn-ui/supabase/functions/app_8ab304f048_stripe_webhook/index.ts
```

Per deployarla su Supabase, esegui:

```bash
# Assicurati di avere Supabase CLI installato
npx supabase functions deploy app_8ab304f048_stripe_webhook
```

## 🔧 Step 2: Configurazione Variabili d'Ambiente

Assicurati che le seguenti variabili siano configurate in Supabase:

1. Vai su Supabase Dashboard → Project Settings → Edge Functions → Environment Variables
2. Aggiungi queste variabili:

```
STRIPE_SECRET_KEY=sk_live_... (o sk_test_... per testing)
APP_8ab304f048_STRIPE_WEBHOOK_SECRET=[verrà generato nel prossimo step]
```

## 🌐 Step 3: Configurazione Webhook su Stripe Dashboard

### 3.1 Ottieni l'URL del Webhook

L'URL della tua Edge Function è:
```
https://[PROJECT_REF].supabase.co/functions/v1/app_8ab304f048_stripe_webhook
```

Sostituisci `[PROJECT_REF]` con il tuo Project Reference di Supabase (es: `tmxmkvinsvuzbzrjrucw`).

**URL Completo Esempio:**
```
https://tmxmkvinsvuzbzrjrucw.supabase.co/functions/v1/app_8ab304f048_stripe_webhook
```

### 3.2 Crea il Webhook su Stripe

1. Vai su [Stripe Dashboard](https://dashboard.stripe.com/)
2. Naviga a **Developers** → **Webhooks**
3. Clicca su **Add endpoint**
4. Inserisci l'URL del webhook (vedi sopra)
5. Clicca su **Select events**

### 3.3 Seleziona gli Eventi da Monitorare

Seleziona questi eventi (TUTTI sono necessari):

#### ✅ Eventi Checkout
- `checkout.session.completed` - Quando il pagamento è completato

#### ✅ Eventi Subscription
- `customer.subscription.created` - Quando una subscription viene creata
- `customer.subscription.updated` - Quando una subscription viene aggiornata
- `customer.subscription.deleted` - Quando una subscription viene cancellata

#### ✅ Eventi Invoice (Pagamenti Ricorrenti)
- `invoice.payment_succeeded` - Quando un pagamento mensile riesce
- `invoice.payment_failed` - Quando un pagamento mensile fallisce

### 3.4 Salva e Ottieni il Webhook Secret

1. Clicca su **Add endpoint**
2. Stripe genererà un **Signing secret** (inizia con `whsec_...`)
3. **COPIA QUESTO SECRET** - lo userai nel prossimo step

## 🔐 Step 4: Configura il Webhook Secret

1. Torna su Supabase Dashboard → Project Settings → Edge Functions → Environment Variables
2. Aggiungi la variabile:
```
APP_8ab304f048_STRIPE_WEBHOOK_SECRET=whsec_...
```
(Incolla il signing secret copiato da Stripe)

3. Salva le modifiche

## 🧪 Step 5: Test del Webhook

### Test in Modalità Test (Consigliato)

1. Usa Stripe CLI per testare localmente:
```bash
stripe listen --forward-to https://[PROJECT_REF].supabase.co/functions/v1/app_8ab304f048_stripe_webhook
```

2. Trigger un evento di test:
```bash
stripe trigger checkout.session.completed
```

### Test in Produzione

1. Vai su Stripe Dashboard → Developers → Webhooks
2. Clicca sul tuo webhook
3. Vai alla tab **Send test webhook**
4. Seleziona `checkout.session.completed`
5. Clicca su **Send test webhook**

### Verifica i Log

1. Vai su Supabase Dashboard → Edge Functions → Logs
2. Dovresti vedere i log della funzione che processa l'evento
3. Verifica che non ci siano errori

## 📊 Step 6: Verifica nel Database

Dopo un pagamento di test, controlla la tabella `app_8ab304f048_user_subscriptions`:

```sql
SELECT 
  user_id,
  stripe_customer_id,
  stripe_subscription_id,
  subscription_type,
  status,
  current_period_end
FROM app_8ab304f048_user_subscriptions
WHERE stripe_customer_id = 'cus_...';
```

Dovresti vedere:
- `subscription_type`: `'paid'`
- `status`: `'active'`
- `current_period_end`: data futura

## 🔄 Flusso Completo

### Quando un Utente Paga:

1. **Utente clicca "Subscribe Now"** → Apre Stripe Checkout
2. **Utente completa il pagamento** → Stripe processa il pagamento
3. **Stripe invia webhook** → `checkout.session.completed`
4. **Edge Function riceve webhook** → Verifica firma
5. **Edge Function aggiorna DB** → Imposta `status='active'`
6. **Utente ricarica pagina** → Vede "Abbonamento Attivo"

### Eventi Successivi:

- **Ogni mese**: `invoice.payment_succeeded` → Rinnova `current_period_end`
- **Pagamento fallito**: `invoice.payment_failed` → Imposta `status='past_due'`
- **Utente cancella**: `customer.subscription.deleted` → Imposta `status='canceled'`

## 🐛 Troubleshooting

### Problema: Webhook non riceve eventi

**Soluzione:**
1. Verifica che l'URL sia corretto
2. Controlla che la Edge Function sia deployata
3. Verifica i log su Supabase Dashboard

### Problema: Errore "Invalid signature"

**Soluzione:**
1. Verifica che `APP_8ab304f048_STRIPE_WEBHOOK_SECRET` sia configurato correttamente
2. Assicurati di usare il signing secret del webhook giusto (test vs live)

### Problema: Subscription non si attiva

**Soluzione:**
1. Controlla i log della Edge Function
2. Verifica che l'email dell'utente corrisponda a quella in Supabase Auth
3. Controlla che la tabella `app_8ab304f048_user_subscriptions` esista

### Problema: Status rimane "suspended"

**Soluzione:**
1. Vai su Stripe Dashboard → Customers
2. Trova il customer per email
3. Verifica lo status della subscription
4. Se è attiva su Stripe ma non su Supabase, triggera manualmente:
```bash
stripe trigger customer.subscription.updated
```

## 📝 Note Importanti

### Ambiente Test vs Produzione

- **Test Mode**: Usa `sk_test_...` e webhook secret di test
- **Live Mode**: Usa `sk_live_...` e webhook secret di produzione
- **Devi configurare 2 webhook separati** (uno per test, uno per live)

### Sicurezza

- ✅ La firma del webhook viene sempre verificata
- ✅ Solo eventi con firma valida vengono processati
- ✅ Il webhook secret non deve mai essere esposto pubblicamente

### Monitoring

Monitora regolarmente:
1. **Stripe Dashboard** → Webhooks → Delivery attempts
2. **Supabase Dashboard** → Edge Functions → Logs
3. **Database** → Verifica che gli status siano corretti

## 🎉 Completamento

Se tutto è configurato correttamente:

✅ I pagamenti attivano automaticamente gli abbonamenti
✅ I rinnovi mensili vengono gestiti automaticamente
✅ Le cancellazioni vengono sincronizzate
✅ Gli utenti vedono lo status corretto in tempo reale

## 📞 Supporto

Se hai problemi:
1. Controlla i log su Supabase
2. Verifica gli eventi su Stripe Dashboard
3. Consulta la [documentazione Stripe Webhooks](https://stripe.com/docs/webhooks)