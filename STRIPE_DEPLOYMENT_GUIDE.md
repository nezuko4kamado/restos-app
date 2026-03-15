# 🚀 Guida al Deployment delle Funzioni Stripe

## ⚠️ Problema Attuale

L'errore "unexpected end of json input" si verifica perché le **Edge Functions per Stripe non sono state deployate** su Supabase.

## 📋 Prerequisiti

Prima di procedere con il deployment, assicurati di avere:

1. ✅ Account Stripe (https://stripe.com)
2. ✅ Stripe Secret Key
3. ✅ Supabase CLI installato
4. ✅ Accesso al progetto Supabase

## 🔧 Step 1: Configurare Stripe

### 1.1 Ottieni le Stripe API Keys

1. Vai su https://dashboard.stripe.com/apikeys
2. Copia la **Secret Key** (inizia con `sk_test_` o `sk_live_`)
3. Copia la **Publishable Key** (inizia con `pk_test_` o `pk_live_`)

### 1.2 Configura i Secrets in Supabase

Esegui questi comandi nel terminale:

```bash
# Imposta la Stripe Secret Key
supabase secrets set STRIPE_SECRET_KEY=sk_test_your_key_here

# Imposta la Stripe Webhook Secret (lo otterrai dopo aver configurato il webhook)
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
```

## 🚀 Step 2: Deploy delle Edge Functions

### 2.1 Deploy della funzione create-checkout-session

```bash
cd /workspace/shadcn-ui
supabase functions deploy create-checkout-session
```

### 2.2 Deploy della funzione create-portal-session

```bash
supabase functions deploy create-portal-session
```

### 2.3 Deploy della funzione stripe-webhook

```bash
supabase functions deploy stripe-webhook
```

## 🔗 Step 3: Configurare Stripe Webhook

### 3.1 Ottieni l'URL del Webhook

Dopo il deploy, l'URL sarà:
```
https://tmxmkvinsvuzbzrjrucw.supabase.co/functions/v1/stripe-webhook
```

### 3.2 Configura il Webhook in Stripe

1. Vai su https://dashboard.stripe.com/webhooks
2. Clicca su "Add endpoint"
3. Inserisci l'URL: `https://tmxmkvinsvuzbzrjrucw.supabase.co/functions/v1/stripe-webhook`
4. Seleziona questi eventi:
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
5. Clicca "Add endpoint"
6. Copia il **Webhook Secret** (inizia con `whsec_`)
7. Imposta il secret in Supabase:
   ```bash
   supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
   ```

## ✅ Step 4: Verifica il Deployment

### 4.1 Testa la funzione create-checkout-session

```bash
curl -X POST \
  https://tmxmkvinsvuzbzrjrucw.supabase.co/functions/v1/create-checkout-session \
  -H "Authorization: Bearer YOUR_SUPABASE_ANON_KEY" \
  -H "Content-Type: application/json"
```

Dovresti ricevere una risposta JSON con `sessionId` e `url`.

### 4.2 Testa nell'app

1. Accedi all'applicazione
2. Vai in **Impostazioni** → **Pagamento**
3. Clicca su **"Attiva Abbonamento"**
4. Dovresti essere reindirizzato alla pagina di checkout Stripe

## 🐛 Troubleshooting

### Errore: "unexpected end of json input"

**Causa**: Le Edge Functions non sono deployate o non rispondono correttamente.

**Soluzione**:
1. Verifica che le funzioni siano deployate: `supabase functions list`
2. Controlla i logs: `supabase functions logs create-checkout-session`
3. Verifica che i secrets siano impostati: `supabase secrets list`

### Errore: "Missing authorization header"

**Causa**: Il token di autenticazione non è valido o è scaduto.

**Soluzione**:
1. Disconnettiti e riconnettiti all'app
2. Verifica che `VITE_SUPABASE_ANON_KEY` sia corretto nel file `.env`

### Errore: "Stripe API key not configured"

**Causa**: La Stripe Secret Key non è impostata nei secrets di Supabase.

**Soluzione**:
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_your_key_here
```

### Errore: "Invalid price_id"

**Causa**: Il price_id di Stripe non è valido o non esiste.

**Soluzione**:
1. Vai su https://dashboard.stripe.com/products
2. Crea un prodotto con abbonamento mensile a €9.90
3. Copia il Price ID (inizia con `price_`)
4. Aggiorna il codice in `create-checkout-session/index.ts` se necessario

## 📝 Note Importanti

1. **Modalità Test vs Live**: 
   - Usa `sk_test_` keys durante lo sviluppo
   - Usa `sk_live_` keys in produzione

2. **Sicurezza**:
   - Non committare mai le Stripe Secret Keys nel repository
   - Usa sempre i Supabase Secrets per le chiavi sensibili

3. **Costi**:
   - Stripe addebita il 2.9% + €0.25 per transazione
   - Supabase Edge Functions sono gratuite fino a 2M invocazioni/mese

## 🎯 Prossimi Passi

Dopo aver completato il deployment:

1. ✅ Testa il flusso di pagamento completo
2. ✅ Verifica che i webhook aggiornino correttamente lo stato dell'abbonamento
3. ✅ Testa la cancellazione e il rinnovo dell'abbonamento
4. ✅ Configura le email di conferma in Stripe

## 📞 Supporto

Se incontri problemi:
- Controlla i logs: `supabase functions logs`
- Verifica lo stato Stripe: https://status.stripe.com
- Consulta la documentazione: https://stripe.com/docs