# Guida Amministratore - Gestione Abbonamenti

Questa guida spiega come gestire gli abbonamenti degli utenti tramite Supabase.

## 📋 Indice

1. [Panoramica Sistema Abbonamenti](#panoramica-sistema-abbonamenti)
2. [Tipi di Abbonamento](#tipi-di-abbonamento)
3. [Accesso a Supabase](#accesso-a-supabase)
4. [Operazioni Comuni](#operazioni-comuni)
5. [Query SQL Utili](#query-sql-utili)
6. [Email Notifiche](#email-notifiche)

---

## 📊 Panoramica Sistema Abbonamenti

Il sistema di abbonamenti gestisce l'accesso alle impostazioni dell'applicazione. Gli utenti hanno:

- **7 giorni di prova gratuita** alla registrazione
- **€9.90/mese** dopo la prova
- **Accesso gratuito a vita** per utenti selezionati (gestito manualmente)

### Tabella Database

La tabella `user_subscriptions` contiene:

```sql
- id: UUID (chiave primaria)
- user_id: UUID (riferimento a auth.users)
- subscription_type: 'free_lifetime' | 'trial' | 'paid'
- status: 'active' | 'expired' | 'suspended'
- trial_end_date: TIMESTAMP (per trial)
- subscription_end_date: TIMESTAMP (per paid)
- created_at: TIMESTAMP
- updated_at: TIMESTAMP
```

---

## 🎯 Tipi di Abbonamento

### 1. Free Lifetime (Gratis a Vita)
- **Accesso:** Illimitato e permanente
- **Costo:** Gratuito
- **Gestione:** Solo manuale da admin
- **Scadenza:** Mai

### 2. Trial (Prova Gratuita)
- **Durata:** 7 giorni
- **Costo:** Gratuito
- **Creazione:** Automatica alla registrazione
- **Scadenza:** Automatica dopo 7 giorni

### 3. Paid (Abbonamento Pagato)
- **Durata:** 1 mese
- **Costo:** €9.90/mese
- **Rinnovo:** Manuale (per ora)
- **Scadenza:** Automatica dopo 30 giorni

---

## 🔐 Accesso a Supabase

1. Vai su [https://supabase.com](https://supabase.com)
2. Accedi con le tue credenziali
3. Seleziona il progetto dell'applicazione
4. Vai su **SQL Editor** nel menu laterale

---

## ⚙️ Operazioni Comuni

### 1️⃣ Concedere Accesso Gratuito a Vita

**Scenario:** Vuoi dare accesso gratuito permanente a un utente specifico.

```sql
-- Sostituisci 'utente@example.com' con l'email dell'utente
INSERT INTO user_subscriptions (user_id, subscription_type, status, trial_end_date, subscription_end_date)
SELECT id, 'free_lifetime', 'active', NULL, NULL
FROM auth.users
WHERE email = 'utente@example.com'
ON CONFLICT (user_id) DO UPDATE
SET 
  subscription_type = 'free_lifetime',
  status = 'active',
  trial_end_date = NULL,
  subscription_end_date = NULL,
  updated_at = NOW();
```

**Risultato:** L'utente avrà accesso illimitato senza scadenza.

---

### 2️⃣ Verificare lo Stato di un Utente

**Scenario:** Vuoi controllare l'abbonamento di un utente specifico.

```sql
SELECT 
  u.email,
  s.subscription_type,
  s.status,
  s.trial_end_date,
  s.subscription_end_date,
  s.created_at,
  s.updated_at
FROM user_subscriptions s
JOIN auth.users u ON s.user_id = u.id
WHERE u.email = 'utente@example.com';
```

**Risultato:** Vedrai tutti i dettagli dell'abbonamento dell'utente.

---

### 3️⃣ Elencare Tutti gli Utenti Free Lifetime

**Scenario:** Vuoi vedere tutti gli utenti con accesso gratuito a vita.

```sql
SELECT 
  u.email,
  s.subscription_type,
  s.status,
  s.created_at
FROM user_subscriptions s
JOIN auth.users u ON s.user_id = u.id
WHERE s.subscription_type = 'free_lifetime'
ORDER BY s.created_at DESC;
```

---

### 4️⃣ Estendere un Abbonamento Pagato

**Scenario:** Un utente ha pagato e vuoi estendere il suo abbonamento di 1 mese.

```sql
UPDATE user_subscriptions
SET 
  subscription_end_date = COALESCE(subscription_end_date, NOW()) + INTERVAL '1 month',
  status = 'active',
  updated_at = NOW()
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'utente@example.com'
)
AND subscription_type = 'paid';
```

---

### 5️⃣ Sospendere un Utente

**Scenario:** Vuoi bloccare temporaneamente l'accesso di un utente.

```sql
UPDATE user_subscriptions
SET 
  status = 'suspended',
  updated_at = NOW()
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'utente@example.com'
);
```

**Per riattivare:**

```sql
UPDATE user_subscriptions
SET 
  status = 'active',
  updated_at = NOW()
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'utente@example.com'
);
```

---

### 6️⃣ Convertire Trial in Paid

**Scenario:** Un utente in prova ha pagato e vuoi attivare l'abbonamento.

```sql
UPDATE user_subscriptions
SET 
  subscription_type = 'paid',
  status = 'active',
  subscription_end_date = NOW() + INTERVAL '1 month',
  updated_at = NOW()
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'utente@example.com'
)
AND subscription_type = 'trial';
```

---

## 📊 Query SQL Utili

### Visualizzare Tutti gli Abbonamenti con Scadenze

```sql
SELECT 
  u.email,
  s.subscription_type,
  s.status,
  CASE 
    WHEN s.subscription_type = 'trial' THEN s.trial_end_date
    WHEN s.subscription_type = 'paid' THEN s.subscription_end_date
    ELSE NULL
  END as expires_at,
  CASE 
    WHEN s.subscription_type = 'free_lifetime' THEN 'Mai'
    WHEN s.subscription_type = 'trial' AND s.trial_end_date > NOW() THEN 
      CONCAT(EXTRACT(DAY FROM (s.trial_end_date - NOW())), ' giorni rimanenti')
    WHEN s.subscription_type = 'paid' AND s.subscription_end_date > NOW() THEN 
      CONCAT(EXTRACT(DAY FROM (s.subscription_end_date - NOW())), ' giorni rimanenti')
    ELSE 'Scaduto'
  END as tempo_rimanente
FROM user_subscriptions s
JOIN auth.users u ON s.user_id = u.id
ORDER BY 
  CASE s.subscription_type
    WHEN 'free_lifetime' THEN 1
    WHEN 'paid' THEN 2
    WHEN 'trial' THEN 3
  END,
  s.created_at DESC;
```

### Statistiche Abbonamenti

```sql
SELECT 
  subscription_type,
  status,
  COUNT(*) as numero_utenti
FROM user_subscriptions
GROUP BY subscription_type, status
ORDER BY subscription_type, status;
```

### Abbonamenti in Scadenza nei Prossimi 7 Giorni

```sql
SELECT 
  u.email,
  s.subscription_type,
  CASE 
    WHEN s.subscription_type = 'trial' THEN s.trial_end_date
    WHEN s.subscription_type = 'paid' THEN s.subscription_end_date
  END as scade_il,
  EXTRACT(DAY FROM (
    CASE 
      WHEN s.subscription_type = 'trial' THEN s.trial_end_date
      WHEN s.subscription_type = 'paid' THEN s.subscription_end_date
    END - NOW()
  )) as giorni_rimanenti
FROM user_subscriptions s
JOIN auth.users u ON s.user_id = u.id
WHERE 
  (s.subscription_type = 'trial' AND s.trial_end_date BETWEEN NOW() AND NOW() + INTERVAL '7 days')
  OR
  (s.subscription_type = 'paid' AND s.subscription_end_date BETWEEN NOW() AND NOW() + INTERVAL '7 days')
ORDER BY 
  CASE 
    WHEN s.subscription_type = 'trial' THEN s.trial_end_date
    WHEN s.subscription_type = 'paid' THEN s.subscription_end_date
  END ASC;
```

### Abbonamenti Scaduti

```sql
SELECT 
  u.email,
  s.subscription_type,
  s.status,
  CASE 
    WHEN s.subscription_type = 'trial' THEN s.trial_end_date
    WHEN s.subscription_type = 'paid' THEN s.subscription_end_date
  END as scaduto_il
FROM user_subscriptions s
JOIN auth.users u ON s.user_id = u.id
WHERE 
  (s.subscription_type = 'trial' AND s.trial_end_date < NOW())
  OR
  (s.subscription_type = 'paid' AND s.subscription_end_date < NOW())
ORDER BY 
  CASE 
    WHEN s.subscription_type = 'trial' THEN s.trial_end_date
    WHEN s.subscription_type = 'paid' THEN s.subscription_end_date
  END DESC;
```

---

## 📧 Email Notifiche

Le email vengono inviate automaticamente all'indirizzo **info@amalfi-alzira.es** per:

1. **Nuovo utente registrato** (trial iniziato)
2. **Abbonamento attivato** (da trial a paid)
3. **Abbonamento scaduto**

### Formato Email

```
Oggetto: [Tipo Evento]
Corpo:
  Utente: email@utente.com
  User ID: uuid-dell-utente
  Tipo: trial_started | subscription_activated | subscription_expired
  Data: 17/01/2025, 10:30:00
```

---

## 🔒 Sicurezza

- **Row Level Security (RLS)** è abilitato sulla tabella `user_subscriptions`
- Gli utenti possono vedere solo il proprio abbonamento
- Solo gli admin possono modificare gli abbonamenti di altri utenti
- Le query devono essere eseguite tramite SQL Editor di Supabase con privilegi admin

---

## 🆘 Supporto

Per problemi o domande:
- Email: info@amalfi-alzira.es
- Documentazione Supabase: https://supabase.com/docs

---

## 📝 Note Importanti

1. **Backup:** Fai sempre un backup prima di modifiche massive
2. **Test:** Testa le query su un utente di test prima di applicarle in produzione
3. **Log:** Tutte le modifiche vengono registrate nel campo `updated_at`
4. **Email:** Controlla regolarmente info@amalfi-alzira.es per notifiche