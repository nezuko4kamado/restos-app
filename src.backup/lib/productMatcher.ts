import { supabase } from './supabase';
import type { Product } from '@/types';

export interface ProductMatchResult {
  matched: boolean;
  product?: Product;
  confidence: number;
  match_type: 'ean' | 'name' | 'none';
  suggestions: Array<{
    product: Product;
    similarity: number;
    match_reason: string;
  }>;
}

export class ProductMatcher {
  /**
   * Calculate string similarity using Levenshtein distance
   */
  private static calculateSimilarity(str1: string, str2: string): number {
    const s1 = str1.toLowerCase().trim();
    const s2 = str2.toLowerCase().trim();

    if (s1 === s2) return 100;

    const len1 = s1.length;
    const len2 = s2.length;

    if (len1 === 0 || len2 === 0) return 0;

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
  static async matchByEAN(eanCode: string): Promise<Product | null> {
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
      console.error('❌ Error matching by EAN:', error);
      return null;
    }
  }

  /**
   * Match product by name with fuzzy matching
   */
  static async matchByName(
    productName: string,
    supplierName?: string,
    minConfidence: number = 70
  ): Promise<ProductMatchResult> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return {
          matched: false,
          confidence: 0,
          match_type: 'none',
          suggestions: [],
        };
      }

      // Get all products (optionally filter by supplier)
      let query = supabase
        .from('app_43909_products')
        .select('*')
        .eq('user_id', user.id);

      if (supplierName) {
        query = query.eq('supplier_name', supplierName);
      }

      const { data: products, error } = await query;

      if (error) throw error;
      if (!products || products.length === 0) {
        return {
          matched: false,
          confidence: 0,
          match_type: 'none',
          suggestions: [],
        };
      }

      const normalizedInput = this.normalizeProductName(productName);

      // Calculate similarity for each product
      const matches = products.map(product => ({
        product,
        similarity: this.calculateSimilarity(normalizedInput, this.normalizeProductName(product.name)),
        match_reason: 'name similarity',
      }));

      // Sort by similarity
      matches.sort((a, b) => b.similarity - a.similarity);

      // Get best match
      const bestMatch = matches[0];

      // Get manual suggestions (60-79% confidence range)
      const suggestions = matches
        .filter(m => m.similarity >= 60 && m.similarity < 80)
        .slice(0, 5);

      return {
        matched: bestMatch.similarity >= minConfidence,
        product: bestMatch.similarity >= minConfidence ? bestMatch.product : undefined,
        confidence: bestMatch.similarity,
        match_type: bestMatch.similarity >= minConfidence ? 'name' : 'none',
        suggestions,
      };
    } catch (error) {
      console.error('❌ Error matching by name:', error);
      return {
        matched: false,
        confidence: 0,
        match_type: 'none',
        suggestions: [],
      };
    }
  }

  /**
   * Match product with EAN priority, fallback to name
   */
  static async matchProduct(
    productName: string,
    eanCode?: string,
    supplierName?: string,
    minConfidence: number = 70
  ): Promise<ProductMatchResult> {
    try {
      // Try EAN match first if available
      if (eanCode) {
        const eanMatch = await this.matchByEAN(eanCode);
        if (eanMatch) {
          return {
            matched: true,
            product: eanMatch,
            confidence: 100,
            match_type: 'ean',
            suggestions: [],
          };
        }
      }

      // Fall back to name matching
      return await this.matchByName(productName, supplierName, minConfidence);
    } catch (error) {
      console.error('❌ Error matching product:', error);
      return {
        matched: false,
        confidence: 0,
        match_type: 'none',
        suggestions: [],
      };
    }
  }

  /**
   * Match product with multi-language support
   */
  static async matchProductMultiLanguage(
    productName: string,
    eanCode?: string,
    supplierName?: string,
    languages: string[] = ['it', 'en', 'fr', 'de', 'es']
  ): Promise<ProductMatchResult> {
    try {
      // Try EAN match first
      if (eanCode) {
        const eanMatch = await this.matchByEAN(eanCode);
        if (eanMatch) {
          return {
            matched: true,
            product: eanMatch,
            confidence: 100,
            match_type: 'ean',
            suggestions: [],
          };
        }
      }

      // Try exact name match
      const exactMatch = await this.matchByName(productName, supplierName, 95);
      if (exactMatch.matched) {
        return exactMatch;
      }

      // Try with variations
      const variations = this.generateNameVariations(productName);
      
      let bestMatch = exactMatch;
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
      console.error('❌ Error in multi-language product matching:', error);
      return {
        matched: false,
        confidence: 0,
        match_type: 'none',
        suggestions: [],
      };
    }
  }

  /**
   * Generate name variations for multi-language matching
   */
  private static generateNameVariations(name: string): string[] {
    const variations: string[] = [];
    const normalized = this.normalizeProductName(name);

    // Add original
    variations.push(name);

    // Add normalized
    variations.push(normalized);

    // Add with common abbreviations expanded
    const abbreviations: Record<string, string> = {
      'kg': 'kilogram',
      'g': 'gram',
      'l': 'liter',
      'ml': 'milliliter',
      'pz': 'pieces',
      'pcs': 'pieces',
      'lt': 'liter',
      'gr': 'gram',
    };

    let expanded = normalized;
    for (const [abbr, full] of Object.entries(abbreviations)) {
      expanded = expanded.replace(new RegExp(`\\b${abbr}\\b`, 'gi'), full);
    }
    variations.push(expanded);

    // Add with numbers removed (for generic matching)
    const withoutNumbers = normalized.replace(/\d+/g, '').replace(/\s+/g, ' ').trim();
    if (withoutNumbers.length > 3) {
      variations.push(withoutNumbers);
    }

    return [...new Set(variations)]; // Remove duplicates
  }

  /**
   * Batch match products from invoice
   */
  static async batchMatchProducts(
    items: Array<{ 
      product_name: string; 
      ean_code?: string;
      supplier_name?: string;
    }>
  ): Promise<ProductMatchResult[]> {
    const results: ProductMatchResult[] = [];

    for (const item of items) {
      const match = await this.matchProduct(
        item.product_name,
        item.ean_code,
        item.supplier_name
      );
      results.push(match);
    }

    return results;
  }

  /**
   * Get match suggestions for manual review
   */
  static async getSuggestionsForManualReview(
    minConfidence: number = 60,
    maxConfidence: number = 79
  ): Promise<Array<{
    invoice_product: string;
    suggestions: Array<{
      product: Product;
      similarity: number;
    }>;
  }>> {
    try {
      // This would typically be called after processing invoices
      // For now, return empty array as this requires invoice context
      return [];
    } catch (error) {
      console.error('❌ Error getting manual review suggestions:', error);
      return [];
    }
  }
}