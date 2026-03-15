/**
 * Product Similarity Detection and Matching
 * Implements intelligent algorithms to find similar products across different suppliers
 */

import type { Product } from '@/types';

export interface SimilarProductMatch {
  newProduct: Product;
  existingProduct: Product;
  similarity: number; // 0-100
  priceDifference: number; // percentage
  savings: number; // absolute amount
  savingsPercent: number; // percentage
}

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits required to change one word into another
 */
function levenshteinDistance(str1: string, str2: string): number {
  const len1 = str1.length;
  const len2 = str2.length;
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // deletion
        matrix[i][j - 1] + 1,      // insertion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[len1][len2];
}

/**
 * Calculate string similarity percentage (0-100)
 * Uses Levenshtein distance normalized by the length of the longer string
 */
export function calculateStringSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  if (str1 === str2) return 100;

  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
  const maxLength = Math.max(str1.length, str2.length);
  const similarity = ((maxLength - distance) / maxLength) * 100;

  return Math.round(similarity);
}

/**
 * Extract key words from product name for better matching
 * Removes common words and focuses on meaningful terms
 */
function extractKeywords(productName: string): string[] {
  const commonWords = new Set([
    'di', 'da', 'in', 'con', 'per', 'il', 'la', 'i', 'le', 'un', 'una',
    'kg', 'g', 'l', 'ml', 'pz', 'confezione', 'conf', 'pack'
  ]);

  return productName
    .toLowerCase()
    .split(/[\s,.-]+/)
    .filter(word => word.length > 2 && !commonWords.has(word));
}

/**
 * Calculate keyword overlap similarity
 * Checks how many keywords are shared between two product names
 */
function calculateKeywordSimilarity(name1: string, name2: string): number {
  const keywords1 = new Set(extractKeywords(name1));
  const keywords2 = new Set(extractKeywords(name2));

  if (keywords1.size === 0 || keywords2.size === 0) return 0;

  const intersection = new Set([...keywords1].filter(x => keywords2.has(x)));
  const union = new Set([...keywords1, ...keywords2]);

  return (intersection.size / union.size) * 100;
}

/**
 * Find similar products using multiple similarity algorithms
 * Combines string similarity and keyword matching for better results
 * IMPORTANT: Never matches products from the same supplier
 */
export function findSimilarProducts(
  newProducts: Product[],
  existingProducts: Product[],
  options: {
    minSimilarity?: number;
    maxPriceDifference?: number;
  } = {}
): SimilarProductMatch[] {
  const {
    minSimilarity = 70,
    maxPriceDifference = 0.30, // 30%
  } = options;

  const matches: SimilarProductMatch[] = [];

  for (const newProduct of newProducts) {
    for (const existingProduct of existingProducts) {
      // Skip if same product
      if (newProduct.id === existingProduct.id) continue;

      // CRITICAL: Never compare products from the same supplier
      // This prevents meaningless price comparisons within the same supplier
      if (newProduct.supplier_id === existingProduct.supplier_id) {
        continue;
      }

      // Skip if either product has no supplier (shouldn't happen, but safety check)
      if (!newProduct.supplier_id || !existingProduct.supplier_id) {
        continue;
      }

      // Calculate name similarity using both algorithms
      const levenshteinSimilarity = calculateStringSimilarity(
        newProduct.name,
        existingProduct.name
      );
      const keywordSimilarity = calculateKeywordSimilarity(
        newProduct.name,
        existingProduct.name
      );

      // Use the higher similarity score
      const nameSimilarity = Math.max(levenshteinSimilarity, keywordSimilarity);

      // Calculate price difference (as percentage)
      const priceDiff = Math.abs(newProduct.price - existingProduct.price) / existingProduct.price;

      // Check if products match criteria
      if (nameSimilarity >= minSimilarity && priceDiff <= maxPriceDifference) {
        const savings = existingProduct.price - newProduct.price;
        const savingsPercent = (savings / existingProduct.price) * 100;

        matches.push({
          newProduct,
          existingProduct,
          similarity: Math.round(nameSimilarity),
          priceDifference: Math.round(priceDiff * 100),
          savings,
          savingsPercent: Math.round(savingsPercent)
        });
      }
    }
  }

  // Sort by similarity (highest first), then by savings (best deal first)
  return matches.sort((a, b) => {
    if (b.similarity !== a.similarity) {
      return b.similarity - a.similarity;
    }
    return b.savings - a.savings;
  });
}

/**
 * Group similar product matches by new product
 * Useful for displaying suggestions organized by the newly added product
 */
export function groupMatchesByNewProduct(
  matches: SimilarProductMatch[]
): Map<string, SimilarProductMatch[]> {
  const grouped = new Map<string, SimilarProductMatch[]>();

  for (const match of matches) {
    const productId = match.newProduct.id;
    if (!grouped.has(productId)) {
      grouped.set(productId, []);
    }
    grouped.get(productId)!.push(match);
  }

  return grouped;
}