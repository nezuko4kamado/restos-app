# 🚀 Guida Configurazione Supabase

## ✅ Hai già completato questi passaggi:

1. ✅ Creato account Supabase
2. ✅ Creato progetto "Ristorante app"
3. ✅ Ottenuto le credenziali API

---

## 📋 PASSO FINALE: Crea le Tabelle del Database

### **Metodo 1: SQL Editor (Consigliato)**

1. **Apri Supabase Dashboard**
   - Vai su: https://supabase.com/dashboard
   - Seleziona il progetto "Ristorante app"

2. **Apri SQL Editor**
   - Nel menu laterale sinistro, clicca su **"SQL Editor"**
   - Clicca su **"New query"**

3. **Copia e Incolla lo Script SQL**
   - Apri il file `supabase-setup.sql` in questo progetto
   - Copia **TUTTO** il contenuto
   - Incollalo nell'editor SQL di Supabase

4. **Esegui lo Script**
   - Clicca sul pulsante **"Run"** (o premi Ctrl+Enter)
   - Attendi qualche secondo
   - Dovresti vedere il messaggio: **"Success. No rows returned"**

5. **Verifica le Tabelle**
   - Nel menu laterale, clicca su **"Table Editor"**
   - Dovresti vedere 4 tabelle:
     - ✅ `products`
     - ✅ `suppliers`
     - ✅ `orders`
     - ✅ `settings`

---

### **Metodo 2: Table Editor (Manuale)**

Se preferisci creare le tabelle manualmente:

#### **Tabella: products**
```
- id (uuid, primary key, default: uuid_generate_v4())
- user_id (uuid, foreign key → auth.users)
- name (text, not null)
- price (numeric(10,2), not null)
- original_price (numeric(10,2))
- discount (numeric(5,2))
- unit (text, not null)
- supplier_id (uuid)
- category (text)
- notes (text)
- last_price_change (timestamptz)
- created_at (timestamptz, default: now())
- updated_at (timestamptz, default: now())
```

#### **Tabella: suppliers**
```
- id (uuid, primary key, default: uuid_generate_v4())
- user_id (uuid, foreign key → auth.users)
- name (text, not null)
- contact (text)
- email (text)
- phone (text)
- address (text)
- notes (text)
- created_at (timestamptz, default: now())
- updated_at (timestamptz, default: now())
```

#### **Tabella: orders**
```
- id (uuid, primary key, default: uuid_generate_v4())
- user_id (uuid, foreign key → auth.users)
- supplier_id (uuid, foreign key → suppliers)
- items (jsonb, not null)
- total (numeric(10,2), not null)
- status (text, not null)
- notes (text)
- created_at (timestamptz, default: now())
- updated_at (timestamptz, default: now())
```

#### **Tabella: settings**
```
- id (uuid, primary key, default: uuid_generate_v4())
- user_id (uuid, foreign key → auth.users, unique)
- country (text, not null, default: 'IT')
- language (text, not null, default: 'it')
- created_at (timestamptz, default: now())
- updated_at (timestamptz, default: now())
```

**⚠️ IMPORTANTE:** Dopo aver creato le tabelle manualmente, devi abilitare Row Level Security (RLS) per ogni tabella!

---

## 🔐 Row Level Security (RLS)

Le policy RLS sono **già incluse** nello script SQL automatico. Garantiscono che:
- ✅ Ogni utente vede solo i propri dati
- ✅ Nessun utente può accedere ai dati di altri utenti
- ✅ I dati sono completamente isolati e sicuri

---

## ✅ Verifica Finale

Dopo aver eseguito lo script SQL:

1. **Vai su Table Editor**
2. **Clicca su "products"**
3. **Dovresti vedere:**
   - Colonne: id, user_id, name, price, etc.
   - RLS abilitato (icona lucchetto verde)
   - Nessun dato (tabella vuota)

4. **Ripeti per le altre 3 tabelle**

---

## 🎉 Fatto!

Ora puoi:
1. **Tornare sull'app MGX**
2. **Fare login** con la tua email
3. **Iniziare a usare l'app** con i dati salvati nel cloud!

---

## 📞 Problemi?

Se vedi errori durante l'esecuzione dello script SQL:

1. **Errore "permission denied"**
   - Assicurati di essere loggato come proprietario del progetto

2. **Errore "relation already exists"**
   - Le tabelle esistono già, puoi ignorare l'errore

3. **Errore "syntax error"**
   - Assicurati di aver copiato **TUTTO** lo script SQL
   - Controlla che non ci siano caratteri extra all'inizio/fine

---

## 🔄 Reset Database (Se Necessario)

Se vuoi ricominciare da zero:

```sql
-- ATTENZIONE: Questo elimina TUTTI i dati!
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS suppliers CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS settings CASCADE;
```

Poi riesegui lo script `supabase-setup.sql` completo.