# 🔍 Guida Diagnostica - Prodotti che Spariscono

## Problema
I prodotti aggiunti dalle fatture spariscono quando ricarichi la pagina, ma i fornitori rimangono.

## Causa Probabile
I prodotti vengono salvati in Supabase MA senza il campo `user_id`, quindi le RLS (Row Level Security) policies bloccano la lettura.

---

## ✅ PASSO 1: Verifica Console Browser

1. **Apri la Console** (F12 → scheda Console)
2. **Ricarica la pagina** (Ctrl+R)
3. **Cerca questi messaggi**:

```
🔍 Storage mode: supabase
👤 Current user ID: [il-tuo-id]  ← DEVE ESSERE UN ID, NON "NOT LOGGED IN"
📦 Getting products using mode: supabase
📥 Fetched X products from Supabase  ← QUANTI PRODOTTI VEDI?
```

**Se vedi:**
- `👤 Current user ID: NOT LOGGED IN` → **Fai logout e login di nuovo**
- `📥 Fetched 0 products` → **Vai al PASSO 2**

---

## ✅ PASSO 2: Verifica Supabase Dashboard

1. **Vai su** https://supabase.com/dashboard
2. **Seleziona il tuo progetto** `tmxmkvinsvuzbzrjrucw`
3. **Clicca** Table Editor → `products`
4. **Controlla la colonna `user_id`**:

### Scenario A: user_id è NULL (vuoto)
```
id                  | name          | user_id | supplier_id
--------------------|---------------|---------|-------------
abc-123-def         | Grana Padano  | NULL    | xyz-789
```

**PROBLEMA TROVATO!** I prodotti non hanno `user_id`.

**SOLUZIONE**: Vai al PASSO 3 per eseguire lo script SQL di fix.

---

### Scenario B: user_id è popolato
```
id                  | name          | user_id                              | supplier_id
--------------------|---------------|--------------------------------------|-------------
abc-123-def         | Grana Padano  | a1b2c3d4-e5f6-7890-abcd-ef1234567890 | xyz-789
```

**PROBLEMA**: Le RLS policies potrebbero essere sbagliate.

**SOLUZIONE**: Vai al PASSO 4 per verificare le policies.

---

## ✅ PASSO 3: Fix user_id NULL

### 3.1 Trova il tuo user_id

1. **Vai su** Authentication → Users
2. **Copia il tuo UUID** (es: `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

### 3.2 Esegui lo Script SQL

1. **Vai su** SQL Editor
2. **Copia e incolla** il contenuto di `SUPABASE_FIX.sql`
3. **SOSTITUISCI** `'IL-TUO-USER-ID-QUI'` con il tuo UUID
4. **Clicca** RUN

Lo script:
- ✅ Popola `user_id` nei prodotti esistenti
- ✅ Verifica le RLS policies
- ✅ Crea le policies se mancano

### 3.3 Verifica

1. **Torna su** Table Editor → `products`
2. **Controlla** che `user_id` sia popolato
3. **Ricarica l'app** e verifica che i prodotti rimangano

---

## ✅ PASSO 4: Verifica RLS Policies

1. **Vai su** Authentication → Policies → `products`
2. **Controlla che esistano queste policies**:

### Policy: "Users can view their own products"
```sql
SELECT
USING (auth.uid() = user_id)
```

### Policy: "Users can insert their own products"
```sql
INSERT
WITH CHECK (auth.uid() = user_id)
```

### Policy: "Users can update their own products"
```sql
UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id)
```

### Policy: "Users can delete their own products"
```sql
DELETE
USING (auth.uid() = user_id)
```

**Se mancano**: Esegui lo script `SUPABASE_FIX.sql` che le crea automaticamente.

---

## ✅ PASSO 5: Test Finale

1. **Vai su un fornitore**
2. **Clicca** "Gestione Fatture"
3. **Carica una foto** di fattura
4. **Clicca** "Aggiungi Tutti" sui nuovi prodotti
5. **Guarda la console** - dovresti vedere:
   ```
   ➕ Adding product: [nome] using mode: supabase
   💾 Attempting to save product: [nome]
   👤 User ID: [il-tuo-id]
   📤 Sending to Supabase: { user_id: [il-tuo-id], ... }
   ✅ Product saved successfully to Supabase
   ```
6. **Ricarica la pagina** (Ctrl+R)
7. **I prodotti devono rimanere!** 🎉

---

## 🆘 Se il Problema Persiste

### Usa il Pannello Diagnostico

1. **Clicca** il bottone "🔍 Diagnostica" nell'header dell'app
2. **Leggi i risultati** del test automatico
3. **Segui le istruzioni** mostrate nel pannello

### Controlla i Log Dettagliati

Nella console, cerca messaggi con questi simboli:
- ❌ = Errore
- ⚠️ = Warning
- ✅ = Successo
- 💾 = Salvataggio
- 📥 = Caricamento

---

## 📋 Checklist Rapida

- [ ] Sei loggato? (vedi email nell'header)
- [ ] Console mostra `user_id` valido?
- [ ] Tabella `products` ha `user_id` popolato?
- [ ] RLS policies esistono?
- [ ] Script SQL eseguito con successo?
- [ ] Test di aggiunta prodotto completato?
- [ ] Prodotti rimangono dopo reload?

---

## 🎯 Soluzione Rapida (TL;DR)

1. Apri Supabase Dashboard
2. Vai su SQL Editor
3. Esegui `SUPABASE_FIX.sql` (sostituisci il tuo user_id)
4. Ricarica l'app
5. Fatto! ✅

---

## 📞 Supporto

Se dopo aver seguito tutti i passi il problema persiste:
1. Esporta i log della console (tasto destro → Save as...)
2. Fai screenshot del pannello diagnostico
3. Controlla se ci sono errori rossi nella console