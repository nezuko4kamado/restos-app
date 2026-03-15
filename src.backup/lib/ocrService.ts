import { OCRResult, Product, InvoiceItem } from '@/types';
import { supabase } from './supabase';

interface OrderItemExtracted {
  name: string;
  quantity: number;
  price?: number;
  vatRate?: number;
  discountPercent?: number;
  unit?: string;
}

export interface InvoiceDataExtracted {
  invoiceNumber?: string;
  date?: string;
  amount?: number;
  totalAmount?: number;
  originalAmount?: number;
  discountPercent?: number;
  discountAmount?: number;
  supplier?: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    vat_number?: string;
  };
  items?: Array<{
    name: string;
    quantity: number;
    price: number;
    originalPrice?: number;
    discountPercent?: number;
    vatRate?: number;
  }>;
}

export interface InvoiceItemsExtracted {
  items: Array<{
    name: string;
    quantity: number;
    price: number;
    originalPrice?: number;
    discountPercent?: number;
    vatRate?: number;
  }>;
  totalAmount?: number;
}

interface InvoiceItemRaw {
  name: string;
  quantity: number;
  price?: number;
  originalPrice?: number;
  discountPercent?: number;
  vatRate?: number;
}

// Helper function to extract unit from text
function extractUnitFromText(text: string): string | null {
  if (!text) return null;
  
  // Pattern for "1x3", "2x5", etc.
  const xPattern = /(\d+)\s*x\s*(\d+)/i;
  
  // Pattern for written units (case-insensitive, plurals included)
  const unitPatterns = [
    /\b(cassa|casse)\b/i,      // Italian
    /\b(caja|cajas)\b/i,        // Spanish
    /\b(box|boxes)\b/i,         // English
    /\b(boîte|boîtes)\b/i,      // French
    /\b(kiste|kisten)\b/i,      // German
    /\b(pezzi|pezzo)\b/i,       // Italian pieces
    /\b(piezas|pieza)\b/i,      // Spanish pieces
    /\b(pieces|piece)\b/i,      // English pieces
    /\b(pièces|pièce)\b/i,      // French pieces
    /\b(stück)\b/i,             // German pieces
    /\b(kg|kilo|kilogrammi|kilogramo|kilogramos)\b/i,
    /\b(litri|litro|liters|liter|litres|litre|litros)\b/i,
    /\b(gr|grammi|gramo|gramos|gramme|grammes|gram|grams)\b/i,
    /\b(ml|millilitri|milliliter|milliliters|millilitre|millilitres)\b/i
  ];
  
  // Check for "x" pattern first (e.g., "1x3" -> "x3")
  const xMatch = text.match(xPattern);
  if (xMatch) {
    return `x${xMatch[2]}`;
  }
  
  // Check for written units
  for (const pattern of unitPatterns) {
    const match = text.match(pattern);
    if (match) {
      const unit = match[1].toLowerCase();
      // Normalize common units
      if (unit.includes('cassa') || unit.includes('casse')) return 'cassa';
      if (unit.includes('caja') || unit.includes('cajas')) return 'caja';
      if (unit.includes('box') || unit.includes('boxes')) return 'box';
      if (unit.includes('boîte') || unit.includes('boîtes')) return 'boîte';
      if (unit.includes('kiste') || unit.includes('kisten')) return 'kiste';
      if (unit.includes('kg') || unit.includes('kilo')) return 'kg';
      if (unit.includes('litr')) return 'l';
      if (unit.includes('gram')) return 'g';
      if (unit.includes('ml')) return 'ml';
      return unit;
    }
  }
  
  return null;
}

// Helper function to validate and normalize date strings to ISO format
function normalizeDateToISO(dateString: string): string | null {
  if (!dateString) {
    console.warn('⚠️ Empty date string received');
    return null;
  }
  
  try {
    // Try parsing the date
    const date = new Date(dateString);
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      console.warn('⚠️ Invalid date received from OCR:', dateString);
      return null;
    }
    
    // Return ISO format (YYYY-MM-DD)
    const isoDate = date.toISOString().split('T')[0];
    console.log('✅ Date normalized:', dateString, '→', isoDate);
    return isoDate;
  } catch (error) {
    console.error('❌ Error normalizing date:', error);
    return null;
  }
}

// Helper function to validate and normalize amount
function normalizeAmount(amount: unknown): number {
  if (amount === null || amount === undefined) {
    console.warn('⚠️ Null or undefined amount received');
    return 0;
  }
  
  // Convert to number
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
  
  // Validate
  if (isNaN(numAmount) || numAmount < 0) {
    console.warn('⚠️ Invalid amount received:', amount, '→ using 0 as fallback');
    return 0;
  }
  
  console.log('✅ Amount normalized:', amount, '→', numAmount);
  return numAmount;
}

export async function extractInvoiceData(imageFile: File): Promise<InvoiceDataExtracted> {
  const base64Image = await fileToBase64(imageFile);
  
  try {
    console.log('🔍 Inizio estrazione dati fattura tramite Supabase Edge Function');
    console.log('📸 Dimensione immagine:', imageFile.size, 'bytes');
    console.log('📸 Tipo MIME:', imageFile.type);
    
    const { data, error } = await supabase.functions.invoke('analyze-invoice', {
      body: {
        imageBase64: base64Image.split(',')[1],
        mimeType: imageFile.type,
        extractType: 'invoice_data'
      }
    });

    console.log('📡 Risposta Edge Function (raw):', JSON.stringify(data, null, 2));

    if (error) {
      console.error('❌ Errore Edge Function:', error);
      throw new Error(`Errore Edge Function: ${error.message}`);
    }

    if (!data) {
      throw new Error('Nessun dato ricevuto dalla Edge Function');
    }

    // Create result object with validated data
    const result: InvoiceDataExtracted = {};

    // Validate and normalize invoice number
    if (data.invoiceNumber && typeof data.invoiceNumber === 'string' && data.invoiceNumber.trim()) {
      result.invoiceNumber = data.invoiceNumber.trim();
      console.log('✅ Invoice number extracted:', result.invoiceNumber);
    } else {
      console.warn('⚠️ No valid invoice number extracted');
    }

    // Validate and normalize the date
    if (data.date) {
      const normalizedDate = normalizeDateToISO(data.date);
      if (normalizedDate) {
        result.date = normalizedDate;
        console.log('✅ Data normalizzata:', normalizedDate);
      } else {
        console.warn('⚠️ Data non valida, uso data corrente come fallback');
        result.date = new Date().toISOString().split('T')[0];
      }
    } else {
      console.warn('⚠️ Nessuna data estratta, uso data corrente');
      result.date = new Date().toISOString().split('T')[0];
    }

    // Validate and normalize amount
    if (data.amount !== undefined && data.amount !== null) {
      result.amount = normalizeAmount(data.amount);
      result.totalAmount = result.amount;
      console.log('✅ Amount extracted:', result.amount);
    } else if (data.totalAmount !== undefined && data.totalAmount !== null) {
      result.totalAmount = normalizeAmount(data.totalAmount);
      result.amount = result.totalAmount;
      console.log('✅ Total amount extracted:', result.totalAmount);
    } else {
      console.warn('⚠️ No amount extracted, using 0 as fallback');
      result.amount = 0;
      result.totalAmount = 0;
    }

    // Extract discount information
    if (data.discountPercent !== undefined && data.discountPercent !== null) {
      result.discountPercent = normalizeAmount(data.discountPercent);
      console.log('✅ Discount percent extracted:', result.discountPercent);
    }

    if (data.discountAmount !== undefined && data.discountAmount !== null) {
      result.discountAmount = normalizeAmount(data.discountAmount);
      console.log('✅ Discount amount extracted:', result.discountAmount);
    }

    if (data.originalAmount !== undefined && data.originalAmount !== null) {
      result.originalAmount = normalizeAmount(data.originalAmount);
      console.log('✅ Original amount extracted:', result.originalAmount);
    }

    // Calculate missing discount values if we have enough information
    if (result.originalAmount && result.amount && !result.discountAmount) {
      result.discountAmount = result.originalAmount - result.amount;
      console.log('💰 Calculated discount amount:', result.discountAmount);
    }

    if (result.originalAmount && result.discountAmount && !result.discountPercent) {
      result.discountPercent = (result.discountAmount / result.originalAmount) * 100;
      console.log('💰 Calculated discount percent:', result.discountPercent.toFixed(2) + '%');
    }

    // Copy supplier data if present
    if (data.supplier) {
      result.supplier = data.supplier;
      console.log('✅ Supplier data extracted:', result.supplier.name);
    }

    // Copy items if present
    if (data.items && Array.isArray(data.items)) {
      result.items = data.items;
      console.log('✅ Items extracted:', data.items.length);
    }

    console.log('✅ Dati fattura estratti e validati:', result);
    return result;
  } catch (error) {
    console.error('❌ Errore estrazione dati fattura:', error);
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('Impossibile estrarre i dati dalla fattura. Assicurati che l\'immagine sia chiara.');
  }
}

export async function extractInvoiceItems(imageFile: File): Promise<InvoiceItemsExtracted> {
  const base64Image = await fileToBase64(imageFile);
  
  try {
    console.log('🔍 Inizio estrazione articoli fattura tramite Supabase Edge Function');
    
    const { data, error } = await supabase.functions.invoke('analyze-invoice', {
      body: {
        imageBase64: base64Image.split(',')[1],
        mimeType: imageFile.type,
        extractType: 'invoice_items'
      }
    });

    if (error) {
      console.error('❌ Errore Edge Function:', error);
      throw new Error(`Errore Edge Function: ${error.message}`);
    }

    if (!data || !data.items) {
      throw new Error('Nessun articolo ricevuto dalla Edge Function');
    }

    console.log('✅ Articoli estratti:', data.items?.length || 0);
    
    return data;
  } catch (error) {
    console.error('❌ Errore estrazione articoli:', error);
    throw new Error('Impossibile estrarre gli articoli dalla fattura');
  }
}

export async function extractDataFromImage(imageFile: File, type: 'products' | 'suppliers' | 'order' | 'invoice'): Promise<OCRResult> {
  // Convert image to base64
  const base64Image = await fileToBase64(imageFile);
  
  let prompt = '';
  
  if (type === 'products') {
    prompt = `Analizza ATTENTAMENTE questa immagine di un listino prezzi (può essere in italiano, spagnolo, inglese o altre lingue) e estrai:
1. Il NOME DEL FORNITORE (solitamente in alto a sinistra, in grande, o nell'intestazione)
2. TUTTI i dati del fornitore disponibili:
   - Nome completo dell'azienda
   - Indirizzo completo (via, numero civico, città, CAP, provincia, paese)
   - Numero di telefono (fisso e/o mobile)
   - Indirizzo email
   - Partita IVA o codice fiscale
3. TUTTI i prodotti con i loro prezzi
4. L'ALIQUOTA IVA per ogni prodotto (se visibile)
5. La PERCENTUALE DI SCONTO per ogni prodotto (se presente)
6. Il PREZZO ORIGINALE (prima dello sconto) per ogni prodotto (se presente)

ISTRUZIONI PER IL FORNITORE:
- Cerca TUTTI i dati del fornitore nell'intestazione della fattura o listino
- Cerca nell'angolo in alto a sinistra, in alto a destra, o nel footer
- Indirizzo: cerca via, numero civico, città, CAP (es: "Via Roma 123, 20100 Milano MI")
- Telefono: cerca numeri con prefisso (es: "+39 02 1234567", "Tel: 0212345678")
- Email: cerca indirizzi email (es: "info@azienda.it", "ordini@fornitore.com")
- Partita IVA: cerca "P.IVA", "VAT", "NIF", "CIF" seguiti da numeri (es: "P.IVA: IT12345678901")
- Variazioni come "CBG", "Commercial CBG", "COMERCIAL CBG" sono LO STESSO fornitore
- Normalizza il nome rimuovendo suffissi aziendali (S.r.l., S.p.A., Ltd, Commercial, etc.)

ISTRUZIONI CRITICHE PER RICONOSCERE GLI SCONTI - MASSIMA PRIORITÀ:
**IMPORTANTE - GLI SCONTI POSSONO AVERE MOLTI NOMI DIVERSI:**

1. **NOMI DELLE COLONNE SCONTO** (cerca TUTTE queste varianti):
   - ITALIANO: "SCONTO", "SCONTI", "SC", "SCO", "DESC", "DESCONTO", "RIBASSO", "RIDUZIONE", "SCONTO%", "% SCONTO"
   - SPAGNOLO: "DESCUENTO", "DESCUENTOS", "DTOS", "DTO", "DTO.", "DTOS.", "DESC", "REBAJA", "% DTO", "% DESCUENTO"
   - INGLESE: "DISCOUNT", "DISCOUNTS", "DISC", "DISC.", "OFF", "% OFF", "REDUCTION", "% DISCOUNT"
   - FRANCESE: "REMISE", "REMISES", "REM", "% REMISE"
   - PORTOGHESE: "DESCONTO", "DESCONTOS", "DESC", "% DESC"
   
2. **FORMATI NUMERICI DEGLI SCONTI** (riconosci TUTTI questi formati):
   - Percentuale con simbolo: "10%", "5%", "15%", "20%"
   - Percentuale senza simbolo: "10", "5", "15" (nella colonna sconto)
   - Decimali: "10.5%", "7.5%", "12.25%"
   - Con segno negativo: "-10%", "-5%" (meno comune)
   - Importo fisso: "-2.50€", "-5.00€", "€2.50", "€5.00" (nella colonna sconto)

3. **CARATTERISTICHE DEGLI SCONTI**:
   - Lo sconto è tipicamente UNIFORME per tutti i prodotti (es: tutto 10%, tutto 5%)
   - Se vedi una colonna dove TUTTI i valori sono IDENTICI → è la colonna SCONTO
   - Gli sconti sono solitamente tra 1% e 50% (raramente oltre)
   - Se vedi "DTOS 10%" o "DTO 10%" nell'intestazione → TUTTI i prodotti hanno 10% di sconto

4. **DISTINGUERE SCONTO DA IVA** (REGOLA CHIAVE):
   - Colonna SCONTO: valori UNIFORMI (tutto uguale: 10%, 10%, 10%)
   - Colonna IVA: valori VARIABILI (diversi: 10%, 4%, 21%, 10%)
   - Se vedi DUE colonne con percentuali:
     * Colonna con valori TUTTI UGUALI = SCONTO → salva in "discountPercent"
     * Colonna con valori DIVERSI = IVA → salva in "vatRate"

5. **ESEMPI REALI**:
   Esempio 1: Colonne "DTOS" e "IMPTO"
   - DTOS: 10%, 10%, 10%, 10% → SCONTO (tutto uguale)
   - IMPTO: 10%, 4%, 21%, 10% → IVA (valori diversi)
   
   Esempio 2: Colonne "DESC" e "IVA"
   - DESC: 5%, 5%, 5% → SCONTO
   - IVA: 21%, 10%, 4% → IVA
   
   Esempio 3: Solo "DTO 15%" nell'intestazione
   - Tutti i prodotti hanno 15% di sconto

ISTRUZIONI CRITICHE PER IL PREZZO UNITARIO - LEGGI ATTENTAMENTE:
1. PRIMA identifica le INTESTAZIONI delle colonne (prima riga della tabella):
   - ITALIANO: "PRODOTTO", "P. UNITARIO", "PREZZO/KG", "P. NETTO", "PREZZO NETTO", "PREZZO", "TOTALE", "SCONTO", "PREZZO LISTINO", "IVA"
   - SPAGNOLO: "PRODUCTO", "P. UNITARIO", "PRECIO/KG", "P. NETO", "PRECIO NETO", "PRECIO", "TOTAL", "DESCUENTO", "DTO", "PRECIO LISTA", "IVA"
   - INGLESE: "PRODUCT", "UNIT PRICE", "PRICE/KG", "NET PRICE", "PRICE", "TOTAL", "DISCOUNT", "LIST PRICE", "VAT"
   - FRANCESE: "PRODUIT", "PRIX UNITAIRE", "PRIX/KG", "PRIX NET", "PRIX", "TOTAL", "REMISE", "PRIX CATALOGUE", "TVA"

2. **REGOLA FONDAMENTALE - PREZZO PIÙ PICCOLO**:
   - Se nella STESSA RIGA trovi PIÙ PREZZI (es: prezzo unitario €12.00 e totale €36.00):
     **SALVA SEMPRE IL PREZZO PIÙ PICCOLO** come "price"
   - Il prezzo più piccolo è SEMPRE il prezzo unitario/al kg
   - Il prezzo più grande è SEMPRE il totale (da IGNORARE)

3. **CALCOLO PREZZO CON SCONTO**:
   - Se trovi uno sconto (es: 10%) e un prezzo originale (es: €20.00):
   - Calcola: prezzo finale = prezzo originale - (prezzo originale × sconto / 100)
   - Esempio: €20.00 - (€20.00 × 10 / 100) = €20.00 - €2.00 = €18.00
   - Salva: "originalPrice": 20.00, "discountPercent": 10, "price": 18.00

Restituisci un JSON valido nel formato:
{
  "supplier": {
    "name": "Nome Fornitore Normalizzato",
    "phone": "+39 02 1234567",
    "email": "info@fornitore.it",
    "address": "Via Roma 123, 20100 Milano MI, Italia",
    "vat_number": "IT12345678901"
  },
  "products": [
    {"name": "nome prodotto completo", "originalPrice": 20.00, "discountPercent": 10, "price": 18.00, "category": "categoria se presente", "vatRate": 10}
  ]
}

IMPORTANTE: 
- Estrai TUTTI i dati del fornitore disponibili nell'immagine
- **CERCA ATTENTAMENTE tutte le varianti di "sconto": DTOS, DTO, DESC, DESCUENTO, DISCOUNT, SCONTO, RIBASSO, etc.**
- **Se trovi una colonna con valori uniformi (tutto uguale), è SICURAMENTE lo SCONTO**
- Se DTOS/DTO/DESC ha valori uniformi (tutto 10%), è lo SCONTO → salva in "discountPercent"
- Se IMPTO/IVA/VAT ha valori variabili (10%, 4%, 21%), è l'IVA → salva in "vatRate"
- Salva SEMPRE il prezzo PIÙ PICCOLO (prezzo unitario/al kg)
- NON salvare mai il prezzo totale
- Se c'è uno sconto, calcola il prezzo finale e salva anche originalPrice
- Restituisci SOLO il JSON, senza testo aggiuntivo prima o dopo.`;
  } else if (type === 'suppliers') {
    prompt = `Analizza questa immagine e estrai TUTTI i fornitori con i loro dati di contatto completi.
       Cerca in biglietti da visita, liste contatti, documenti aziendali, o fatture.
       
       ISTRUZIONI IMPORTANTI:
       - Estrai nome azienda/fornitore completo
       - Normalizza il nome rimuovendo suffissi aziendali (S.r.l., S.p.A., Ltd, Commercial, etc.)
       - Cerca indirizzo completo (via, numero, città, CAP, provincia, paese)
       - Cerca numeri di telefono (fisso, mobile, WhatsApp) con prefisso
       - Cerca indirizzi email
       - Cerca Partita IVA o codice fiscale (P.IVA, VAT, NIF, CIF)
       
       Restituisci un JSON valido nel formato:
       {
         "suppliers": [
           {
             "name": "nome fornitore normalizzato",
             "phone": "+39 123 456 7890",
             "email": "email@esempio.it",
             "address": "Via Roma 123, 20100 Milano MI, Italia",
             "vat_number": "IT12345678901"
           }
         ]
       }
       
       IMPORTANTE: Restituisci SOLO il JSON, senza testo aggiuntivo prima o dopo.`;
  } else if (type === 'order') {
    prompt = `Analizza questa immagine di una fattura, lista della spesa, o ordine (può essere stampata O SCRITTA A MANO, in italiano, spagnolo, inglese o altre lingue) e estrai:
1. Il NOME DEL FORNITORE (solitamente in alto, nell'intestazione o in grande)
2. TUTTI i prodotti con quantità, prezzi, sconti, IVA e UNITÀ DI MISURA
       
       **SUPPORTO SCRITTURA A MANO:**
       - Questa immagine PUÒ contenere testo scritto a mano
       - Analizza ATTENTAMENTE ogni parola, anche se scritta in modo informale o poco leggibile
       - Cerca nomi di prodotti comuni anche se abbreviati (es: "Grana" per "Grana Padano", "Pomod" per "Pomodori")
       - I numeri scritti a mano possono essere difficili da leggere: fai del tuo meglio per interpretarli
       - Se una parola non è chiara, usa il contesto per capire cosa potrebbe essere
       
       **ISTRUZIONI PER IL FORNITORE:**
       - Cerca il nome del fornitore nell'INTESTAZIONE dell'immagine (in alto)
       - Il nome è solitamente in GRANDE, in GRASSETTO, o nella parte superiore centrale/sinistra
       - Cerca varianti come: "COMERCIAL CBG", "CBG", "Commercial CBG", "Fornitore XYZ", etc.
       - Normalizza il nome rimuovendo suffissi aziendali (S.r.l., S.p.A., Ltd, Commercial, etc.)
       - Se trovi "COMERCIAL CBG" o "CBG" o "Commercial CBG", normalizza a "CBG"
       - Se NON trovi un nome fornitore chiaro, ometti il campo "supplier" dal JSON
       
       **ISTRUZIONI CRITICHE PER RICONOSCERE LE UNITÀ DI MISURA - MASSIMA PRIORITÀ:**
       
       1. **PATTERN NUMERICI** (cerca questi pattern accanto alle quantità):
          - Pattern "x": "1x3", "2x5", "10x2" → estrai come "x3", "x5", "x2"
          - Esempio: "Pomodori 5x3" → quantità: 5, unità: "x3"
       
       2. **UNITÀ SCRITTE** (cerca queste parole accanto ai numeri):
          - ITALIANO: "cassa", "casse", "pezzi", "pezzo", "kg", "kilo", "litri", "litro", "grammi", "gr"
          - SPAGNOLO: "caja", "cajas", "piezas", "pieza", "kg", "kilo", "litros", "litro", "gramos", "gr"
          - INGLESE: "box", "boxes", "pieces", "piece", "kg", "kilo", "liters", "liter", "grams", "gr"
          - FRANCESE: "boîte", "boîtes", "pièces", "pièce", "kg", "kilo", "litres", "litre", "grammes", "gr"
          - TEDESCO: "Kiste", "Kisten", "Stück", "kg", "Kilo", "Liter", "Gramm"
       
       3. **REGOLE DI ESTRAZIONE**:
          - Cerca l'unità IMMEDIATAMENTE dopo o vicino al numero della quantità
          - Se trovi "10 casse" → quantità: 10, unità: "cassa"
          - Se trovi "5x3 kg" → quantità: 5, unità: "x3" (prendi il pattern "x" per primo)
          - Se trovi "20" senza unità → quantità: 20, unità: null (lascia vuoto)
       
       4. **PRIORITÀ**:
          - Pattern "x" ha PRIORITÀ su unità scritte
          - Se vedi "5x3 kg", prendi "x3" come unità
          - Se NON trovi nessuna unità, lascia il campo "unit" vuoto o null
       
       5. **ESEMPI REALI**:
          Input: "Pomodori 5x3 kg"
          Output: {"name": "Pomodori", "quantity": 5, "unit": "x3"}
          
          Input: "Patate 10 casse"
          Output: {"name": "Patate", "quantity": 10, "unit": "cassa"}
          
          Input: "Cipolle 20"
          Output: {"name": "Cipolle", "quantity": 20, "unit": null}
          
          Input: "Latte 2 litri"
          Output: {"name": "Latte", "quantity": 2, "unit": "l"}
       
       ISTRUZIONI CRITICHE PER RICONOSCERE GLI SCONTI - MASSIMA PRIORITÀ:
       **IMPORTANTE - GLI SCONTI POSSONO AVERE MOLTI NOMI DIVERSI:**
       
       1. **NOMI DELLE COLONNE SCONTO** (cerca TUTTE queste varianti):
          - ITALIANO: "SCONTO", "SCONTI", "SC", "SCO", "DESC", "DESCONTO", "RIBASSO", "RIDUZIONE", "SCONTO%", "% SCONTO"
          - SPAGNOLO: "DESCUENTO", "DESCUENTOS", "DTOS", "DTO", "DTO.", "DTOS.", "DESC", "REBAJA", "% DTO", "% DESCUENTO"
          - INGLESE: "DISCOUNT", "DISCOUNTS", "DISC", "DISC.", "OFF", "% OFF", "REDUCTION", "% DISCOUNT"
          - FRANCESE: "REMISE", "REMISES", "REM", "% REMISE"
          - PORTOGHESE: "DESCONTO", "DESCONTOS", "DESC", "% DESC"
       
       2. **CARATTERISTICHE DEGLI SCONTI**:
          - Lo sconto è tipicamente UNIFORME per tutti i prodotti (es: tutto 10%)
          - Se vedi una colonna dove TUTTI i valori sono IDENTICI → è la colonna SCONTO
          - Colonna SCONTO: valori UNIFORMI (tutto uguale: 10%, 10%, 10%)
          - Colonna IVA: valori VARIABILI (diversi: 10%, 4%, 21%)
       
       3. **DISTINGUERE SCONTO DA IVA**:
          - Se vedi DUE colonne con percentuali:
            * Colonna con valori TUTTI UGUALI = SCONTO → "discountPercent"
            * Colonna con valori DIVERSI = IVA → "vatRate"
       
       ISTRUZIONI CRITICHE PER IL PREZZO UNITARIO:
       1. PRIMA identifica le INTESTAZIONI delle colonne (se presenti)
       2. Per OGNI RIGA dopo le intestazioni, estrai i dati dalle colonne corrette DELLA STESSA RIGA
       3. **REGOLA FONDAMENTALE**: Se trovi PIÙ PREZZI nella stessa riga, salva SEMPRE IL PIÙ PICCOLO (prezzo unitario)
       4. Il PREZZO UNITARIO è nella colonna "P. UNITARIO" / "PRECIO UNITARIO" / "UNIT PRICE" / "P. NETTO" / "P. NETO" / "NET PRICE"
       5. IGNORA il prezzo nella colonna "TOTALE" / "TOTAL" (è sempre più grande)
       6. Lo SCONTO è nella colonna "SCONTO" / "DESCUENTO" / "DTO" / "DTOS" / "DISCOUNT" della STESSA RIGA
       7. NON mescolare dati di righe diverse
       
       Restituisci un JSON valido nel formato:
       {
         "supplier": "nome fornitore normalizzato (SOLO se trovato nell'intestazione)",
         "orderItems": [
           {"name": "nome prodotto", "quantity": 2, "unit": "cassa", "price": 3.50, "vatRate": 10, "discountPercent": 10}
         ]
       }
       
       IMPORTANTE: 
       - **CERCA il nome del FORNITORE nell'INTESTAZIONE (in alto, in grande)**
       - **Normalizza il nome del fornitore** (es: "COMERCIAL CBG" → "CBG")
       - **Se NON trovi un fornitore chiaro, ometti il campo "supplier"**
       - **CERCA ATTENTAMENTE le UNITÀ DI MISURA accanto alle quantità**
       - **Pattern "x" (es: "1x3") ha PRIORITÀ su unità scritte**
       - **Se NON trovi unità, lascia il campo "unit" vuoto o null**
       - **CERCA ATTENTAMENTE tutte le varianti di "sconto": DTOS, DTO, DESC, DESCUENTO, DISCOUNT, SCONTO, etc.**
       - **Se trovi una colonna con valori uniformi (tutto uguale), è SICURAMENTE lo SCONTO**
       - Distingui tra colonna SCONTO (valori uniformi) e colonna IVA (valori variabili)
       - Salva SEMPRE il prezzo PIÙ PICCOLO (prezzo unitario)
       - Per scrittura a mano, fai del tuo meglio per interpretare il testo
       - Se un campo non è leggibile o presente, omettilo
       - Restituisci SOLO il JSON, senza testo aggiuntivo prima o dopo.`;
  } else if (type === 'invoice') {
    prompt = `Analizza ATTENTAMENTE questa fattura (può essere in italiano, spagnolo, inglese o altre lingue) e estrai:
1. La DATA della fattura (OBBLIGATORIO) - Converti SEMPRE in formato ISO: "YYYY-MM-DD" (es: "2024-12-01")
2. L'importo totale FINALE (OBBLIGATORIO - dopo sconti)
3. L'importo ORIGINALE (prima degli sconti, se presente)
4. La PERCENTUALE DI SCONTO totale della fattura (se presente)
5. L'IMPORTO DELLO SCONTO totale (se presente)
6. Il numero fattura (se presente)
7. TUTTI i dati del fornitore
8. I prodotti/servizi con quantità, PREZZO UNITARIO, SCONTI, PREZZO FINALE e ALIQUOTA IVA

ISTRUZIONI PER GLI SCONTI DELLA FATTURA:
- Cerca sconti globali applicati all'intera fattura
- Cerca righe come "SCONTO", "DESCUENTO", "DISCOUNT", "RIBASSO", etc.
- Se c'è un subtotale e un totale diverso, calcola lo sconto
- Lo sconto può essere in percentuale (es: "Sconto 10%") o in valore (es: "Sconto €50")

ISTRUZIONI PER IL FORNITORE:
- Cerca TUTTI i dati del fornitore nell'intestazione della fattura
- Solitamente nell'angolo in alto a sinistra o in alto a destra
- Indirizzo: cerca via, numero civico, città, CAP (es: "Via Roma 123, 20100 Milano MI")
- Telefono: cerca numeri con prefisso (es: "+39 02 1234567", "Tel: 0212345678")
- Email: cerca indirizzi email (es: "info@azienda.it", "ordini@fornitore.com")
- Partita IVA: cerca "P.IVA", "VAT", "NIF", "CIF" seguiti da numeri (es: "P.IVA: IT12345678901")

ISTRUZIONI PER LA DATA (CRITICO):
- Cerca la data in formati: "01/12/2024", "1 Dicembre 2024", "01-12-2024", "2024-12-01"
- La data è solitamente vicino a "Data", "Fecha", "Date", "Data Fattura", "Emissione", "Del", ecc.
- Converti SEMPRE in formato ISO: "YYYY-MM-DD" (es: "2024-12-01")
- Se trovi solo mese e anno, usa il primo giorno del mese
- Se la data non è trovata o non è valida, usa la data corrente

ISTRUZIONI PER L'IMPORTO TOTALE (CRITICO - MASSIMA PRIORITÀ):
**REGOLA FONDAMENTALE**: L'importo totale si trova SEMPRE in BASSO A DESTRA della fattura

1. POSIZIONE GEOGRAFICA (PRIORITÀ MASSIMA):
   - Analizza la POSIZIONE di ogni numero nella fattura
   - L'importo totale è nell'ULTIMO 30% VERTICALE (in basso)
   - L'importo totale è nell'ULTIMO 50% ORIZZONTALE (a destra)
   - Se trovi più importi, scegli quello nella zona BASSO-DESTRA

2. PAROLE CHIAVE (cerca vicino all'importo):
   - ITALIANO: "TOTALE", "TOTALE FATTURA", "TOTALE DA PAGARE", "IMPORTO", "SALDO", "DA PAGARE"
   - SPAGNOLO: "TOTAL", "TOTAL FACTURA", "IMPORTE", "SALDO", "A PAGAR"
   - INGLESE: "TOTAL", "TOTAL AMOUNT", "AMOUNT DUE", "BALANCE", "TO PAY"
   - FRANCESE: "TOTAL", "MONTANT", "SOLDE", "À PAYER"

3. FORMATO VALUTA:
   - Cerca numeri con simboli: €, EUR, $, USD, £, GBP
   - Gestisci separatori italiani: 1.234,56 (punto migliaia, virgola decimali)
   - Gestisci separatori internazionali: 1,234.56 (virgola migliaia, punto decimali)
   - Converti SEMPRE in formato numerico con punto decimale (es: 1234.56)

4. SELEZIONE DELL'IMPORTO CORRETTO:
   - Se trovi PIÙ importi, scegli quello PIÙ GRANDE nella zona BASSO-DESTRA
   - L'importo totale è tipicamente il numero PIÙ GRANDE e PIÙ IN BASSO
   - Ignora subtotali, IVA parziali, o importi intermedi
   - Se non trovi l'importo, usa 0 (zero)

5. VALIDAZIONE:
   - L'importo DEVE essere un numero valido (es: 123.45, non "N/A" o testo)
   - L'importo DEVE essere positivo (> 0)
   - Se l'importo è invalido, usa 0 come fallback

ISTRUZIONI CRITICHE PER RICONOSCERE GLI SCONTI NEI PRODOTTI - MASSIMA PRIORITÀ:
**IMPORTANTE - GLI SCONTI POSSONO AVERE MOLTI NOMI DIVERSI:**

1. **NOMI DELLE COLONNE SCONTO** (cerca TUTTE queste varianti):
   - ITALIANO: "SCONTO", "SCONTI", "SC", "SCO", "DESC", "DESCONTO", "RIBASSO", "RIDUZIONE", "SCONTO%", "% SCONTO"
   - SPAGNOLO: "DESCUENTO", "DESCUENTOS", "DTOS", "DTO", "DTO.", "DTOS.", "DESC", "REBAJA", "% DTO", "% DESCUENTO"
   - INGLESE: "DISCOUNT", "DISCOUNTS", "DISC", "DISC.", "OFF", "% OFF", "REDUCTION", "% DISCOUNT"
   - FRANCESE: "REMISE", "REMISES", "REM", "% REMISE"
   - PORTOGHESE: "DESCONTO", "DESCONTOS", "DESC", "% DESC"

2. **FORMATI NUMERICI DEGLI SCONTI** (riconosci TUTTI questi formati):
   - Percentuale con simbolo: "10%", "5%", "15%", "20%"
   - Percentuale senza simbolo: "10", "5", "15" (nella colonna sconto)
   - Decimali: "10.5%", "7.5%", "12.25%"
   - Con segno negativo: "-10%", "-5%" (meno comune)
   - Importo fisso: "-2.50€", "-5.00€", "€2.50", "€5.00" (nella colonna sconto)

3. **CARATTERISTICHE DEGLI SCONTI**:
   - Lo sconto è tipicamente UNIFORME per tutti i prodotti (es: tutto 10%, tutto 5%)
   - Se vedi una colonna dove TUTTI i valori sono IDENTICI → è la colonna SCONTO
   - Gli sconti sono solitamente tra 1% e 50% (raramente oltre)
   - Se vedi "DTOS 10%" o "DTO 10%" nell'intestazione → TUTTI i prodotti hanno 10% di sconto

4. **DISTINGUERE SCONTO DA IVA** (REGOLA CHIAVE):
   - Colonna SCONTO: valori UNIFORMI (tutto uguale: 10%, 10%, 10%)
   - Colonna IVA: valori VARIABILI (diversi: 10%, 4%, 21%, 10%)
   - Se vedi DUE colonne con percentuali:
     * Colonna con valori TUTTI UGUALI = SCONTO → salva in "discountPercent"
     * Colonna con valori DIVERSI = IVA → salva in "vatRate"

5. **ESEMPI REALI**:
   Esempio 1: Colonne "DTOS" e "IMPTO"
   - DTOS: 10%, 10%, 10%, 10% → SCONTO (tutto uguale)
   - IMPTO: 10%, 4%, 21%, 10% → IVA (valori diversi)
   
   Esempio 2: Colonne "DESC" e "IVA"
   - DESC: 5%, 5%, 5% → SCONTO
   - IVA: 21%, 10%, 4% → IVA
   
   Esempio 3: Solo "DTO 15%" nell'intestazione
   - Tutti i prodotti hanno 15% di sconto

ISTRUZIONI CRITICHE PER IL PREZZO UNITARIO - LEGGI ATTENTAMENTE:
1. PRIMA identifica le INTESTAZIONI delle colonne (prima riga della tabella)
2. **REGOLA FONDAMENTALE - PREZZO PIÙ PICCOLO**:
   - Se nella STESSA RIGA trovi PIÙ PREZZI (es: prezzo unitario €12.00 e totale €36.00):
     **SALVA SEMPRE IL PREZZO PIÙ PICCOLO** come "price"
   - Il prezzo più piccolo è SEMPRE il prezzo unitario/al kg
   - Il prezzo più grande è SEMPRE il totale (da IGNORARE)

3. **CALCOLO PREZZO CON SCONTO**:
   - Se trovi uno sconto (es: 10%) e un prezzo originale (es: €20.00):
   - Calcola: prezzo finale = prezzo originale - (prezzo originale × sconto / 100)
   - Esempio: €20.00 - (€20.00 × 10 / 100) = €20.00 - €2.00 = €18.00
   - Salva: "originalPrice": 20.00, "discountPercent": 10, "price": 18.00

Restituisci un JSON valido nel formato:
{
  "invoice": {
    "invoiceNumber": "FT-2024-001",
    "date": "2024-11-15",
    "amount": 111.15,
    "originalAmount": 123.45,
    "discountPercent": 10,
    "discountAmount": 12.30,
    "supplier": {
      "name": "Nome Fornitore",
      "phone": "+39 02 1234567",
      "email": "info@fornitore.it",
      "address": "Via Roma 123, 20100 Milano MI, Italia",
      "vat_number": "IT12345678901"
    },
    "items": [
      {"name": "Prodotto 1", "quantity": 2, "originalPrice": 12.00, "discountPercent": 10, "price": 10.80, "vatRate": 10}
    ]
  }
}

IMPORTANTE: 
- La DATA è OBBLIGATORIA in formato ISO "YYYY-MM-DD"
- L'IMPORTO è OBBLIGATORIO (usa 0 se non trovato)
- **L'IMPORTO TOTALE SI TROVA IN BASSO A DESTRA** - dai MASSIMA PRIORITÀ a questa zona
- Se trovi più importi, scegli quello PIÙ GRANDE nella zona BASSO-DESTRA
- Se la data non è valida, usa la data corrente
- Se l'importo non è valido, usa 0
- Estrai TUTTI i dati del fornitore disponibili
- Estrai gli sconti globali della fattura se presenti
- **CERCA ATTENTAMENTE tutte le varianti di "sconto": DTOS, DTO, DESC, DESCUENTO, DISCOUNT, SCONTO, RIBASSO, etc.**
- **Se trovi una colonna con valori uniformi (tutto uguale), è SICURAMENTE lo SCONTO**
- DISTINGUI CORRETTAMENTE tra colonna SCONTO (valori uniformi) e colonna IVA (valori variabili)
- Salva SEMPRE il prezzo PIÙ PICCOLO (prezzo unitario/al kg)
- NON salvare mai il prezzo totale
- Se c'è uno sconto, calcola il prezzo finale e salva anche originalPrice
- Restituisci SOLO il JSON, senza testo aggiuntivo`;
  }

  try {
    console.log('🔍 Inizio analisi OCR per tipo:', type);
    console.log('📸 Dimensione immagine:', imageFile.size, 'bytes');
    console.log('📸 Tipo MIME:', imageFile.type);
    
    // For products, suppliers, order types, we still use direct Gemini API call
    // since these are less frequent operations
    const GEMINI_API_KEY = 'AIzaSyCovh7lc2BECIkfc0sEQ-MeqJEhJZlKqzo';
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inline_data: {
                mime_type: imageFile.type,
                data: base64Image.split(',')[1]
              }
            }
          ]
        }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 8192,
        }
      })
    });

    console.log('📡 Risposta API status:', response.status);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Errore API:', errorData);
      throw new Error(`Errore API (${response.status}): ${JSON.stringify(errorData)}`);
    }

    const data = await response.json();
    console.log('📦 Dati ricevuti:', data);
    
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    console.log('📝 Testo estratto (primi 500 caratteri):', text.substring(0, 500));
    
    if (!text) {
      throw new Error('Nessun testo ricevuto dall\'API. L\'immagine potrebbe non contenere testo leggibile.');
    }
    
    // Extract JSON from markdown code blocks if present - IMPROVED LOGIC
    let jsonText = text.trim();
    
    // Try to extract from markdown code blocks first
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
      console.log('✂️ JSON estratto da code block');
    } else {
      // Try to find JSON object in the text
      const objectMatch = text.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        jsonText = objectMatch[0];
        console.log('✂️ JSON estratto da testo');
      }
    }
    
    // Clean up any remaining text before/after JSON - IMPROVED CLEANING
    jsonText = jsonText.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
    console.log('🧹 JSON pulito (primi 500 caratteri):', jsonText.substring(0, 500));
    
    const result = JSON.parse(jsonText);
    console.log('✅ Parsing JSON completato');
    
    // POST-PROCESSING: Apply discount calculation if needed for all item types
    if (type === 'products' && result.products) {
      console.log('🔧 Applicazione calcolo sconti sui prodotti...');
      result.products = result.products.map((product: Product) => {
        if (product.originalPrice && product.discountPercent && !product.price) {
          const discountedPrice = product.originalPrice - (product.originalPrice * product.discountPercent / 100);
          console.log(`  💰 Calcolo sconto per "${product.name}": €${product.originalPrice} - ${product.discountPercent}% = €${discountedPrice.toFixed(2)}`);
          return {
            ...product,
            price: parseFloat(discountedPrice.toFixed(2))
          };
        }
        return product;
      });
    }
    
    if (type === 'order' && result.orderItems) {
      console.log('🔧 Applicazione calcolo sconti sugli ordini...');
      result.orderItems = result.orderItems.map((item: OrderItemExtracted) => {
        // Apply discount calculation
        if (item.originalPrice && item.discountPercent && !item.price) {
          const discountedPrice = item.originalPrice - (item.originalPrice * item.discountPercent / 100);
          item = {
            ...item,
            price: parseFloat(discountedPrice.toFixed(2))
          };
        }
        
        // Extract unit if not already present
        if (!item.unit) {
          const extractedUnit = extractUnitFromText(item.name);
          if (extractedUnit) {
            console.log(`  🔍 Unità estratta da "${item.name}": ${extractedUnit}`);
            item = {
              ...item,
              unit: extractedUnit
            };
          }
        }
        
        return item;
      });
    }
    
    // POST-PROCESSING: Validate and normalize dates for invoice type
    if (type === 'invoice' && result.invoice) {
      // Validate date
      if (result.invoice.date) {
        const normalizedDate = normalizeDateToISO(result.invoice.date);
        if (normalizedDate) {
          result.invoice.date = normalizedDate;
          console.log('✅ Data fattura normalizzata:', normalizedDate);
        } else {
          console.warn('⚠️ Data fattura non valida, uso data corrente');
          result.invoice.date = new Date().toISOString().split('T')[0];
        }
      } else {
        console.warn('⚠️ Nessuna data fattura estratta, uso data corrente');
        result.invoice.date = new Date().toISOString().split('T')[0];
      }

      // Validate amount
      if (result.invoice.amount !== undefined && result.invoice.amount !== null) {
        result.invoice.amount = normalizeAmount(result.invoice.amount);
      } else {
        console.warn('⚠️ Nessun importo estratto, uso 0');
        result.invoice.amount = 0;
      }

      // Validate discount fields
      if (result.invoice.discountPercent !== undefined) {
        result.invoice.discountPercent = normalizeAmount(result.invoice.discountPercent);
        console.log('✅ Discount percent extracted:', result.invoice.discountPercent);
      }

      if (result.invoice.discountAmount !== undefined) {
        result.invoice.discountAmount = normalizeAmount(result.invoice.discountAmount);
        console.log('✅ Discount amount extracted:', result.invoice.discountAmount);
      }

      if (result.invoice.originalAmount !== undefined) {
        result.invoice.originalAmount = normalizeAmount(result.invoice.originalAmount);
        console.log('✅ Original amount extracted:', result.invoice.originalAmount);
      }

      // Calculate missing discount values
      if (result.invoice.originalAmount && result.invoice.amount && !result.invoice.discountAmount) {
        result.invoice.discountAmount = result.invoice.originalAmount - result.invoice.amount;
        console.log('💰 Calculated discount amount:', result.invoice.discountAmount);
      }

      if (result.invoice.originalAmount && result.invoice.discountAmount && !result.invoice.discountPercent) {
        result.invoice.discountPercent = (result.invoice.discountAmount / result.invoice.originalAmount) * 100;
        console.log('💰 Calculated discount percent:', result.invoice.discountPercent.toFixed(2) + '%');
      }
      
      // Apply discount calculation to items
      if (result.invoice.items) {
        console.log('🔧 Applicazione calcolo sconti sugli items fattura...');
        result.invoice.items = result.invoice.items.map((item: InvoiceItem) => {
          if (item.originalPrice && item.discountPercent && !item.price) {
            const discountedPrice = item.originalPrice - (item.originalPrice * item.discountPercent / 100);
            console.log(`  💰 Calcolo sconto per "${item.name}": €${item.originalPrice} - ${item.discountPercent}% = €${discountedPrice.toFixed(2)}`);
            return {
              ...item,
              price: parseFloat(discountedPrice.toFixed(2))
            };
          }
          return item;
        });
      }
    }
    
    if (type === 'products') {
      console.log('📊 Fornitore:', result.supplier?.name || 'Non trovato');
      if (result.supplier) {
        console.log('📊 Dati fornitore completi:', {
          name: result.supplier.name,
          phone: result.supplier.phone || 'N/A',
          email: result.supplier.email || 'N/A',
          address: result.supplier.address || 'N/A',
          vat_number: result.supplier.vat_number || 'N/A'
        });
      }
      console.log('📊 Numero di prodotti estratti:', result.products?.length || 0);
      if (result.products?.length > 0) {
        const productsWithVAT = (result.products as Product[]).filter((p) => p.vatRate).length;
        const productsWithDiscount = (result.products as Product[]).filter((p) => p.discountPercent).length;
        const productsWithOriginalPrice = (result.products as Product[]).filter((p) => p.originalPrice).length;
        console.log('📊 Prodotti con IVA:', productsWithVAT);
        console.log('📊 Prodotti con Sconto:', productsWithDiscount);
        console.log('📊 Prodotti con Prezzo Originale:', productsWithOriginalPrice);
        
        // Log first 3 products with their prices for debugging
        console.log('📊 Primi 3 prodotti estratti:');
        result.products.slice(0, 3).forEach((p: Product, i: number) => {
          console.log(`  ${i + 1}. ${p.name}: €${p.price}${p.originalPrice ? ` (era €${p.originalPrice}, sconto ${p.discountPercent}%)` : ''} - IVA: ${p.vatRate || 'N/A'}%`);
        });
      }
    } else if (type === 'invoice') {
      console.log('📊 Data fattura:', result.invoice?.date || 'Non trovata');
      console.log('📊 Importo:', result.invoice?.amount || 'Non trovato');
      if (result.invoice?.discountPercent) {
        console.log('📊 Sconto fattura:', result.invoice.discountPercent + '%');
      }
      if (result.invoice?.discountAmount) {
        console.log('📊 Importo sconto:', '€' + result.invoice.discountAmount.toFixed(2));
      }
      if (result.invoice?.originalAmount) {
        console.log('📊 Importo originale:', '€' + result.invoice.originalAmount.toFixed(2));
      }
      if (result.invoice?.supplier) {
        console.log('📊 Dati fornitore completi:', {
          name: result.invoice.supplier.name,
          phone: result.invoice.supplier.phone || 'N/A',
          email: result.invoice.supplier.email || 'N/A',
          address: result.invoice.supplier.address || 'N/A',
          vat_number: result.invoice.supplier.vat_number || 'N/A'
        });
      }
      console.log('📊 Numero di prodotti:', result.invoice?.items?.length || 0);
      if (result.invoice?.items?.length > 0) {
        const itemsWithVAT = (result.invoice.items as InvoiceItem[]).filter((i) => i.vatRate).length;
        const itemsWithDiscount = (result.invoice.items as InvoiceItem[]).filter((i) => i.discountPercent).length;
        console.log('📊 Prodotti con IVA:', itemsWithVAT);
        console.log('📊 Prodotti con Sconto:', itemsWithDiscount);
        
        // Log first 3 items with their prices for debugging
        console.log('📊 Primi 3 prodotti estratti:');
        result.invoice.items.slice(0, 3).forEach((item: InvoiceItem, i: number) => {
          console.log(`  ${i + 1}. ${item.name}: €${item.price} (qta: ${item.quantity})${item.originalPrice ? ` (era €${item.originalPrice}, sconto ${item.discountPercent}%)` : ''} - IVA: ${item.vatRate || 'N/A'}%`);
        });
      }
    } else if (type === 'order') {
      console.log('📊 Fornitore:', result.supplier || 'Non trovato');
      console.log('📊 Numero di prodotti estratti:', result.orderItems?.length || 0);
      if (result.orderItems?.length > 0) {
        console.log('📊 Primi 3 prodotti estratti:');
        result.orderItems.slice(0, 3).forEach((item: OrderItemExtracted, i: number) => {
          console.log(`  ${i + 1}. ${item.name}: qta ${item.quantity}${item.unit ? ` ${item.unit}` : ''}${item.price ? `, €${item.price}` : ''} - Sconto: ${item.discountPercent || 'N/A'}% - IVA: ${item.vatRate || 'N/A'}%`);
        });
      }
    }
    
    return result;
  } catch (error) {
    console.error('❌ Errore OCR completo:', error);
    
    if (error instanceof SyntaxError) {
      throw new Error('Errore nel parsing della risposta. L\'AI non ha restituito un JSON valido. Riprova con un\'immagine più chiara.');
    }
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('Impossibile estrarre i dati dall\'immagine. Assicurati che l\'immagine sia chiara e contenga testo leggibile.');
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}