# SQL Cleanup Scripts

Questa cartella contiene script SQL per la manutenzione e pulizia del database.

## cleanup_duplicate_products.sql

Script per identificare ed eliminare prodotti duplicati dalla tabella `products`.

### Come usare:

1. **Verifica duplicati esistenti** (SEZIONE 1):
   ```sql
   -- Esegui le query della SEZIONE 1 per vedere:
   -- - Quali prodotti sono duplicati
   -- - Quanti duplicati esistono
   -- - Gli ID e le date di creazione di ogni duplicato
   ```

2. **Elimina duplicati** (SEZIONE 2):
   ```sql
   -- ⚠️ ATTENZIONE: Questa operazione è IRREVERSIBILE!
   -- Esegui la query DELETE solo dopo aver verificato i risultati della SEZIONE 1
   ```

3. **Verifica finale** (SEZIONE 3):
   ```sql
   -- Esegui le query della SEZIONE 3 per confermare:
   -- - Che non ci sono più duplicati
   -- - Il numero totale di prodotti rimanenti
   ```

### Logica dello script:

- **Identificazione duplicati**: Prodotti con lo stesso nome (case-insensitive, dopo trim)
- **Criterio di mantenimento**: Mantiene solo la versione più recente (campo `created_at`)
- **Sicurezza**: Non elimina prodotti unici, solo i duplicati

### Esempio di esecuzione:

```bash
# Opzione 1: Tramite Supabase SQL Editor
# 1. Vai su https://supabase.com/dashboard
# 2. Seleziona il tuo progetto
# 3. Vai su SQL Editor
# 4. Copia e incolla le query dalla SEZIONE 1
# 5. Esegui e verifica i risultati
# 6. Se tutto è corretto, esegui la SEZIONE 2
# 7. Verifica con la SEZIONE 3

# Opzione 2: Tramite psql (se hai accesso diretto al database)
psql -h <host> -U <user> -d <database> -f cleanup_duplicate_products.sql
```

### Note importanti:

- ⚠️ **Backup**: Crea sempre un backup prima di eseguire operazioni di eliminazione
- 🔒 **Irreversibile**: Una volta eliminati, i duplicati non possono essere recuperati
- ✅ **Test**: Esegui prima in un ambiente di test se possibile
- 📊 **Verifica**: Controlla sempre i risultati della SEZIONE 1 prima di procedere

### Supporto:

Per problemi o domande, contatta il team di sviluppo.