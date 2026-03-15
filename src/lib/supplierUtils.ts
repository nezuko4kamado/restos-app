/**
 * Utility functions for supplier name normalization and matching
 */

/**
 * Normalize supplier name by removing common legal suffixes and formatting
 */
export const normalizeSupplierName = (name: string): string => {
  if (!name) return '';
  
  let normalized = name.trim().toUpperCase();
  
  // Remove common legal entity suffixes
  const suffixes = [
    'S.A.',
    'S.L.',
    'S.R.L.',
    'S.P.A.',
    'S.A.S.',
    'S.N.C.',
    'LTD',
    'LIMITED',
    'INC',
    'INCORPORATED',
    'CORP',
    'CORPORATION',
    'LLC',
    'L.L.C.',
    'GMBH',
    'AG',
  ];
  
  for (const suffix of suffixes) {
    // Remove suffix with or without comma
    normalized = normalized
      .replace(new RegExp(`,?\\s*${suffix.replace(/\./g, '\\.')}$`, 'i'), '')
      .trim();
  }
  
  // Remove extra spaces
  normalized = normalized.replace(/\s+/g, ' ');
  
  return normalized;
};

/**
 * Calculate similarity between two strings (0-100)
 * Uses Levenshtein distance algorithm
 */
export const calculateSimilarity = (str1: string, str2: string): number => {
  const s1 = str1.toLowerCase();
  const s2 = str2.toLowerCase();
  
  if (s1 === s2) return 100;
  
  const len1 = s1.length;
  const len2 = s2.length;
  
  if (len1 === 0) return 0;
  if (len2 === 0) return 0;
  
  // Create matrix
  const matrix: number[][] = [];
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }
  
  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,     // deletion
        matrix[i][j - 1] + 1,     // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }
  
  const distance = matrix[len1][len2];
  const maxLen = Math.max(len1, len2);
  const similarity = ((maxLen - distance) / maxLen) * 100;
  
  return Math.round(similarity);
};

/**
 * Normalize phone number by removing spaces, dashes, and country codes
 */
const normalizePhone = (phone: string): string => {
  if (!phone) return '';
  // Remove all non-digit characters
  let normalized = phone.replace(/\D/g, '');
  // Remove leading country codes (1-3 digits)
  if (normalized.length > 10) {
    normalized = normalized.slice(-10); // Keep last 10 digits
  }
  return normalized;
};

/**
 * Normalize email by converting to lowercase and trimming
 */
const normalizeEmail = (email: string): string => {
  if (!email) return '';
  return email.toLowerCase().trim();
};

/**
 * Find similar supplier by name, email, or phone
 * Returns the most similar supplier if similarity is above threshold
 */
export const findSimilarSupplier = <T extends { id: string; name: string; email?: string; phone?: string }>(
  supplierName: string,
  existingSuppliers: T[],
  threshold: number = 80,
  email?: string,
  phone?: string
): T | null => {
  if (!supplierName || existingSuppliers.length === 0) return null;
  
  const normalizedInputName = normalizeSupplierName(supplierName);
  const normalizedInputEmail = email ? normalizeEmail(email) : '';
  const normalizedInputPhone = phone ? normalizePhone(phone) : '';
  
  // First, check for exact email or phone match (highest priority)
  if (normalizedInputEmail || normalizedInputPhone) {
    for (const supplier of existingSuppliers) {
      // Exact email match
      if (normalizedInputEmail && supplier.email) {
        const supplierEmail = normalizeEmail(supplier.email);
        if (supplierEmail === normalizedInputEmail) {
          console.log(`✅ Found supplier by exact email match: "${supplier.name}"`);
          return supplier;
        }
      }
      
      // Exact phone match
      if (normalizedInputPhone && supplier.phone) {
        const supplierPhone = normalizePhone(supplier.phone);
        if (supplierPhone === normalizedInputPhone) {
          console.log(`✅ Found supplier by exact phone match: "${supplier.name}"`);
          return supplier;
        }
      }
    }
  }
  
  // If no exact email/phone match, try name similarity
  let bestMatch: T | null = null;
  let bestScore = 0;
  
  for (const supplier of existingSuppliers) {
    const normalizedExisting = normalizeSupplierName(supplier.name);
    
    // Exact match after normalization
    if (normalizedInputName === normalizedExisting) {
      console.log(`✅ Found supplier by exact normalized name: "${supplier.name}"`);
      return supplier;
    }
    
    // Calculate similarity
    const similarity = calculateSimilarity(normalizedInputName, normalizedExisting);
    
    if (similarity > bestScore && similarity >= threshold) {
      bestScore = similarity;
      bestMatch = supplier;
    }
  }
  
  if (bestMatch) {
    console.log(`🔍 Found similar supplier by name: "${supplierName}" → "${bestMatch.name}" (${bestScore}% match)`);
  }
  
  return bestMatch;
};