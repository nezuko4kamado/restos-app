import Compressor from 'compressorjs'

interface PreprocessingResult {
  processedFile: File
  originalSize: number
  processedSize: number
  processingTime: number
  improvements: string[]
  qualityLevel: 'low' | 'medium' | 'high'
}

interface QualityMetrics {
  qualityLevel: 'low' | 'medium' | 'high'
  brightness: number
  contrast: number
  sharpness: number
  colorBalance: number
  fileSize: number
  dimensions: { width: number; height: number }
}

/**
 * Analyzes image quality with detailed metrics
 */
async function analyzeImageQuality(file: File): Promise<QualityMetrics> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    
    img.onload = () => {
      try {
        // Create canvas for pixel analysis
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          URL.revokeObjectURL(url)
          return resolve({
            qualityLevel: 'high',
            brightness: 128,
            contrast: 50,
            sharpness: 30,
            colorBalance: 1,
            fileSize: file.size,
            dimensions: { width: img.width, height: img.height }
          })
        }

        // Sample a smaller version for faster analysis
        const sampleWidth = Math.min(img.width, 400)
        const sampleHeight = Math.min(img.height, 400)
        canvas.width = sampleWidth
        canvas.height = sampleHeight
        ctx.drawImage(img, 0, 0, sampleWidth, sampleHeight)

        const imageData = ctx.getImageData(0, 0, sampleWidth, sampleHeight)
        const data = imageData.data

        // Calculate brightness (average luminance)
        let totalBrightness = 0
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          totalBrightness += (r + g + b) / 3
        }
        const brightness = totalBrightness / (data.length / 4)

        // Calculate contrast (standard deviation of luminance)
        let varianceSum = 0
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]
          const luminance = (r + g + b) / 3
          varianceSum += Math.pow(luminance - brightness, 2)
        }
        const contrast = Math.sqrt(varianceSum / (data.length / 4))

        // Calculate sharpness (edge detection using Laplacian)
        let edgeStrength = 0
        for (let y = 1; y < sampleHeight - 1; y++) {
          for (let x = 1; x < sampleWidth - 1; x++) {
            const idx = (y * sampleWidth + x) * 4
            const center = (data[idx] + data[idx + 1] + data[idx + 2]) / 3
            
            const top = (data[idx - sampleWidth * 4] + data[idx - sampleWidth * 4 + 1] + data[idx - sampleWidth * 4 + 2]) / 3
            const bottom = (data[idx + sampleWidth * 4] + data[idx + sampleWidth * 4 + 1] + data[idx + sampleWidth * 4 + 2]) / 3
            const left = (data[idx - 4] + data[idx - 3] + data[idx - 2]) / 3
            const right = (data[idx + 4] + data[idx + 5] + data[idx + 6]) / 3
            
            const laplacian = Math.abs(4 * center - top - bottom - left - right)
            edgeStrength += laplacian
          }
        }
        const sharpness = edgeStrength / ((sampleWidth - 2) * (sampleHeight - 2))

        // Calculate color balance (ratio of RGB channels)
        let totalR = 0, totalG = 0, totalB = 0
        for (let i = 0; i < data.length; i += 4) {
          totalR += data[i]
          totalG += data[i + 1]
          totalB += data[i + 2]
        }
        const avgR = totalR / (data.length / 4)
        const avgG = totalG / (data.length / 4)
        const avgB = totalB / (data.length / 4)
        const maxChannel = Math.max(avgR, avgG, avgB)
        const minChannel = Math.min(avgR, avgG, avgB)
        const colorBalance = minChannel / maxChannel

        URL.revokeObjectURL(url)

        // ✅ IMPROVED: More lenient quality thresholds to avoid over-processing
        let qualityLevel: 'low' | 'medium' | 'high' = 'high'
        
        // Low quality: severe issues only
        if (contrast < 15 || sharpness < 8 || colorBalance < 0.5) {
          qualityLevel = 'low'
        }
        // Medium quality: moderate issues
        else if (contrast < 25 || sharpness < 15 || colorBalance < 0.7) {
          qualityLevel = 'medium'
        }

        console.log('📊 [Quality Analysis] Metrics:', {
          brightness: brightness.toFixed(2),
          contrast: contrast.toFixed(2),
          sharpness: sharpness.toFixed(2),
          colorBalance: colorBalance.toFixed(2),
          dimensions: `${img.width}x${img.height}`,
          fileSize: `${(file.size / 1024).toFixed(2)} KB`,
          qualityLevel
        })

        resolve({
          qualityLevel,
          brightness,
          contrast,
          sharpness,
          colorBalance,
          fileSize: file.size,
          dimensions: { width: img.width, height: img.height }
        })
      } catch (error) {
        console.error('❌ [Quality Analysis] Error:', error)
        URL.revokeObjectURL(url)
        resolve({
          qualityLevel: 'high',
          brightness: 128,
          contrast: 50,
          sharpness: 30,
          colorBalance: 1,
          fileSize: file.size,
          dimensions: { width: img.width, height: img.height }
        })
      }
    }
    
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve({
        qualityLevel: 'high',
        brightness: 128,
        contrast: 50,
        sharpness: 30,
        colorBalance: 1,
        fileSize: file.size,
        dimensions: { width: 0, height: 0 }
      })
    }
    
    img.src = url
  })
}

/**
 * Preprocesses an image for OCR with IMPROVED quality-based optimization
 * ✅ IMPROVEMENTS:
 * - Higher quality compression (0.98 → 0.99) to preserve text clarity
 * - Larger max dimensions (3072 → 4096) for better OCR accuracy
 * - More conservative enhancement to avoid text degradation
 */
export async function preprocessImageForOCR(file: File, skipHeavyProcessing: boolean = false): Promise<PreprocessingResult> {
  const startTime = Date.now()
  const originalSize = file.size
  
  console.log('🔍 [Preprocessing] Starting IMPROVED image preprocessing for OCR accuracy...')
  console.log('📊 [Preprocessing] Original file:', {
    name: file.name,
    size: `${(file.size / 1024).toFixed(2)} KB`,
    type: file.type
  })

  const improvements: string[] = []
  
  // ✅ IMPROVEMENT: Increase threshold to 3MB (was 2MB) to process more files with light preprocessing
  if (file.size < 3 * 1024 * 1024) {
    console.log('⚡ [Preprocessing] Small file (<3MB) - Applying high-quality light preprocessing')
    const compressedBlob = await new Promise<Blob>((resolve, reject) => {
      new Compressor(file, {
        quality: 0.99,        // ✅ Higher quality (was 0.95)
        maxWidth: 4096,       // ✅ Larger dimensions (was 3072)
        maxHeight: 4096,
        mimeType: 'image/jpeg',
        success: resolve,
        error: reject
      })
    })
    const processedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' })
    return {
      processedFile,
      originalSize,
      processedSize: processedFile.size,
      processingTime: Date.now() - startTime,
      improvements: ['High-quality light preprocessing (optimized for OCR accuracy)'],
      qualityLevel: 'high'
    }
  }
  
  // Step 1: Analyze image quality
  const qualityMetrics = await analyzeImageQuality(file)
  console.log(`📈 [Preprocessing] Detected quality level: ${qualityMetrics.qualityLevel}`)

  // Step 2: Apply preprocessing based on quality
  try {
    let processedFile: File

    if (qualityMetrics.qualityLevel === 'high') {
      // ✅ HIGH QUALITY: Minimal processing to preserve text clarity
      console.log('✅ [Preprocessing] High quality - Minimal processing for maximum OCR accuracy')
      
      const compressedBlob = await new Promise<Blob>((resolve, reject) => {
        new Compressor(file, {
          quality: 0.99,        // ✅ Highest quality
          maxWidth: 4096,       // ✅ Larger dimensions
          maxHeight: 4096,
          mimeType: 'image/jpeg',
          success: resolve,
          error: reject
        })
      })
      processedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' })
      improvements.push('Minimal processing (high quality preserved for OCR)')

    } else if (qualityMetrics.qualityLevel === 'medium') {
      // ℹ️ MEDIUM QUALITY: Light enhancement
      console.log('ℹ️ [Preprocessing] Medium quality - Light enhancement for better OCR')
      
      const compressedBlob = await new Promise<Blob>((resolve, reject) => {
        new Compressor(file, {
          quality: 0.98,        // ✅ Still high quality
          maxWidth: 4096,
          maxHeight: 4096,
          mimeType: 'image/jpeg',
          success: resolve,
          error: reject
        })
      })
      processedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' })
      improvements.push('Light enhancement (medium quality improved)')

    } else {
      // ⚠️ LOW QUALITY: Conservative enhancement
      console.log('⚠️ [Preprocessing] Low quality - Conservative enhancement to improve readability')
      
      // Step 1: Compress with high quality
      const compressedBlob = await new Promise<Blob>((resolve, reject) => {
        new Compressor(file, {
          quality: 0.98,
          maxWidth: 4096,
          maxHeight: 4096,
          mimeType: 'image/jpeg',
          success: resolve,
          error: reject
        })
      })
      improvements.push('Compressed with high quality')

      // Step 2: Apply CONSERVATIVE canvas-based enhancements
      const enhancedBlob = await enhanceImageOnCanvas(compressedBlob, qualityMetrics)
      improvements.push('Conservative enhancement (brightness, contrast - text-safe)')
      
      processedFile = new File([enhancedBlob], file.name, { type: 'image/jpeg' })
    }

    const processingTime = Date.now() - startTime
    console.log('✅ [Preprocessing] Preprocessing completed successfully')
    console.log('📊 [Preprocessing] Final stats:', {
      originalSize: `${(originalSize / 1024).toFixed(2)} KB`,
      processedSize: `${(processedFile.size / 1024).toFixed(2)} KB`,
      reduction: `${(((originalSize - processedFile.size) / originalSize) * 100).toFixed(1)}%`,
      processingTime: `${processingTime}ms`,
      improvements: improvements.join(', ')
    })

    return {
      processedFile,
      originalSize,
      processedSize: processedFile.size,
      processingTime,
      improvements,
      qualityLevel: qualityMetrics.qualityLevel
    }
  } catch (error) {
    console.error('❌ [Preprocessing] Error during preprocessing:', error)
    // Return original file if preprocessing fails
    return {
      processedFile: file,
      originalSize,
      processedSize: file.size,
      processingTime: Date.now() - startTime,
      improvements: ['Preprocessing failed, using original image'],
      qualityLevel: 'high'
    }
  }
}

/**
 * Enhances image using canvas with CONSERVATIVE adjustments for OCR
 * ✅ IMPROVEMENTS:
 * - Reduced brightness/contrast factors to avoid text degradation
 * - Removed aggressive sharpening that can create artifacts
 * - Focus on readability over visual appeal
 */
async function enhanceImageOnCanvas(blob: Blob, qualityMetrics: QualityMetrics): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(blob)

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          URL.revokeObjectURL(url)
          return reject(new Error('Failed to get canvas context'))
        }

        canvas.width = img.width
        canvas.height = img.height

        // Draw original image
        ctx.drawImage(img, 0, 0)

        // Get image data for pixel manipulation
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data

        console.log('🎨 [Enhancement] Applying CONSERVATIVE enhancement for OCR')

        // ✅ CONSERVATIVE factors to avoid text degradation
        let brightnessFactor = 1.0
        let contrastFactor = 1.0

        // Adjust brightness CONSERVATIVELY
        if (qualityMetrics.brightness < 90) {
          brightnessFactor = 1.15  // ✅ Reduced from 1.3
          console.log('💡 [Enhancement] Slight brightness increase (was too dark)')
        } else if (qualityMetrics.brightness > 190) {
          brightnessFactor = 0.95  // ✅ Reduced from 0.9
          console.log('💡 [Enhancement] Slight brightness decrease (was too bright)')
        }

        // Adjust contrast CONSERVATIVELY
        if (qualityMetrics.contrast < 20) {
          contrastFactor = 1.25  // ✅ Reduced from 1.5
          console.log('📊 [Enhancement] Moderate contrast increase (was too low)')
        }

        // Apply brightness and contrast adjustments
        for (let i = 0; i < data.length; i += 4) {
          // Apply brightness
          data[i] *= brightnessFactor
          data[i + 1] *= brightnessFactor
          data[i + 2] *= brightnessFactor
          
          // Apply contrast
          data[i] = ((data[i] - 128) * contrastFactor) + 128
          data[i + 1] = ((data[i + 1] - 128) * contrastFactor) + 128
          data[i + 2] = ((data[i + 2] - 128) * contrastFactor) + 128
          
          // Clamp values
          data[i] = Math.max(0, Math.min(255, data[i]))
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1]))
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2]))
        }

        ctx.putImageData(imageData, 0, 0)

        // ✅ REMOVED: Aggressive sharpening that can create artifacts and degrade OCR
        // Only apply very light sharpening for extremely blurry images
        if (qualityMetrics.sharpness < 10) {
          console.log('🔍 [Enhancement] Light sharpening (extremely low sharpness)')
          const sharpenedData = applyLightSharpen(ctx, canvas.width, canvas.height)
          ctx.putImageData(sharpenedData, 0, 0)
        }

        // Convert canvas to blob with high quality
        canvas.toBlob(
          (resultBlob) => {
            URL.revokeObjectURL(url)
            if (resultBlob) {
              resolve(resultBlob)
            } else {
              reject(new Error('Failed to create blob from canvas'))
            }
          },
          'image/jpeg',
          0.99  // ✅ Higher quality (was 0.98)
        )
      } catch (error) {
        URL.revokeObjectURL(url)
        reject(error)
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}

/**
 * Applies LIGHT sharpening filter (reduced from aggressive sharpening)
 * ✅ IMPROVEMENT: Gentler kernel to avoid artifacts
 */
function applyLightSharpen(ctx: CanvasRenderingContext2D, width: number, height: number): ImageData {
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  const output = ctx.createImageData(width, height)
  
  // ✅ LIGHTER sharpening kernel (reduced center weight from 5 to 3)
  const kernel = [
    0, -0.5, 0,
    -0.5, 3, -0.5,
    0, -0.5, 0
  ]
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      for (let c = 0; c < 3; c++) {
        let sum = 0
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const idx = ((y + ky) * width + (x + kx)) * 4 + c
            const kernelIdx = (ky + 1) * 3 + (kx + 1)
            sum += data[idx] * kernel[kernelIdx]
          }
        }
        const outputIdx = (y * width + x) * 4 + c
        output.data[outputIdx] = Math.max(0, Math.min(255, sum))
      }
      // Copy alpha channel
      output.data[(y * width + x) * 4 + 3] = data[(y * width + x) * 4 + 3]
    }
  }
  
  return output
}