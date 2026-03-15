# 🚀 Passaggio a Stripe Live Mode - Guida Completa

## ✅ Chiave Publishable Key già configurata
La tua Publishable Key Live è già stata aggiornata nel file `.env.local`:
```
pk_live_51NAwxJERHOOWoH8ZArl1PQy7pw9zr6ZoOCb8rNwuPq5NDtxs3jgsT3sxmgl0xbjWCoQsI9ZpRXerqBg5lUUgfFjb00SPRnH7yU
```

## 📋 Passi da completare

### 1. Ottieni la Secret Key Live da Stripe
1. Vai su [Stripe Dashboard](https://dashboard.stripe.com/)
2. **Disattiva** il toggle "Test mode" in alto a destra (passa a Live mode)
3. Vai su **Developers → API keys**
4. Copia la **Secret key** (inizia con `sk_live_...`)
5. **NON condividerla mai pubblicamente!**

### 2. Aggiorna i Secrets su Supabase
1. Vai su [Supabase Dashboard](https://supabase.com/dashboard)
2. Seleziona il tuo progetto
3. Vai su **Project Settings → Edge Functions**
4. Aggiorna questi secrets:

```bash
# Secret Key Live (sostituisci con la tua)
STRIPE_SECRET_KEY=sk_live_TUA_CHIAVE_SEGRETA_LIVE

# Publishable Key Live (già configurata)
STRIPE_PUBLISHABLE_KEY=pk_live_51NAwxJERHOOWoH8ZArl1PQy7pw9zr6ZoOCb8rNwuPq5NDtxs3jgsT3sxmgl0xbjWCoQsI9ZpRXerqBg5lUUgfFjb00SPRnH7yU
```

### 3. Configura il Webhook Live su Stripe
1. Vai su Stripe Dashboard (Live mode) → **Developers → Webhooks**
2. Clicca **"Add endpoint"**
3. Inserisci l'URL del webhook:
   ```
   https://tuo-progetto.supabase.co/functions/v1/stripe-webhook
   ```
   (Sostituisci `tuo-progetto` con il tuo project ID Supabase)

4. Seleziona questi eventi:
   - ✅ `customer.subscription.created`
   - ✅ `customer.subscription.updated`
   - ✅ `customer.subscription.deleted`
   - ✅ `invoice.payment_succeeded`
   - ✅ `invoice.payment_failed`

5. Clicca **"Add endpoint"**

6. Copia il **Webhook signing secret** (inizia con `whsec_...`)

### 4. Aggiorna il Webhook Secret su Supabase
1. Torna su Supabase Dashboard → Project Settings → Edge Functions
2. Aggiorna il secret:
```bash
STRIPE_WEBHOOK_SECRET=whsec_TUO_WEBHOOK_SECRET_LIVE
```

### 5. Verifica la Configurazione
1. **Testa il pagamento:**
   - Usa una carta reale (non le carte di test)
   - Completa il checkout
   - Verifica che il pagamento sia registrato su Stripe

2. **Controlla il webhook:**
   - Vai su Stripe Dashboard → Developers → Webhooks
   - Clicca sul tuo endpoint
   - Verifica che gli eventi siano ricevuti correttamente

3. **Verifica il database:**
   - Vai su Supabase Dashboard → Table Editor → `user_subscriptions`
   - Controlla che lo stato dell'abbonamento sia aggiornato:
     - `subscription_type` = `'paid'`
     - `status` = `'active'`

## ⚠️ IMPORTANTE - Checklist Pre-Live

Prima di accettare pagamenti reali, assicurati che:

- [ ] Il tuo account Stripe sia completamente **verificato**
- [ ] Le informazioni aziendali siano complete su Stripe
- [ ] Le email di notifica siano configurate
- [ ] Hai testato il flusso completo in test mode
- [ ] Hai configurato le policy di rimborso
- [ ] Hai impostato le email di conferma pagamento
- [ ] Hai testato il webhook in live mode

## 🔐 Sicurezza

**NON condividere mai:**
- Secret Key (`sk_live_...`)
- Webhook Secret (`whsec_...`)

**Puoi condividere pubblicamente:**
- Publishable Key (`pk_live_...`) ✅

## 📞 Supporto

Se hai problemi:
1. Controlla i log su Supabase Dashboard → Edge Functions → Logs
2. Verifica gli eventi webhook su Stripe Dashboard → Developers → Webhooks
3. Controlla la console del browser per errori JavaScript

## 🎉 Congratulazioni!

Una volta completati tutti i passi, la tua app sarà pronta per accettare pagamenti reali! 🚀
