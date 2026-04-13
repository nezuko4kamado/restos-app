import express, { Request, Response } from 'express';
import multer from 'multer';
import { extractTextFromImage, parseInvoiceData } from '../services/ocrService.js';
import { verifyAuth } from '../middleware/auth.js';
import { ocrRateLimiter } from '../middleware/rateLimiter.js';
import { validateImageUpload } from '../middleware/validateRequest.js';
import { log } from '../utils/logger.js';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  }
});

/**
 * POST /api/ocr/process-invoice
 * Process an invoice image and extract structured data
 */
router.post(
  '/process-invoice',
  verifyAuth,
  ocrRateLimiter,
  upload.single('image'),
  validateImageUpload,
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: 'No image file provided' });
        return;
      }

      const userId = req.user?.uid;
      log.info('Processing invoice', { userId, fileSize: req.file.size });

      // Extract text from image
      const extractedText = await extractTextFromImage(req.file.buffer);
      
      // Parse invoice data
      const invoiceData = await parseInvoiceData(extractedText);

      res.json({
        success: true,
        data: invoiceData
      });
    } catch (error) {
      log.error('Invoice processing failed', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process invoice'
      });
    }
  }
);

export default router;
