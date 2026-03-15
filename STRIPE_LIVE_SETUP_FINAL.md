# ✅ Stripe Live Mode - Configurazione Completata

## 🎉 Chiavi API Live Configurate

Le tue chiavi Stripe Live sono state configurate nel file `.env.local`:

✅ **Publishable Key:** `pk_live_51NAwxJERHOOWoH8ZArl1PQy7pw9zr6ZoOCb8rNwuPq5NDtxs3jgsT3sxmgl0xbjWCoQsI9ZpRXerqBg5lUUgfFjb00SPRnH7yU`
✅ **Secret Key:** `sk_live_51NAwxJERHOOWoH8Z...` (configurata in sicurezza)

## 📋 Prossimi Passi Obbligatori

### 1. Aggiorna i Secrets su Supabase Edge Functions

**IMPORTANTE:** Devi aggiornare manualmente i secrets su Supabase perché non posso accedere direttamente al tuo account.

1. Vai su [Supabase Dashboard](https://supabase.com/dashboard)
2. Seleziona il tuo progetto
3. Vai su **Project Settings → Edge Functions → Secrets**
4. Clicca su **"Add new secret"** o aggiorna quelli esistenti:

```bash
# Nome: STRIPE_SECRET_KEY
# Valore: YOUR_STRIPE_SECRET_KEY

# Nome: STRIPE_PUBLISHABLE_KEY
# Valore: pk_live_51NAwxJERHOOWoH8ZArl1PQy7pw9zr6ZoOCb8rNwuPq5NDtxs3jgsT3sxmgl0xbjWCoQsI9ZpRXerqBg5lUUgfFjb00SPRnH7yU
```

5. Clicca **"Save"** per ogni secret

### 2. Configura il Webhook Live su Stripe

1. Vai su [Stripe Dashboard](https://dashboard.stripe.com/)
2. **Disattiva** il toggle "Test mode" in alto a destra (passa a **Live mode**)
3. Vai su **Developers → Webhooks**
4. Clicca **"Add endpoint"**
5. Inserisci l'URL del webhook (sostituisci `tuo-progetto` con il tuo Project ID):
   ```
   https://tuo-progetto.supabase.co/functions/v1/stripe-webhook
   ```

6. Nella sezione **"Select events to listen to"**, seleziona:
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.payment_succeeded`
   - ✅ `invoice.payment_failed`

7. Clicca **"Add endpoint"**

8. Dopo la creazione, clicca sull'endpoint appena creato

9. Nella sezione **"Signing secret"**, clicca su **"Reveal"** e copia il valore (inizia con `whsec_...`)

### 3. Aggiorna il Webhook Secret su Supabase

1. Torna su Supabase Dashboard → Project Settings → Edge Functions → Secrets
2. Aggiungi un nuovo secret:
```bash
# Nome: STRIPE_WEBHOOK_SECRET
# Valore: whsec_... (il valore che hai copiato da Stripe)
```

3. Clicca **"Save"**

### 4. Rideploy delle Edge Functions (Opzionale ma Consigliato)

Dopo aver aggiornato i secrets, è consigliato fare il redeploy delle funzioni:

```bash
# Naviga nella directory delle funzioni
cd supabase/functions

# Redeploy della funzione stripe-webhook
supabase functions deploy stripe-webhook

# Redeploy delle altre funzioni
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session
```

### 5. Test del Pagamento Live

1. **Apri la tua app** e vai alla sezione Impostazioni
2. Clicca su **"Vai al Pagamento"**
3. Usa una **carta reale** (NON le carte di test come 4242 4242 4242 4242)
4. Completa il checkout
5. Verifica che:
   - Il pagamento sia registrato su Stripe Dashboard (Live mode)
   - L'abbonamento sia aggiornato nel database Supabase
   - Lo stato dell'app mostri "Abbonamento Attivo"

### 6. Verifica il Webhook

1. Vai su Stripe Dashboard (Live mode) → Developers → Webhooks
2. Clicca sul tuo endpoint
3. Nella tab **"Events"**, dovresti vedere gli eventi ricevuti dopo il pagamento
4. Verifica che tutti gli eventi abbiano status **"Succeeded"** (✅)

## ⚠️ Checklist Pre-Live (IMPORTANTE)

Prima di accettare pagamenti reali, assicurati che:

- [ ] Il tuo account Stripe sia completamente **verificato**
- [ ] Le informazioni aziendali siano complete su Stripe
- [ ] Hai configurato le email di notifica su Stripe
- [ ] Hai testato il flusso completo in test mode
- [ ] Hai configurato le policy di rimborso
- [ ] Hai impostato le email di conferma pagamento
- [ ] Il webhook è configurato correttamente in Live mode
- [ ] I secrets sono aggiornati su Supabase

## 🔐 Sicurezza

**⚠️ NON condividere MAI:**
- Secret Key (`sk_live_...`)
- Webhook Secret (`whsec_...`)

**✅ Puoi condividere pubblicamente:**
- Publishable Key (`pk_live_...`)

## 📊 Monitoraggio

Dopo aver attivato la modalità live, monitora:

1. **Stripe Dashboard (Live mode):**
   - Pagamenti ricevuti
   - Abbonamenti attivi
   - Eventi webhook

2. **Supabase Dashboard:**
   - Tabella `user_subscriptions`
   - Log delle Edge Functions
   - Errori nelle funzioni

3. **Console del Browser:**
   - Errori JavaScript
   - Chiamate API fallite

## 📞 Supporto

Se hai problemi:

1. **Controlla i log:**
   - Supabase Dashboard → Edge Functions → Logs
   - Stripe Dashboard → Developers → Webhooks → Events

2. **Errori comuni:**
   - Webhook secret non aggiornato
   - Secrets non salvati su Supabase
   - URL webhook errato
   - Eventi webhook non selezionati

3. **Test del webhook:**
   - Usa "Send test webhook" su Stripe Dashboard per testare

## 🎉 Congratulazioni!

Una volta completati tutti i passi, la tua app sarà pronta per accettare pagamenti reali! 🚀

**Ricorda:** Testa sempre con una piccola transazione prima di lanciare ufficialmente!
