import { supabase } from './supabase';
import type { Supplier } from '@/types';

/**
 * Supplier Matcher - Matches extracted suppliers from invoices with existing suppliers
 * Uses fuzzy matching on name, email, and phone to identify existing suppliers
 */

interface ExtractedSupplier {
  name: string;
  email?: string;
  phone?: string;
}

interface MatchResult {
  supplier: Supplier;
  similarity: number;
  matchType: 'exact' | 'fuzzy' | 'none';
  matchedBy: 'name' | 'email' | 'phone' | 'combined';
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
 * Calculate Levenshtein distance
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
 * Match extracted supplier with existing suppliers
 * NOTE: Whitelist functionality removed - all suppliers are now matched from 'suppliers' table
 */
export async function matchSupplier(
  extractedSupplier: ExtractedSupplier,
  userId: string
): Promise<MatchResult | null> {
  try {
    // CRITICAL FIX: Use correct table name 'suppliers' instead of 'app_43909_suppliers'
    const { data: existingSuppliers, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('user_id', userId);

    if (error) {
      console.error('❌ Error matching supplier:', error);
      return null;
    }

    if (!existingSuppliers || existingSuppliers.length === 0) {
      return null;
    }

    // Find best match
    let bestMatch: MatchResult | null = null;
    let highestSimilarity = 0;

    for (const supplier of existingSuppliers) {
      // Match by email (exact)
      if (extractedSupplier.email && supplier.email && 
          extractedSupplier.email.toLowerCase() === supplier.email.toLowerCase()) {
        return {
          supplier,
          similarity: 100,
          matchType: 'exact',
          matchedBy: 'email'
        };
      }

      // Match by phone (exact)
      if (extractedSupplier.phone && supplier.phone && 
          extractedSupplier.phone.replace(/\s/g, '') === supplier.phone.replace(/\s/g, '')) {
        return {
          supplier,
          similarity: 100,
          matchType: 'exact',
          matchedBy: 'phone'
        };
      }

      // Match by name (fuzzy)
      const nameSimilarity = calculateSimilarity(extractedSupplier.name, supplier.name);
      
      if (nameSimilarity === 100) {
        return {
          supplier,
          similarity: 100,
          matchType: 'exact',
          matchedBy: 'name'
        };
      }

      if (nameSimilarity > 80 && nameSimilarity > highestSimilarity) {
        highestSimilarity = nameSimilarity;
        bestMatch = {
          supplier,
          similarity: nameSimilarity,
          matchType: 'fuzzy',
          matchedBy: 'name'
        };
      }
    }

    return bestMatch;
  } catch (error) {
    console.error('❌ Exception in matchSupplier:', error);
    return null;
  }
}

/**
 * DEPRECATED: Whitelist functionality removed
 * All suppliers are now managed through the 'suppliers' table
 */
export async function addToWhitelist(
  supplierName: string,
  userId: string
): Promise<boolean> {
  console.warn('⚠️ addToWhitelist is deprecated - whitelist functionality removed');
  return true;
}

/**
 * DEPRECATED: Whitelist functionality removed
 */
export async function removeFromWhitelist(
  supplierName: string,
  userId: string
): Promise<boolean> {
  console.warn('⚠️ removeFromWhitelist is deprecated - whitelist functionality removed');
  return true;
}

/**
 * DEPRECATED: Whitelist functionality removed
 */
export async function isWhitelisted(
  supplierName: string,
  userId: string
): Promise<boolean> {
  console.warn('⚠️ isWhitelisted is deprecated - whitelist functionality removed');
  return false;
}

// Export as SupplierMatcher object to match the import pattern in SuppliersSection.tsx
export const SupplierMatcher = {
  matchSupplier,
  addToWhitelist,
  removeFromWhitelist,
  isWhitelisted
};

export default {
  matchSupplier,
  addToWhitelist,
  removeFromWhitelist,
  isWhitelisted
};