// This file is deprecated - Mindee has been replaced by Tesseract + AI OCR
// Keeping for reference only - DO NOT USE

export interface MindeeResponse {
  document: {
    inference: {
      prediction: Record<string, unknown>;
    };
  };
}

export function processMindeeResponse(response: MindeeResponse): Record<string, unknown> {
  console.warn('⚠️ Mindee is deprecated - use Tesseract + AI OCR instead');
  return response.document?.inference?.prediction || {};
}