# 🚀 Guida Completa: Configurazione Stripe per Pagamenti Abbonamenti

Questa guida ti accompagnerà passo-passo nella configurazione completa di Stripe per abilitare i pagamenti degli abbonamenti nella tua applicazione.

---

## 📋 Indice

1. [Prerequisiti](#prerequisiti)
2. [Parte 1: Configurazione Account Stripe](#parte-1-configurazione-account-stripe)
3. [Parte 2: Creazione Prodotto e Prezzo](#parte-2-creazione-prodotto-e-prezzo)
4. [Parte 3: Installazione Supabase CLI](#parte-3-installazione-supabase-cli)
5. [Parte 4: Configurazione Secrets Supabase](#parte-4-configurazione-secrets-supabase)
6. [Parte 5: Deploy Edge Functions](#parte-5-deploy-edge-functions)
7. [Parte 6: Configurazione Webhook Stripe](#parte-6-configurazione-webhook-stripe)
8. [Parte 7: Test e Verifica](#parte-7-test-e-verifica)
9. [Troubleshooting](#troubleshooting)

---

## Prerequisiti

Prima di iniziare, assicurati di avere:

- ✅ Un account Supabase attivo (il tuo progetto: `tmxmkvinsvuzbzrjrucw`)
- ✅ Accesso al terminale/command line
- ✅ Node.js installato (versione 16 o superiore)
- ✅ Un account email valido per Stripe

**Tempo stimato:** 30-45 minuti

---

## Parte 1: Configurazione Account Stripe

### Step 1.1: Crea un Account Stripe

1. Vai su **https://dashboard.stripe.com/register**
2. Compila il form con:
   - Email
   - Nome completo
   - Password sicura
3. Clicca su **"Create account"**
4. Verifica la tua email (controlla anche spam/promozioni)

### Step 1.2: Completa il Profilo Business

1. Accedi alla dashboard Stripe: **https://dashboard.stripe.com**
2. Clicca su **"Activate your account"** in alto
3. Compila le informazioni richieste:
   - **Tipo di business**: Individuale o Azienda
   - **Paese**: Italia
   - **Settore**: Seleziona il più appropriato (es. "Software")
   - **URL sito web**: (opzionale per test)
4. Clicca **"Submit"**

> 💡 **Nota:** Per ora puoi usare la modalità **Test** senza completare la verifica dell'account. Potrai attivare la modalità Live in seguito.

### Step 1.3: Ottieni le API Keys

1. Nella dashboard Stripe, vai su **"Developers"** → **"API keys"**
   - URL diretto: https://dashboard.stripe.com/test/apikeys

2. Vedrai due tipi di chiavi:

   **A) Publishable Key** (inizia con `pk_test_`)
   - Questa chiave è pubblica e sicura da usare nel frontend
   - Esempio: `pk_test_51AbCdEfGhIjKlMnOpQrStUvWxYz...`

   **B) Secret Key** (inizia con `sk_test_`)
   - ⚠️ **IMPORTANTE:** Questa chiave è PRIVATA, non condividerla mai!
   - Clicca su **"Reveal test key"** per visualizzarla
   - Esempio: `sk_test_51AbCdEfGhIjKlMnOpQrStUvWxYz...`

3. **Copia entrambe le chiavi** e salvale temporaneamente in un file di testo (le useremo dopo)

---

## Parte 2: Creazione Prodotto e Prezzo

### Step 2.1: Crea il Prodotto "Abbonamento Mensile"

1. Nella dashboard Stripe, vai su **"Products"** → **"Add product"**
   - URL diretto: https://dashboard.stripe.com/test/products

2. Compila i campi:
   - **Name**: `Abbonamento Mensile`
   - **Description**: `Accesso completo a tutte le funzionalità dell'applicazione`
   - **Image**: (opzionale) Carica un'immagine o logo

3. Nella sezione **"Pricing"**:
   - **Price**: `9.90`
   - **Currency**: `EUR` (Euro)
   - **Billing period**: Seleziona **"Monthly"** (Mensile)
   - **Payment type**: Seleziona **"Recurring"** (Ricorrente)

4. Clicca **"Save product"**

### Step 2.2: Ottieni il Price ID

1. Dopo aver salvato, vedrai la pagina del prodotto
2. Nella sezione **"Pricing"**, troverai il **Price ID**
   - Inizia con `price_` (es: `price_1AbCdEfGhIjKlMnOp`)
3. **Copia questo Price ID** - lo useremo nel codice

> 📝 **Nota:** Se hai già creato il prodotto, il Price ID è già configurato nel codice delle Edge Functions. Puoi verificarlo aprendo il file `supabase/functions/create-checkout-session/index.ts`

---

## Parte 3: Installazione Supabase CLI

### Step 3.1: Installa Supabase CLI

Apri il terminale ed esegui:

```bash
npm install -g supabase
```

### Step 3.2: Verifica l'Installazione

```bash
supabase --version
```

Dovresti vedere qualcosa come: `1.x.x`

### Step 3.3: Login a Supabase

```bash
supabase login
```

Si aprirà il browser per autenticarti. Accedi con le tue credenziali Supabase.

### Step 3.4: Collega il Progetto

```bash
cd /workspace/shadcn-ui
supabase link --project-ref tmxmkvinsvuzbzrjrucw
```

Ti verrà chiesta la **database password** del tuo progetto Supabase. Inseriscila quando richiesto.

> 🔑 **Dove trovo la database password?**
> - Vai su https://supabase.com/dashboard/project/tmxmkvinsvuzbzrjrucw/settings/database
> - Clicca su "Reset database password" se non la ricordi

---

## Parte 4: Configurazione Secrets Supabase

I "secrets" sono variabili d'ambiente sicure che vengono usate dalle Edge Functions.

### Step 4.1: Imposta la Stripe Secret Key

Usa la **Secret Key** che hai copiato nello Step 1.3:

```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_TUA_CHIAVE_SEGRETA_QUI
```

**Esempio:**
```bash
supabase secrets set STRIPE_SECRET_KEY=sk_test_51AbCdEfGhIjKlMnOpQrStUvWxYz1234567890
```

### Step 4.2: Verifica i Secrets

```bash
supabase secrets list
```

Dovresti vedere:
```
NAME                  VALUE
STRIPE_SECRET_KEY     sk_test_51AbCd... (hidden)
```

> ⚠️ **Importante:** Il valore della chiave sarà nascosto per sicurezza. Questo è normale!

---

## Parte 5: Deploy Edge Functions

Ora deployeremo le tre Edge Functions necessarie per Stripe.

### Step 5.1: Deploy "create-checkout-session"

Questa funzione crea la sessione di pagamento Stripe.

```bash
cd /workspace/shadcn-ui
supabase functions deploy create-checkout-session
```

**Output atteso:**
```
Deploying function create-checkout-session...
Function URL: https://tmxmkvinsvuzbzrjrucw.supabase.co/functions/v1/create-checkout-session
✓ Deployed function create-checkout-session
```

### Step 5.2: Deploy "create-portal-session"

Questa funzione permette agli utenti di gestire il loro abbonamento.

```bash
supabase functions deploy create-portal-session
```

**Output atteso:**
```
Deploying function create-portal-session...
Function URL: https://tmxmkvinsvuzbzrjrucw.supabase.co/functions/v1/create-portal-session
✓ Deployed function create-portal-session
```

### Step 5.3: Deploy "stripe-webhook"

Questa funzione riceve gli eventi da Stripe (pagamenti, cancellazioni, ecc.).

```bash
supabase functions deploy stripe-webhook
```

**Output atteso:**
```
Deploying function stripe-webhook...
Function URL: https://tmxmkvinsvuzbzrjrucw.supabase.co/functions/v1/stripe-webhook
✓ Deployed function stripe-webhook
```

### Step 5.4: Verifica il Deploy

```bash
supabase functions list
```

Dovresti vedere tutte e tre le funzioni con stato **"deployed"**:
```
NAME                        STATUS      CREATED AT
create-checkout-session     deployed    2024-01-16 10:30:00
create-portal-session       deployed    2024-01-16 10:30:15
stripe-webhook              deployed    2024-01-16 10:30:30
```

---

## Parte 6: Configurazione Webhook Stripe

Il webhook permette a Stripe di notificare la tua app quando succede qualcosa (pagamento completato, abbonamento cancellato, ecc.).

### Step 6.1: Aggiungi il Webhook Endpoint

1. Vai su **"Developers"** → **"Webhooks"** nella dashboard Stripe
   - URL diretto: https://dashboard.stripe.com/test/webhooks

2. Clicca su **"Add endpoint"**

3. Nel campo **"Endpoint URL"**, inserisci:
   ```
   https://tmxmkvinsvuzbzrjrucw.supabase.co/functions/v1/stripe-webhook
   ```

4. Clicca su **"Select events"**

### Step 6.2: Seleziona gli Eventi

Nella sezione **"Select events to listen to"**, cerca e seleziona questi eventi:

**Customer Events:**
- ✅ `customer.subscription.created`
- ✅ `customer.subscription.updated`
- ✅ `customer.subscription.deleted`

**Invoice Events:**
- ✅ `invoice.paid`
- ✅ `invoice.payment_failed`
- ✅ `invoice.payment_action_required`

**Checkout Events:**
- ✅ `checkout.session.completed`
- ✅ `checkout.session.expired`

### Step 6.3: Salva il Webhook

1. Clicca **"Add endpoint"** in fondo alla pagina
2. Vedrai la pagina del webhook appena creato

### Step 6.4: Ottieni il Webhook Secret

1. Nella pagina del webhook, cerca la sezione **"Signing secret"**
2. Clicca su **"Reveal"** per visualizzare il secret
3. Il secret inizia con `whsec_` (es: `whsec_AbCdEfGhIjKlMnOpQrStUvWxYz...`)
4. **Copia questo Webhook Secret**

### Step 6.5: Configura il Webhook Secret in Supabase

```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_TUO_WEBHOOK_SECRET_QUI
```

**Esempio:**
```bash
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_AbCdEfGhIjKlMnOpQrStUvWxYz1234567890
```

### Step 6.6: Verifica i Secrets Finali

```bash
supabase secrets list
```

Dovresti vedere entrambi i secrets:
```
NAME                      VALUE
STRIPE_SECRET_KEY         sk_test_51AbCd... (hidden)
STRIPE_WEBHOOK_SECRET     whsec_AbCdEf... (hidden)
```

---

## Parte 7: Test e Verifica

### Step 7.1: Test della Funzione Checkout

Apri il terminale ed esegui questo comando per testare la funzione:

```bash
curl -X POST \
  https://tmxmkvinsvuzbzrjrucw.supabase.co/functions/v1/create-checkout-session \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRteG1rdmluc3Z1emJ6cmpydWN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5Mzc4ODIsImV4cCI6MjA3ODUxMzg4Mn0.bz5siYBfM4UVV6cerbHPzmII7DnDLP3ynH2OV2Ts3So" \
  -H "Content-Type: application/json"
```

**Risposta attesa (se non sei loggato):**
```json
{"error": "Unauthorized - Invalid or expired token"}
```

Questo è normale! Significa che la funzione funziona ma richiede autenticazione.

### Step 7.2: Test nell'Applicazione

1. **Apri l'applicazione** nel browser
2. **Effettua il login** con il tuo account
3. Vai in **Impostazioni** → **Pagamento**
4. Clicca su **"Attiva Abbonamento"**

**Cosa dovrebbe succedere:**
- ✅ Vieni reindirizzato alla pagina di checkout Stripe
- ✅ Vedi il prodotto "Abbonamento Mensile" a €9.90/mese
- ✅ Puoi inserire i dati della carta di test

### Step 7.3: Usa una Carta di Test

Stripe fornisce carte di test per simulare pagamenti:

**Carta di Successo:**
- Numero: `4242 4242 4242 4242`
- Data scadenza: Qualsiasi data futura (es: `12/25`)
- CVC: Qualsiasi 3 cifre (es: `123`)
- CAP: Qualsiasi 5 cifre (es: `12345`)

**Altre carte di test:**
- Carta che richiede autenticazione 3D Secure: `4000 0027 6000 3184`
- Carta che viene rifiutata: `4000 0000 0000 0002`

### Step 7.4: Verifica il Pagamento

1. Completa il pagamento con la carta di test
2. Dovresti essere reindirizzato all'app con un messaggio di successo
3. Vai nella dashboard Stripe → **"Payments"**
   - URL: https://dashboard.stripe.com/test/payments
4. Dovresti vedere il pagamento di €9.90 con stato **"Succeeded"**

### Step 7.5: Verifica il Webhook

1. Vai su **"Developers"** → **"Webhooks"** in Stripe
2. Clicca sul webhook che hai creato
3. Nella sezione **"Recent events"**, dovresti vedere gli eventi ricevuti:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `invoice.paid`

4. Clicca su un evento per vedere i dettagli
5. Verifica che lo **"Status"** sia **"Succeeded"** (✅ verde)

---

## Troubleshooting

### ❌ Errore: "Function not found" o 404

**Problema:** La funzione non è stata deployata correttamente.

**Soluzione:**
```bash
# Verifica che le funzioni siano deployate
supabase functions list

# Se non vedi le funzioni, ri-deploya
supabase functions deploy create-checkout-session
supabase functions deploy create-portal-session
supabase functions deploy stripe-webhook
```

---

### ❌ Errore: "Missing authorization header"

**Problema:** L'utente non è autenticato o il token è scaduto.

**Soluzione:**
1. Disconnettiti dall'app
2. Riconnettiti
3. Riprova

---

### ❌ Errore: "Invalid API Key provided"

**Problema:** La Stripe Secret Key non è configurata o è errata.

**Soluzione:**
```bash
# Verifica i secrets
supabase secrets list

# Se STRIPE_SECRET_KEY non c'è o è sbagliato, riconfiguralo
supabase secrets set STRIPE_SECRET_KEY=sk_test_TUA_CHIAVE_QUI
```

---

### ❌ Errore: "No signature found in header"

**Problema:** Il Webhook Secret non è configurato.

**Soluzione:**
```bash
# Configura il webhook secret
supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_TUO_SECRET_QUI

# Poi ri-deploya la funzione webhook
supabase functions deploy stripe-webhook
```

---

### ❌ Il webhook non riceve eventi

**Problema:** L'URL del webhook è sbagliato o gli eventi non sono selezionati.

**Soluzione:**
1. Vai su https://dashboard.stripe.com/test/webhooks
2. Verifica che l'URL sia: `https://tmxmkvinsvuzbzrjrucw.supabase.co/functions/v1/stripe-webhook`
3. Verifica che gli eventi siano selezionati (vedi Step 6.2)
4. Prova a inviare un evento di test:
   - Clicca sul webhook
   - Clicca su "Send test webhook"
   - Seleziona `customer.subscription.created`
   - Clicca "Send test webhook"

---

### ❌ L'abbonamento non si attiva dopo il pagamento

**Problema:** Il webhook non aggiorna il database.

**Soluzione:**
1. Controlla i logs della funzione webhook:
   ```bash
   supabase functions logs stripe-webhook
   ```
2. Cerca errori nel log
3. Verifica che la tabella `user_subscriptions` esista nel database:
   - Vai su https://supabase.com/dashboard/project/tmxmkvinsvuzbzrjrucw/editor
   - Cerca la tabella `user_subscriptions`
4. Se non esiste, esegui le migration:
   ```bash
   cd /workspace/shadcn-ui
   # Controlla se ci sono migration da eseguire
   ls supabase/migrations/
   ```

---

### ❌ Errore: "supabase: command not found"

**Problema:** Supabase CLI non è installato o non è nel PATH.

**Soluzione:**
```bash
# Reinstalla Supabase CLI
npm install -g supabase

# Verifica l'installazione
which supabase
supabase --version
```

---

### 🔍 Come Vedere i Logs delle Funzioni

Per debug avanzato, puoi vedere i logs in tempo reale:

```bash
# Logs della funzione checkout
supabase functions logs create-checkout-session --follow

# Logs della funzione webhook
supabase functions logs stripe-webhook --follow
```

Premi `Ctrl+C` per fermare il log.

---

## ✅ Checklist Finale

Prima di considerare la configurazione completa, verifica:

- [ ] Account Stripe creato e verificato
- [ ] API Keys copiate (Publishable e Secret)
- [ ] Prodotto "Abbonamento Mensile" creato su Stripe
- [ ] Supabase CLI installato e collegato al progetto
- [ ] Secret `STRIPE_SECRET_KEY` configurato in Supabase
- [ ] Tutte e 3 le Edge Functions deployate
- [ ] Webhook creato su Stripe con URL corretto
- [ ] Eventi webhook selezionati (8 eventi totali)
- [ ] Secret `STRIPE_WEBHOOK_SECRET` configurato in Supabase
- [ ] Test pagamento completato con successo
- [ ] Webhook riceve eventi correttamente
- [ ] Abbonamento si attiva nel database dopo il pagamento

---

## 🎉 Congratulazioni!

Se hai completato tutti i passaggi, il sistema di pagamento Stripe è ora **completamente configurato e funzionante**!

Gli utenti possono:
- ✅ Attivare l'abbonamento mensile a €9.90
- ✅ Pagare in modo sicuro con Stripe
- ✅ Gestire il loro abbonamento (aggiornare carta, cancellare, ecc.)
- ✅ Ricevere fatture automatiche ogni mese

---

## 📞 Hai Bisogno di Aiuto?

Se incontri problemi non coperti in questa guida:

1. **Controlla i logs:** `supabase functions logs <nome-funzione>`
2. **Verifica lo stato Stripe:** https://status.stripe.com
3. **Consulta la documentazione:**
   - Stripe: https://stripe.com/docs
   - Supabase: https://supabase.com/docs

---

## 🔄 Passaggio da Test a Produzione

Quando sei pronto per accettare pagamenti reali:

1. **Completa la verifica dell'account Stripe**
   - Vai su https://dashboard.stripe.com/account/onboarding
   - Completa tutti i passaggi richiesti

2. **Ottieni le Live API Keys**
   - Vai su https://dashboard.stripe.com/apikeys
   - Passa alla modalità "Live" (toggle in alto a sinistra)
   - Copia le nuove chiavi (iniziano con `pk_live_` e `sk_live_`)

3. **Aggiorna i Secrets in Supabase**
   ```bash
   supabase secrets set STRIPE_SECRET_KEY=sk_live_TUA_CHIAVE_LIVE
   ```

4. **Crea un nuovo Webhook per Live**
   - Usa lo stesso URL: `https://tmxmkvinsvuzbzrjrucw.supabase.co/functions/v1/stripe-webhook`
   - Seleziona gli stessi eventi
   - Copia il nuovo Webhook Secret (live)
   - Aggiornalo in Supabase:
     ```bash
     supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_TUO_SECRET_LIVE
     ```

5. **Testa con una carta reale** (piccolo importo)

6. **Monitora i primi pagamenti** nella dashboard Stripe

---

**Versione:** 1.0  
**Ultimo aggiornamento:** 16 Novembre 2024  
**Progetto Supabase:** tmxmkvinsvuzbzrjrucw