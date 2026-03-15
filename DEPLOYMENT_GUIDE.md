# 🚀 Guida Completa al Deployment con Supabase

## 📋 Indice
1. [Configurazione Supabase](#1-configurazione-supabase)
2. [Configurazione Locale](#2-configurazione-locale)
3. [Deploy su Vercel](#3-deploy-su-vercel)
4. [Test dell'Applicazione](#4-test-dellapplicazione)
5. [Gestione Utenti](#5-gestione-utenti)

---

## 1. Configurazione Supabase

### Step 1.1: Esegui lo Script SQL

1. Vai al tuo progetto Supabase: https://tmxmkvinsvuzbzrjrucw.supabase.co
2. Clicca su **"SQL Editor"** nella barra laterale sinistra
3. Clicca su **"New Query"**
4. Copia tutto il contenuto del file `SUPABASE_SETUP.sql`
5. Incolla nel SQL Editor
6. Clicca su **"Run"** (o premi `Ctrl+Enter`)
7. Dovresti vedere il messaggio: **"Success. No rows returned"**

### Step 1.2: Verifica le Tabelle Create

1. Vai su **"Table Editor"** nella barra laterale
2. Dovresti vedere 5 tabelle:
   - `products`
   - `suppliers`
   - `orders`
   - `invoices`
   - `price_history`

### Step 1.3: Configura l'Autenticazione Email

1. Vai su **"Authentication"** → **"Providers"**
2. Assicurati che **"Email"** sia abilitato
3. Opzionale: Configura le impostazioni email per conferma account

---

## 2. Configurazione Locale

### Step 2.1: File .env

Il file `.env` è già configurato con le tue credenziali:

```env
VITE_SUPABASE_URL=https://tmxmkvinsvuzbzrjrucw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_GOOGLE_API_KEY=AIzaSyCovh7lc2BECIkfc0sEQ-MeqJEhJZlKqzo
```

### Step 2.2: Test Locale

```bash
# Installa dipendenze (se non già fatto)
pnpm install

# Avvia il server di sviluppo
pnpm run dev
```

Apri http://localhost:5173 e dovresti vedere la schermata di login.

---

## 3. Deploy su Vercel

### Step 3.1: Push su GitHub

```bash
# Assicurati che tutto sia committato
git add .
git commit -m "Add Supabase integration"
git push origin main
```

### Step 3.2: Configura Vercel

1. Vai su https://vercel.com/dashboard
2. Clicca su **"Import Project"**
3. Seleziona il tuo repository GitHub
4. **IMPORTANTE**: Prima di cliccare "Deploy", configura le variabili d'ambiente

### Step 3.3: Aggiungi Variabili d'Ambiente su Vercel

Nella sezione **"Environment Variables"**, aggiungi:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | `https://tmxmkvinsvuzbzrjrucw.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRteG1rdmluc3Z1emJ6cmpydWN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5Mzc4ODIsImV4cCI6MjA3ODUxMzg4Mn0.bz5siYBfM4UVV6cerbHPzmII7DnDLP3ynH2OV2Ts3So` |
| `VITE_GOOGLE_API_KEY` | `AIzaSyCovh7lc2BECIkfc0sEQ-MeqJEhJZlKqzo` |

**Per ogni variabile:**
- Seleziona tutti gli ambienti: ✅ Production, ✅ Preview, ✅ Development
- Clicca "Add"

### Step 3.4: Deploy

1. Clicca su **"Deploy"**
2. Attendi il completamento del build (2-3 minuti)
3. Clicca sul link del deployment quando è pronto

---

## 4. Test dell'Applicazione

### Step 4.1: Registrazione Primo Utente

1. Apri l'app deployata
2. Dovresti vedere la schermata di **Login/Registrazione**
3. Clicca su **"Non hai un account? Registrati"**
4. Inserisci:
   - Email: `test@example.com`
   - Password: `password123` (minimo 6 caratteri)
   - Conferma Password: `password123`
5. Clicca su **"Registrati"**
6. Dovresti vedere: **"Registrazione completata! Controlla la tua email per confermare."**

### Step 4.2: Conferma Email (Opzionale)

Se hai configurato l'email su Supabase:
1. Controlla la tua casella email
2. Clicca sul link di conferma
3. Torna all'app e fai login

Se NON hai configurato l'email:
1. Vai su Supabase → **Authentication** → **Users**
2. Trova l'utente appena creato
3. Clicca sui tre puntini → **"Confirm email"**

### Step 4.3: Login

1. Torna alla schermata di login
2. Inserisci le credenziali
3. Clicca su **"Accedi"**
4. Dovresti vedere la dashboard con il badge **"Supabase Cloud"**

### Step 4.4: Test Funzionalità

1. **Aggiungi un Fornitore:**
   - Vai su "Fornitori"
   - Clicca "Aggiungi Fornitore"
   - Compila i campi
   - Salva

2. **Aggiungi un Prodotto:**
   - Vai su "Prodotti"
   - Clicca "Aggiungi Prodotto"
   - Seleziona il fornitore
   - Salva

3. **Crea un Ordine:**
   - Vai su "Ordini"
   - Clicca "Crea Nuovo Ordine"
   - Aggiungi prodotti
   - Salva

4. **Verifica Isolamento Dati:**
   - Fai logout
   - Registra un secondo utente
   - Fai login con il secondo utente
   - Dovresti vedere **ZERO** prodotti/fornitori/ordini
   - I dati del primo utente sono completamente isolati! ✅

---

## 5. Gestione Utenti

### Visualizza Utenti Registrati

1. Vai su Supabase Dashboard
2. Clicca su **"Authentication"** → **"Users"**
3. Vedrai tutti gli utenti registrati

### Elimina un Utente

1. Trova l'utente nella lista
2. Clicca sui tre puntini → **"Delete user"**
3. **IMPORTANTE**: Tutti i dati dell'utente (prodotti, ordini, ecc.) verranno eliminati automaticamente grazie a `ON DELETE CASCADE`

### Reset Password Utente

1. L'utente può cliccare su "Password dimenticata?" nella schermata di login
2. Oppure tu puoi inviare manualmente un link di reset da Supabase Dashboard

---

## 🎯 Checklist Finale

Prima di considerare il deployment completo, verifica:

- [ ] ✅ Script SQL eseguito con successo su Supabase
- [ ] ✅ Tabelle create e visibili in Table Editor
- [ ] ✅ Variabili d'ambiente configurate su Vercel
- [ ] ✅ App deployata e accessibile
- [ ] ✅ Registrazione nuovo utente funzionante
- [ ] ✅ Login funzionante
- [ ] ✅ Badge "Supabase Cloud" visibile nell'header
- [ ] ✅ Aggiunta fornitore/prodotto/ordine funzionante
- [ ] ✅ Dati salvati nel cloud (verifica su Supabase Table Editor)
- [ ] ✅ Isolamento dati tra utenti verificato
- [ ] ✅ Logout funzionante

---

## 🚨 Troubleshooting

### Problema: "User not authenticated"

**Soluzione:**
1. Fai logout e login di nuovo
2. Controlla che le variabili d'ambiente siano configurate correttamente
3. Verifica che l'utente sia confermato in Supabase → Authentication → Users

### Problema: "Failed to fetch"

**Soluzione:**
1. Verifica che `VITE_SUPABASE_URL` sia corretto
2. Controlla la console del browser per errori CORS
3. Assicurati che Supabase non abbia restrizioni IP

### Problema: Dati non si salvano

**Soluzione:**
1. Apri la console del browser (F12)
2. Cerca errori nella tab "Console"
3. Verifica che le RLS policies siano attive
4. Controlla che `user_id` sia presente nelle query

### Problema: "Invalid API key"

**Soluzione:**
1. Verifica che `VITE_GOOGLE_API_KEY` sia configurato
2. Controlla che la chiave API sia valida su Google AI Studio
3. Prova a rigenerare la chiave API

---

## 📊 Capacità Multi-Utente

### ✅ Pronto per 1000+ Utenti

L'app è ora completamente pronta per supportare migliaia di utenti perché:

1. **Isolamento Dati**: Ogni utente vede solo i propri dati grazie alle RLS policies
2. **Scalabilità**: Supabase gestisce automaticamente il carico
3. **Sicurezza**: Autenticazione JWT e Row Level Security
4. **Backup**: Supabase fa backup automatici
5. **Performance**: Indici ottimizzati per query veloci
6. **Real-time**: Possibilità di aggiungere sync real-time in futuro

### Limiti del Piano Gratuito Supabase

- **Database**: 500 MB
- **Bandwidth**: 5 GB/mese
- **Auth Users**: Illimitati
- **API Requests**: Illimitati

Per 1000 utenti attivi, probabilmente dovrai passare al piano **Pro** ($25/mese) che offre:
- **Database**: 8 GB
- **Bandwidth**: 250 GB/mese
- **Support**: Email support

---

## 🎉 Congratulazioni!

Hai completato con successo l'integrazione Supabase! La tua app è ora:

- ✅ Multi-utente con autenticazione
- ✅ Dati isolati per ogni utente
- ✅ Sincronizzati nel cloud
- ✅ Accessibili da qualsiasi dispositivo
- ✅ Pronta per 1000+ utenti
- ✅ Sicura con Row Level Security

**Prossimi Passi Consigliati:**

1. Configura un dominio personalizzato su Vercel
2. Abilita la conferma email su Supabase
3. Aggiungi un logo personalizzato
4. Monitora l'uso su Supabase Dashboard
5. Considera il piano Pro quando necessario

---

**Hai domande o problemi?** Controlla la sezione Troubleshooting o consulta la documentazione:
- Supabase Docs: https://supabase.com/docs
- Vercel Docs: https://vercel.com/docs