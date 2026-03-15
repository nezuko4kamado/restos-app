# 🚀 Guida al Deploy su Vercel

## Metodo 1: Deploy Automatico (Raccomandato)

### Opzione A: Deploy da MGX Platform
1. Clicca sul pulsante **"Publish"** in alto a destra nell'App Viewer
2. Seleziona "Deploy to Vercel"
3. Autorizza Vercel con il tuo account GitHub/GitLab/Bitbucket
4. Vercel farà il deploy automaticamente
5. Riceverai un link tipo: `https://tua-app.vercel.app`

### Opzione B: Deploy Manuale con Vercel CLI
```bash
# 1. Installa Vercel CLI (se non l'hai già)
npm i -g vercel

# 2. Vai nella cartella del progetto
cd /workspace/shadcn-ui

# 3. Login a Vercel
vercel login

# 4. Deploy!
vercel --prod
```

---

## Metodo 2: Deploy da GitHub

### Passo 1: Crea un Repository GitHub
1. Vai su https://github.com/new
2. Crea un nuovo repository (es: "restaurant-manager")
3. NON inizializzare con README

### Passo 2: Push del Codice
```bash
cd /workspace/shadcn-ui
git init
git add .
git commit -m "Initial commit - Restaurant Manager App"
git branch -M main
git remote add origin https://github.com/TUO_USERNAME/restaurant-manager.git
git push -u origin main
```

### Passo 3: Connetti a Vercel
1. Vai su https://vercel.com/new
2. Clicca "Import Git Repository"
3. Seleziona il tuo repository "restaurant-manager"
4. Vercel rileverà automaticamente che è un progetto Vite
5. Clicca "Deploy"

---

## 📱 Installare l'App su iPhone

### Dopo il Deploy:
1. Apri il link Vercel sul tuo iPhone (es: `https://restaurant-manager.vercel.app`)
2. In Safari, tocca il pulsante **Condividi** (quadrato con freccia)
3. Scorri e seleziona **"Aggiungi a Home"**
4. Dai un nome all'app (es: "Restaurant Manager")
5. Tocca **"Aggiungi"**

✅ **Ora hai l'app sulla home screen come un'app nativa!**

---

## 🔧 Configurazione Post-Deploy

### Importante: API Key
La tua API key di Google AI è salvata nel browser locale (localStorage).

**Dopo il deploy:**
1. Apri l'app dal link Vercel
2. Clicca sull'icona ⚙️ (Impostazioni) in alto a destra
3. Incolla nuovamente la tua API key: `AIzaSyCovh7Ic2BECIKfc0sEQ-MeqJEhJZIKqzo`
4. Clicca "Salva Configurazione"

**Nota:** Dovrai fare questo solo una volta per dispositivo. La key sarà salvata nel browser.

---

## 🎯 Vantaggi del Deploy su Vercel

✅ **HTTPS automatico** - Sicurezza garantita
✅ **CDN globale** - Velocità massima ovunque
✅ **Deploy automatici** - Ogni modifica è live in 30 secondi
✅ **Zero configurazione** - Tutto funziona out-of-the-box
✅ **Gratis** - Piano free più che sufficiente
✅ **Custom domain** - Puoi aggiungere il tuo dominio (es: app.tuoristorante.it)

---

## 🆘 Troubleshooting

### L'app non si carica
- Controlla che il build sia completato con successo
- Verifica i logs su Vercel Dashboard

### OCR non funziona
- Assicurati di aver inserito l'API key nelle Impostazioni
- Controlla la console del browser per errori

### Dati non salvati
- I dati sono salvati nel localStorage del browser
- Ogni dispositivo ha i suoi dati separati
- Per sincronizzare tra dispositivi, considera di aggiungere Supabase

---

## 📞 Link Utili

- **Vercel Dashboard:** https://vercel.com/dashboard
- **Vercel Docs:** https://vercel.com/docs
- **Support:** https://vercel.com/support

---

## 🎉 Prossimi Passi

Dopo il deploy, puoi:
1. **Testare l'app** dal link Vercel
2. **Installarla su iPhone** come PWA
3. **Condividere il link** con il tuo team
4. **Aggiungere un dominio custom** (opzionale)
5. **Configurare Supabase** per sincronizzare dati tra dispositivi (opzionale)

Buon lavoro! 🚀