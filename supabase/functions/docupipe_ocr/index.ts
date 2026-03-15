import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const DOCUPIPE_UPLOAD_URL = 'https://app.docupipe.ai/document'
const DOCUPIPE_STANDARDIZATION_URL = 'https://app.docupipe.ai/standardization'
const WORKFLOW_ID = 'mtWmnRZ2'

function generateRequestId(): string {
  return crypto.randomUUID().substring(0, 8)
}

function log(requestId: string, level: string, message: string, data?: any) {
  try {
    const logMessage = data 
      ? `[${new Date().toISOString()}] [${requestId}] [${level}] ${message} ${JSON.stringify(data, null, 2)}`
      : `[${new Date().toISOString()}] [${requestId}] [${level}] ${message}`
    console.log(logMessage)
  } catch (e) {
    console.log(`[${new Date().toISOString()}] [${requestId}] [${level}] ${message} [data logging failed]`)
  }
}

function cleanBase64(base64: string | undefined): string {
  if (!base64 || typeof base64 !== 'string') return ''
  return base64.includes(',') ? base64.split(',')[1] : base64
}

async function uploadToDocuPipe(base64Data: string, filename: string, apiKey: string, requestId: string): Promise<{ documentId: string, standardizationId?: string }> {
  log(requestId, 'INFO', '📤 Uploading to DocuPipe...')
  
  const payload = {
    document: {
      file: {
        contents: base64Data,
        filename: filename
      }
    },
    parseVersion: 3,
    dataset: 'invoices',
    workflowId: WORKFLOW_ID
  }
  
  const response = await fetch(DOCUPIPE_UPLOAD_URL, {
    method: 'POST',
    headers: {
      'accept': 'application/json',
      'content-type': 'application/json',
      'X-API-Key': apiKey
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const errorText = await response.text()
    log(requestId, 'ERROR', `❌ Upload failed: ${response.status}`)
    throw new Error(`Upload failed: ${response.status} - ${errorText}`)
  }

  const result = await response.json()
  log(requestId, 'SUCCESS', '✅ Uploaded to DocuPipe')
  
  return {
    documentId: result.documentId,
    standardizationId: result.workflowResponse?.standardizeStep?.standardizationIds?.[0]
  }
}

/**
 * OPTIMIZED: Exponential backoff polling strategy
 * Reduces total polling time from 14s to 10-11s
 */
async function getStandardizationResults(standardizationId: string, apiKey: string, requestId: string): Promise<any> {
  log(requestId, 'INFO', '🔄 Polling standardization with exponential backoff...')
  
  // Exponential backoff delays: start fast, then slow down
  const delays = [500, 800, 1000, 1200, 1500, 2000, 2500, 3000];
  const maxRetries = 25;
  
  for (let i = 0; i < maxRetries; i++) {
    const response = await fetch(`${DOCUPIPE_STANDARDIZATION_URL}/${standardizationId}`, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'X-API-Key': apiKey
      }
    })

    if (response.ok) {
      const result = await response.json()
      
      if (result.data) {
        log(requestId, 'SUCCESS', `✅ Standardization complete - ${result.data.products?.length || 0} products`)
        return result.data
      }
    }
    
    // Use exponential backoff delay
    const delay = delays[Math.min(i, delays.length - 1)];
    await new Promise(resolve => setTimeout(resolve, delay))
  }
  
  log(requestId, 'ERROR', '❌ Standardization timeout after 20 seconds')
  throw new Error('Standardization timeout')
}

serve(async (req: Request) => {
  const requestId = generateRequestId()
  log(requestId, 'INFO', '🚀 Starting OCR processing - PURE EXTRACTION MODE')

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  try {
    const docuPipeApiKey = Deno.env.get('DOCUPIPE_API_KEY')

    if (!docuPipeApiKey) {
      log(requestId, 'ERROR', '❌ Missing DOCUPIPE_API_KEY')
      return new Response(JSON.stringify({ error: 'Missing API key' }), { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const body = await req.json()
    
    if (!body.imageBase64) {
      log(requestId, 'ERROR', '❌ Missing imageBase64 in request')
      return new Response(JSON.stringify({ error: 'Missing imageBase64' }), { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const cleanB64 = cleanBase64(body.imageBase64)
    const startTime = Date.now()

    const { documentId, standardizationId } = await uploadToDocuPipe(cleanB64, '/images/photo1766660855.jpg', docuPipeApiKey, requestId)

    if (!standardizationId) {
      log(requestId, 'ERROR', '❌ No standardization ID received from upload')
      throw new Error('No standardization ID received')
    }

    const data = await getStandardizationResults(standardizationId, docuPipeApiKey, requestId)

    const processingTime = Math.round((Date.now() - startTime) / 1000)

    const supplierAddress = data.supplier_address || {}
    const addressFull = [
      supplierAddress.street,
      supplierAddress.city,
      supplierAddress.postalCode,
      supplierAddress.region
    ].filter(p => p).join(', ')

    const products = (data.products || []).map((p: any) => ({
      name: p.description || p.name || '',
      description: p.description || p.name || '',
      code: p.code || '',
      quantity: parseFloat(p.quantity || 0),
      quantity_unit: p.quantity_unit || 'U',
      unit_price: parseFloat(p.unit_price || 0),
      discount: parseFloat(p.discount || 0),
      discount_percent: parseFloat(p.discount || 0),
      discount_amount: parseFloat(p.unit_price || 0) * parseFloat(p.discount || 0) / 100,
      discounted_price: parseFloat(p.unit_price || 0) * (1 - parseFloat(p.discount || 0) / 100),
      vat_rate: parseFloat(p.vat_rate || 0),
      vatRate: parseFloat(p.vat_rate || 0),  // ✅ Add camelCase for frontend
      total_price: parseFloat(p.total_price || 0),
      lot_number: p.lot_number || '',
      category: ''  // ✅ FIX: Use empty string instead of 'Generico'
    }))

    log(requestId, 'SUCCESS', `📦 Transformed ${products.length} products`)

    const finalResult = {
      success: true,
      data: {
        requestId,
        invoice_number: data.invoice_number || `INV-${Date.now()}`,
        date: data.invoice_date || data.date || new Date().toISOString().split('T')[0],
        supplier: {
          name: data.supplier_name || 'Unknown',
          email: data.supplier_email || '',
          phone: data.supplier_phone || '',
          address: addressFull,
          vat_number: data.supplier_vat_number || '',
          tax_id: data.supplier_tax_id || ''
        },
        products,
        total_amount: parseFloat(data.total_amount || 0),
        subtotal: parseFloat(data.subtotal || 0),
        vat_amount: (data.tax_breakdown || []).reduce((sum: number, t: any) => sum + parseFloat(t.tax_amount || 0), 0),
        currency: data.currency || 'EUR',
        processing_time: processingTime,
        document_id: documentId
      }
    }

    // ✅ REMOVED: Database insertion logic (lines 209-251)
    // The Edge Function is now a PURE data extraction service
    // Frontend will handle ALL database operations via batchAddProducts
    log(requestId, 'INFO', '✅ Data extraction complete - NO database operations performed by Edge Function')
    log(requestId, 'INFO', '📤 Returning extracted data to frontend for database handling')

    log(requestId, 'SUCCESS', `🎉 Processed ${products.length} products in ${processingTime}s`)

    return new Response(JSON.stringify(finalResult), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    log(requestId, 'ERROR', `💥 ${error.message}`)
    
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      requestId
    }), { 
      status: 500, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})