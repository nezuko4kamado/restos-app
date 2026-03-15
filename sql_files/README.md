# 📁 Script SQL per Gestione Database

Questa cartella contiene script SQL per la gestione e manutenzione del database dell'applicazione di gestione fatture.

## 📋 File Disponibili

### 1. **cleanup_duplicate_products.sql**
Script per eliminare prodotti duplicati dal database.

**Quando usarlo:**
- Dopo aver caricato fatture che hanno creato prodotti duplicati
- Quando si notano prodotti con lo stesso nome ma dati diversi (IVA, prezzi, sconti)

**Come usarlo:**
```sql
-- Esegui questo script nella Supabase SQL Editor
-- Lo script elimina automaticamente i duplicati mantenendo la versione migliore
```

**Cosa fa:**
- Identifica prodotti con lo stesso nome (normalizzato)
- Per ogni gruppo di duplicati, mantiene UNA versione con:
  - IVA più bassa non-zero
  - Informazioni di sconto se presenti
  - Prezzo più accurato
- Elimina tutte le altre versioni

---

### 2. **verify_database_status.sql**
Script per verificare lo stato attuale del database.

**Quando usarlo:**
- Prima di eseguire cleanup_duplicate_products.sql (per vedere quanti duplicati ci sono)
- Dopo il cleanup (per verificare che i duplicati siano stati rimossi)
- Per monitoraggio periodico del database

**Come usarlo:**
```sql
-- Esegui questo script nella Supabase SQL Editor
-- Mostra statistiche dettagliate sul database
```

**Cosa mostra:**
- Numero totale di prodotti
- Numero di prodotti duplicati (stesso nome)
- Distribuzione prodotti per aliquota IVA (4%, 10%, 21%, etc.)
- Distribuzione prodotti per fornitore
- Prodotti con sconti applicati
- Prodotti senza IVA o con dati mancanti

---

### 3. **check_schema.sql**
Script per verificare la struttura della tabella products.

**Quando usarlo:**
- Per verificare che la tabella abbia tutte le colonne necessarie
- Per controllare gli indici e i vincoli
- Per debugging di problemi di schema

**Come usarlo:**
```sql
-- Esegui questo script nella Supabase SQL Editor
```

**Cosa mostra:**
- Elenco di tutte le colonne con tipo dati
- Indici presenti sulla tabella
- Vincoli (primary key, foreign key, etc.)
- Statistiche sulla tabella (numero righe, dimensione)

---

### 4. **database_duplicates_report.md**
Report dettagliato sui prodotti duplicati trovati nel database.

**Quando usarlo:**
- Per analizzare quali prodotti sono duplicati
- Per capire perché ci sono duplicati (diverse IVA, sconti, fornitori)
- Prima di eseguire il cleanup per sapere cosa verrà eliminato

**Contenuto:**
- Lista di tutti i gruppi di prodotti duplicati
- Per ogni gruppo: numero di versioni, dettagli di ogni versione
- Raccomandazioni su quale versione mantenere

---

## 🚀 Workflow Consigliato

### Scenario 1: Pulizia Duplicati
```bash
1. Esegui verify_database_status.sql
   → Controlla quanti duplicati ci sono

2. Leggi database_duplicates_report.md
   → Analizza quali prodotti sono duplicati

3. Esegui cleanup_duplicate_products.sql
   → Elimina i duplicati

4. Esegui verify_database_status.sql
   → Verifica che i duplicati siano stati rimossi
```

### Scenario 2: Verifica Schema
```bash
1. Esegui check_schema.sql
   → Verifica la struttura della tabella

2. Controlla che tutte le colonne necessarie siano presenti:
   - name, unit_price, discounted_price
   - discount_percent, discount_amount
   - vat_rate, currency
   - user_id, supplier_id
```

### Scenario 3: Monitoraggio Periodico
```bash
1. Esegui verify_database_status.sql settimanalmente
   → Monitora la crescita del database
   → Identifica duplicati prima che diventino un problema

2. Se trovi duplicati, esegui cleanup_duplicate_products.sql
```

---

## 🔧 Come Eseguire gli Script

### Metodo 1: Supabase Dashboard (Consigliato)
1. Vai su https://supabase.com/dashboard/project/tmxmkvinsvuzbzrjrucw/editor
2. Clicca su "SQL Editor"
3. Clicca su "New Query"
4. Copia e incolla il contenuto dello script SQL
5. Clicca su "Run" (o premi Ctrl+Enter)

### Metodo 2: Supabase CLI
```bash
# Installa Supabase CLI se non l'hai già fatto
npm install -g supabase

# Esegui uno script
supabase db execute --file sql_files/verify_database_status.sql
```

### Metodo 3: psql (PostgreSQL CLI)
```bash
# Connettiti al database
psql "postgresql://postgres:[PASSWORD]@db.tmxmkvinsvuzbzrjrucw.supabase.co:5432/postgres"

# Esegui uno script
\i sql_files/verify_database_status.sql
```

---

## ⚠️ Avvertenze

### cleanup_duplicate_products.sql
- ⚠️ **ATTENZIONE**: Questo script ELIMINA dati dal database
- ✅ Esegui sempre `verify_database_status.sql` PRIMA per vedere cosa verrà eliminato
- ✅ Fai un backup del database prima di eseguire il cleanup
- ✅ Testa su un database di sviluppo prima di eseguire in produzione

### verify_database_status.sql
- ✅ Sicuro da eseguire, è solo una query SELECT
- ✅ Non modifica alcun dato

### check_schema.sql
- ✅ Sicuro da eseguire, è solo una query SELECT
- ✅ Non modifica alcun dato

---

## 📊 Interpretazione Risultati

### verify_database_status.sql

**Esempio output:**
```
Totale Prodotti: 36
Prodotti Duplicati: 0
Prodotti con IVA 4%: 5
Prodotti con IVA 10%: 20
Prodotti con IVA 21%: 11
Prodotti con Sconto: 8
```

**Cosa significa:**
- ✅ **Prodotti Duplicati: 0** → Database pulito, nessun duplicato
- ⚠️ **Prodotti Duplicati: 24** → Ci sono 24 prodotti che hanno duplicati, esegui cleanup
- ✅ **Prodotti con IVA 10%: 20** → La maggior parte dei prodotti ha IVA 10% (corretto per prodotti alimentari)
- ⚠️ **Prodotti con IVA 21%: 11** → Alcuni prodotti hanno IVA 21% (verifica se è corretto)

---

## 🆘 Supporto

Se hai problemi con gli script SQL:

1. **Errore di permessi**: Assicurati di usare il service role key, non l'anon key
2. **Timeout**: Se il database è molto grande, gli script potrebbero richiedere tempo
3. **Errori di sintassi**: Verifica di aver copiato l'intero script senza modifiche

Per ulteriore assistenza, controlla i log della Edge Function Klippa OCR per vedere i dettagli dell'estrazione prodotti.

---

## 📝 Note Tecniche

### Logica di De-duplicazione
Gli script usano la stessa logica della Edge Function `klippa_ocr_v2`:

1. **Raggruppamento**: Prodotti con lo stesso nome (case-insensitive, trimmed)
2. **Selezione migliore versione**:
   - IVA: Più bassa non-zero (es: 10% invece di 21%)
   - Sconto: Massimo se presente
   - Prezzo: Più basso o scontato se disponibile
   - Quantità: Più alta
   - SKU: Primo disponibile

### Colonne Importanti
- `name`: Nome prodotto (usato per identificare duplicati)
- `vat_rate`: Aliquota IVA (4%, 10%, 21%)
- `discount_percent`: Percentuale sconto
- `unit_price`: Prezzo unitario originale
- `discounted_price`: Prezzo dopo sconto
- `supplier_id`: ID fornitore (per raggruppare prodotti per fornitore)

---

**Ultimo aggiornamento**: 25 Dicembre 2024
**Versione**: 1.0.0