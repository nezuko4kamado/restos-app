import { supabase } from '@/lib/supabase';
import { MatchSuggestion } from '@/types/advanced';
import { SupplierWhitelistService } from './supplierWhitelistService';
import type { Product } from '@/types';

interface ProductRecord {
  id: string;
  name: string;
  ean_code?: string;
}

export class ProductMatchingService {
  /**
   * Find matching product from a list of products
   * This is a simple synchronous method for local matching
   */
  static findMatchingProduct(
    productName: string,
    products: Product[],
    eanCode?: string
  ): Product | null {
    console.log('🔍 [MATCHING] Searching for product:', productName);
    console.log('🔍 [MATCHING] Available products:', products.length);
    console.log('🔍 [MATCHING] EAN code:', eanCode);

    // First try to match by EAN code if provided
    if (eanCode) {
      const eanMatch = products.find(p => p.ean_code === eanCode);
      if (eanMatch) {
        console.log('✅ [MATCHING] Found exact EAN match:', eanMatch.name);
        return eanMatch;
      }
    }

    // Normalize the search name
    const normalizedSearchName = this.normalizeProductName(productName);

    // Try exact match first (case-insensitive)
    let match = products.find(p => 
      this.normalizeProductName(p.name) === normalizedSearchName
    );

    if (match) {
      console.log('✅ [MATCHING] Found exact name match:', match.name);
      return match;
    }

    // Try partial match (contains)
    match = products.find(p => {
      const normalizedProductName = this.normalizeProductName(p.name);
      return normalizedProductName.includes(normalizedSearchName) ||
             normalizedSearchName.includes(normalizedProductName);
    });

    if (match) {
      console.log('✅ [MATCHING] Found partial match:', match.name);
      return match;
    }

    // Try fuzzy matching with similarity threshold
    const matches = products.map(p => ({
      product: p,
      similarity: this.calculateSimilarity(normalizedSearchName, this.normalizeProductName(p.name))
    }));

    // Sort by similarity
    matches.sort((a, b) => b.similarity - a.similarity);

    // Return best match if similarity is above threshold (70%)
    if (matches.length > 0 && matches[0].similarity >= 70) {
      console.log('✅ [MATCHING] Found fuzzy match:', matches[0].product.name, 'with similarity:', matches[0].similarity);
      return matches[0].product;
    }

    console.log('❌ [MATCHING] No match found for:', productName);
    return null;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 100;

    const len1 = s1.length;
    const len2 = s2.length;

    if (len1 === 0) return 0;
    if (len2 === 0) return 0;

    const matrix: number[][] = [];

    for (let i = 0; i <= len1; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= len2; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + cost
        );
      }
    }

    const distance = matrix[len1][len2];
    const maxLen = Math.max(len1, len2);
    return Math.round(((maxLen - distance) / maxLen) * 100);
  }

  /**
   * Normalize product name for better matching
   */
  private static normalizeProductName(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Match product by EAN code (highest priority)
   */
  static async matchByEAN(eanCode: string): Promise<ProductRecord | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('app_43909_products')
        .select('*')
        .eq('user_id', user.id)
        .eq('ean_code', eanCode)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;
    } catch (error) {
      console.error('Error matching by EAN:', error);
      return null;
    }
  }

  /**
   * Match product by name with fuzzy matching
   */
  static async matchByName(
    productName: string,
    supplierName: string,
    minConfidence: number = 70
  ): Promise<MatchSuggestion> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return this.getEmptyMatchSuggestion(productName, supplierName);
      }

      // Get all products
      const { data: products, error } = await supabase
        .from('app_43909_products')
        .select('id, name, ean_code')
        .eq('user_id', user.id);

      if (error) throw error;

      if (!products || products.length === 0) {
        return this.getEmptyMatchSuggestion(productName, supplierName);
      }

      const normalizedInput = this.normalizeProductName(productName);

      // Calculate similarity for each product
      const matches = products.map(product => ({
        ...product,
        similarity: this.calculateSimilarity(normalizedInput, this.normalizeProductName(product.name)),
      }));

      // Sort by similarity
      matches.sort((a, b) => b.similarity - a.similarity);

      // Get best match
      const bestMatch = matches[0];

      // Check if supplier is whitelisted
      const isWhitelisted = await SupplierWhitelistService.isSupplierWhitelisted(supplierName);

      // Adjust confidence based on whitelist status
      let confidence = bestMatch.similarity;
      if (isWhitelisted) {
        confidence = Math.min(100, confidence + 5); // Boost confidence for whitelisted suppliers
      }

      const matchSuggestion: MatchSuggestion = {
        product_name: productName,
        supplier_name: supplierName,
        confidence,
        matched_product: confidence >= minConfidence ? {
          id: bestMatch.id,
          name: bestMatch.name,
          ean_code: bestMatch.ean_code,
        } : undefined,
        suggestions: matches
          .filter(m => m.similarity >= 50)
          .slice(0, 5)
          .map(m => ({
            id: m.id,
            name: m.name,
            ean_code: m.ean_code,
            similarity: m.similarity,
          })),
      };

      return matchSuggestion;
    } catch (error) {
      console.error('Error matching by name:', error);
      return this.getEmptyMatchSuggestion(productName, supplierName);
    }
  }

  /**
   * Match product with multi-language support
   */
  static async matchMultiLanguage(
    productName: string,
    supplierName: string,
    languages: string[] = ['en', 'it', 'fr', 'de', 'es']
  ): Promise<MatchSuggestion> {
    try {
      // Try exact match first
      const exactMatch = await this.matchByName(productName, supplierName, 95);
      if (exactMatch.matched_product) {
        return exactMatch;
      }

      // Try with common translations/variations
      const variations = this.generateNameVariations(productName, languages);
      
      let bestMatch: MatchSuggestion = exactMatch;
      let highestConfidence = exactMatch.confidence;

      for (const variation of variations) {
        const match = await this.matchByName(variation, supplierName, 70);
        if (match.confidence > highestConfidence) {
          bestMatch = match;
          highestConfidence = match.confidence;
        }
      }

      return bestMatch;
    } catch (error) {
      console.error('Error in multi-language matching:', error);
      return this.getEmptyMatchSuggestion(productName, supplierName);
    }
  }

  /**
   * Generate name variations for multi-language matching
   */
  private static generateNameVariations(name: string, languages: string[]): string[] {
    const variations: string[] = [];
    const normalized = this.normalizeProductName(name);

    // Add original
    variations.push(name);

    // Add without special characters
    variations.push(normalized);

    // Add with common abbreviations expanded
    const abbreviations: Record<string, string> = {
      'kg': 'kilogram',
      'g': 'gram',
      'l': 'liter',
      'ml': 'milliliter',
      'pz': 'pieces',
      'pcs': 'pieces',
    };

    let expanded = normalized;
    for (const [abbr, full] of Object.entries(abbreviations)) {
      expanded = expanded.replace(new RegExp(`\\b${abbr}\\b`, 'gi'), full);
    }
    variations.push(expanded);

    return [...new Set(variations)]; // Remove duplicates
  }

  /**
   * Get empty match suggestion
   */
  private static getEmptyMatchSuggestion(productName: string, supplierName: string): MatchSuggestion {
    return {
      product_name: productName,
      supplier_name: supplierName,
      confidence: 0,
      suggestions: [],
    };
  }

  /**
   * Batch match products from invoice
   */
  static async batchMatchProducts(
    items: Array<{ product_name: string; ean_code?: string }>,
    supplierName: string
  ): Promise<MatchSuggestion[]> {
    const results: MatchSuggestion[] = [];

    for (const item of items) {
      // Try EAN match first if available
      if (item.ean_code) {
        const eanMatch = await this.matchByEAN(item.ean_code);
        if (eanMatch) {
          results.push({
            product_name: item.product_name,
            supplier_name: supplierName,
            confidence: 100,
            matched_product: {
              id: eanMatch.id,
              name: eanMatch.name,
              ean_code: eanMatch.ean_code,
            },
            suggestions: [],
          });
          continue;
        }
      }

      // Fall back to name matching
      const nameMatch = await this.matchByName(item.product_name, supplierName);
      results.push(nameMatch);
    }

    return results;
  }
}