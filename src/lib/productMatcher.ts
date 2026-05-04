import { supabase } from './supabase';
import type { Product } from '@/types';

/**
 * Product Matcher - Matches extracted products from invoices with existing products in database
 * Uses fuzzy matching and price comparison to identify existing products
 */

interface ExtractedProduct {
  name: string;
  price: number;
  quantity?: number;
  category?: string;
  vatRate?: number;
  discountPercent?: number;
}

interface MatchResult {
  matched: boolean;
  product?: Product;
  confidence: number;
  matchType?: 'exact' | 'fuzzy' | 'none';
}

/**
 * Calculate similarity between two strings using Levenshtein distance
 */
function calculateSimilarity(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  
  if (s1 === s2) return 100;
  
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 100;
  
  const editDistance = levenshteinDistance(longer, shorter);
  return ((longer.length - editDistance) / longer.length) * 100;
}

/**
 * Calculate word overlap between two strings.
 * Returns a score 0-100 based on the fraction of meaningful words shared.
 * Words shorter than 2 characters are ignored.
 */
function calculateWordOverlap(str1: string, str2: string): number {
  const tokenize = (s: string) =>
    s.toLowerCase().trim().split(/[\s*x()/,]+/).filter(w => w.length >= 2);

  const words1 = tokenize(str1);
  const words2 = tokenize(str2);

  if (words1.length === 0 || words2.length === 0) return 0;

  const set2 = new Set(words2);
  const matches = words1.filter(w => set2.has(w)).length;
  const overlap = matches / Math.max(words1.length, words2.length);

  return overlap * 100;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

/**
 * Match product by name and optional EAN code or code_description
 */
async function matchProduct(
  productName: string,
  eanCode?: string,
  supplierName?: string,
  codeDescription?: string
): Promise<MatchResult> {
  try {
    // CRITICAL FIX: Use correct table name 'products' instead of 'app_43909_products'
    const { data: existingProducts, error } = await supabase
      .from('products')
      .select('*');

    if (error) {
      console.error('❌ Error matching product:', error);
      return { matched: false, confidence: 0 };
    }

    if (!existingProducts || existingProducts.length === 0) {
      return { matched: false, confidence: 0 };
    }

    // ✅ Match by code_description (exact then partial) — highest priority after EAN
    if (codeDescription && codeDescription.trim()) {
      const codeNorm = codeDescription.toLowerCase().trim();
      const isPureNumeric = /^\d+$/.test(codeNorm);

      for (const product of existingProducts) {
        if (product.code_description && product.code_description.trim()) {
          const prodCode = product.code_description.toLowerCase().trim();
          // Exact match
          if (prodCode === codeNorm) {
            console.log('✅ [MATCHER] Exact code_description match:', codeDescription, '->', product.name);
            return { matched: true, product, confidence: 100, matchType: 'exact' };
          }
          // Numeric code exact match (e.g. "13010" vs "13010")
          if (isPureNumeric && /^\d+$/.test(prodCode) && prodCode === codeNorm) {
            console.log('✅ [MATCHER] Numeric code exact match:', codeDescription, '->', product.name);
            return { matched: true, product, confidence: 100, matchType: 'exact' };
          }
          // Partial match (one contains the other)
          if (prodCode.includes(codeNorm) || codeNorm.includes(prodCode)) {
            console.log('✅ [MATCHER] Partial code_description match:', codeDescription, '->', product.code_description, '(', product.name, ')');
            return { matched: true, product, confidence: 95, matchType: 'exact' };
          }
        }
      }
    }

    // Find best match using combined Levenshtein + word overlap score
    let bestMatch: MatchResult = { matched: false, confidence: 0 };
    let highestScore = 0;

    for (const product of existingProducts) {
      // Exact match by EAN code (if provided)
      if (eanCode && product.ean_code && eanCode === product.ean_code) {
        return {
          matched: true,
          product,
          confidence: 100,
          matchType: 'exact'
        };
      }

      // Match by name similarity — combine Levenshtein and word overlap
      const levenSimilarity = calculateSimilarity(productName, product.name);
      const wordOverlap = calculateWordOverlap(productName, product.name);
      const combinedScore = Math.max(levenSimilarity, wordOverlap);

      // Exact name match
      if (levenSimilarity === 100) {
        return {
          matched: true,
          product,
          confidence: 100,
          matchType: 'exact'
        };
      }

      // Fuzzy match: lowered threshold to 65% to catch variants like
      // "POLPA TORRENTE 5 KG*3 S/P" vs "POLPA TORRENTE 5 KG X 3 (UN) S/P"
      if (combinedScore > 65 && combinedScore > highestScore) {
        highestScore = combinedScore;
        const confidence = wordOverlap >= 60 && levenSimilarity < 65
          ? 75  // word-overlap-only match gets capped at 75
          : Math.round(combinedScore);
        bestMatch = {
          matched: true,
          product,
          confidence,
          matchType: 'fuzzy'
        };
      }
    }

    return bestMatch;
  } catch (error) {
    console.error('❌ Exception in matchProduct:', error);
    return { matched: false, confidence: 0 };
  }
}

/**
 * Match extracted product with existing products by name similarity
 */
export async function matchProductByName(
  extractedProduct: ExtractedProduct,
  userId: string,
  supplierName: string
): Promise<MatchResult> {
  return matchProduct(extractedProduct.name, undefined, supplierName);
}

/**
 * Match extracted product with existing products by supplier and name
 */
export async function matchProductBySupplier(
  extractedProduct: ExtractedProduct,
  userId: string,
  supplierId: string
): Promise<MatchResult> {
  try {
    // CRITICAL FIX: Use correct table name 'products' and correct column 'supplier_id'
    const { data: existingProducts, error } = await supabase
      .from('products')
      .select('*')
      .eq('user_id', userId)
      .eq('supplier_id', supplierId);

    if (error) {
      console.error('❌ Error matching by supplier:', error);
      return { matched: false, confidence: 0 };
    }

    if (!existingProducts || existingProducts.length === 0) {
      return { matched: false, confidence: 0 };
    }

    // Find best match using combined Levenshtein + word overlap score
    let bestMatch: MatchResult = { matched: false, confidence: 0 };
    let highestScore = 0;

    for (const product of existingProducts) {
      const levenSimilarity = calculateSimilarity(extractedProduct.name, product.name);
      const wordOverlap = calculateWordOverlap(extractedProduct.name, product.name);
      const combinedScore = Math.max(levenSimilarity, wordOverlap);

      if (levenSimilarity === 100) {
        return {
          matched: true,
          product,
          confidence: 100,
          matchType: 'exact'
        };
      }
      
      if (combinedScore > 65 && combinedScore > highestScore) {
        highestScore = combinedScore;
        const confidence = wordOverlap >= 60 && levenSimilarity < 65
          ? 75
          : Math.round(combinedScore);
        bestMatch = {
          matched: true,
          product,
          confidence,
          matchType: 'fuzzy'
        };
      }
    }

    return bestMatch;
  } catch (error) {
    console.error('❌ Exception in matchProductBySupplier:', error);
    return { matched: false, confidence: 0 };
  }
}

// Export as ProductMatcher object to match the import pattern in InvoiceManagement.tsx
export const ProductMatcher = {
  matchProduct: (productName: string, eanCode?: string, supplierName?: string, codeDescription?: string) =>
    matchProduct(productName, eanCode, supplierName, codeDescription),
  matchProductByName,
  matchProductBySupplier
};

export default {
  matchProduct,
  matchProductByName,
  matchProductBySupplier
};