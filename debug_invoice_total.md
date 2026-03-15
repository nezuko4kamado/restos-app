# Debug: Problema Totale Fattura

## Problema Riportato
- Fattura numero: 3050339
- Data: 30/10/2025
- **Totale mostrato: 270.26€** (SBAGLIATO secondo l'utente)

## Flusso di Calcolo del Totale

### 1. Estrazione OCR (ocrService.ts)
- `extractInvoiceData()` estrae i dati dalla fattura
- Linee 294-347: Logica di calcolo del totale
- **FALLBACK ATTIVO**: Se OCR estrae un totale sbagliato, calcola dalla somma dei prodotti

```typescript
// Linea 307-319: Calcolo fallback dai prodotti
if (data.items && Array.isArray(data.items) && data.items.length > 0) {
  calculatedTotal = data.items.reduce((sum, item) => {
    return sum + (item.price * item.quantity);
  }, 0);
}

// Linea 322-342: Decisione se usare OCR o calcolo
if (percentDifference > 5) {
  // Usa il totale calcolato dai prodotti
  result.amount = calculatedTotal;
} else {
  // Usa il totale estratto da OCR
  result.amount = extractedAmount;
}
```

### 2. InvoiceManagement.tsx
- Linee 143-194: useEffect che calcola automaticamente il totale
- Viene chiamato ogni volta che `extractedItems` cambia

```typescript
useEffect(() => {
  if (extractedItems.length > 0) {
    let calculatedTotal = 0;
    extractedItems.forEach((item) => {
      const itemPrice = Number(item.price) || 0;
      const itemQuantity = Number(item.quantity) || 0;
      calculatedTotal += itemPrice * itemQuantity;
    });
    setNewInvoice(prev => ({ ...prev, amount: calculatedTotal.toFixed(2) }));
  }
}, [extractedItems]);
```

## Possibili Cause del Problema

### A. OCR estrae totale sbagliato
- L'OCR potrebbe confondere il prezzo più alto di un prodotto con il totale
- Esempio: Se un prodotto costa 270.26€, OCR potrebbe pensare che sia il totale

### B. Prodotti mancanti o duplicati
- Non tutti i prodotti sono stati estratti
- Alcuni prodotti sono stati estratti due volte

### C. Prezzi o quantità errati
- I prezzi unitari sono sbagliati
- Le quantità sono sbagliate

### D. Calcolo fallback non attivato
- La differenza tra OCR e calcolo è < 5%
- Il sistema usa il valore OCR sbagliato invece del calcolo corretto

## Prossimi Passi

1. Controllare i log della console per vedere:
   - Quali prodotti sono stati estratti
   - Il totale calcolato vs il totale OCR
   - Se il fallback è stato attivato

2. Verificare nella fattura originale:
   - Quanti prodotti ci sono
   - Qual è il totale corretto
   - Se 270.26€ è il prezzo di un singolo prodotto

3. Aggiungere logging extra per debug
