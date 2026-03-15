import { OCRResult } from '@/types';
import { getGeminiApiKey } from './config';

interface TextItem {
  str: string;
}

interface PDFJSLib {
  version: string;
  GlobalWorkerOptions: {
    workerSrc: string;
  };
  getDocument: (params: { data: ArrayBuffer }) => {
    promise: Promise<{
      numPages: number;
      getPage: (pageNum: number) => Promise<{
        getTextContent: () => Promise<{
          items: TextItem[];
        }>;
      }>;
    }>;
  };
}

/**
 * Extract text from PDF file using PDF.js
 */
async function extractTextFromPDF(file: File): Promise<string> {
  try {
    // Dynamically import pdfjs-dist
    const pdfjsLib = await import('pdfjs-dist') as unknown as PDFJSLib;
    
    // Set worker source
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;
    
    // Read file as ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    
    // Load PDF document
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    
    // Extract text from each page
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: TextItem) => item.str)
        .join(' ');
      fullText += pageText + '\n\n';
    }
    
    return fullText;
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error('Impossibile estrarre il testo dal PDF. Assicurati che il file non sia protetto o corrotto.');
  }
}

/**
 * Process PDF file and extract product data using AI
 */
export async function extractDataFromPDF(
  file: File,
  type: 'products' | 'suppliers' | 'order' | 'invoice'
): Promise<OCRResult> {
  console.log('📄 Inizio estrazione da PDF:', file.name);
  
  // Extract text from PDF
  const pdfText = await extractTextFromPDF(file);
  console.log('📝 Testo estratto dal PDF (primi 500 caratteri):', pdfText.substring(0, 500));
  
  if (!pdfText || pdfText.trim().length < 10) {
    throw new Error('Il PDF non contiene testo leggibile o è vuoto.');
  }
  
  // Prepare prompt based on type
  let prompt = '';
  
  if (type === 'products') {
    prompt = `Analizza ATTENTAMENTE questo testo estratto da un listino prezzi PDF italiano e estrai:
1. Il NOME DEL FORNITORE (solitamente all'inizio del documento)
2. TUTTI i prodotti con i loro prezzi
3. L'ALIQUOTA IVA per ogni prodotto (se visibile)

ISTRUZIONI PER IL FORNITORE:
- Cerca il nome dell'azienda/fornitore all'inizio del testo
- Cerca anche numero di telefono o email se presenti

ISTRUZIONI PER I PRODOTTI:
1. Leggi OGNI riga del listino
2. NON saltare nessun prodotto
3. Il PREZZO è solitamente l'ultimo numero sulla destra
4. Formati prezzi: €12.50, 12,50€, 12.50, 12,50
5. Converti SEMPRE i prezzi in formato decimale con PUNTO (es: 12.50)
6. Se vedi categorie (es: "VERDURE", "FRUTTA", "SECO", "FRIO"), includile nel campo category

ISTRUZIONI PER L'IVA:
- Cerca "IVA 4%", "IVA 10%", "IVA 22%", "VAT 4%"
- Cerca in note: "Prodotti con IVA al 4%"
- Se non trovi l'IVA, lascia il campo vuoto
- Estrai SOLO il numero (4, 10, 22)

TESTO DEL PDF:
${pdfText}

Restituisci un JSON valido nel formato:
{
  "supplier": {
    "name": "Nome Fornitore",
    "phone": "numero telefono se presente",
    "email": "email se presente"
  },
  "products": [
    {"name": "nome prodotto completo", "price": 12.50, "category": "categoria se presente", "vatRate": 4}
  ]
}

IMPORTANTE: Restituisci SOLO il JSON, senza testo aggiuntivo.`;
  } else if (type === 'suppliers') {
    prompt = `Analizza questo testo estratto da un PDF e estrai TUTTI i fornitori con i loro dati di contatto.
       
TESTO DEL PDF:
${pdfText}

Restituisci un JSON valido nel formato:
{
  "suppliers": [
    {"name": "nome fornitore", "phone": "+39 123 456 7890", "email": "email@esempio.it"}
  ]
}

IMPORTANTE: Restituisci SOLO il JSON, senza testo aggiuntivo.`;
  } else if (type === 'order') {
    prompt = `Analizza questo testo estratto da un PDF di fattura o ordine e estrai TUTTI i prodotti con quantità, prezzi e IVA.

TESTO DEL PDF:
${pdfText}

Restituisci un JSON valido nel formato:
{
  "supplier": "nome fornitore se visibile",
  "orderItems": [
    {"name": "nome prodotto", "quantity": 2, "price": 3.50, "vatRate": 10}
  ]
}

IMPORTANTE: Restituisci SOLO il JSON, senza testo aggiuntivo.`;
  } else if (type === 'invoice') {
    prompt = `Analizza questo testo estratto da una fattura PDF e estrai:
1. La DATA della fattura
2. L'importo totale
3. I prodotti con quantità, prezzi e ALIQUOTA IVA

TESTO DEL PDF:
${pdfText}

Restituisci un JSON valido nel formato:
{
  "invoice": {
    "date": "2024-11-15",
    "amount": 123.45,
    "items": [
      {"name": "Prodotto 1", "quantity": 2, "price": 10.50, "vatRate": 4}
    ]
  }
}

IMPORTANTE: Restituisci SOLO il JSON, senza testo aggiuntivo.`;
  }
  
  try {
    // Get API key from config
    const apiKey = getGeminiApiKey();
    
    // Use Gemini API to analyze the text
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [{ text: prompt }],
            },
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 8192,
          },
        }),
      }
    );
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ Errore API:', errorData);
      throw new Error(`Errore API (${response.status})`);
    }
    
    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!text) {
      throw new Error('Nessuna risposta dall\'AI');
    }
    
    // Extract JSON from response
    let jsonText = text.trim();
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    } else {
      const objectMatch = text.match(/\{[\s\S]*\}/);
      if (objectMatch) {
        jsonText = objectMatch[0];
      }
    }
    
    jsonText = jsonText.replace(/^[^{]*/, '').replace(/[^}]*$/, '');
    const result = JSON.parse(jsonText);
    
    console.log('✅ Dati estratti dal PDF con successo');
    return result;
  } catch (error) {
    console.error('❌ Errore nell\'analisi del PDF:', error);
    
    if (error instanceof SyntaxError) {
      throw new Error('Errore nel parsing della risposta AI. Riprova.');
    }
    
    if (error instanceof Error) {
      throw error;
    }
    
    throw new Error('Impossibile analizzare il PDF.');
  }
}