import type { Product } from '@/types';

// Similarity threshold for matching products (70% = more permissive matching)
const SIMILARITY_THRESHOLD = 70;

// Dictionary of common OCR errors and their corrections
const OCR_CORRECTIONS: Record<string, string> = {
  // Common misspellings
  'rigatons': 'rigatoni',
  'kicotta': 'ricotta',
  'ricota': 'ricotta',
  'foccaccia': 'focaccia',
  'focacia': 'focaccia',
  'ol!ve': 'olive',
  '01ive': 'olive',
  'o1ive': 'olive',
  'acc:runns': 'aceitunas',
  'strigol1': 'strigoli',
  'strigoli': 'strigoli',
  'mozzare11a': 'mozzarella',
  'mozzare1la': 'mozzarella',
  'parmig!ano': 'parmigiano',
  'parmig1ano': 'parmigiano',
  
  // Incomplete suffixes
  'crema forte fo': 'crema forte',
  'pizza margherita ma': 'pizza margherita',
};

/**
 * Apply OCR corrections from dictionary
 */
function applyOCRCorrections(name: string): string {
  const normalized = name.toLowerCase().trim();
  
  // Check exact match in dictionary
  if (OCR_CORRECTIONS[normalized]) {
    console.log(`🔧 [OCR Correction] "${name}" → "${OCR_CORRECTIONS[normalized]}" (dictionary match)`);
    return OCR_CORRECTIONS[normalized];
  }
  
  // Check partial matches (if dictionary key is contained in name)
  for (const [error, correction] of Object.entries(OCR_CORRECTIONS)) {
    if (normalized.includes(error)) {
      const corrected = name.toLowerCase().replace(error, correction);
      console.log(`🔧 [OCR Correction] "${name}" → "${corrected}" (partial dictionary match)`);
      return corrected;
    }
  }
  
  return name;
}

/**
 * Normalize string for fast exact matching (remove special chars, lowercase)
 */
function normalizeForMatching(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Calculate Levenshtein distance between two strings
 * Used for fuzzy matching product names
 */
function levenshteinDistance(str1: string, str2: string): number {
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
}

/**
 * Calculate similarity percentage between two strings
 * Returns a value between 0 and 100
 */
function calculateSimilarity(str1: string, str2: string): number {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) {
    return 100;
  }
  
  const distance = levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
  return ((longer.length - distance) / longer.length) * 100;
}

/**
 * Remove incomplete suffix words (1-2 letters at the end)
 * Example: "Crema Forte fo" → "Crema Forte"
 */
function removeIncompleteSuffix(name: string): string {
  const words = name.trim().split(/\s+/);
  
  // If last word is 1-2 letters and there are more words before it
  if (words.length > 1) {
    const lastWord = words[words.length - 1];
    if (lastWord.length <= 2 && !/^\d+$/.test(lastWord)) {
      // Don't remove if it's a number
      words.pop();
      console.log(`🧹 [Suffix Removal] "${name}" → "${words.join(' ')}" (removed "${lastWord}")`);
      return words.join(' ');
    }
  }
  
  return name;
}

/**
 * Replace common OCR character mistakes
 * Example: "Acc:runns" → "Acerunns", "Ol!ve" → "Olive"
 */
function replaceSpecialCharacters(name: string): string {
  const original = name;
  
  // Common OCR mistakes
  const cleaned = name
    .replace(/:/g, 'e')  // : → e
    .replace(/!/g, 'i')  // ! → i
    .replace(/1(?=[a-z])/gi, 'i')  // 1 → i (when followed by letter)
    .replace(/0(?=[a-z])/gi, 'o')  // 0 → o (when followed by letter)
    .replace(/\|/g, 'l')  // | → l
    .replace(/\[/g, 'l')  // [ → l
    .replace(/\]/g, 'l')  // ] → l
    .replace(/\{/g, 'l')  // { → l
    .replace(/\}/g, 'l'); // } → l
  
  if (cleaned !== original) {
    console.log(`🔧 [Char Replace] "${original}" → "${cleaned}"`);
  }
  
  return cleaned;
}

/**
 * Normalize capitalization: First letter of each word uppercase
 * Example: "RICOTTA CANNOLI" → "Ricotta Cannoli"
 */
function normalizeCapitalization(name: string): string {
  const original = name;
  
  const normalized = name
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  if (normalized !== original) {
    console.log(`📝 [Capitalize] "${original}" → "${normalized}"`);
  }
  
  return normalized;
}

/**
 * Remove multiple spaces
 * Example: "Crema  Forte" → "Crema Forte"
 */
function removeMultipleSpaces(name: string): string {
  const original = name;
  const cleaned = name.replace(/\s+/g, ' ').trim();
  
  if (cleaned !== original) {
    console.log(`🧹 [Spaces] "${original}" → "${cleaned}"`);
  }
  
  return cleaned;
}

/**
 * Apply basic cleaning rules to a product name
 * Rules: OCR corrections, remove suffix, replace special chars, normalize caps, remove spaces
 */
export function cleanProductName(name: string): string {
  if (!name || typeof name !== 'string') {
    return name;
  }
  
  console.log(`\n🧹 [Cleaning] Starting with: "${name}"`);
  
  let cleaned = name;
  
  // Step 1: Apply OCR corrections from dictionary FIRST
  cleaned = applyOCRCorrections(cleaned);
  
  // Step 2: Remove special characters and apply other cleaning rules
  cleaned = removeMultipleSpaces(cleaned);
  cleaned = replaceSpecialCharacters(cleaned);
  cleaned = removeIncompleteSuffix(cleaned);
  cleaned = normalizeCapitalization(cleaned);
  cleaned = removeMultipleSpaces(cleaned); // Final cleanup
  
  console.log(`✨ [Cleaning] Final result: "${cleaned}"`);
  
  return cleaned;
}

/**
 * Find best matching product from database
 * OPTIMIZATION D: Limit to first 200 products + fast exact match check
 * Returns product if similarity > SIMILARITY_THRESHOLD (70%), otherwise null
 */
export function findBestMatch(
  cleanedName: string, 
  existingProducts: Product[]
): { product: Product | null; similarity: number } {
  if (!cleanedName || !existingProducts || existingProducts.length === 0) {
    return { product: null, similarity: 0 };
  }
  
  // OPTIMIZATION D: Limit to first 200 products for faster matching
  const productsToSearch = existingProducts.slice(0, 200);
  
  // OPTIMIZATION D: Fast exact match check first (normalized)
  const normalizedClean = normalizeForMatching(cleanedName);
  
  const exactMatch = productsToSearch.find(p => 
    normalizeForMatching(p.name) === normalizedClean
  );
  
  if (exactMatch) {
    console.log(`✅ [Match Found] "${cleanedName}" → "${exactMatch.name}" (exact match 100%)`);
    return { product: exactMatch, similarity: 100 };
  }
  
  // If no exact match, proceed with fuzzy matching
  let bestMatch: Product | null = null;
  let bestSimilarity = 0;
  
  for (const product of productsToSearch) {
    if (!product.name) continue;
    
    const similarity = calculateSimilarity(cleanedName, product.name);
    
    if (similarity > bestSimilarity) {
      bestSimilarity = similarity;
      bestMatch = product;
    }
  }
  
  // Only return match if similarity > SIMILARITY_THRESHOLD (70%)
  if (bestSimilarity > SIMILARITY_THRESHOLD) {
    console.log(`✅ [Match Found] "${cleanedName}" → "${bestMatch?.name}" (${bestSimilarity.toFixed(1)}% similar)`);
    return { product: bestMatch, similarity: bestSimilarity };
  }
  
  console.log(`🔍 [No Match] "${cleanedName}" (best: ${bestSimilarity.toFixed(1)}%, threshold: ${SIMILARITY_THRESHOLD}%)`);
  return { product: null, similarity: bestSimilarity };
}

/**
 * Post-process OCR extracted products
 * Apply cleaning rules and match with existing products
 */
export function postProcessOCRProducts(
  extractedProducts: Array<{
    name: string;
    quantity?: number | string;
    price?: number;
    unit?: string;
    vatRate?: number;
    ean_code?: string;
  }>,
  existingProducts: Product[]
): Array<{
  name: string;
  originalName: string;
  quantity?: number | string;
  price?: number;
  unit?: string;
  vatRate?: number;
  ean_code?: string;
  matchedProduct?: Product;
  similarity?: number;
}> {
  console.log(`\n🔄 [Post-Processing] Starting for ${extractedProducts.length} products...`);
  
  return extractedProducts.map((item, index) => {
    console.log(`\n--- Product ${index + 1}/${extractedProducts.length} ---`);
    console.log(`📦 [Original OCR] "${item.name}"`);
    
    const originalName = item.name;
    
    // Step 1: Clean the name
    const cleanedName = cleanProductName(item.name);
    
    // Step 2: Try to find match in database
    const { product: matchedProduct, similarity } = findBestMatch(cleanedName, existingProducts);
    
    // Step 3: Decide final name
    let finalName = cleanedName;
    
    if (matchedProduct) {
      finalName = matchedProduct.name;
      console.log(`🎯 [Final Decision] Using database name: "${finalName}"`);
    } else {
      console.log(`🎯 [Final Decision] Using cleaned name: "${finalName}"`);
    }
    
    return {
      ...item,
      name: finalName,
      originalName,
      matchedProduct: matchedProduct || undefined,
      similarity: similarity || undefined
    };
  });
}

/**
 * Get post-processing statistics
 */
export function getPostProcessingStats(
  processedProducts: Array<{
    name: string;
    originalName: string;
    matchedProduct?: Product;
    similarity?: number;
  }>
): {
  total: number;
  cleaned: number;
  matched: number;
  unchanged: number;
} {
  const total = processedProducts.length;
  let cleaned = 0;
  let matched = 0;
  let unchanged = 0;
  
  processedProducts.forEach(item => {
    if (item.matchedProduct) {
      matched++;
    } else if (item.name !== item.originalName) {
      cleaned++;
    } else {
      unchanged++;
    }
  });
  
  return { total, cleaned, matched, unchanged };
}