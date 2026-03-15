import imageCompression from 'browser-image-compression';

/**
 * NO COMPRESSION - Send original image quality to Klippa OCR
 * User requested to maintain original image quality for better OCR accuracy
 */

export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  quality?: number;
  fileType?: string;
}

export interface CompressionResult {
  compressedFile: File;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
  timeTaken: number;
}

/**
 * NO COMPRESSION - Return original file
 * This function now bypasses compression to maintain original image quality
 */
export async function compressImageForOCR(
  file: File,
  options: CompressionOptions = {}
): Promise<CompressionResult> {
  const startTime = Date.now();
  const originalSize = file.size;

  // NO COMPRESSION - Return original file
  return {
    compressedFile: file,
    originalSize,
    compressedSize: originalSize,
    compressionRatio: 0,
    timeTaken: Date.now() - startTime
  };
}

/**
 * Process multiple images without compression
 */
export async function compressMultipleImages(
  files: File[],
  options: CompressionOptions = {},
  onProgress?: (current: number, total: number) => void
): Promise<CompressionResult[]> {
  const results: CompressionResult[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const result = await compressImageForOCR(files[i], options);
    results.push(result);
    
    if (onProgress) {
      onProgress(i + 1, files.length);
    }
  }
  
  return results;
}

/**
 * Check if a file needs compression (always returns false now)
 */
export function shouldCompressFile(file: File, maxSizeMB: number = 0.3): boolean {
  return false; // No compression
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}