import { supabase } from '@/lib/supabase';
import { SupplierWhitelist, Supplier } from '@/types';

export class SupplierWhitelistService {
  /**
   * Add supplier to whitelist
   */
  static async addSupplier(
    supplierName: string,
    priority: number = 0,
    notes?: string
  ): Promise<SupplierWhitelist | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('app_43909_supplier_whitelist')
        .insert({
          user_id: user.id,
          supplier_name: supplierName,
          is_active: true,
          priority,
          notes,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error adding supplier to whitelist:', error);
      return null;
    }
  }

  /**
   * Get all whitelisted suppliers
   */
  static async getWhitelistedSuppliers(activeOnly: boolean = true): Promise<SupplierWhitelist[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from('app_43909_supplier_whitelist')
        .select('*')
        .eq('user_id', user.id)
        .order('priority', { ascending: false })
        .order('supplier_name', { ascending: true });

      if (activeOnly) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching whitelisted suppliers:', error);
      return [];
    }
  }

  /**
   * Check if supplier is whitelisted
   */
  static async isSupplierWhitelisted(supplierName: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { data, error } = await supabase
        .from('app_43909_supplier_whitelist')
        .select('id')
        .eq('user_id', user.id)
        .eq('supplier_name', supplierName)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return !!data;
    } catch (error) {
      console.error('Error checking supplier whitelist:', error);
      return false;
    }
  }

  /**
   * Update supplier whitelist entry
   */
  static async updateSupplier(
    id: string,
    updates: Partial<SupplierWhitelist>
  ): Promise<SupplierWhitelist | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const { data, error } = await supabase
        .from('app_43909_supplier_whitelist')
        .update(updates)
        .eq('id', id)
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating supplier whitelist:', error);
      return null;
    }
  }

  /**
   * Toggle supplier active status
   */
  static async toggleSupplierStatus(id: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // Get current status
      const { data: current } = await supabase
        .from('app_43909_supplier_whitelist')
        .select('is_active')
        .eq('id', id)
        .eq('user_id', user.id)
        .single();

      if (!current) return false;

      // Toggle status
      const { error } = await supabase
        .from('app_43909_supplier_whitelist')
        .update({ is_active: !current.is_active })
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error toggling supplier status:', error);
      return false;
    }
  }

  /**
   * Remove supplier from whitelist
   */
  static async removeSupplier(id: string): Promise<boolean> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await supabase
        .from('app_43909_supplier_whitelist')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('Error removing supplier from whitelist:', error);
      return false;
    }
  }

  /**
   * Get supplier priority
   */
  static async getSupplierPriority(supplierName: string): Promise<number> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { data, error } = await supabase
        .from('app_43909_supplier_whitelist')
        .select('priority')
        .eq('user_id', user.id)
        .eq('supplier_name', supplierName)
        .eq('is_active', true)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data?.priority || 0;
    } catch (error) {
      console.error('Error getting supplier priority:', error);
      return 0;
    }
  }

  /**
   * Find matching supplier from existing suppliers list
   * Uses fuzzy matching with 30% similarity threshold
   */
  static findMatchingSupplier(
    supplierName: string,
    suppliers: Supplier[],
    supplierPhone?: string
  ): { supplier: Supplier | null; similarity: number; matchType: string } {
    if (!supplierName) return { supplier: null, similarity: 0, matchType: 'none' };

    // Normalize text helper
    const normalizeText = (text: string): string => {
      let normalized = text.toLowerCase().trim();
      
      const businessPrefixes = [
        'comercial', 'commercial', 'fornitore', 'azienda', 'ditta', 'impresa',
        'societa', 'società', 'company', 'supplier', 'vendor'
      ];
      
      const legalSuffixes = [
        's\\.r\\.l\\.?', 'srl', 's\\.p\\.a\\.?', 'spa', 's\\.n\\.c\\.?', 'snc',
        's\\.a\\.s\\.?', 'sas', 's\\.s\\.?', 'ss', 'ltd', 'llc', 'inc',
        's\\.l\\.?', 'sl', 's\\.a\\.?', 'sa'
      ];
      
      const articles = ['il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'una', 'uno'];
      
      const wordsToRemove = [...businessPrefixes, ...legalSuffixes, ...articles];
      
      wordsToRemove.forEach((word) => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        normalized = normalized.replace(regex, '');
      });
      
      normalized = normalized.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, '');
      normalized = normalized.replace(/\s+/g, ' ').trim();
      
      return normalized;
    };

    // Phone number helper
    const normalizePhoneNumber = (phone: string): string => {
      if (!phone) return '';
      return phone.replace(/\D/g, '');
    };

    const getLastNDigits = (phone: string, n: number): string => {
      const normalized = normalizePhoneNumber(phone);
      return normalized.slice(-n);
    };

    // Levenshtein distance for fuzzy matching
    const levenshteinDistance = (str1: string, str2: string): number => {
      const len1 = str1.length;
      const len2 = str2.length;
      const matrix: number[][] = [];

      for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
      }
      for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
      }

      for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
          const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
          matrix[i][j] = Math.min(
            matrix[i - 1][j] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j - 1] + cost
          );
        }
      }

      return matrix[len1][len2];
    };

    const calculateSimilarity = (str1: string, str2: string): number => {
      const distance = levenshteinDistance(str1, str2);
      const maxLength = Math.max(str1.length, str2.length);
      if (maxLength === 0) return 100;
      return ((maxLength - distance) / maxLength) * 100;
    };

    // Try phone number matching first (most reliable)
    if (supplierPhone) {
      const ocrPhoneLast5 = getLastNDigits(supplierPhone, 5);
      
      if (ocrPhoneLast5.length === 5) {
        for (const supplier of suppliers) {
          if (supplier.phone) {
            const supplierPhoneLast5 = getLastNDigits(supplier.phone, 5);
            
            if (supplierPhoneLast5 === ocrPhoneLast5) {
              console.log(`✅ PHONE MATCH: "${supplierName}" → "${supplier.name}"`);
              return { supplier, similarity: 100, matchType: 'phone' };
            }
          }
        }
      }
    }

    // Exact name match (normalized)
    const normalizedSearchName = normalizeText(supplierName);
    
    for (const supplier of suppliers) {
      const normalizedSupplierName = normalizeText(supplier.name);
      if (normalizedSupplierName === normalizedSearchName) {
        console.log(`✅ EXACT NAME MATCH: "${supplierName}" → "${supplier.name}"`);
        return { supplier, similarity: 100, matchType: 'exact' };
      }
    }

    // Containment match
    for (const supplier of suppliers) {
      const normalizedSupplierName = normalizeText(supplier.name);
      const minLength = Math.min(normalizedSearchName.length, normalizedSupplierName.length);
      const maxLength = Math.max(normalizedSearchName.length, normalizedSupplierName.length);
      
      const threshold = minLength <= 5 ? 0.5 : 0.8;
      
      if (minLength / maxLength >= threshold) {
        if (normalizedSupplierName.includes(normalizedSearchName) || normalizedSearchName.includes(normalizedSupplierName)) {
          const similarity = calculateSimilarity(normalizedSearchName, normalizedSupplierName);
          console.log(`✅ CONTAINMENT MATCH: "${supplierName}" → "${supplier.name}" (${similarity.toFixed(1)}%)`);
          return { supplier, similarity, matchType: 'containment' };
        }
      }
    }

    // Fuzzy match with 30% similarity threshold (LOWERED FROM 85%)
    let bestMatch: Supplier | null = null;
    let bestSimilarity = 0;
    
    for (const supplier of suppliers) {
      const normalizedSupplierName = normalizeText(supplier.name);
      const similarity = calculateSimilarity(normalizedSearchName, normalizedSupplierName);
      
      // THRESHOLD LOWERED TO 30%
      if (similarity >= 30 && similarity > bestSimilarity) {
        bestMatch = supplier;
        bestSimilarity = similarity;
      }
    }

    if (bestMatch) {
      console.log(`✅ FUZZY MATCH (30% threshold): "${supplierName}" → "${bestMatch.name}" (${bestSimilarity.toFixed(1)}%)`);
      return { supplier: bestMatch, similarity: bestSimilarity, matchType: 'fuzzy' };
    }

    console.log(`❌ NO MATCH: Creating new supplier for "${supplierName}"`);
    return { supplier: null, similarity: 0, matchType: 'none' };
  }
}

// Export as SupplierMatchingService for backward compatibility
export const SupplierMatchingService = SupplierWhitelistService;