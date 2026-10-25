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
/* ------------------------------------------------------------------ */
/* Canonical supplier resolution for invoices                          */
/* Invoices may carry only an OCR-detected name and no supplier_id, so */
/* every grouped list must resolve the canonical supplier first:       */
/* supplier_id -> normalized-name match -> normalized raw name.        */
/* ------------------------------------------------------------------ */

interface SupplierRef {
  id: string;
  name: string;
}

export interface InvoiceLike {
  id: string;
  supplier_id?: string | null;
  supplierId?: string | null;
  supplier_name?: string | null;
}

export interface SupplierIndex {
  byId: Map<string, SupplierRef>;
  byName: Map<string, SupplierRef>;
}

export interface SupplierFilterOption {
  key: string;
  label: string;
  count: number;
}

export interface InvoiceSupplierLink {
  id: string;
  supplier_id: string;
  supplier_name: string;
}

/** Comparable key for a supplier name (case, spacing and legal suffix insensitive). */
export const supplierNameKey = (name?: string | null): string =>
  normalizeSupplierName(name ?? '').toLowerCase();

const getInvoiceSupplierId = (invoice: InvoiceLike): string =>
  invoice.supplier_id || invoice.supplierId || '';

export const buildSupplierIndex = (suppliers: SupplierRef[]): SupplierIndex => {
  const byId = new Map<string, SupplierRef>();
  const byName = new Map<string, SupplierRef>();
  for (const supplier of suppliers) {
    byId.set(supplier.id, supplier);
    const key = supplierNameKey(supplier.name);
    if (key && !byName.has(key)) byName.set(key, supplier);
  }
  return { byId, byName };
};

export const resolveInvoiceSupplier = (
  invoice: InvoiceLike,
  index: SupplierIndex
): SupplierRef | undefined => {
  const supplierId = getInvoiceSupplierId(invoice);
  if (supplierId && index.byId.has(supplierId)) return index.byId.get(supplierId);
  const key = supplierNameKey(invoice.supplier_name);
  return key ? index.byName.get(key) : undefined;
};

/** Stable key: the same supplier always yields the same key, whatever the OCR spelling. */
export const getCanonicalSupplierKey = (invoice: InvoiceLike, index: SupplierIndex): string => {
  const supplier = resolveInvoiceSupplier(invoice, index);
  if (supplier) return supplier.id;
  const key = supplierNameKey(invoice.supplier_name);
  return key ? `name:${key}` : '';
};

export const getCanonicalSupplierName = (
  invoice: InvoiceLike,
  index: SupplierIndex,
  fallback = ''
): string => {
  const supplier = resolveInvoiceSupplier(invoice, index);
  if (supplier) return supplier.name;
  const raw = (invoice.supplier_name ?? '').replace(/\s+/g, ' ').trim();
  return raw || fallback;
};

/** De-duplicated supplier filter options with real invoice counts. */
export const buildSupplierOptions = (
  invoices: InvoiceLike[],
  index: SupplierIndex
): SupplierFilterOption[] => {
  const options = new Map<string, SupplierFilterOption>();
  for (const invoice of invoices) {
    const key = getCanonicalSupplierKey(invoice, index);
    if (!key) continue;
    const existing = options.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      options.set(key, { key, label: getCanonicalSupplierName(invoice, index, key), count: 1 });
    }
  }
  return [...options.values()].sort((a, b) => a.label.localeCompare(b.label));
};

/** Legacy invoices without supplier_id whose name matches a known supplier. */
export const findUnlinkedInvoiceSuppliers = (
  invoices: InvoiceLike[],
  index: SupplierIndex,
  limit = 50
): InvoiceSupplierLink[] => {
  const links: InvoiceSupplierLink[] = [];
  for (const invoice of invoices) {
    if (links.length >= limit) break;
    if (getInvoiceSupplierId(invoice)) continue;
    const supplier = index.byName.get(supplierNameKey(invoice.supplier_name));
    if (supplier) links.push({ id: invoice.id, supplier_id: supplier.id, supplier_name: supplier.name });
  }
  return links;
};
