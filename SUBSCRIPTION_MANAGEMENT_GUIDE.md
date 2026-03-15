# 📋 Guida Gestione Abbonamenti via Supabase Dashboard

## 🎯 Come Gestire gli Abbonamenti degli Utenti

### **1. Accedi a Supabase Dashboard**
1. Vai su https://supabase.com/dashboard
2. Seleziona il progetto "Ristorante app"
3. Clicca su **"Table Editor"** nel menu laterale
4. Seleziona la tabella **"user_subscriptions"**

---

## 👥 **Vedere Tutti gli Utenti Registrati**

Nella tabella `user_subscriptions` vedrai:

| Colonna | Descrizione |
|---------|-------------|
| **user_id** | ID univoco dell'utente (UUID) |
| **subscription_type** | Tipo abbonamento: `free`, `premium`, `enterprise` |
| **status** | Stato: `active`, `expired`, `suspended` |
| **expires_at** | Data e ora di scadenza |
| **created_at** | Data registrazione |
| **updated_at** | Ultima modifica |

---

## ✏️ **Operazioni Comuni**

### **A. Estendere un Abbonamento**

**Scenario:** Un utente ha pagato per 30 giorni di Premium

1. Trova la riga dell'utente nella tabella
2. Clicca sull'icona **"Edit"** (matita)
3. Modifica i campi:
   - `subscription_type` → `premium`
   - `status` → `active`
   - `expires_at` → Clicca sul campo e seleziona la nuova data (es: oggi + 30 giorni)
4. Clicca **"Save"**

**Esempio:**
- Oggi: 11 Novembre 2024
- Utente paga per 1 mese
- Imposta `expires_at`: 11 Dicembre 2024, 23:59:59

---

### **B. Disattivare un Utente**

**Scenario:** Vuoi bloccare temporaneamente un utente

1. Trova la riga dell'utente
2. Clicca **"Edit"**
3. Cambia `status` → `suspended`
4. Clicca **"Save"**

L'utente vedrà la pagina "Abbonamento Scaduto" al prossimo login.

---

### **C. Riattivare un Utente**

**Scenario:** Vuoi riattivare un utente sospeso o scaduto

1. Trova la riga dell'utente
2. Clicca **"Edit"**
3. Modifica:
   - `status` → `active`
   - `expires_at` → Imposta una nuova data futura
4. Clicca **"Save"**

---

### **D. Cambiare Tipo di Abbonamento**

**Scenario:** Upgrade da Free a Premium

1. Trova la riga dell'utente
2. Clicca **"Edit"**
3. Modifica:
   - `subscription_type` → `premium` (o `enterprise`)
   - `expires_at` → Imposta la nuova scadenza
   - `status` → `active`
4. Clicca **"Save"**

---

## 📊 **Vedere Email degli Utenti**

Per vedere le email associate agli utenti:

1. Vai su **"Authentication"** nel menu laterale
2. Clicca su **"Users"**
3. Vedrai la lista completa con:
   - Email
   - Data registrazione
   - Ultimo accesso
   - User ID (UUID)

4. **Collegare con Abbonamenti:**
   - Copia il `User ID` dall'elenco utenti
   - Vai su **"Table Editor"** → **"user_subscriptions"**
   - Cerca il `user_id` corrispondente

---

## 🔄 **Workflow Tipico**

### **Nuovo Utente si Registra:**
1. L'utente si registra nell'app
2. **Automaticamente** viene creato un record in `user_subscriptions`:
   - `subscription_type`: `free`
   - `status`: `active`
   - `expires_at`: Data odierna + 7 giorni (trial gratuito)

### **Utente Paga per Premium:**
1. Ricevi il pagamento (WhatsApp, email, bonifico, etc.)
2. Vai su Supabase Dashboard
3. Trova l'utente in `user_subscriptions`
4. Modifica:
   - `subscription_type` → `premium`
   - `expires_at` → Oggi + 30 giorni (o 365 per annuale)
   - `status` → `active`
5. Salva
6. L'utente può continuare a usare l'app

### **Abbonamento Scade:**
1. L'app controlla automaticamente la scadenza ad ogni login
2. Se `expires_at` < data odierna:
   - L'utente vede "Abbonamento Scaduto"
   - Non può accedere all'app
   - Deve contattarti per rinnovare

---

## 💡 **Suggerimenti**

### **Filtri Utili:**

**Vedere solo abbonamenti scaduti:**
1. Clicca sull'icona filtro nella colonna `status`
2. Seleziona `expired`

**Vedere abbonamenti in scadenza:**
1. Ordina per `expires_at` (clicca sull'intestazione colonna)
2. I primi risultati sono quelli in scadenza prima

**Cercare un utente specifico:**
1. Se conosci l'email, vai su Authentication → Users
2. Cerca l'email e copia il `User ID`
3. Vai su Table Editor → user_subscriptions
4. Usa il filtro sulla colonna `user_id`

---

## 📅 **Durate Abbonamento Comuni**

| Tipo | Durata | Calcolo `expires_at` |
|------|--------|----------------------|
| **Trial Gratuito** | 7 giorni | Oggi + 7 giorni |
| **Mensile** | 30 giorni | Oggi + 30 giorni |
| **Trimestrale** | 90 giorni | Oggi + 90 giorni |
| **Semestrale** | 180 giorni | Oggi + 180 giorni |
| **Annuale** | 365 giorni | Oggi + 365 giorni |

---

## 🚨 **Problemi Comuni**

### **Utente dice di aver pagato ma non può accedere:**
1. Verifica il pagamento
2. Controlla `user_subscriptions`:
   - `status` deve essere `active`
   - `expires_at` deve essere nel futuro
3. Se necessario, modifica manualmente

### **Utente non vede l'aggiornamento:**
1. L'utente deve fare **logout** e **login** di nuovo
2. L'app ricarica lo stato abbonamento ad ogni login

### **Voglio dare un mese gratuito:**
1. Trova l'utente in `user_subscriptions`
2. Imposta `expires_at` a oggi + 30 giorni
3. Mantieni `subscription_type` come `free` o cambia in `premium`

---

## 📞 **Contatti Utente**

Nella pagina "Abbonamento Scaduto", l'utente vede:

- **Email:** admin@tuoristorante.it (modifica in `SubscriptionExpired.tsx`)
- **WhatsApp:** +39 312 345 6789 (modifica in `SubscriptionExpired.tsx`)

**Per personalizzare i contatti:**
1. Apri il file `/workspace/shadcn-ui/src/pages/SubscriptionExpired.tsx`
2. Cerca le righe con `mailto:` e `https://wa.me/`
3. Sostituisci con i tuoi contatti reali
4. Salva e ricompila l'app

---

## 🎯 **Best Practices**

1. **Controlla regolarmente** la tabella per vedere abbonamenti in scadenza
2. **Invia promemoria** agli utenti 3-7 giorni prima della scadenza
3. **Documenta i pagamenti** (crea una tabella separata se necessario)
4. **Backup dei dati** - Supabase fa backup automatici, ma puoi esportare la tabella periodicamente
5. **Comunica chiaramente** le date di scadenza agli utenti

---

## 🔮 **Prossimi Passi (Futuro)**

Quando vorrai automatizzare i pagamenti:
- Integrazione con **Stripe** o **PayPal**
- Rinnovo automatico abbonamenti
- Email automatiche di promemoria
- Dashboard admin personalizzata nell'app

Per ora, la gestione manuale via Supabase Dashboard è semplice ed efficace! 💪