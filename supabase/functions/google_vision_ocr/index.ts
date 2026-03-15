import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GOOGLE_VISION_API_KEY = Deno.env.get('GOOGLE_VISION_API_KEY') || ''
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY') || ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface OrderItem {
  name: string
  quantity: number
  price: number
  unit?: string
  vatRate?: number
  totalLine: number
}

interface OCRResult {
  success: boolean
  supplier: {
    name: string
    phone?: string
  }
  orderItems: OrderItem[]
  totalAmount: number
  error?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 [Google Vision OCR] Starting order extraction...')

    const { image } = await req.json()

    if (!image) {
      throw new Error('No image provided')
    }

    // Step 1: Extract text using Google Vision API
    console.log('📸 [Google Vision] Calling Vision API...')
    const visionResponse = await fetch(
      `https://vision.googleapis.com/v1/images:annotate?key=${GOOGLE_VISION_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: image.split(',')[1] || image, // Remove data:image/jpeg;base64, prefix if present
              },
              features: [
                {
                  type: 'DOCUMENT_TEXT_DETECTION',
                  maxResults: 1,
                },
              ],
            },
          ],
        }),
      }
    )

    if (!visionResponse.ok) {
      const errorText = await visionResponse.text()
      console.error('❌ [Google Vision] API Error:', errorText)
      throw new Error(`Google Vision API error: ${visionResponse.status}`)
    }

    const visionData = await visionResponse.json()
    console.log('✅ [Google Vision] Text extracted successfully')

    const extractedText = visionData.responses[0]?.fullTextAnnotation?.text || ''

    if (!extractedText) {
      throw new Error('No text extracted from image')
    }

    console.log('📝 [Google Vision] Extracted text length:', extractedText.length)
    console.log('📝 [Google Vision] First 500 chars:', extractedText.substring(0, 500))

    // Step 2: Use GPT-4 to structure the data
    console.log('🤖 [GPT-4] Processing extracted text...')
    const gptResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are an expert at extracting structured data from Italian order documents (ordini/bolle).

IMPORTANT RULES:
- Extract ALL products/items found in the document, even if some information is missing
- Be flexible with table formats - products may be in various layouts
- Quantity can be written as: "x2", "2 pz", "2kg", "2 lt", or just "2"
- If unit price is missing, set it to 0
- If total line is missing, calculate it as quantity * price (or set to 0)
- Product names may span multiple lines - combine them
- Look for supplier name at the TOP of the document (usually the largest text or header)
- Common Italian terms: "Descrizione" (description), "Qta/Qt" (quantity), "Prezzo" (price), "Totale" (total), "IVA" (VAT)
- Accept partial information - it's better to extract incomplete data than nothing

Extract:
1. Supplier name (azienda/fornitore) - usually at document top
2. Supplier phone (if visible)
3. ALL products with available info:
   - name (descrizione prodotto)
   - quantity (quantità) - convert text like "x2" to number 2
   - price (prezzo unitario) - use 0 if not found
   - unit (unità: kg, pz, lt, conf, etc.) - extract from quantity field if present
   - VAT rate (aliquota IVA) if shown
   - total line (totale riga) - calculate if missing
4. Total amount (totale ordine)

Return ONLY valid JSON:
{
  "supplier": {"name": "...", "phone": "..." or null},
  "orderItems": [
    {
      "name": "Product name",
      "quantity": 10,
      "price": 5.50,
      "unit": "kg",
      "vatRate": 10,
      "totalLine": 55.00
    }
  ],
  "totalAmount": 55.00
}

If a field is unknown, use null for strings or 0 for numbers. ALWAYS extract products even if incomplete.`,
          },
          {
            role: 'user',
            content: `Extract order information from this Italian order document:\n\n${extractedText}`,
          },
        ],
        temperature: 0.1,
        max_tokens: 4000,
      }),
    })

    if (!gptResponse.ok) {
      const errorText = await gptResponse.text()
      console.error('❌ [GPT-4] API Error:', errorText)
      throw new Error(`GPT-4 API error: ${gptResponse.status}`)
    }

    const gptData = await gptResponse.json()
    console.log('✅ [GPT-4] Data structured successfully')

    const gptContent = gptData.choices[0]?.message?.content || ''
    console.log('📝 [GPT-4] Full response:', gptContent)
    
    // Parse JSON from GPT response (remove markdown code blocks if present)
    let structuredData
    try {
      const jsonMatch = gptContent.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        structuredData = JSON.parse(jsonMatch[0])
      } else {
        structuredData = JSON.parse(gptContent)
      }
      console.log('✅ [GPT-4] JSON parsed successfully')
      console.log('📊 [GPT-4] Parsed data:', JSON.stringify(structuredData, null, 2))
    } catch (parseError) {
      console.error('❌ [GPT-4] JSON Parse Error:', parseError)
      console.error('📝 [GPT-4] GPT Response that failed to parse:', gptContent)
      throw new Error('Failed to parse GPT-4 response as JSON')
    }

    // Validate and format the response
    const result: OCRResult = {
      success: true,
      supplier: {
        name: structuredData.supplier?.name || 'Unknown Supplier',
        phone: structuredData.supplier?.phone || undefined,
      },
      orderItems: (structuredData.orderItems || []).map((item: any) => ({
        name: item.name || 'Unknown Product',
        quantity: Number(item.quantity) || 0,
        price: Number(item.price) || 0,
        unit: item.unit || undefined,
        vatRate: item.vatRate ? Number(item.vatRate) : undefined,
        totalLine: Number(item.totalLine) || 0,
      })),
      totalAmount: Number(structuredData.totalAmount) || 0,
    }

    console.log('✅ [Google Vision OCR] Extraction completed successfully')
    console.log('📊 [Results] Supplier:', result.supplier.name)
    console.log('📊 [Results] Items extracted:', result.orderItems.length)
    console.log('📊 [Results] Total amount:', result.totalAmount)
    console.log('📊 [Results] First item:', result.orderItems[0] || 'No items')

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('❌ [Google Vision OCR] Error:', error)
    
    const errorResult: OCRResult = {
      success: false,
      supplier: { name: 'Error' },
      orderItems: [],
      totalAmount: 0,
      error: error.message || 'Unknown error occurred',
    }

    return new Response(JSON.stringify(errorResult), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200, // Return 200 even for errors to handle them in frontend
    })
  }
})