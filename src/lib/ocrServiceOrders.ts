import { supabase } from './supabase'
import { preprocessImageForOCR } from '@/lib/imagePreprocessor'
import { compressImageForOCR } from '@/lib/imageCompression'

export interface OrderItem {
  name: string
  quantity: number
  price: number
  unit?: string
  vatRate?: number
  totalLine: number
}

export interface OrderOCRResult {
  success: boolean
  supplier: {
    name: string
    phone?: string
  }
  orderItems: OrderItem[]
  totalAmount: number
  error?: string
}

export type OCRProvider = 'google_vision' | 'google_document_ai'

/**
 * Converts a File/Blob to a clean base64 string (without the data URL prefix).
 * Uses ArrayBuffer approach to avoid potential issues with FileReader.readAsDataURL.
 */
async function fileToCleanBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const arrayBuffer = reader.result as ArrayBuffer
        const bytes = new Uint8Array(arrayBuffer)
        // Convert to base64 in chunks to avoid call stack issues with large files
        let binary = ''
        const chunkSize = 8192
        for (let i = 0; i < bytes.length; i += chunkSize) {
          const chunk = bytes.subarray(i, i + chunkSize)
          binary += String.fromCharCode(...chunk)
        }
        const base64 = btoa(binary)
        
        // Validate the base64 string
        if (!base64 || base64.length === 0) {
          reject(new Error('Base64 conversion produced empty string'))
          return
        }
        
        console.log(`📊 [Order OCR] Base64 length: ${base64.length} chars (clean, no prefix)`)
        resolve(base64)
      } catch (error) {
        reject(new Error(`Base64 conversion failed: ${error instanceof Error ? error.message : 'Unknown error'}`))
      }
    }
    reader.onerror = () => reject(new Error('FileReader error during base64 conversion'))
    reader.readAsArrayBuffer(file)
  })
}

/**
 * Extracts order data from an image using the specified OCR provider
 * @param file - The image file to process
 * @param provider - OCR provider to use ('google_vision' or 'google_document_ai')
 * @returns Structured order data
 */
export async function extractOrderFromImage(
  file: File,
  provider: OCRProvider = 'google_document_ai'
): Promise<OrderOCRResult> {
  try {
    console.log(`🔍 [Order OCR] Starting order extraction with ${provider}...`)
    console.log('📄 [Order OCR] File:', file.name, `(${(file.size / 1024).toFixed(2)} KB)`)

    // Step 1: Preprocess the image (auto-rotate, enhance, optimize)
    console.log('🖼️ [Order OCR] Starting image preprocessing...')
    let processedFile: File
    try {
      const preprocessingResult = await preprocessImageForOCR(file)
      console.log(`✅ [Order OCR] Preprocessing complete: ${preprocessingResult.improvements.join(', ')}`)
      console.log(`📊 [Order OCR] Size after preprocessing: ${(preprocessingResult.originalSize / 1024).toFixed(2)} KB → ${(preprocessingResult.processedSize / 1024).toFixed(2)} KB`)
      processedFile = preprocessingResult.processedFile
    } catch (preprocessError) {
      console.warn('⚠️ [Order OCR] Preprocessing failed, using original file:', preprocessError)
      processedFile = file
    }

    // Step 2: Compress the preprocessed image (currently a no-op but kept for future use)
    console.log('🗜️ [Order OCR] Compressing preprocessed image...')
    let finalFile: File
    try {
      const compressionResult = await compressImageForOCR(processedFile)
      console.log(`✅ [Order OCR] Compression complete: ${(compressionResult.originalSize / 1024).toFixed(2)} KB → ${(compressionResult.compressedSize / 1024).toFixed(2)} KB (ratio: ${compressionResult.compressionRatio.toFixed(2)})`)
      finalFile = compressionResult.compressedFile
    } catch (compressError) {
      console.warn('⚠️ [Order OCR] Compression failed, using preprocessed file:', compressError)
      finalFile = processedFile
    }

    // Step 3: Convert to clean base64 (without data URL prefix)
    console.log('🔄 [Order OCR] Converting image to base64...')
    const base64Image = await fileToCleanBase64(finalFile)

    // Step 4: Get current session to pass auth token
    console.log('🔐 [Order OCR] Getting authentication token...')
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session) {
      throw new Error('User not authenticated - please log in again')
    }
    
    console.log('✅ [Order OCR] Authentication token obtained')

    // Step 5: Call the appropriate OCR Edge Function with auth token
    const functionName = provider === 'google_vision' ? 'google_vision_ocr' : 'google_document_ai_ocr'
    console.log(`📡 [Order OCR] Calling ${functionName}...`)
    
    const { data, error } = await supabase.functions.invoke(functionName, {
      body: { image: base64Image },
      headers: {
        Authorization: `Bearer ${session.access_token}`,
      },
    })

    if (error) {
      console.error(`❌ [Order OCR] ${functionName} error:`, error)
      throw new Error(`OCR processing failed: ${error.message}`)
    }

    if (!data || !data.success) {
      console.error('❌ [Order OCR] Extraction failed:', data?.error)
      throw new Error(data?.error || 'Failed to extract order data')
    }

    console.log('✅ [Order OCR] Extraction successful!')
    console.log('📊 [Order OCR] Supplier:', data.supplier.name)
    console.log('📊 [Order OCR] Items:', data.orderItems.length)
    console.log('📊 [Order OCR] Total:', data.totalAmount)

    return data as OrderOCRResult
  } catch (error) {
    console.error('❌ [Order OCR] Error:', error)
    throw error
  }
}

/**
 * Validates order data before saving
 */
export function validateOrderData(data: OrderOCRResult): boolean {
  if (!data.supplier?.name) {
    console.error('❌ [Validation] Missing supplier name')
    return false
  }

  if (!data.orderItems || data.orderItems.length === 0) {
    console.error('❌ [Validation] No order items found')
    return false
  }

  for (const item of data.orderItems) {
    if (!item.name || item.quantity <= 0 || item.price < 0) {
      console.error('❌ [Validation] Invalid item data:', item)
      return false
    }
  }

  return true
}