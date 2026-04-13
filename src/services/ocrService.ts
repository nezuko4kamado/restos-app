import { ImageAnnotatorClient } from '@google-cloud/vision';
import { log } from '../utils/logger.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyCovh7lc2BECIkfc0sEQ-MeqJEhJZlKqzo';

// Initialize Google Cloud Vision client
// Uses Application Default Credentials in Cloud Run
let visionClient: ImageAnnotatorClient | null = null;

function getVisionClient(): ImageAnnotatorClient {
  if (!visionClient) {
    try {
      visionClient = new ImageAnnotatorClient();
      log.info('✅ Google Cloud Vision client initialized');
    } catch (error) {
      log.error('❌ Failed to initialize Vision client', error);
      throw new Error('Vision client initialization failed');
    }
  }
  return visionClient;
}

interface GeminiPart {
  text?: string;
  inline_data?: {
    mime_type: string;
    data: string;
  };
}

interface GeminiContent {
  parts: GeminiPart[];
}

interface GeminiRequest {
  contents: GeminiContent[];
}

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{
        text: string;
      }>;
    };
  }>;
}

/**
 * Extract text from image using Google Cloud Vision OCR
 */
export async function extractTextFromImage(imageBuffer: Buffer): Promise<string> {
  try {
    const client = getVisionClient();
    const [result] = await client.textDetection(imageBuffer);
    const detections = result.textAnnotations;

    if (!detections || detections.length === 0) {
      log.warn('⚠️ No text detected in image');
      return '';
    }

    const fullText = detections[0].description || '';
    log.info('✅ Text extracted successfully', {
      textLength: fullText.length,
      linesCount: fullText.split('\n').length,
    });

    return fullText;
  } catch (error) {
    log.error('❌ OCR extraction failed', error);
    throw new Error('Failed to extract text from image');
  }
}

/**
 * Parse invoice data from extracted text using Gemini
 */
export async function parseInvoiceData(extractedText: string): Promise<Record<string, unknown>> {
  try {
    const prompt = `Analyze this invoice text and extract the following information in JSON format:
{
  "invoiceNumber": "string",
  "date": "YYYY-MM-DD",
  "supplierName": "string",
  "supplierVAT": "string",
  "totalAmount": number,
  "vatAmount": number,
  "netAmount": number,
  "items": [
    {
      "description": "string",
      "quantity": number,
      "unitPrice": number,
      "totalPrice": number,
      "vatRate": number
    }
  ]
}

Invoice text:
${extractedText}

Return ONLY valid JSON, no additional text.`;

    const requestBody: GeminiRequest = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      log.error('❌ Gemini API error', new Error(errorText), {
        status: response.status,
        statusText: response.statusText,
      });
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json() as GeminiResponse;

    if (!data.candidates || data.candidates.length === 0) {
      throw new Error('No response from Gemini');
    }

    const text = data.candidates[0].content.parts[0].text;
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('No JSON found in Gemini response');
    }

    const invoiceData = JSON.parse(jsonMatch[0]);
    log.info('✅ Invoice data parsed successfully', {
      invoiceNumber: invoiceData.invoiceNumber,
      itemsCount: invoiceData.items?.length || 0,
    });

    return invoiceData;
  } catch (error) {
    log.error('❌ Invoice parsing failed', error);
    throw new Error('Failed to parse invoice data');
  }
}
