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
 * Match product by name and optional EAN code
 */
async function matchProduct(
  productName: string,
  eanCode?: string,
  supplierName?: string
): Promise<MatchResult> {
  try {
    // CRITICAL FIX: Use correct table name 'products' instead of 'app_43909_products'
    const { data: existingProducts, error } = await supabase
      .from('app_43909_products')
      .select('*');

    if (error) {
      console.error('❌ Error matching product:', error);
      return { matched: false, confidence: 0 };
    }

    if (!existingProducts || existingProducts.length === 0) {
      return { matched: false, confidence: 0 };
    }

    // Find best match
    let bestMatch: MatchResult = { matched: false, confidence: 0 };
    let highestSimilarity = 0;

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

      // Match by name similarity
      const similarity = calculateSimilarity(productName, product.name);
      
      // Exact name match
      if (similarity === 100) {
        return {
          matched: true,
          product,
          confidence: 100,
          matchType: 'exact'
        };
      }
      
      // Fuzzy match: > 80% similarity
      if (similarity > 80 && similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = {
          matched: true,
          product,
          confidence: Math.round(similarity),
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
      .from('app_43909_products')
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

    // Find best match
    let bestMatch: MatchResult = { matched: false, confidence: 0 };
    let highestSimilarity = 0;

    for (const product of existingProducts) {
      const similarity = calculateSimilarity(extractedProduct.name, product.name);
      
      if (similarity === 100) {
        return {
          matched: true,
          product,
          confidence: 100,
          matchType: 'exact'
        };
      }
      
      if (similarity > 80 && similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = {
          matched: true,
          product,
          confidence: Math.round(similarity),
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
  matchProduct,
  matchProductByName,
  matchProductBySupplier
};

export default {
  matchProduct,
  matchProductByName,
  matchProductBySupplier
};