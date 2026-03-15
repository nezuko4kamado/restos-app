# 📧 Configurazione SMTP Gmail per RESTO Contact Form

Questa guida ti aiuterà a configurare l'invio automatico delle email quando qualcuno compila il form di contatto.

## 🎯 Cosa otterrai

Quando un utente compila il form di contatto, riceverai automaticamente un'email su **salvo89uk@gmail.com** con:
- Nome e email del mittente
- Oggetto del messaggio
- Contenuto completo del messaggio
- Possibilità di rispondere direttamente all'utente

## ⚙️ Prerequisiti

- Account Gmail attivo (salvo89uk@gmail.com)
- Accesso alla dashboard Supabase
- Supabase CLI installato (opzionale ma consigliato)

---

## 📋 Passo 1: Abilita la Verifica in Due Passaggi su Gmail

1. Vai su [myaccount.google.com](https://myaccount.google.com)
2. Nel menu a sinistra, clicca su **"Sicurezza"**
3. Nella sezione **"Accesso a Google"**, trova **"Verifica in due passaggi"**
4. Clicca su **"Verifica in due passaggi"** e segui le istruzioni per attivarla
5. Potrebbe essere richiesto di:
   - Inserire la password del tuo account
   - Aggiungere un numero di telefono
   - Verificare il numero tramite SMS o chiamata

> ⚠️ **Importante**: La verifica in due passaggi DEVE essere attiva per creare le Password per le app.

---

## 🔑 Passo 2: Crea una Password per le App Gmail

1. Dopo aver attivato la verifica in due passaggi, torna su [myaccount.google.com](https://myaccount.google.com)
2. Vai su **"Sicurezza"**
3. Nella sezione **"Accesso a Google"**, cerca **"Password per le app"**
   - Se non vedi questa opzione, assicurati che la verifica in due passaggi sia attiva
4. Clicca su **"Password per le app"**
5. Potrebbe essere richiesto di inserire nuovamente la password
6. Nel campo **"Seleziona app"**, scegli **"Posta"**
7. Nel campo **"Seleziona dispositivo"**, scegli **"Altro (nome personalizzato)"**
8. Inserisci un nome descrittivo, ad esempio: **"RESTO Contact Form"**
9. Clicca su **"Genera"**
10. Gmail ti mostrerà una password di 16 caratteri (es: `abcd efgh ijkl mnop`)
11. **COPIA QUESTA PASSWORD** - la userai nel prossimo passo

> 📝 **Nota**: Questa password è diversa dalla tua password Gmail normale. È specifica per l'applicazione RESTO.

---

## 🔐 Passo 3: Configura i Secrets in Supabase

Ora devi configurare le credenziali SMTP come "secrets" (variabili d'ambiente sicure) in Supabase.

### Opzione A: Tramite Dashboard Supabase (Più Facile)

1. Vai su [supabase.com/dashboard](https://supabase.com/dashboard)
2. Seleziona il tuo progetto **RESTO**
3. Nel menu a sinistra, clicca su **"Edge Functions"**
4. Clicca sulla tab **"Secrets"** (o "Environment Variables")
5. Aggiungi i seguenti secrets uno per uno:

| Nome Secret | Valore | Descrizione |
|------------|--------|-------------|
| `SMTP_HOST` | `smtp.gmail.com` | Server SMTP di Gmail |
| `SMTP_PORT` | `587` | Porta SMTP (TLS) |
| `SMTP_USER` | `salvo89uk@gmail.com` | Tuo indirizzo Gmail |
| `SMTP_PASSWORD` | `abcd efgh ijkl mnop` | Password app generata (SENZA spazi) |
| `SMTP_FROM` | `noreply@resto.app` | Email mittente (può essere personalizzata) |

> ⚠️ **IMPORTANTE**: Quando inserisci `SMTP_PASSWORD`, **rimuovi tutti gli spazi** dalla password generata da Gmail. Se Gmail ti ha dato `abcd efgh ijkl mnop`, inserisci `abcdefghijklmnop`.

6. Clicca su **"Save"** o **"Add Secret"** per ogni variabile

### Opzione B: Tramite Supabase CLI (Per Utenti Avanzati)

Se hai installato la Supabase CLI, puoi configurare i secrets dal terminale:

```bash
# Installa Supabase CLI (se non l'hai già fatto)
npm install -g supabase

# Login a Supabase
supabase login

# Link al tuo progetto
supabase link --project-ref tmxmkvinsvuzbzrjrucw

# Configura i secrets (sostituisci con la tua password app)
supabase secrets set SMTP_HOST=smtp.gmail.com
supabase secrets set SMTP_PORT=587
supabase secrets set SMTP_USER=salvo89uk@gmail.com
supabase secrets set SMTP_PASSWORD=abcdefghijklmnop
supabase secrets set SMTP_FROM=noreply@resto.app
```

---

## 🚀 Passo 4: Verifica la Configurazione

Dopo aver configurato i secrets:

1. Vai all'app RESTO
2. Clicca su **"Contattaci"** nel menu
3. Compila il form di contatto con dati di test:
   - Nome: Test
   - Email: test@esempio.com
   - Oggetto: Test Email
   - Messaggio: Questo è un messaggio di test
4. Clicca su **"Invia Messaggio"**
5. Controlla la tua casella email **salvo89uk@gmail.com**
6. Dovresti ricevere un'email con il messaggio di test

---

## 🔍 Troubleshooting

### ❌ Non ricevo email

**Possibili cause:**

1. **Password per le app errata**
   - Verifica di aver copiato correttamente la password
   - Assicurati di aver rimosso tutti gli spazi
   - Prova a generare una nuova password per le app

2. **Verifica in due passaggi non attiva**
   - Controlla che la verifica in due passaggi sia attiva su Gmail
   - Senza questa, non puoi creare password per le app

3. **Secrets non configurati correttamente**
   - Verifica che tutti i 5 secrets siano stati aggiunti
   - Controlla che non ci siano errori di battitura
   - I nomi dei secrets sono case-sensitive (maiuscole/minuscole)

4. **Email finisce nello spam**
   - Controlla la cartella spam/posta indesiderata
   - Aggiungi noreply@resto.app ai contatti

5. **Edge Function non aggiornata**
   - L'Edge Function potrebbe aver bisogno di tempo per aggiornarsi
   - Aspetta 1-2 minuti e riprova

### 📊 Come verificare i log

1. Vai su [supabase.com/dashboard](https://supabase.com/dashboard)
2. Seleziona il tuo progetto
3. Vai su **"Edge Functions"**
4. Clicca su **"app_8ab304f048_send_contact_email"**
5. Vai sulla tab **"Logs"**
6. Cerca errori o messaggi di debug

---

## 🔒 Sicurezza

### ✅ Cosa è sicuro

- ✅ La password per le app è specifica per RESTO e può essere revocata in qualsiasi momento
- ✅ L'email destinatario (salvo89uk@gmail.com) è nascosta nel backend
- ✅ I secrets sono criptati in Supabase
- ✅ La password per le app NON è la tua password Gmail principale

### ⚠️ Best Practices

- 🔐 Non condividere mai la password per le app
- 🔐 Non committare i secrets nel codice
- 🔐 Revoca la password per le app se non la usi più
- 🔐 Usa password diverse per app diverse

### 🗑️ Come revocare una Password per le App

Se vuoi disattivare l'invio email o hai compromesso la password:

1. Vai su [myaccount.google.com](https://myaccount.google.com)
2. Vai su **"Sicurezza"** → **"Password per le app"**
3. Trova **"RESTO Contact Form"** nella lista
4. Clicca su **"Revoca"** o sull'icona del cestino
5. Conferma la revoca

---

## 📝 Note Importanti

### Sistema Dual-Layer (Doppio Salvataggio)

Il form di contatto usa un sistema **dual-layer** per massima affidabilità:

1. **Layer 1 (Primario)**: Salvataggio nel database Supabase
   - ✅ Sempre attivo
   - ✅ Garantisce che nessun messaggio venga perso
   - ✅ Puoi vedere tutti i messaggi nella dashboard Supabase

2. **Layer 2 (Secondario)**: Invio email via SMTP
   - ✅ Attivo solo se SMTP è configurato
   - ✅ Ti invia notifiche immediate
   - ✅ Non blocca il form se fallisce

**Cosa significa?**
- Anche se l'email fallisce, il messaggio viene comunque salvato nel database
- L'utente vede sempre "Messaggio ricevuto!" anche se l'email non parte
- Puoi configurare SMTP in qualsiasi momento senza perdere messaggi

### Come vedere i messaggi nel database

Se l'email non funziona o vuoi vedere tutti i messaggi storici:

1. Vai su [supabase.com/dashboard](https://supabase.com/dashboard)
2. Seleziona il tuo progetto
3. Vai su **"Table Editor"**
4. Apri la tabella **"app_8ab304f048_contact_messages"**
5. Vedrai tutti i messaggi con:
   - Nome
   - Email
   - Oggetto
   - Messaggio
   - Data/ora di ricezione

---

## 🆘 Supporto

Se hai problemi con la configurazione:

1. Controlla i log nella dashboard Supabase
2. Verifica che tutti i secrets siano configurati correttamente
3. Prova a generare una nuova password per le app
4. Contatta il supporto con screenshot dei log

---

## ✅ Checklist Finale

Prima di considerare la configurazione completa, verifica:

- [ ] Verifica in due passaggi attiva su Gmail
- [ ] Password per le app generata e copiata
- [ ] Tutti i 5 secrets configurati in Supabase
- [ ] Password per le app senza spazi in `SMTP_PASSWORD`
- [ ] Email di test inviata e ricevuta
- [ ] Email non finita nello spam

---

**🎉 Configurazione completata!** Ora riceverai automaticamente un'email ogni volta che qualcuno compila il form di contatto.