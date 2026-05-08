import { supabase } from './supabase';
import type { Product } from '@/types';

/**
 * Product Matcher - Matches extracted products from invoices with existing products in database
 * PRIMARY KEY: code_description (product code is always the same and never changes)
 * FALLBACK: fuzzy name matching (only when no code is available)
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
 * ✅ PRIMARY MATCH: Match by product code (code_description / sku).
 * The product code is ALWAYS the same — this is the most reliable identifier.
 * Returns immediately on first match — no fuzzy logic needed for codes.
 */
async function matchProduct(
  productName: string,
  eanCode?: string,
  supplierName?: string,
  codeDescription?: string,
  userId?: string
): Promise<MatchResult> {
  try {
    // Resolve userId if not provided
    let resolvedUserId = userId;
    if (!resolvedUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      resolvedUserId = user?.id;
    }

    const codeNorm = codeDescription?.trim() ?? '';
    const hasCode = codeNorm.length > 0;

    console.log(`🔍 [MATCHER] Matching product: "${productName}"`);
    console.log(`🔍 [MATCHER]   code_description/sku from OCR: "${codeNorm}" (hasCode=${hasCode})`);
    console.log(`🔍 [MATCHER]   userId: ${resolvedUserId}`);

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 1 — CODE MATCH (PRIMARY, highest priority)
    // When a code is present, query the DB directly by code_description.
    // This is O(1) and 100% reliable — skip ALL fuzzy logic.
    // ─────────────────────────────────────────────────────────────────────────
    if (hasCode) {
      console.log(`🔑 [MATCHER] CODE MATCH: querying DB for code_description = "${codeNorm}"`);

      let codeQuery = supabase
        .from('products')
        .select('id,name,price,category,supplier_id,vat_rate,unit,code_description,previous_price,created_at,updated_at')
        .ilike('code_description', codeNorm); // case-insensitive exact match

      if (resolvedUserId) {
        codeQuery = codeQuery.eq('user_id', resolvedUserId);
      }

      const { data: codeMatches, error: codeError } = await codeQuery.limit(1);

      if (codeError) {
        console.error('❌ [MATCHER] DB error during code match:', codeError.message);
      } else if (codeMatches && codeMatches.length > 0) {
        const matched = codeMatches[0];
        console.log(`✅ [MATCHER] CODE MATCH SUCCESS: "${codeNorm}" → product "${matched.name}" (id=${matched.id})`);
        console.log(`✅ [MATCHER]   DB price: ${matched.price}, OCR name: "${productName}"`);
        return {
          matched: true,
          product: matched as unknown as Product,
          confidence: 100,
          matchType: 'exact',
        };
      } else {
        console.warn(`⚠️ [MATCHER] CODE MATCH: no product found for code "${codeNorm}" (userId=${resolvedUserId})`);
        console.warn(`⚠️ [MATCHER] This product may not exist yet in the DB — will be added as NEW`);
        // Do NOT fall through to name matching when a code was provided but not found.
        // A missing code means the product is genuinely new for this user.
        return { matched: false, confidence: 0, matchType: 'none' };
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 2 — EAN CODE MATCH (secondary, only when no code_description)
    // ─────────────────────────────────────────────────────────────────────────
    if (eanCode && eanCode.trim()) {
      console.log(`🔑 [MATCHER] EAN MATCH: querying DB for ean_code = "${eanCode}"`);
      let eanQuery = supabase
        .from('products')
        .select('id,name,price,category,supplier_id,vat_rate,unit,code_description,previous_price,created_at,updated_at')
        .eq('ean_code', eanCode.trim());

      if (resolvedUserId) {
        eanQuery = eanQuery.eq('user_id', resolvedUserId);
      }

      const { data: eanMatches, error: eanError } = await eanQuery.limit(1);
      if (!eanError && eanMatches && eanMatches.length > 0) {
        const matched = eanMatches[0];
        console.log(`✅ [MATCHER] EAN MATCH SUCCESS: "${eanCode}" → "${matched.name}"`);
        return {
          matched: true,
          product: matched as unknown as Product,
          confidence: 100,
          matchType: 'exact',
        };
      }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // STEP 3 — NAME FUZZY MATCH (last resort, only when no code at all)
    // ─────────────────────────────────────────────────────────────────────────
    console.log(`🔤 [MATCHER] NAME FUZZY MATCH for: "${productName}" (no code available)`);

    let query = supabase
      .from('products')
      .select('id,name,price,category,supplier_id,vat_rate,unit,code_description,previous_price,created_at,updated_at');

    if (resolvedUserId) {
      query = query.eq('user_id', resolvedUserId);
    }

    const { data: existingProducts, error } = await query;

    if (error) {
      console.error('❌ [MATCHER] Error fetching products for name match:', error);
      return { matched: false, confidence: 0 };
    }

    if (!existingProducts || existingProducts.length === 0) {
      console.warn('⚠️ [MATCHER] No products found for user:', resolvedUserId);
      return { matched: false, confidence: 0 };
    }

    let bestMatch: MatchResult = { matched: false, confidence: 0 };
    let highestScore = 0;

    for (const product of existingProducts) {
      // Exact name match
      const levenSimilarity = calculateSimilarity(productName, product.name);
      const wordOverlap = calculateWordOverlap(productName, product.name);
      const combinedScore = Math.max(levenSimilarity, wordOverlap);

      if (levenSimilarity === 100) {
        console.log(`✅ [MATCHER] EXACT NAME MATCH: "${productName}" → "${product.name}"`);
        return {
          matched: true,
          product: product as unknown as Product,
          confidence: 100,
          matchType: 'exact',
        };
      }

      if (combinedScore > 65 && combinedScore > highestScore) {
        highestScore = combinedScore;
        const confidence = wordOverlap >= 60 && levenSimilarity < 65
          ? 75
          : Math.round(combinedScore);
        bestMatch = {
          matched: true,
          product: product as unknown as Product,
          confidence,
          matchType: 'fuzzy',
        };
      }
    }

    if (bestMatch.matched) {
      console.log(`🔤 [MATCHER] FUZZY NAME MATCH: "${productName}" → "${bestMatch.product?.name}" (confidence=${bestMatch.confidence}%)`);
    } else {
      console.warn(`⚠️ [MATCHER] NO MATCH for: "${productName}"`);
    }

    return bestMatch;
  } catch (error) {
    console.error('❌ [MATCHER] Exception in matchProduct:', error);
    return { matched: false, confidence: 0 };
  }
}

/**
 * Match extracted product with existing products by name similarity.
 * FIXED: passes userId so matchProduct can filter by user_id.
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
      .select('id,name,price,category,supplier_id,vat_rate,unit,code_description,previous_price,created_at,updated_at')
      .eq('user_id', userId)
      .eq('supplier_id', supplierId);

    if (error) {
      console.error('❌ Error matching by supplier:', error);
      return { matched: false, confidence: 0 };
    }

    if (!existingProducts || existingProducts.length === 0) {
      return { matched: false, confidence: 0 };
    }

    let bestMatch: MatchResult = { matched: false, confidence: 0 };
    let highestScore = 0;

    for (const product of existingProducts) {
      const levenSimilarity = calculateSimilarity(extractedProduct.name, product.name);
      const wordOverlap = calculateWordOverlap(extractedProduct.name, product.name);
      const combinedScore = Math.max(levenSimilarity, wordOverlap);

      if (levenSimilarity === 100) {
        return {
          matched: true,
          product: product as unknown as Product,
          confidence: 100,
          matchType: 'exact',
        };
      }
      
      if (combinedScore > 65 && combinedScore > highestScore) {
        highestScore = combinedScore;
        const confidence = wordOverlap >= 60 && levenSimilarity < 65
          ? 75
          : Math.round(combinedScore);
        bestMatch = {
          matched: true,
          product: product as unknown as Product,
          confidence,
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
  matchProduct: (productName: string, eanCode?: string, supplierName?: string, codeDescription?: string, userId?: string) =>
    matchProduct(productName, eanCode, supplierName, codeDescription, userId),
  matchProductByName,
  matchProductBySupplier,
};

export default {
  matchProduct,
  matchProductByName,
  matchProductBySupplier,
};