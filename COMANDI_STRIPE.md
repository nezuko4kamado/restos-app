# 📝 Comandi Rapidi per Configurazione Stripe

Questa è una guida di riferimento rapido con tutti i comandi necessari per configurare Stripe.

---

## 🚀 Setup Iniziale

### 1. Installa Supabase CLI

```bash
npm install -g supabase
```

### 2. Verifica Installazione

```bash
supabase --version
```

### 3. Login a Supabase

```bash
supabase login
```

### 4. Collega il Progetto

```bash
cd /workspace/shadcn-ui
supabase link --project-ref tmxmkvinsvuzbzrjrucw
```

---

## 🔐 Configurazione Secrets

### Imposta Stripe Secret Key

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_TUA_CHIAVE_QUI
```

**Esempio:**
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_51AbCdEfGhIjKlMnOpQrStUvWxYz1234567890
```

### Imposta Webhook Secret

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_TUO_SECRET_QUI
```

**Esempio:**
```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_AbCdEfGhIjKlMnOpQrStUvWxYz1234567890
```

### Verifica Secrets Configurati

```bash
supabase secrets list
```

**Output atteso:**
```
NAME                      VALUE
STRIPE_SECRET_KEY         sk_test_51AbCd... (hidden)
STRIPE_WEBHOOK_SECRET     whsec_AbCdEf... (hidden)
```

---

## 📤 Deploy Edge Functions

### Deploy Tutte le Funzioni (Consigliato)

```bash
cd /workspace/shadcn-ui

# Deploy create-checkout-session
supabase functions deploy create-checkout-session

# Deploy create-portal-session
supabase functions deploy create-portal-session

# Deploy stripe-webhook
supabase functions deploy stripe-webhook
```

### Deploy Singola Funzione

```bash
# Solo checkout
supabase functions deploy create-checkout-session

# Solo portal
supabase functions deploy create-portal-session

# Solo webhook
supabase functions deploy stripe-webhook
```

### Verifica Deploy

```bash
supabase functions list
```

**Output atteso:**
```
NAME                        STATUS      CREATED AT
create-checkout-session     deployed    2024-01-16 10:30:00
create-portal-session       deployed    2024-01-16 10:30:15
stripe-webhook              deployed    2024-01-16 10:30:30
```

---

## 🔍 Debug e Logs

### Visualizza Logs in Tempo Reale

```bash
# Logs checkout session
supabase functions logs create-checkout-session --follow

# Logs portal session
supabase functions logs create-portal-session --follow

# Logs webhook
supabase functions logs stripe-webhook --follow
```

Premi `Ctrl+C` per fermare.

### Visualizza Ultimi Logs

```bash
# Ultimi 50 log della funzione checkout
supabase functions logs create-checkout-session --limit 50

# Ultimi 100 log del webhook
supabase functions logs stripe-webhook --limit 100
```

---

## 🧪 Test Funzioni

### Test Create Checkout Session

```bash
curl -X POST \
  https://tmxmkvinsvuzbzrjrucw.supabase.co/functions/v1/create-checkout-session \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRteG1rdmluc3Z1emJ6cmpydWN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5Mzc4ODIsImV4cCI6MjA3ODUxMzg4Mn0.bz5siYBfM4UVV6cerbHPzmII7DnDLP3ynH2OV2Ts3So" \
  -H "Content-Type: application/json"
```

### Test Webhook (Locale)

```bash
# Serve la funzione localmente per test
supabase functions serve stripe-webhook
```

---

## 🔄 Aggiornamento e Manutenzione

### Ri-deploy Dopo Modifiche al Codice

```bash
cd /workspace/shadcn-ui

# Ri-deploya la funzione modificata
supabase functions deploy create-checkout-session

# Oppure tutte
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session
supabase functions deploy stripe-webhook
```

### Aggiorna un Secret

```bash
# Aggiorna Stripe Secret Key
supabase secrets set STRIPE_SECRET_KEY=sk_test_NUOVA_CHIAVE

# Aggiorna Webhook Secret
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_NUOVO_SECRET
```

### Elimina un Secret (se necessario)

```bash
supabase secrets unset STRIPE_SECRET_KEY
supabase secrets unset STRIPE_WEBHOOK_SECRET
```

---

## 🌐 Passaggio a Produzione

### 1. Aggiorna Secrets con Chiavi Live

```bash
# Sostituisci con le chiavi LIVE (sk_live_... invece di sk_test_...)
supabase secrets set STRIPE_SECRET_KEY=sk_live_TUA_CHIAVE_LIVE

# Webhook secret LIVE (nuovo webhook da creare in Stripe)
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_TUO_SECRET_LIVE
```

### 2. Verifica Secrets Live

```bash
supabase secrets list
```

### 3. Ri-deploy Funzioni (opzionale)

```bash
# Non necessario se il codice non è cambiato
# Ma puoi farlo per sicurezza
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session
supabase functions deploy stripe-webhook
```

---

## 🆘 Troubleshooting Rapido

### Funzione non trovata (404)

```bash
# Verifica deploy
supabase functions list

# Ri-deploya
supabase functions deploy create-checkout-session
```

### Errore "Invalid API Key"

```bash
# Verifica secrets
supabase secrets list

# Riconfigura
supabase secrets set STRIPE_SECRET_KEY=sk_test_TUA_CHIAVE
```

### Webhook non riceve eventi

```bash
# Controlla logs
supabase functions logs stripe-webhook --follow

# Verifica URL webhook in Stripe:
# https://tmxmkvinsvuzbzrjrucw.supabase.co/functions/v1/stripe-webhook
```

### Reset Completo

```bash
# 1. Elimina secrets
supabase secrets unset STRIPE_SECRET_KEY
supabase secrets unset STRIPE_WEBHOOK_SECRET

# 2. Riconfigura
supabase secrets set STRIPE_SECRET_KEY=sk_test_TUA_CHIAVE
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_TUO_SECRET

# 3. Ri-deploya tutto
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session
supabase functions deploy stripe-webhook

# 4. Verifica
supabase functions list
supabase secrets list
```

---

## 📋 Checklist Veloce

Copia e incolla questi comandi in sequenza:

```bash
# 1. Setup
cd /workspace/shadcn-ui
supabase link --project-ref tmxmkvinsvuzbzrjrucw

# 2. Secrets (sostituisci con le tue chiavi)
supabase secrets set STRIPE_SECRET_KEY=sk_test_TUA_CHIAVE
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_TUO_SECRET

# 3. Deploy
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session
supabase functions deploy stripe-webhook

# 4. Verifica
supabase functions list
supabase secrets list
```

---

## 🔗 Link Utili

- **Dashboard Stripe:** https://dashboard.stripe.com
- **API Keys:** https://dashboard.stripe.com/test/apikeys
- **Webhooks:** https://dashboard.stripe.com/test/webhooks
- **Prodotti:** https://dashboard.stripe.com/test/products
- **Pagamenti:** https://dashboard.stripe.com/test/payments
- **Dashboard Supabase:** https://supabase.com/dashboard/project/tmxmkvinsvuzbzrjrucw
- **Supabase Functions:** https://supabase.com/dashboard/project/tmxmkvinsvuzbzrjrucw/functions

---

**Nota:** Sostituisci sempre `TUA_CHIAVE`, `TUO_SECRET`, ecc. con i valori reali ottenuti da Stripe.