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
 * Match product by name, EAN/SKU code, supplier name, and code_description.
 * Always filters by userId to prevent cross-user false matches.
 * Optionally narrows by supplier name for better accuracy.
 */
async function matchProduct(
  productName: string,
  eanCode?: string,
  supplierName?: string,
  codeDescription?: string,
  userId?: string
): Promise<MatchResult> {
  try {
    if (!userId) {
      console.warn('⚠️ [MATCHER] No userId provided — skipping match to avoid cross-user contamination');
      return { matched: false, confidence: 0 };
    }

    // --- Step 1: Try exact match via code_description (scoped to user) ---
    if (codeDescription && codeDescription.trim() !== '') {
      const { data: codeMatches, error: codeError } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', userId)
        .eq('code_description', codeDescription.trim());

      if (!codeError && codeMatches && codeMatches.length > 0) {
        console.log(`✅ [MATCHER] Exact code_description match for "${codeDescription}": ${codeMatches[0].name}`);
        return {
          matched: true,
          product: codeMatches[0] as Product,
          confidence: 100,
          matchType: 'exact',
        };
      }
    }

    // --- Step 2: Try exact match via EAN/SKU code (scoped to user) ---
    if (eanCode && eanCode.trim() !== '') {
      const { data: eanMatches, error: eanError } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', userId)
        .eq('ean_code', eanCode.trim());

      if (!eanError && eanMatches && eanMatches.length > 0) {
        console.log(`✅ [MATCHER] Exact EAN/SKU match for "${eanCode}": ${eanMatches[0].name}`);
        return {
          matched: true,
          product: eanMatches[0] as Product,
          confidence: 100,
          matchType: 'exact',
        };
      }
    }

    // --- Step 3: Fuzzy name match — prefer supplier-scoped products first ---
    // Build candidate list: supplier-scoped first, then all user products as fallback
    let candidates: Product[] = [];

    if (supplierName && supplierName.trim() !== '') {
      // Try to find the supplier id by name
      const { data: supplierRows } = await supabase
        .from('suppliers')
        .select('id')
        .eq('user_id', userId)
        .ilike('name', supplierName.trim());

      if (supplierRows && supplierRows.length > 0) {
        const supplierIds = supplierRows.map((s: { id: string }) => s.id);
        const { data: supplierProducts, error: spError } = await supabase
          .from('products')
          .select('*')
          .eq('user_id', userId)
          .in('supplier_id', supplierIds);

        if (!spError && supplierProducts && supplierProducts.length > 0) {
          candidates = supplierProducts as Product[];
          console.log(`🔍 [MATCHER] Supplier-scoped candidates for "${supplierName}": ${candidates.length}`);
        }
      }
    }

    // If no supplier-scoped candidates, fall back to all user products
    if (candidates.length === 0) {
      const { data: allProducts, error: allError } = await supabase
        .from('products')
        .select('*')
        .eq('user_id', userId);

      if (allError || !allProducts || allProducts.length === 0) {
        console.warn('⚠️ [MATCHER] No products found for user', userId);
        return { matched: false, confidence: 0 };
      }
      candidates = allProducts as Product[];
      console.log(`🔍 [MATCHER] Fallback to all user products: ${candidates.length}`);
    }

    // --- Fuzzy name matching with threshold 70% ---
    const FUZZY_THRESHOLD = 70;
    let bestMatch: MatchResult = { matched: false, confidence: 0 };
    let highestSimilarity = 0;

    for (const product of candidates) {
      // Exact name match
      const similarity = calculateSimilarity(productName, product.name);

      if (similarity === 100) {
        console.log(`✅ [MATCHER] Exact name match: "${productName}" → "${product.name}"`);
        return {
          matched: true,
          product,
          confidence: 100,
          matchType: 'exact',
        };
      }

      if (similarity >= FUZZY_THRESHOLD && similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = {
          matched: true,
          product,
          confidence: Math.round(similarity),
          matchType: 'fuzzy',
        };
      }
    }

    if (bestMatch.matched) {
      console.log(`🔶 [MATCHER] Fuzzy match (${bestMatch.confidence}%): "${productName}" → "${bestMatch.product?.name}"`);
    } else {
      console.log(`❌ [MATCHER] No match found for "${productName}" (best similarity: ${Math.round(highestSimilarity)}%)`);
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
  return matchProduct(extractedProduct.name, undefined, supplierName, undefined, userId);
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

    const FUZZY_THRESHOLD = 70;
    let bestMatch: MatchResult = { matched: false, confidence: 0 };
    let highestSimilarity = 0;

    for (const product of existingProducts) {
      const similarity = calculateSimilarity(extractedProduct.name, product.name);

      if (similarity === 100) {
        return {
          matched: true,
          product,
          confidence: 100,
          matchType: 'exact',
        };
      }

      if (similarity >= FUZZY_THRESHOLD && similarity > highestSimilarity) {
        highestSimilarity = similarity;
        bestMatch = {
          matched: true,
          product,
          confidence: Math.round(similarity),
          matchType: 'fuzzy',
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
  matchProductBySupplier,
};

// Re-export matchProduct type for callers
export type { MatchResult };

export default {
  matchProduct,
  matchProductByName,
  matchProductBySupplier,
};
