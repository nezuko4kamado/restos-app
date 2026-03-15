import { supabase } from './supabase';
import type { Supplier } from '@/types';

export interface SupplierMatchResult {
  matched: boolean;
  supplier?: Supplier;
  confidence: number;
  suggestions: Array<{
    supplier: Supplier;
    similarity: number;
  }>;
  is_whitelisted: boolean;
}

export class SupplierMatcher {
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
   * Normalize supplier name for better matching
   */
  private static normalizeSupplierName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\b(srl|spa|snc|sas|s\.r\.l\.|s\.p\.a\.|s\.n\.c\.|s\.a\.s\.)\b/gi, '')
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Check if supplier is whitelisted
   */
  static async isWhitelisted(supplierName: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from('app_43909_supplier_whitelist')
        .select('is_active')
        .eq('user_id', user.id)
        .eq('supplier_name', supplierName)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return !!data;
    } catch (error) {
      console.error('❌ Error checking whitelist:', error);
      return false;
    }
  }

  /**
   * Match supplier by name with fuzzy matching
   */
  static async matchSupplier(
    supplierName: string,
    minConfidence: number = 70
  ): Promise<SupplierMatchResult> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return {
          matched: false,
          confidence: 0,
          suggestions: [],
          is_whitelisted: false,
        };
      }

      // Get all suppliers
      const { data: suppliers, error } = await supabase
        .from('app_43909_suppliers')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;
      if (!suppliers || suppliers.length === 0) {
        return {
          matched: false,
          confidence: 0,
          suggestions: [],
          is_whitelisted: false,
        };
      }

      const normalizedInput = this.normalizeSupplierName(supplierName);

      // Calculate similarity for each supplier
      const matches = suppliers.map(supplier => ({
        supplier,
        similarity: this.calculateSimilarity(normalizedInput, this.normalizeSupplierName(supplier.name)),
      }));

      // Sort by similarity
      matches.sort((a, b) => b.similarity - a.similarity);

      // Get best match
      const bestMatch = matches[0];

      // Check if whitelisted
      const isWhitelisted = await this.isWhitelisted(supplierName);

      // Adjust confidence based on whitelist status
      let confidence = bestMatch.similarity;
      if (isWhitelisted) {
        confidence = Math.min(100, confidence + 10); // Boost confidence for whitelisted suppliers
      }

      // Get suggestions (60-79% confidence range)
      const suggestions = matches
        .filter(m => m.similarity >= 60 && m.similarity < 80)
        .slice(0, 5);

      return {
        matched: confidence >= minConfidence,
        supplier: confidence >= minConfidence ? bestMatch.supplier : undefined,
        confidence,
        suggestions,
        is_whitelisted: isWhitelisted,
      };
    } catch (error) {
      console.error('❌ Error matching supplier:', error);
      return {
        matched: false,
        confidence: 0,
        suggestions: [],
        is_whitelisted: false,
      };
    }
  }

  /**
   * Match supplier with multi-language support
   */
  static async matchSupplierMultiLanguage(
    supplierName: string,
    languages: string[] = ['it', 'en', 'fr', 'de', 'es']
  ): Promise<SupplierMatchResult> {
    try {
      // Try exact match first
      const exactMatch = await this.matchSupplier(supplierName, 95);
      if (exactMatch.matched) {
        return exactMatch;
      }

      // Try with variations
      const variations = this.generateNameVariations(supplierName);
      
      let bestMatch = exactMatch;
      let highestConfidence = exactMatch.confidence;

      for (const variation of variations) {
        const match = await this.matchSupplier(variation, 70);
        if (match.confidence > highestConfidence) {
          bestMatch = match;
          highestConfidence = match.confidence;
        }
      }

      return bestMatch;
    } catch (error) {
      console.error('❌ Error in multi-language supplier matching:', error);
      return {
        matched: false,
        confidence: 0,
        suggestions: [],
        is_whitelisted: false,
      };
    }
  }

  /**
   * Generate name variations for matching
   */
  private static generateNameVariations(name: string): string[] {
    const variations: string[] = [];
    
    // Add original
    variations.push(name);

    // Add normalized
    variations.push(this.normalizeSupplierName(name));

    // Add without common suffixes
    const withoutSuffix = name.replace(/\b(srl|spa|snc|sas|s\.r\.l\.|s\.p\.a\.|s\.n\.c\.|s\.a\.s\.)\b/gi, '').trim();
    variations.push(withoutSuffix);

    // Add with common abbreviations
    const abbreviations: Record<string, string> = {
      'società': 'soc',
      'responsabilità': 'resp',
      'limitata': 'ltd',
      'company': 'co',
      'corporation': 'corp',
    };

    let abbreviated = name;
    for (const [full, abbr] of Object.entries(abbreviations)) {
      abbreviated = abbreviated.replace(new RegExp(`\\b${full}\\b`, 'gi'), abbr);
    }
    variations.push(abbreviated);

    return [...new Set(variations)]; // Remove duplicates
  }

  /**
   * Add supplier to whitelist
   */
  static async addToWhitelist(
    supplierName: string,
    priority: number = 0,
    notes?: string
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('app_43909_supplier_whitelist')
        .upsert({
          user_id: user.id,
          supplier_name: supplierName,
          is_active: true,
          priority,
          notes,
        }, {
          onConflict: 'user_id,supplier_name',
        });

      if (error) throw error;
      console.log('✅ Supplier added to whitelist:', supplierName);
    } catch (error) {
      console.error('❌ Error adding to whitelist:', error);
      throw error;
    }
  }

  /**
   * Remove supplier from whitelist
   */
  static async removeFromWhitelist(supplierName: string): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('app_43909_supplier_whitelist')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('supplier_name', supplierName);

      if (error) throw error;
      console.log('✅ Supplier removed from whitelist:', supplierName);
    } catch (error) {
      console.error('❌ Error removing from whitelist:', error);
      throw error;
    }
  }

  /**
   * Get all whitelisted suppliers
   */
  static async getWhitelistedSuppliers(): Promise<Array<{
    supplier_name: string;
    priority: number;
    notes?: string;
    created_at: string;
  }>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('app_43909_supplier_whitelist')
        .select('supplier_name, priority, notes, created_at')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('priority', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching whitelisted suppliers:', error);
      return [];
    }
  }
}