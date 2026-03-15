import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const GOOGLE_CLOUD_PROJECT_ID = Deno.env.get('GOOGLE_CLOUD_PROJECT_ID')!
const GOOGLE_SERVICE_ACCOUNT_EMAIL = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_EMAIL')!
const GOOGLE_PRIVATE_KEY = Deno.env.get('GOOGLE_PRIVATE_KEY')!

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
    id?: string
    phone?: string
  }
  orderItems: OrderItem[]
  totalAmount: number
  error?: string
}

interface VisionBlock {
  text: string
  boundingBox: {
    vertices: Array<{ x: number; y: number }>
  }
}

/**
 * Calculate similarity between two strings using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim()
  const s2 = str2.toLowerCase().trim()
  
  if (s1 === s2) return 1.0
  
  // Simple fuzzy matching: check if one contains the other
  if (s1.includes(s2) || s2.includes(s1)) {
    return 0.8
  }
  
  // Levenshtein distance
  const matrix: number[][] = []
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j
  }
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      if (s1[i - 1] === s2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  const distance = matrix[s1.length][s2.length]
  const maxLength = Math.max(s1.length, s2.length)
  return 1 - distance / maxLength
}

/**
 * Generate OAuth 2.0 token for Google Cloud API
 */
async function generateGoogleOAuthToken(): Promise<string> {
  const header = {
    alg: 'RS256',
    typ: 'JWT',
  }

  const now = Math.floor(Date.now() / 1000)
  const claim = {
    iss: GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: 'https://www.googleapis.com/auth/cloud-platform',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now,
  }

  const encodedHeader = btoa(JSON.stringify(header))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
  const encodedClaim = btoa(JSON.stringify(claim))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  const signatureInput = `${encodedHeader}.${encodedClaim}`

  // Import the private key - handle both literal \n and actual newlines
  let pemKey = GOOGLE_PRIVATE_KEY
  
  // Replace literal \n with actual newlines if they exist as string
  if (pemKey.includes('\\n')) {
    pemKey = pemKey.replace(/\\n/g, '\n')
  }
  
  // Extract the base64 content between the PEM headers
  const pemHeader = '-----BEGIN PRIVATE KEY-----'
  const pemFooter = '-----END PRIVATE KEY-----'
  
  // Remove headers, footers, and all whitespace
  let pemContents = pemKey
    .replace(pemHeader, '')
    .replace(pemFooter, '')
    .replace(/\s+/g, '')  // Remove all whitespace including newlines
    .trim()

  console.log('🔑 [OAuth] PEM contents length after cleanup:', pemContents.length)

  // Convert base64 to binary
  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0))

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    binaryKey,
    {
      name: 'RSASSA-PKCS1-v1_5',
      hash: 'SHA-256',
    },
    false,
    ['sign']
  )

  // Sign the JWT
  const encoder = new TextEncoder()
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    encoder.encode(signatureInput)
  )

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  const jwt = `${signatureInput}.${encodedSignature}`

  // Exchange JWT for access token
  const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  })

  const tokenData = await tokenResponse.json()
  return tokenData.access_token
}

/**
 * Extract text from image using Google Cloud Vision API with position information
 */
async function extractTextWithGoogleVision(base64Image: string, accessToken: string): Promise<{ 
  fullText: string
  blocks: VisionBlock[]
  imageHeight: number 
}> {
  console.log('🔍 [Google Vision] Starting text detection...')
  const startTime = Date.now()
  
  try {
    const visionResponse = await fetch(
      'https://vision.googleapis.com/v1/images:annotate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          requests: [
            {
              image: {
                content: base64Image,
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
    const endTime = Date.now()
    console.log(`⏱️ [Google Vision] Text detection completed in ${(endTime - startTime) / 1000} seconds`)

    const textAnnotations = visionData.responses[0]?.textAnnotations || []
    
    if (textAnnotations.length === 0) {
      throw new Error('No text detected in image')
    }

    // First annotation is the full text
    const fullText = textAnnotations[0]?.description || ''
    console.log(`📝 [Google Vision] Extracted ${fullText.length} characters`)

    // Get image height from first annotation's bounding box
    const vertices = textAnnotations[0]?.boundingPoly?.vertices || []
    const imageHeight = Math.max(...vertices.map((v: any) => v.y || 0))
    console.log(`📏 [Google Vision] Image height: ${imageHeight}px`)

    // Extract blocks (skip first annotation which is full text)
    const blocks: VisionBlock[] = textAnnotations.slice(1).map((annotation: any) => ({
      text: annotation.description || '',
      boundingBox: annotation.boundingPoly || { vertices: [] }
    }))

    console.log(`📊 [Google Vision] Extracted ${blocks.length} text blocks`)

    return {
      fullText,
      blocks,
      imageHeight
    }
  } catch (error) {
    console.error('❌ [Google Vision] Error:', error)
    throw new Error(`Google Vision text detection failed: ${error.message}`)
  }
}

/**
 * Structure text by vertical position (top, middle, bottom sections)
 */
function structureTextByPosition(blocks: VisionBlock[], imageHeight: number): {
  header: string
  productLines: string[]
  footer: string
} {
  console.log('📐 [Text Structuring] Organizing text by position...')
  
  // Define sections based on Y position
  const headerThreshold = imageHeight * 0.20  // Top 20%
  const footerThreshold = imageHeight * 0.80  // Bottom 20%
  
  const headerBlocks: VisionBlock[] = []
  const middleBlocks: VisionBlock[] = []
  const footerBlocks: VisionBlock[] = []
  
  // Classify blocks into sections based on Y position
  for (const block of blocks) {
    const vertices = block.boundingBox.vertices || []
    if (vertices.length === 0) continue
    
    // Get average Y position
    const avgY = vertices.reduce((sum, v) => sum + (v.y || 0), 0) / vertices.length
    
    if (avgY < headerThreshold) {
      headerBlocks.push(block)
    } else if (avgY > footerThreshold) {
      footerBlocks.push(block)
    } else {
      middleBlocks.push(block)
    }
  }
  
  // Sort blocks by Y position, then X position
  const sortBlocks = (blocks: VisionBlock[]) => {
    return blocks.sort((a, b) => {
      const aVertices = a.boundingBox.vertices || []
      const bVertices = b.boundingBox.vertices || []
      
      if (aVertices.length === 0 || bVertices.length === 0) return 0
      
      const aY = aVertices.reduce((sum, v) => sum + (v.y || 0), 0) / aVertices.length
      const bY = bVertices.reduce((sum, v) => sum + (v.y || 0), 0) / bVertices.length
      const aX = aVertices.reduce((sum, v) => sum + (v.x || 0), 0) / aVertices.length
      const bX = bVertices.reduce((sum, v) => sum + (v.x || 0), 0) / bVertices.length
      
      // Same line if within 15px vertically
      if (Math.abs(aY - bY) < 15) {
        return aX - bX
      }
      return aY - bY
    })
  }
  
  const sortedMiddle = sortBlocks(middleBlocks)
  
  // Group middle blocks into lines (products)
  const productLines: string[] = []
  let currentLine: string[] = []
  let lastY = -1
  
  for (const block of sortedMiddle) {
    const vertices = block.boundingBox.vertices || []
    if (vertices.length === 0) continue
    
    const avgY = vertices.reduce((sum, v) => sum + (v.y || 0), 0) / vertices.length
    
    if (lastY === -1 || Math.abs(avgY - lastY) < 15) {
      // Same line
      currentLine.push(block.text)
      lastY = avgY
    } else {
      // New line
      if (currentLine.length > 0) {
        const lineText = currentLine.join(' ')
        if (lineText.trim().length > 2) {
          productLines.push(lineText)
        }
      }
      currentLine = [block.text]
      lastY = avgY
    }
  }
  
  // Add last line
  if (currentLine.length > 0) {
    const lineText = currentLine.join(' ')
    if (lineText.trim().length > 2) {
      productLines.push(lineText)
    }
  }
  
  const header = sortBlocks(headerBlocks).map(b => b.text).join(' ')
  const footer = sortBlocks(footerBlocks).map(b => b.text).join(' ')
  
  console.log(`📊 [Text Structuring] Header (${header.length} chars): ${header.substring(0, 100)}...`)
  console.log(`📊 [Text Structuring] Product lines: ${productLines.length}`)
  console.log(`📊 [Text Structuring] Footer (${footer.length} chars): ${footer.substring(0, 100)}...`)
  
  // Log first few product lines for debugging
  console.log('📋 [Text Structuring] First 5 product lines:')
  productLines.slice(0, 5).forEach((line, i) => {
    console.log(`   ${i + 1}. ${line}`)
  })
  
  return { header, productLines, footer }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🚀 [Google Vision + GPT-4 OCR] Starting order extraction...')

    const { image } = await req.json()

    if (!image) {
      throw new Error('No image provided')
    }

    // Get authorization header for user authentication
    const authHeader = req.headers.get('authorization') || req.headers.get('Authorization')
    console.log('🔐 [Auth] Authorization header present:', !!authHeader)
    
    if (!authHeader) {
      throw new Error('Authorization header missing')
    }

    // Extract JWT token
    const token = authHeader.replace('Bearer ', '')
    console.log('🔐 [Auth] Token extracted (first 20 chars):', token.substring(0, 20))

    // Use service role key to verify the user token and get user_id
    const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !user) {
      console.error('❌ [Auth] Failed to verify user:', userError)
      throw new Error('User authentication failed')
    }

    console.log('✅ [Auth] User authenticated:', user.id)

    // Extract base64 content (remove data URL prefix if present)
    const base64Content = image.includes(',') ? image.split(',')[1] : image
    console.log('📄 [Image] Base64 size:', base64Content.length)

    // Fetch existing suppliers from database for GPT-4 context
    const { data: existingSuppliers, error: suppliersError } = await supabaseAdmin
      .from('suppliers')
      .select('id, name')
      .eq('user_id', user.id)

    if (suppliersError) {
      console.error('❌ [Supplier Fetch] Error fetching suppliers:', suppliersError)
    }

    console.log('📊 [Supplier Fetch] Found', existingSuppliers?.length || 0, 'existing suppliers')

    // Build supplier list for GPT-4
    const supplierList = existingSuppliers && existingSuppliers.length > 0
      ? existingSuppliers.map(s => s.name).join(', ')
      : 'No existing suppliers'

    // STEP 1: Generate Google OAuth token
    console.log('🔑 [Google Auth] Generating OAuth token...')
    const accessToken = await generateGoogleOAuthToken()
    console.log('✅ [Google Auth] Token generated successfully')

    // STEP 2: Extract text using Google Cloud Vision API
    const visionStartTime = Date.now()
    const { fullText, blocks, imageHeight } = await extractTextWithGoogleVision(base64Content, accessToken)
    const visionEndTime = Date.now()
    console.log(`⏱️ [Performance] Google Vision took: ${(visionEndTime - visionStartTime) / 1000} seconds`)

    // STEP 3: Structure text by position
    const { header, productLines, footer } = structureTextByPosition(blocks, imageHeight)

    // STEP 4: Use GPT-4 (text-only) to parse structured data
    console.log('🤖 [GPT-4 Text] Analyzing extracted text...')
    console.log('🎯 [Optimization] Using GPT-4 text-only (faster and cheaper than Vision)')
    const gptStartTime = Date.now()
    
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
            content: `You are an expert at parsing Italian handwritten order documents that have been OCR'd.

SUPPLIER NAME (FROM HEADER):
- Look for company names in the header section
- Common names: GBG, CBG, COMERCIAL CBG
- Existing suppliers: ${supplierList}
- Match to existing suppliers when similar
- Use "Unknown Supplier" if no clear name found

PRODUCTS (FROM PRODUCT LINES):
- Each line represents one product
- Extract ALL products (expect ~16 items)
- Accept OCR errors and misspellings
- Quantity formats: "2x", "2 pz", "2kg" → extract number
- Product names: accept partial/misspelled names
- Units: kg, pz, lt, conf, gr, cato
- Use 0 for missing prices/totals

COMMON OCR ERRORS:
"Rigatons"→"Rigatoni", "Kicotta"→"Ricotta", "Foccaccia"→"Focaccia", "Ol!ve"→"Olive", "ACC:CUNAS"→"Aceitunas", "Bresoola"→"Bresaola", "verolicio"→"Valpolicella", "Berenjeho"→"Berenjena", "Piemiento Asodo"→"Pimiento Asado", "toute verry"→"Tomate Cherry", "Gengibre"→"Jengibre"

Return ONLY valid JSON:
{
  "supplier": {"name": "...", "phone": "..." or null},
  "orderItems": [{"name": "...", "quantity": 2, "price": 0, "unit": "kg", "vatRate": null, "totalLine": 0}],
  "totalAmount": 0
}

Extract ALL products even if incomplete.`,
          },
          {
            role: 'user',
            content: `Extract order information from this OCR'd Italian handwritten order document.

HEADER SECTION (Supplier info):
${header}

PRODUCT LINES (one per line):
${productLines.join('\n')}

FOOTER SECTION (Totals):
${footer}

Extract the supplier name from the header, all products from the product lines, and total from footer.`
          }
        ],
        temperature: 0.1,
        max_tokens: 2500,
      }),
    })

    const gptEndTime = Date.now()
    console.log(`⏱️ [Performance] GPT-4 took: ${(gptEndTime - gptStartTime) / 1000} seconds`)
    console.log(`⏱️ [Performance] Total time: ${(gptEndTime - visionStartTime) / 1000} seconds`)

    if (!gptResponse.ok) {
      const errorText = await gptResponse.text()
      console.error('❌ [GPT-4] API Error:', errorText)
      throw new Error(`GPT-4 API error: ${gptResponse.status}`)
    }

    const gptData = await gptResponse.json()
    console.log('✅ [GPT-4] Analysis completed')

    const gptContent = gptData.choices[0]?.message?.content || ''
    console.log('📝 [GPT-4] Raw response length:', gptContent.length)
    
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

    // Validate product count
    console.log('📊 [GPT-4] Products found:', structuredData.orderItems?.length || 0)
    if ((structuredData.orderItems?.length || 0) < 15) {
      console.warn('⚠️ [GPT-4] Expected ~16 products, found only', structuredData.orderItems?.length)
      console.warn('⚠️ [GPT-4] This may indicate some products were not detected')
    }

    // Extract supplier name from GPT-4 response
    const extractedSupplierName = structuredData.supplier?.name || 'Unknown Supplier'
    console.log('🏢 [Supplier] Extracted from GPT-4:', extractedSupplierName)

    // Find best match using fuzzy matching
    let matchedSupplier: { id: string; name: string } | null = null
    let bestSimilarity = 0

    if (existingSuppliers && existingSuppliers.length > 0 && extractedSupplierName !== 'Unknown Supplier') {
      for (const supplier of existingSuppliers) {
        const similarity = calculateSimilarity(extractedSupplierName, supplier.name)
        console.log(`🔍 [Supplier Matching] "${extractedSupplierName}" vs "${supplier.name}": ${(similarity * 100).toFixed(1)}%`)
        
        if (similarity > bestSimilarity) {
          bestSimilarity = similarity
          matchedSupplier = supplier
        }
      }
    }

    // Use matched supplier if similarity >= 60%, otherwise use GPT-4 extracted name
    let finalSupplierName = extractedSupplierName
    let finalSupplierId: string | undefined = undefined

    if (matchedSupplier && bestSimilarity >= 0.6) {
      finalSupplierName = matchedSupplier.name
      finalSupplierId = matchedSupplier.id
      console.log(`✅ [Supplier Matching] Match found: "${extractedSupplierName}" → "${finalSupplierName}" (${(bestSimilarity * 100).toFixed(1)}%)`)
    } else {
      console.log(`⚠️ [Supplier Matching] No match found for "${extractedSupplierName}" (best: ${(bestSimilarity * 100).toFixed(1)}%)`)
      console.log(`⚠️ [Supplier Matching] Using GPT-4 extracted name: "${finalSupplierName}"`)
    }

    // Validate and format the response
    const result: OCRResult = {
      success: true,
      supplier: {
        name: finalSupplierName,
        id: finalSupplierId,
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

    console.log('✅ [Google Vision + GPT-4 OCR] Extraction completed successfully')
    console.log('📊 [Results] Supplier:', result.supplier.name, '(ID:', result.supplier.id || 'none', ')')
    console.log('📊 [Results] Items extracted:', result.orderItems.length)
    console.log('📊 [Results] Total amount:', result.totalAmount)
    console.log('📊 [Results] All items:', result.orderItems.map(item => `${item.name} x${item.quantity}`).join(', '))

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error) {
    console.error('❌ [Google Vision + GPT-4 OCR] Error:', error)
    
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