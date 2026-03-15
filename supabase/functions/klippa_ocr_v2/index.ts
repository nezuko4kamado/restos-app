import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const KLIPPA_API_URL = 'https://dochorizon.klippa.com/api/services/document_capturing/v1/prompt_builder/configurations/resto'

function log(requestId: string, level: string, message: string) {
  console.log(`[${new Date().toISOString()}] [${requestId}] [${level}] ${message}`)
}

/**
 * ✅ BUG 2 FIX: Check if a line item description looks like a real product.
 * Filters out non-product text like notes, phone numbers, addresses, etc.
 */
function isLikelyProduct(item: any, index: number, requestId: string): boolean {
  const description = (item.description || '').trim()
  const unitPrice = parseFloat(item.item_unitprice || item.item_price || item.unit_price || 0)
  const totalAmount = parseFloat(item.amount || 0)
  const quantity = parseFloat(item.quantity || 0)

  // Rule 1: Empty description is never a product
  if (!description || description.length === 0) {
    log(requestId, 'FILTER', `🚫 Filtered item ${index}: empty description`)
    return false
  }

  // Rule 2: If both unit price and total amount are 0 or missing, not a product
  if (unitPrice === 0 && totalAmount === 0) {
    log(requestId, 'FILTER', `🚫 Filtered item ${index}: "${description}" - both unitPrice (${unitPrice}) and amount (${totalAmount}) are 0`)
    return false
  }

  // Helper flags for product detection
  const hasUnitIndicator = /\((UN|KG|LT|PZ|CF|BT|CT|GR|ML|CL|SC|PK|BOT|BAR|PAC|BUS|FAS|SAC|VAR|RIS|BLI|TUB|ROT|FGL|PEZ|MTL|MTR|MQ|MC)\)/i.test(description)
  const hasNumericPattern = /\d+[.,]?\d*\s*(kg|g|gr|lt|l|ml|cl|pz|un|cf|bt|ct)\b/i.test(description)
  const hasReasonablePrice = unitPrice > 0.01 && totalAmount > 0
  const hasQuantity = quantity > 0

  // ✅ Rule 3 (PRIORITY): Detect non-product patterns FIRST, before price/quantity checks.
  // This prevents notes like "OJO, EL LOCAL ESTÁ CERRADO..." from passing through
  // just because Klippa assigned them a default price/quantity.
  const nonProductPatterns = [
    /^tel[\.:\s]/i,                    // Phone numbers: "tel. 691 30 49 02"
    /^\+?\d[\d\s\-\.]{7,}/,           // Raw phone numbers
    /^ojo[,\s:!]/i,                    // Notes: "OJO, EL LOCAL..."
    /\bojo\b/i,                        // Any "OJO" anywhere in text
    /^nota[:\s]/i,                     // Notes
    /^aviso[:\s]/i,                    // Notices
    /^cerrado/i,                       // "CERRADO" (closed)
    /\bcerrado\b/i,                    // "cerrado" anywhere
    /^horario/i,                       // Schedule
    /^direcci[oó]n/i,                  // Address
    /^www\./i,                         // URLs
    /^http/i,                          // URLs
    /^email/i,                         // Email labels
    /^@/,                              // Social handles
    /^\*+$/,                           // Decorative asterisks
    /^[-=_]{3,}$/,                     // Decorative lines
    /^total\b/i,                       // Total lines (should not be products)
    /^subtotal\b/i,                    // Subtotal lines
    /^iva\b/i,                         // VAT lines
    /^i\.v\.a/i,                       // VAT lines
    /^base\s*imponible/i,             // Tax base
    /^descuento\b/i,                   // Discount header
    /^dto\b/i,                         // Discount abbreviation
    /^recargo\b/i,                     // Surcharge
    /^forma\s*de\s*pago/i,            // Payment method
    /^pago\b/i,                        // Payment
    /^factura\b/i,                     // Invoice header
    /^albaran\b/i,                     // Delivery note header
    /^pedido\b/i,                      // Order header
    /^cliente\b/i,                     // Customer
    /^n[uú]mero\b/i,                  // Number header
    /^fecha\b/i,                       // Date header
    /^gracias/i,                       // Thank you message
    /^le\s*atendi[oó]/i,              // Service message
    /\bllamar\b/i,                     // "llamar" (call) - delivery notes
    /\bhay\s+que\b/i,                  // "hay que" (must) - instructions
    /\batencion\b/i,                   // "atencion" - attention notes
    /\batenci[oó]n\b/i,               // "atención" - attention notes
  ]

  for (const pattern of nonProductPatterns) {
    if (pattern.test(description)) {
      log(requestId, 'FILTER', `🚫 Filtered item ${index}: "${description}" - matches non-product pattern: ${pattern}`)
      return false
    }
  }

  // ✅ Rule 4: Detect delivery/authorization notes in multiple languages (BEFORE price check)
  const notePatterns = [
    /\bautorizad[oa]\b/i,              // "autorizado/autorizada" (Spanish)
    /\breparto\b.*\bautorizad/i,       // "reparto autorizado" (delivery authorization)
    /\besta\s+factura\b/i,             // "esta factura..." (this invoice...)
    /\bpor\s+favor\b/i,               // "por favor" (please)
    /\bobservaci[oó]n/i,              // "observación" (observation/note)
    /\bcomentario/i,                   // "comentario" (comment)
    /\bnota\s*:/i,                     // "nota:" (note:)
    /\bruta[s]?\s+de\s+la/i,          // "rutas de la" (routes of the)
    /\ba\s+la\s+(ida|vuelta)\b/i,     // "a la ida/vuelta" (on the way there/back)
    /\bel\s+local\b/i,                // "el local" - location notes
    /\best[aá]\s+cerrad/i,            // "está cerrado" - closed notes
  ]

  for (const pattern of notePatterns) {
    if (pattern.test(description)) {
      log(requestId, 'FILTER', `🚫 Filtered item ${index}: "${description}" - matches note/comment pattern: ${pattern}`)
      return false
    }
  }

  // Rule 5: Very short descriptions (1-2 chars) without a good price are suspicious
  if (description.length <= 2 && !hasReasonablePrice) {
    log(requestId, 'FILTER', `🚫 Filtered item ${index}: "${description}" - too short and no reasonable price`)
    return false
  }

  // Rule 6: If unit price is exactly 1.00 and total is exactly 1.00 and no unit indicator,
  // it's likely a default/junk value assigned to non-product text.
  if (unitPrice === 1.00 && totalAmount === 1.00 && !hasUnitIndicator && !hasNumericPattern) {
    log(requestId, 'FILTER', `🚫 Filtered item ${index}: "${description}" - suspicious default price (1.00/1.00) with no unit indicators`)
    return false
  }

  // Rule 7: Long descriptions (>60 chars) without unit indicators are likely notes/comments
  if (description.length > 60 && !hasUnitIndicator && !hasNumericPattern) {
    const wordCount = description.split(/\s+/).length
    if (wordCount >= 6) {
      log(requestId, 'FILTER', `🚫 Filtered item ${index}: "${description}" - long text (${description.length} chars, ${wordCount} words) without unit indicators, likely a note/comment`)
      return false
    }
  }

  // ✅ Rule 8: Now check positive indicators - unit indicators or numeric patterns
  if (hasUnitIndicator || hasNumericPattern) {
    return true
  }

  // Rule 9: If it has a reasonable price AND quantity, it's likely a product
  if (hasReasonablePrice && hasQuantity) {
    return true
  }

  // Default: allow items that have at least some price
  if (unitPrice > 0 || totalAmount > 0) {
    return true
  }

  log(requestId, 'FILTER', `🚫 Filtered item ${index}: "${description}" - no price data`)
  return false
}

function extractProducts(klippaData: any, requestId: string): any[] {
  const lineItems = klippaData.data?.components?.prompt_builder?.line_items || []
  
  log(requestId, 'INFO', `📦 Klippa ha restituito ${lineItems.length} line items`)
  
  const allProducts = lineItems.map((item: any, index: number) => {
    // ✅ Extract product code from item.code_product (renamed from item.code in Klippa)
    const productCode = String(item.code_product || item.code || '').trim()
    
    const description = (item.description || '').trim()
    const productName = description.length >= 1 ? description : `Prodotto ${index + 1}`
    
    // ✅ BUG 1 FIX: Support both item_unitprice (correct Klippa field) and item_price (fallback)
    const unitPrice = parseFloat(item.item_unitprice || item.item_price || item.unit_price || 0)
    const totalAmount = parseFloat(item.amount || 0)
    const quantity = parseFloat(item.quantity || 1)
    const discountPercent = parseFloat(item.discount || 0)
    
    // Calculate discounted price
    const discountedPrice = Math.round(unitPrice * (1 - discountPercent / 100) * 10000) / 10000
    const discountAmount = Math.round((unitPrice - discountedPrice) * 10000) / 10000
    
    const vatRate = parseFloat(item.Vat || 0)
    
    const product = {
      name: productName,
      line_number: index,
      quantity: quantity,
      unit: 'pz',
      unit_price: unitPrice,
      discounted_price: discountedPrice,
      discount_percent: discountPercent,
      discount_amount: discountAmount,
      vat_rate: vatRate,
      vatRate: vatRate,
      total_amount: totalAmount,
      currency: 'EUR',
      category: '',
      code_description: productCode,  // ✅ Use item.code_product (fallback: item.code) as code_description
      sku: productCode,               // ✅ Also set sku from code_product
      date: ''
    }
    
    log(requestId, 'DEBUG', `📋 Line item ${index}: "${product.name}" [CODE_PRODUCT: ${productCode}] - item_unitprice: ${item.item_unitprice}, item_price: ${item.item_price} => €${product.unit_price}/unità × ${product.quantity} = €${product.total_amount}`)
    
    return product
  })
  
  // ✅ BUG 2 FIX: Filter out non-product items
  const filteredProducts = allProducts.filter((product: any, index: number) => {
    // Re-check against the original line item data
    const originalItem = lineItems[index]
    return isLikelyProduct(originalItem, index, requestId)
  })
  
  const filteredCount = allProducts.length - filteredProducts.length
  if (filteredCount > 0) {
    log(requestId, 'INFO', `🔍 Filtered out ${filteredCount} non-product items from ${allProducts.length} total line items`)
  }
  
  log(requestId, 'SUCCESS', `✅ Estratti ${filteredProducts.length} prodotti validi (filtrati ${filteredCount} non-prodotti)`)
  
  return filteredProducts
}

function extractSupplier(klippaData: any, requestId: string): any {
  const pb = klippaData.data?.components?.prompt_builder || {}
  
  // ✅ Support both new structure (supplier_address/supplier_name) and old structure (company_address/company_name)
  const addr = pb.supplier_address || pb.company_address || {}
  
  const phone = String(addr.company_phone || '').trim()
  const email = String(addr.company_email || '').trim()
  const vatNumber = String(addr.vat_number || pb.vat_number || pb.tax_id || '').trim()
  
  // ✅ Read supplier_name first (new Klippa config), fallback to company_name (old config)
  const name = pb.supplier_name || addr.supplier_name || addr.company_name || 'Unknown Supplier'
  const address = [
    addr.street_name,
    addr.house_number,
    addr.postal_code,
    addr.city,
    addr.country
  ].filter(Boolean).join(' ')
  
  log(requestId, 'INFO', `🏢 Fornitore: ${name}`)
  log(requestId, phone ? 'SUCCESS' : 'WARNING', `📞 Phone: ${phone || '(not found)'}`)
  log(requestId, email ? 'SUCCESS' : 'WARNING', `📧 Email: ${email || '(not found)'}`)
  log(requestId, 'DEBUG', `🔢 VAT: ${vatNumber || '(not found)'}`)
  log(requestId, 'DEBUG', `📍 Address: ${address || '(not found)'}`)
  
  return {
    name,
    address,
    phone,
    mobile: '',
    email,
    vat_number: vatNumber
  }
}

function extractInvoice(klippaData: any, requestId: string): any {
  const pb = klippaData.data?.components?.prompt_builder || {}
  
  // ✅ Log ALL pb keys to identify available fields for invoice number
  log(requestId, 'INFO', `🔑 prompt_builder ALL keys: ${JSON.stringify(Object.keys(pb))}`)
  // Log non-object values for quick inspection
  const scalarFields: Record<string, any> = {}
  for (const key of Object.keys(pb)) {
    if (typeof pb[key] !== 'object' || pb[key] === null) {
      scalarFields[key] = pb[key]
    }
  }
  log(requestId, 'INFO', `🔑 prompt_builder scalar values: ${JSON.stringify(scalarFields)}`)
  
  // ✅ Also log nested objects that might contain invoice number
  if (pb.dates) log(requestId, 'INFO', `🔑 pb.dates: ${JSON.stringify(pb.dates)}`)
  if (pb.amounts) log(requestId, 'INFO', `🔑 pb.amounts: ${JSON.stringify(pb.amounts)}`)
  
  // ✅ Extract total_amount from prompt_builder
  let totalAmount = parseFloat(pb.total_amount || 0)
  
  // Fallback: calculate from line_items if not found
  if (totalAmount === 0) {
    const lineItems = pb.line_items || []
    totalAmount = lineItems.reduce((sum: number, item: any) => {
      return sum + parseFloat(item.amount || 0)
    }, 0)
    log(requestId, 'WARNING', `⚠️ Total not found in prompt_builder, calculated from line_items: €${totalAmount}`)
  }
  
  // ✅ STEP 1: Try direct prompt_builder fields
  let extractedInvoiceNumber = String(
    pb.invoice_number || 
    pb.document_number || 
    pb.order_number || 
    pb.receipt_number || 
    pb.reference_number ||
    pb.invoice_id ||
    pb.document_id ||
    pb.purchase_order_number ||
    pb.document_subject ||
    pb.delivery_note_number ||
    pb.shipment_number ||
    pb.ticket_number ||
    ''
  ).trim()
  
  log(requestId, 'INFO', `🔍 Step 1 - Direct fields: "${extractedInvoiceNumber}"`)
  log(requestId, 'INFO', `🔍 Field values: invoice_number=${pb.invoice_number}, document_number=${pb.document_number}, order_number=${pb.order_number}, receipt_number=${pb.receipt_number}, reference_number=${pb.reference_number}, purchase_order_number=${pb.purchase_order_number}, document_subject=${pb.document_subject}, delivery_note_number=${pb.delivery_note_number}`)
  
  // ✅ STEP 1.5: Check nested objects (especially pb.dates) for invoice/order numbers
  // Klippa often puts order_number inside pb.dates as a numeric value
  if (!extractedInvoiceNumber) {
    log(requestId, 'INFO', `🔍 Step 1.5 - Checking nested objects for invoice/order numbers...`)
    
    // Define which nested objects to check and which fields to look for
    const nestedObjects: Record<string, any> = {}
    for (const key of Object.keys(pb)) {
      if (pb[key] && typeof pb[key] === 'object' && !Array.isArray(pb[key])) {
        nestedObjects[key] = pb[key]
      }
    }
    
    // Fields that could contain an invoice/order number (in priority order)
    const numberFieldNames = [
      'invoice_number', 'document_number', 'order_number', 'receipt_number',
      'reference_number', 'purchase_order_number', 'delivery_note_number',
      'shipment_number', 'ticket_number', 'invoice_id', 'document_id',
      'factura_number', 'albaran_number', 'pedido_number', 'nota_number',
      'bolla_number', 'ddt_number'
    ]
    
    for (const [objName, obj] of Object.entries(nestedObjects)) {
      if (!obj || typeof obj !== 'object') continue
      
      // First pass: check known field names
      for (const fieldName of numberFieldNames) {
        const val = obj[fieldName]
        if (val !== undefined && val !== null && val !== '' && val !== 0) {
          extractedInvoiceNumber = String(val).trim()
          log(requestId, 'INFO', `🔍 Step 1.5 - Found in pb.${objName}.${fieldName}: "${extractedInvoiceNumber}" (type: ${typeof val})`)
          break
        }
      }
      if (extractedInvoiceNumber) break
      
      // Second pass: deep search through ALL fields in nested object for anything
      // with a key name containing number/invoice/order/factura/albaran etc.
      const invoiceKeyPatterns = [
        /invoice/i, /factura/i, /albaran/i, /order/i, /pedido/i, /receipt/i,
        /document.*num/i, /doc.*num/i, /reference/i, /ref.*num/i, /numero/i,
        /delivery/i, /shipment/i, /ticket/i, /nota/i, /bolla/i, /ddt/i
      ]
      
      for (const fieldKey of Object.keys(obj)) {
        const val = obj[fieldKey]
        // Skip empty/null/zero values and non-scalar values
        if (val === undefined || val === null || val === '' || val === 0) continue
        if (typeof val === 'object') continue
        
        for (const pattern of invoiceKeyPatterns) {
          if (pattern.test(fieldKey)) {
            extractedInvoiceNumber = String(val).trim()
            log(requestId, 'INFO', `🔍 Step 1.5 - Deep search found in pb.${objName}.${fieldKey}: "${extractedInvoiceNumber}" (type: ${typeof val})`)
            break
          }
        }
        if (extractedInvoiceNumber) break
      }
      if (extractedInvoiceNumber) break
    }
  }
  
  // ✅ STEP 2: Search through ALL scalar fields for anything that looks like an invoice/order number
  if (!extractedInvoiceNumber) {
    const invoiceKeyPatterns = [
      /invoice/i, /factura/i, /albaran/i, /order/i, /pedido/i, /receipt/i,
      /document.*num/i, /doc.*num/i, /reference/i, /ref.*num/i, /numero/i,
      /delivery/i, /shipment/i, /ticket/i, /nota/i, /bolla/i, /ddt/i
    ]
    
    for (const key of Object.keys(pb)) {
      const val = pb[key]
      // Check both string and numeric values
      if ((typeof val === 'string' && val.trim()) || (typeof val === 'number' && val !== 0)) {
        for (const pattern of invoiceKeyPatterns) {
          if (pattern.test(key)) {
            extractedInvoiceNumber = String(val).trim()
            log(requestId, 'INFO', `🔍 Step 2 - Found in key "${key}": "${extractedInvoiceNumber}"`)
            break
          }
        }
        if (extractedInvoiceNumber) break
      }
    }
  }
  
  // ✅ STEP 3: Try to extract from raw OCR text using regex patterns
  if (!extractedInvoiceNumber) {
    const rawText = pb.raw_text || pb.text || pb.ocr_text || ''
    
    // Also try to build raw text from all string values
    let allText = rawText
    if (!allText) {
      const textParts: string[] = []
      for (const key of Object.keys(pb)) {
        if (typeof pb[key] === 'string' && pb[key].length > 0) {
          textParts.push(pb[key])
        }
      }
      allText = textParts.join(' ')
    }
    
    if (allText) {
      log(requestId, 'INFO', `🔍 Step 3 - Searching in text (${allText.length} chars): "${allText.substring(0, 500)}"`)
      
      // Common invoice number patterns (Spanish, Italian, English, etc.)
      const invoicePatterns = [
        /(?:ALBARAN|Albarán|albarán)\s*[:\-#]?\s*(\d[\d\-\/\.]+\d)/i,
        /(?:FACTURA|Factura|factura)\s*[:\-#]?\s*(\d[\d\-\/\.]+\d)/i,
        /(?:N[ºo°]?\s*(?:de\s+)?(?:factura|pedido|albaran|albarán|orden|documento|doc))\s*[:\-#]?\s*(\d[\d\-\/\.]+\d)/i,
        /(?:Invoice|Inv)\s*[:\-#]?\s*(\d[\d\-\/\.]+\d)/i,
        /(?:Order|Pedido)\s*[:\-#]?\s*(\d[\d\-\/\.]+\d)/i,
        /(?:DDT|Bolla|Nota)\s*[:\-#]?\s*(\d[\d\-\/\.]+\d)/i,
        /(?:Delivery\s*Note)\s*[:\-#]?\s*(\d[\d\-\/\.]+\d)/i,
        /(?:Doc|Document)\s*[:\-#]?\s*(\d[\d\-\/\.]+\d)/i,
        /(?:Ref|Reference)\s*[:\-#]?\s*(\d[\d\-\/\.]+\d)/i,
      ]
      
      for (const pattern of invoicePatterns) {
        const match = allText.match(pattern)
        if (match && match[1]) {
          extractedInvoiceNumber = match[1].trim()
          log(requestId, 'INFO', `🔍 Step 3 - Regex match: "${extractedInvoiceNumber}" (pattern: ${pattern})`)
          break
        }
      }
    }
  }
  
  // ✅ STEP 4: Search in the full Klippa response for any field containing invoice-like data
  // Now handles both string values ("123") and numeric values (123)
  if (!extractedInvoiceNumber) {
    try {
      const fullJson = JSON.stringify(klippaData)
      // Search for patterns like "order_number":"VALUE" or "order_number":12345
      const jsonPatterns = [
        // Match string values: "field_name":"value"
        /"(?:invoice_number|document_number|order_number|receipt_number|reference_number|purchase_order)"\s*:\s*"([^"]+)"/i,
        // Match numeric values: "field_name":12345
        /"(?:invoice_number|document_number|order_number|receipt_number|reference_number|purchase_order)"\s*:\s*(\d+)/i,
      ]
      for (const pattern of jsonPatterns) {
        const match = fullJson.match(pattern)
        if (match && match[1] && match[1].trim() && match[1] !== 'null' && match[1] !== '0') {
          extractedInvoiceNumber = match[1].trim()
          log(requestId, 'INFO', `🔍 Step 4 - Found in full JSON: "${extractedInvoiceNumber}"`)
          break
        }
      }
    } catch (e) {
      log(requestId, 'WARNING', `⚠️ Step 4 JSON search failed: ${e}`)
    }
  }
  
  const invoiceNumber = extractedInvoiceNumber || `INV-${Date.now()}`
  
  log(requestId, 'INFO', `🔍 FINAL Invoice number: "${invoiceNumber}" (extracted: "${extractedInvoiceNumber || 'NONE - using fallback'}")`)
  
  const invoice = {
    invoice_number: invoiceNumber,
    date: pb.dates?.invoice_date || new Date().toISOString().split('T')[0],
    total_amount: totalAmount,
    vat_amount: 0,
    currency: 'EUR'
  }
  
  log(requestId, 'INFO', `📄 Fattura: ${invoice.invoice_number}, Data: ${invoice.date}, Totale: €${invoice.total_amount}`)
  
  return invoice
}

serve(async (req: Request) => {
  const requestId = crypto.randomUUID().substring(0, 8)
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders })
  }

  log(requestId, 'INFO', '🚀 KLIPPA OCR V2 - UPDATED WITH NESTED ORDER_NUMBER FIX')

  try {
    const klippaApiKey = Deno.env.get('KLIPPA_API_KEY')

    if (!klippaApiKey) {
      throw new Error('Missing KLIPPA_API_KEY')
    }

    let body
    try {
      body = await req.json()
    } catch {
      throw new Error('Invalid JSON body')
    }

    if (!body.imageBase64) {
      throw new Error('Missing imageBase64')
    }

    const base64Data = body.imageBase64.includes(',') 
      ? body.imageBase64.split(',')[1] 
      : body.imageBase64

    const startTime = Date.now()

    log(requestId, 'INFO', '📤 Chiamata a Klippa API...')
    
    const ocrResponse = await fetch(KLIPPA_API_URL, {
      method: 'POST',
      headers: { 
        'x-api-key': klippaApiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        documents: [{ data: base64Data }]
      })
    })

    if (!ocrResponse.ok) {
      const errorText = await ocrResponse.text()
      log(requestId, 'ERROR', `❌ Klippa error ${ocrResponse.status}: ${errorText}`)
      throw new Error(`Klippa API failed: ${ocrResponse.status}`)
    }

    const klippaData = await ocrResponse.json()
    
    // Log full response for debugging
    log(requestId, 'DEBUG', `📥 FULL Klippa response: ${JSON.stringify(klippaData, null, 2).substring(0, 3000)}...`)

    const products = extractProducts(klippaData, requestId)
    const supplier = extractSupplier(klippaData, requestId)
    const invoice = extractInvoice(klippaData, requestId)

    const processingTime = Math.round((Date.now() - startTime) / 1000)

    log(requestId, 'SUCCESS', `✅ Estrazione completata: ${products.length} prodotti, Totale: €${invoice.total_amount}`)
    log(requestId, supplier.phone ? 'SUCCESS' : 'WARNING', `📞 Phone: ${supplier.phone ? 'YES ✅' : 'NO ❌'}`)
    log(requestId, supplier.email ? 'SUCCESS' : 'WARNING', `📧 Email: ${supplier.email ? 'YES ✅' : 'NO ❌'}`)
    log(requestId, 'SUCCESS', `🎉 Completato in ${processingTime}s`)

    return new Response(JSON.stringify({
      success: true,
      data: {
        requestId,
        invoice_number: invoice.invoice_number,
        date: invoice.date,
        supplier,
        products,
        total_amount: invoice.total_amount,
        currency: invoice.currency,
        processing_time: processingTime,
        method: 'klippa_v2_nested_order_fix'
      }
    }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    log(requestId, 'ERROR', `💥 Error: ${error.message}`)
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