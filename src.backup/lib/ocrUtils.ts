import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({
  apiKey: import.meta.env.VITE_ANTHROPIC_API_KEY || '',
  dangerouslyAllowBrowser: true,
});

export interface ExtractedProduct {
  name: string;
  price: number;
  unit?: string;
  quantity?: number;
  category?: string;
}

export async function extractProductsFromInvoice(imageFile: File): Promise<ExtractedProduct[]> {
  try {
    // Convert image to base64
    const base64Image = await fileToBase64(imageFile);
    const mediaType = imageFile.type as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

    // Call Claude API with vision
    const message = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: mediaType,
                data: base64Image,
              },
            },
            {
              type: 'text',
              text: `Analizza questa fattura/scontrino e estrai TUTTI i prodotti con i loro prezzi.

Per ogni prodotto, fornisci:
- nome: il nome del prodotto (in italiano se possibile)
- price: il prezzo unitario in euro (numero decimale)
- unit: l'unità di misura (kg, g, l, ml, pz)
- quantity: la quantità acquistata (se presente)

Rispondi SOLO con un array JSON valido, senza testo aggiuntivo.

Esempio formato:
[
  {"name": "Pomodori", "price": 2.50, "unit": "kg", "quantity": 2},
  {"name": "Pane", "price": 1.20, "unit": "pz", "quantity": 1}
]`,
            },
          ],
        },
      ],
    });

    // Parse response
    const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
    
    // Extract JSON from response (handle markdown code blocks)
    let jsonText = responseText.trim();
    if (jsonText.startsWith('```json')) {
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    } else if (jsonText.startsWith('```')) {
      jsonText = jsonText.replace(/```\n?/g, '');
    }
    
    const products = JSON.parse(jsonText) as ExtractedProduct[];
    
    return products;
  } catch (error) {
    console.error('OCR Error:', error);
    throw new Error('Errore durante l\'analisi della fattura. Verifica che l\'immagine sia leggibile.');
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result as string;
      // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = (error) => reject(error);
  });
}