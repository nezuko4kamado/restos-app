import { Product, Supplier, Order, Invoice, PriceHistory, Settings } from '@/types';
import { supabase, isSupabaseConfigured, getCurrentUser } from './supabase';
import { getCountryCurrency } from './currency';

// Use the same keys as before for localStorage
const PRODUCTS_KEY = 'restaurant_products';
const SUPPLIERS_KEY = 'restaurant_suppliers';
const ORDERS_KEY = 'restaurant_orders';
const INVOICES_KEY = 'restaurant_invoices';
const SETTINGS_KEY = 'restaurant_settings';
const DRAFT_ORDER_KEY = 'resto_draft_order';
const CANCELLED_DRAFT_KEY = 'cancelled_draft_order';

// OrderItem interface for draft orders
interface OrderItem {
  product_id: string;
  quantity: number;
  price: number;
}

// Storage mode detection - RESTORED fallback to localStorage
export const getStorageMode = (): 'supabase' | 'localStorage' => {
  const mode = isSupabaseConfigured() ? 'supabase' : 'localStorage';
  console.log('🔍 Storage mode:', mode);
  if (mode === 'localStorage') {
    console.warn('⚠️ Using localStorage fallback - Supabase not configured');
  }
  return mode;
};

// Helper to get current user ID (returns null if not authenticated, doesn't throw)
const getUserId = async (): Promise<string | null> => {
  try {
    const user = await getCurrentUser();
    console.log('👤 Current user ID:', user?.id || 'NOT LOGGED IN');
    return user?.id || null;
  } catch (error) {
    console.warn('⚠️ Could not get user ID:', error);
    return null;
  }
};

// Helper to validate date string
const isValidDate = (dateString: string): boolean => {
  if (!dateString) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime());
};

// ============================================
// DRAFT ORDER MANAGEMENT - NEW FUNCTIONS
// ============================================

// Save draft order to localStorage
export const saveDraftOrder = (orderItems: OrderItem[], temporaryOcrProducts?: Product[]): void => {
  try {
    const draftData = {
      orderItems,
      temporaryOcrProducts: temporaryOcrProducts || [],
      timestamp: new Date().toISOString(),
    };
    localStorage.setItem(DRAFT_ORDER_KEY, JSON.stringify(draftData));
    console.log('💾 Saved draft order to localStorage:', draftData);
  } catch (error) {
    console.error('❌ Error saving draft order:', error);
  }
};

// Get draft order from localStorage
export const getDraftOrder = (): { orderItems: OrderItem[]; temporaryOcrProducts: Product[] } | null => {
  try {
    const draftData = localStorage.getItem(DRAFT_ORDER_KEY);
    if (draftData) {
      const parsed = JSON.parse(draftData);
      console.log('📥 Loaded draft order from localStorage:', parsed);
      return parsed;
    }
  } catch (error) {
    console.error('❌ Error loading draft order:', error);
  }
  return null;
};

// Clear draft order from localStorage
export const clearDraftOrder = (): void => {
  try {
    localStorage.removeItem(DRAFT_ORDER_KEY);
    console.log('🗑️ Cleared draft order from localStorage');
  } catch (error) {
    console.error('❌ Error clearing draft order:', error);
  }
};

// FIXED: Save cancelled draft order with temporaryOcrProducts
export const saveCancelledDraft = (orderItems: OrderItem[], temporaryOcrProducts?: Product[]): void => {
  try {
    console.log('💾 [saveCancelledDraft] Saving orderItems:', orderItems);
    console.log('💾 [saveCancelledDraft] Saving temporaryOcrProducts:', temporaryOcrProducts);
    
    const cancelledDraft = {
      orderItems,
      temporaryOcrProducts: temporaryOcrProducts || [],
      timestamp: new Date().toISOString()
    };
    
    const jsonString = JSON.stringify(cancelledDraft);
    console.log('💾 [saveCancelledDraft] JSON string length:', jsonString.length);
    
    localStorage.setItem(CANCELLED_DRAFT_KEY, jsonString);
    console.log('✅ [saveCancelledDraft] Saved successfully');
    
    // Verify save
    const verify = localStorage.getItem(CANCELLED_DRAFT_KEY);
    console.log('✅ [saveCancelledDraft] Verification read:', verify);
  } catch (error) {
    console.error('❌ [saveCancelledDraft] Failed to save:', error);
  }
};

// FIXED: Get cancelled draft order with temporaryOcrProducts
export const getCancelledDraft = (): { orderItems: OrderItem[]; temporaryOcrProducts: Product[] } | null => {
  try {
    const saved = localStorage.getItem(CANCELLED_DRAFT_KEY);
    console.log('📖 [getCancelledDraft] Raw localStorage value:', saved);
    
    if (saved) {
      const parsed = JSON.parse(saved);
      console.log('📖 [getCancelledDraft] Parsed object:', JSON.stringify(parsed, null, 2));
      
      if (parsed.orderItems && Array.isArray(parsed.orderItems)) {
        console.log('✅ [getCancelledDraft] Returning', parsed.orderItems.length, 'items');
        return {
          orderItems: parsed.orderItems,
          temporaryOcrProducts: parsed.temporaryOcrProducts || []
        };
      } else {
        console.error('❌ [getCancelledDraft] orderItems is not an array!');
        return null;
      }
    }
    
    console.log('📖 [getCancelledDraft] No saved data found');
    return null;
  } catch (error) {
    console.error('❌ [getCancelledDraft] Failed to get:', error);
    return null;
  }
};

// Clear cancelled draft order from localStorage
export const clearCancelledDraft = (): void => {
  try {
    localStorage.removeItem(CANCELLED_DRAFT_KEY);
    console.log('🗑️ Cleared cancelled draft');
  } catch (error) {
    console.error('❌ Failed to clear cancelled draft:', error);
  }
};

// IMPROVED: Helper to normalize supplier names for comparison
const normalizeSupplierName = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    // Remove common business prefixes/suffixes
    .replace(/\b(commercial|comercial|ditta|azienda)\b/gi, '')
    // Remove common legal suffixes
    .replace(/\b(s\.?a\.?|s\.?l\.?|s\.?r\.?l\.?|ltd\.?|inc\.?|llc\.?|gmbh\.?)\b/gi, '')
    // Remove punctuation
    .replace(/[.,/#!$%&*;:{}=\-_`~()]/g, '')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
};

// Helper to calculate similarity between two strings (Levenshtein distance)
const calculateSimilarity = (str1: string, str2: string): number => {
  const s1 = normalizeSupplierName(str1);
  const s2 = normalizeSupplierName(str2);
  
  if (s1 === s2) return 100;
  
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  
  if (longer.length === 0) return 100;
  
  // Calculate Levenshtein distance
  const editDistance = levenshteinDistance(longer, shorter);
  return ((longer.length - editDistance) / longer.length) * 100;
};

const levenshteinDistance = (str1: string, str2: string): number => {
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
};

// IMPROVED: Helper to find similar supplier with better normalization
// This will recognize "CBG" and "Commercial CBG" as the same supplier
export const findSimilarSupplier = (suppliers: Supplier[], newSupplierName: string): Supplier | null => {
  const SIMILARITY_THRESHOLD = 80;
  
  for (const supplier of suppliers) {
    const similarity = calculateSimilarity(supplier.name, newSupplierName);
    console.log(`🔍 Comparing "${newSupplierName}" with "${supplier.name}": ${similarity.toFixed(1)}% similar`);
    
    if (similarity >= SIMILARITY_THRESHOLD) {
      console.log(`✅ Found similar supplier: "${supplier.name}" (${similarity.toFixed(1)}% match)`);
      return supplier;
    }
  }
  
  return null;
};

// FIXED: Helper to remove duplicate products - now uses ONLY product name as key
export const removeDuplicateProducts = (products: Product[]): Product[] => {
  const seen = new Map<string, Product>();
  
  for (const product of products) {
    // FIXED: Use only normalized name as key (ignore supplier_id)
    const normalizedName = product.name.toLowerCase().trim();
    const key = normalizedName;
    
    if (!seen.has(key)) {
      seen.set(key, product);
    } else {
      // Keep the one with the most recent updated_at
      const existing = seen.get(key)!;
      const existingDate = new Date(existing.updated_at || existing.created_at || 0);
      const newDate = new Date(product.updated_at || product.created_at || 0);
      
      // Prefer products with valid supplier_id
      const existingHasSupplier = !!(existing.supplier_id || existing.supplierId);
      const newHasSupplier = !!(product.supplier_id || product.supplierId);
      
      if (newDate > existingDate || (!existingHasSupplier && newHasSupplier)) {
        console.log(`🔄 Replacing duplicate product: "${product.name}" (${newDate > existingDate ? 'newer version' : 'has supplier_id'})`);
        seen.set(key, product);
      } else {
        console.log(`⏭️ Skipping duplicate product: "${product.name}" (${newDate <= existingDate ? 'older version' : 'no supplier_id'})`);
      }
    }
  }
  
  const uniqueProducts = Array.from(seen.values());
  const duplicatesRemoved = products.length - uniqueProducts.length;
  
  if (duplicatesRemoved > 0) {
    console.log(`✅ Removed ${duplicatesRemoved} duplicate products`);
  }
  
  return uniqueProducts;
};

// Database types
interface DbProduct {
  id: string;
  user_id: string;
  name: string;
  code?: string;
  category: string;
  unit: string;
  supplier_id: string;
  price: number;
  vat_rate: number;
  discount_percent: number;
  price_history: PriceHistory[];
  created_at: string;
  updated_at: string;
}

interface DbSupplier {
  id: string;
  user_id: string;
  name: string;
  contact: string;
  email?: string;
  phone: string;
  mobile?: string;
  address?: string;
  created_at: string;
  updated_at: string;
}

interface DbOrder {
  id: string;
  user_id: string;
  supplier_id: string;
  status: string;
  total: number;
  notes: string;
  items: unknown;
  order_date: string;
  created_at: string;
  updated_at: string;
}

interface DbInvoice {
  id: string;
  user_id: string;
  supplier_id: string;
  invoice_number: string;
  date: string;
  total: number;
  items: unknown;
  created_at: string;
  updated_at: string;
}

// FIXED: Only include columns that actually exist in Supabase
interface DbSettings {
  id: string;
  user_id: string;
  country: string;
  language: string;
  created_at: string;
  updated_at: string;
}

// Helper to map Product to database format
const mapProductToDb = (product: Product, userId: string): Partial<DbProduct> => {
  return {
    id: product.id,
    user_id: userId,
    name: product.name,
    category: product.category || 'general',
    unit: product.unit || 'kg',
    supplier_id: product.supplier_id || product.supplierId || '',
    price: product.price,
    vat_rate: product.vatRate || 0,
    discount_percent: product.discountPercent || product.discount || 0,
    price_history: product.priceHistory || [],
    created_at: product.created_at || new Date().toISOString(),
    updated_at: product.updated_at || new Date().toISOString(),
    code: product.id
  };
};

// Helper to map database format to Product
const mapDbToProduct = (dbProduct: DbProduct): Product => {
  return {
    id: dbProduct.id,
    name: dbProduct.name,
    price: parseFloat(String(dbProduct.price)),
    category: dbProduct.category,
    unit: dbProduct.unit,
    supplier_id: dbProduct.supplier_id,
    supplierId: dbProduct.supplier_id,
    vatRate: parseFloat(String(dbProduct.vat_rate || 0)),
    discountPercent: parseFloat(String(dbProduct.discount_percent || 0)),
    discount: parseFloat(String(dbProduct.discount_percent || 0)),
    priceHistory: dbProduct.price_history || [],
    created_at: dbProduct.created_at,
    updated_at: dbProduct.updated_at
  };
};

// FIXED: Helper to map Supplier to database format - now includes mobile
const mapSupplierToDb = (supplier: Supplier, userId: string): DbSupplier => {
  return {
    id: supplier.id,
    user_id: userId,
    name: supplier.name,
    contact: supplier.phone,
    email: supplier.email,
    phone: supplier.phone,
    mobile: supplier.mobile,
    address: supplier.address,
    created_at: supplier.created_at || new Date().toISOString(),
    updated_at: supplier.updated_at || new Date().toISOString()
  };
};

// FIXED: Helper to map database format to Supplier - now includes mobile
const mapDbToSupplier = (dbSupplier: DbSupplier): Supplier => {
  return {
    id: dbSupplier.id,
    name: dbSupplier.name,
    phone: dbSupplier.phone || dbSupplier.contact || '',
    mobile: dbSupplier.mobile,
    email: dbSupplier.email,
    address: dbSupplier.address,
    products: [],
    created_at: dbSupplier.created_at,
    updated_at: dbSupplier.updated_at
  };
};

// Helper to map Order to database format
const mapOrderToDb = (order: Order, userId: string): DbOrder => {
  return {
    id: order.id,
    user_id: userId,
    supplier_id: order.items[0]?.supplierId || '',
    status: order.status,
    total: order.total,
    notes: '',
    items: order.items,
    order_date: order.date,
    created_at: order.created_at || new Date().toISOString(),
    updated_at: order.updated_at || new Date().toISOString()
  };
};

// Helper to map database format to Order
const mapDbToOrder = (dbOrder: DbOrder): Order => {
  return {
    id: dbOrder.id,
    date: dbOrder.order_date,
    items: (dbOrder.items as Order['items']) || [],
    total: parseFloat(String(dbOrder.total)),
    status: dbOrder.status as Order['status'],
    created_at: dbOrder.created_at,
    updated_at: dbOrder.updated_at
  };
};

// CRITICAL FIX: Helper to map Invoice to database format with validation
const mapInvoiceToDb = (invoice: Invoice, userId: string): DbInvoice => {
  // CRITICAL FIX 1: Convert ISO date string to DATE format (YYYY-MM-DD)
  const dateOnly = invoice.date.split('T')[0];
  
  // CRITICAL FIX 2: Validate supplier_id is a valid UUID
  const supplierId = invoice.supplierId || invoice.supplier_id;
  if (!supplierId) {
    console.error('❌ CRITICAL: supplier_id is missing!', invoice);
    throw new Error('supplier_id is required for invoice');
  }
  
  // Validate UUID format
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(supplierId)) {
    console.error('❌ CRITICAL: supplier_id is not a valid UUID!', supplierId);
    throw new Error(`supplier_id must be a valid UUID, got: ${supplierId}`);
  }
  
  const dbInvoice: DbInvoice = {
    id: invoice.id,
    user_id: userId,
    supplier_id: supplierId,
    invoice_number: invoice.invoice_number || invoice.invoiceNumber || '',
    date: dateOnly,
    total: invoice.amount,
    items: invoice.items ? JSON.parse(JSON.stringify(invoice.items)) : [],
    created_at: invoice.created_at || invoice.createdAt || new Date().toISOString(),
    updated_at: invoice.updated_at || new Date().toISOString()
  };
  
  console.log('📋 Mapped invoice to DB format:');
  console.log('  - id:', dbInvoice.id);
  console.log('  - user_id:', dbInvoice.user_id);
  console.log('  - supplier_id:', dbInvoice.supplier_id);
  console.log('  - invoice_number:', dbInvoice.invoice_number);
  console.log('  - date:', dbInvoice.date);
  console.log('  - total:', dbInvoice.total);
  console.log('  - items:', Array.isArray(dbInvoice.items) ? `array[${(dbInvoice.items as unknown[]).length}]` : typeof dbInvoice.items);
  console.log('  - created_at:', dbInvoice.created_at);
  console.log('  - updated_at:', dbInvoice.updated_at);
  
  return dbInvoice;
};

// FIXED: Helper to map database format to Invoice - removed non-existent fields
const mapDbToInvoice = (dbInvoice: DbInvoice): Invoice => {
  return {
    id: dbInvoice.id,
    supplierId: dbInvoice.supplier_id,
    invoiceNumber: dbInvoice.invoice_number,
    invoice_number: dbInvoice.invoice_number,
    date: dbInvoice.date,
    amount: parseFloat(String(dbInvoice.total)),
    items: dbInvoice.items as Invoice['items'],
    created_at: dbInvoice.created_at,
    createdAt: dbInvoice.created_at,
    updated_at: dbInvoice.updated_at
  };
};

// FIXED: Only map columns that exist in Supabase (country, language)
const mapSettingsToDb = (settings: Settings, userId: string): Omit<DbSettings, 'id' | 'created_at' | 'updated_at'> => {
  return {
    user_id: userId,
    country: settings.country || 'IT',
    language: settings.language || 'it'
  };
};

// FIXED: Derive all other settings from country + use localStorage for notifications
const mapDbToSettings = (dbSettings: DbSettings): Settings => {
  const country = dbSettings.country || 'IT';
  
  // Get notification settings from localStorage if available
  let notificationSettings = {
    price_change_threshold: 10,
    recurring_order_reminder_days: 3,
    enable_recurring_reminders: true
  };
  
  try {
    const localData = localStorage.getItem(SETTINGS_KEY);
    if (localData) {
      const localSettings = JSON.parse(localData);
      if (localSettings.notifications) {
        notificationSettings = localSettings.notifications;
      }
    }
  } catch (error) {
    console.warn('⚠️ Could not read notification settings from localStorage:', error);
  }
  
  return {
    country: country,
    language: dbSettings.language || 'it',
    defaultCurrency: getCountryCurrency(country),
    fontSize: 'medium',
    layoutMode: 'expanded',
    priceApiKey: undefined,
    notifications: notificationSettings
  };
};

// ============================================
// PRODUCTS - Dual mode (Supabase + localStorage fallback)
// ============================================

const getProductsFromSupabase = async (): Promise<Product[]> => {
  const userId = await getUserId();
  if (!userId) {
    console.warn('⚠️ No user logged in, returning empty products');
    return [];
  }

  const { data, error } = await supabase
    .from('products')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching products from Supabase:', error);
    return [];
  }

  console.log('✅ Fetched', data?.length || 0, 'products from Supabase');
  const products = (data || []).map(mapDbToProduct);
  
  // Remove duplicates before returning
  return removeDuplicateProducts(products);
};

const getProductsFromLocalStorage = (): Product[] => {
  try {
    const data = localStorage.getItem(PRODUCTS_KEY);
    const products = data ? JSON.parse(data) : [];
    console.log('📥 Fetched', products.length, 'products from localStorage');
    
    // Remove duplicates before returning
    return removeDuplicateProducts(products);
  } catch (error) {
    console.error('❌ Error reading products from localStorage:', error);
    return [];
  }
};

const saveProductsToLocalStorage = (products: Product[]): void => {
  try {
    // Remove duplicates before saving
    const uniqueProducts = removeDuplicateProducts(products);
    localStorage.setItem(PRODUCTS_KEY, JSON.stringify(uniqueProducts));
    console.log('✅ Saved', uniqueProducts.length, 'products to localStorage');
  } catch (error) {
    console.error('❌ Error saving products to localStorage:', error);
  }
};

export const getProducts = async (): Promise<Product[]> => {
  const mode = getStorageMode();
  
  if (mode === 'supabase') {
    return await getProductsFromSupabase();
  }
  return getProductsFromLocalStorage();
};

export const saveProducts = async (products: Product[]): Promise<void> => {
  const mode = getStorageMode();
  
  // Remove duplicates before saving
  const uniqueProducts = removeDuplicateProducts(products);
  
  if (mode === 'supabase') {
    const userId = await getUserId();
    if (!userId) {
      console.warn('⚠️ No user logged in, falling back to localStorage');
      saveProductsToLocalStorage(uniqueProducts);
      return;
    }

    for (const product of uniqueProducts) {
      const dbProduct = mapProductToDb(product, userId);
      const { error } = await supabase.from('products').upsert(dbProduct);
      if (error) {
        console.error('❌ Error saving product to Supabase:', error);
        throw error;
      }
    }
    console.log('✅ Saved', uniqueProducts.length, 'products to Supabase');
  } else {
    saveProductsToLocalStorage(uniqueProducts);
  }
};

export const addProduct = async (product: Omit<Product, 'id'>): Promise<Product> => {
  const newProduct: Product = { ...product, id: crypto.randomUUID() };
  const mode = getStorageMode();
  
  if (mode === 'supabase') {
    const userId = await getUserId();
    if (userId) {
      const dbProduct = mapProductToDb(newProduct, userId);
      const { error } = await supabase.from('products').upsert(dbProduct);
      if (error) throw error;
      console.log('✅ Added product to Supabase');
    } else {
      const products = getProductsFromLocalStorage();
      products.push(newProduct);
      saveProductsToLocalStorage(products);
    }
  } else {
    const products = getProductsFromLocalStorage();
    products.push(newProduct);
    saveProductsToLocalStorage(products);
  }
  
  return newProduct;
};

export const updateProduct = async (id: string, updates: Partial<Product>): Promise<void> => {
  const mode = getStorageMode();
  
  if (mode === 'supabase') {
    const userId = await getUserId();
    if (userId) {
      const products = await getProducts();
      const existing = products.find(p => p.id === id);
      if (!existing) throw new Error('Product not found');
      
      const updated = { ...existing, ...updates };
      const dbProduct = mapProductToDb(updated, userId);
      const { error } = await supabase.from('products').update(dbProduct).eq('id', id);
      if (error) throw error;
    }
  } else {
    const products = getProductsFromLocalStorage();
    const index = products.findIndex(p => p.id === id);
    if (index !== -1) {
      products[index] = { ...products[index], ...updates };
      saveProductsToLocalStorage(products);
    }
  }
};

export const deleteProduct = async (id: string): Promise<void> => {
  const mode = getStorageMode();
  
  if (mode === 'supabase') {
    const { error } = await supabase.from('products').delete().eq('id', id);
    if (error) throw error;
  } else {
    const products = getProductsFromLocalStorage();
    saveProductsToLocalStorage(products.filter(p => p.id !== id));
  }
};

export const updatePrice = async (
  id: string,
  newPrice: number,
  source: string,
  invoiceId?: string
): Promise<void> => {
  const products = await getProducts();
  const product = products.find(p => p.id === id);
  if (!product) throw new Error('Product not found');

  const oldPrice = product.price;
  const changePercent = ((newPrice - oldPrice) / oldPrice) * 100;

  const historyEntry: PriceHistory = {
    price: oldPrice,
    date: new Date().toISOString(),
    change_percent: parseFloat(changePercent.toFixed(2)),
    source,
    invoice_id: invoiceId,
  };

  const priceHistory = product.priceHistory || [];
  priceHistory.push(historyEntry);

  await updateProduct(id, { price: newPrice, priceHistory });
};

// ============================================
// SUPPLIERS - Dual mode
// ============================================

const getSuppliersFromSupabase = async (): Promise<Supplier[]> => {
  const userId = await getUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('suppliers')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching suppliers from Supabase:', error);
    return [];
  }

  console.log('✅ Fetched', data?.length || 0, 'suppliers from Supabase');
  return (data || []).map(mapDbToSupplier);
};

const getSuppliersFromLocalStorage = (): Supplier[] => {
  try {
    const data = localStorage.getItem(SUPPLIERS_KEY);
    const suppliers = data ? JSON.parse(data) : [];
    console.log('📥 Fetched', suppliers.length, 'suppliers from localStorage');
    return suppliers;
  } catch (error) {
    console.error('❌ Error reading suppliers from localStorage:', error);
    return [];
  }
};

const saveSuppliersToLocalStorage = (suppliers: Supplier[]): void => {
  try {
    localStorage.setItem(SUPPLIERS_KEY, JSON.stringify(suppliers));
    console.log('✅ Saved', suppliers.length, 'suppliers to localStorage');
  } catch (error) {
    console.error('❌ Error saving suppliers to localStorage:', error);
  }
};

export const getSuppliers = async (): Promise<Supplier[]> => {
  const mode = getStorageMode();
  
  if (mode === 'supabase') {
    return await getSuppliersFromSupabase();
  }
  return getSuppliersFromLocalStorage();
};

export const saveSuppliers = async (suppliers: Supplier[]): Promise<void> => {
  const mode = getStorageMode();
  
  if (mode === 'supabase') {
    const userId = await getUserId();
    if (!userId) {
      saveSuppliersToLocalStorage(suppliers);
      return;
    }

    for (const supplier of suppliers) {
      const dbSupplier = mapSupplierToDb(supplier, userId);
      const { error } = await supabase.from('suppliers').upsert(dbSupplier);
      if (error) throw error;
    }
    console.log('✅ Saved', suppliers.length, 'suppliers to Supabase');
  } else {
    saveSuppliersToLocalStorage(suppliers);
  }
};

export const addSupplier = async (supplier: Omit<Supplier, 'id'>): Promise<Supplier> => {
  const newSupplier: Supplier = { ...supplier, id: crypto.randomUUID() };
  const mode = getStorageMode();
  
  if (mode === 'supabase') {
    const userId = await getUserId();
    if (userId) {
      const dbSupplier = mapSupplierToDb(newSupplier, userId);
      const { error } = await supabase.from('suppliers').insert(dbSupplier);
      if (error) throw error;
    } else {
      const suppliers = getSuppliersFromLocalStorage();
      suppliers.push(newSupplier);
      saveSuppliersToLocalStorage(suppliers);
    }
  } else {
    const suppliers = getSuppliersFromLocalStorage();
    suppliers.push(newSupplier);
    saveSuppliersToLocalStorage(suppliers);
  }
  
  return newSupplier;
};

export const updateSupplier = async (id: string, updates: Partial<Supplier>): Promise<void> => {
  const mode = getStorageMode();
  
  if (mode === 'supabase') {
    const userId = await getUserId();
    if (userId) {
      const suppliers = await getSuppliers();
      const existing = suppliers.find(s => s.id === id);
      if (!existing) throw new Error('Supplier not found');
      
      const updated = { ...existing, ...updates };
      const dbSupplier = mapSupplierToDb(updated, userId);
      const { error } = await supabase.from('suppliers').update(dbSupplier).eq('id', id);
      if (error) throw error;
    }
  } else {
    const suppliers = getSuppliersFromLocalStorage();
    const index = suppliers.findIndex(s => s.id === id);
    if (index !== -1) {
      suppliers[index] = { ...suppliers[index], ...updates };
      saveSuppliersToLocalStorage(suppliers);
    }
  }
};

// FIXED: Delete supplier with cascade delete for invoices
export const deleteSupplier = async (id: string): Promise<void> => {
  const mode = getStorageMode();
  
  if (mode === 'supabase') {
    const userId = await getUserId();
    if (!userId) {
      const suppliers = getSuppliersFromLocalStorage();
      saveSuppliersToLocalStorage(suppliers.filter(s => s.id !== id));
      
      const invoices = getInvoicesFromLocalStorage();
      saveInvoicesToLocalStorage(invoices.filter(inv => inv.supplierId !== id && inv.supplier_id !== id));
      return;
    }

    // First, delete all invoices associated with this supplier
    console.log('🗑️ Deleting invoices for supplier:', id);
    const { error: invoicesError } = await supabase
      .from('invoices')
      .delete()
      .eq('supplier_id', id);
    
    if (invoicesError) {
      console.error('❌ Error deleting supplier invoices:', invoicesError);
      throw invoicesError;
    }
    console.log('✅ Deleted invoices for supplier:', id);

    // Then delete the supplier
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) throw error;
    console.log('✅ Deleted supplier:', id);
  } else {
    const suppliers = getSuppliersFromLocalStorage();
    saveSuppliersToLocalStorage(suppliers.filter(s => s.id !== id));
    
    // Also delete invoices from localStorage
    const invoices = getInvoicesFromLocalStorage();
    saveInvoicesToLocalStorage(invoices.filter(inv => inv.supplierId !== id && inv.supplier_id !== id));
  }
};

// ============================================
// ORDERS - Dual mode
// ============================================

const getOrdersFromSupabase = async (): Promise<Order[]> => {
  const userId = await getUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching orders from Supabase:', error);
    return [];
  }

  return (data || []).map(mapDbToOrder);
};

const getOrdersFromLocalStorage = (): Order[] => {
  try {
    const data = localStorage.getItem(ORDERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('❌ Error reading orders from localStorage:', error);
    return [];
  }
};

const saveOrdersToLocalStorage = (orders: Order[]): void => {
  try {
    localStorage.setItem(ORDERS_KEY, JSON.stringify(orders));
  } catch (error) {
    console.error('❌ Error saving orders to localStorage:', error);
  }
};

export const getOrders = async (): Promise<Order[]> => {
  const mode = getStorageMode();
  
  if (mode === 'supabase') {
    return await getOrdersFromSupabase();
  }
  return getOrdersFromLocalStorage();
};

export const saveOrders = async (orders: Order[]): Promise<void> => {
  const mode = getStorageMode();
  
  if (mode === 'supabase') {
    const userId = await getUserId();
    if (!userId) {
      saveOrdersToLocalStorage(orders);
      return;
    }

    for (const order of orders) {
      const dbOrder = mapOrderToDb(order, userId);
      const { error } = await supabase.from('orders').upsert(dbOrder);
      if (error) throw error;
    }
  } else {
    saveOrdersToLocalStorage(orders);
  }
};

export const addOrder = async (order: Omit<Order, 'id'>): Promise<Order> => {
  const newOrder: Order = { ...order, id: crypto.randomUUID() };
  const mode = getStorageMode();
  
  if (mode === 'supabase') {
    const userId = await getUserId();
    if (userId) {
      const dbOrder = mapOrderToDb(newOrder, userId);
      const { error } = await supabase.from('orders').insert(dbOrder);
      if (error) throw error;
    } else {
      const orders = getOrdersFromLocalStorage();
      orders.push(newOrder);
      saveOrdersToLocalStorage(orders);
    }
  } else {
    const orders = getOrdersFromLocalStorage();
    orders.push(newOrder);
    saveOrdersToLocalStorage(orders);
  }
  
  return newOrder;
};

export const updateOrder = async (id: string, updates: Partial<Order>): Promise<void> => {
  const mode = getStorageMode();
  
  if (mode === 'supabase') {
    const userId = await getUserId();
    if (userId) {
      const orders = await getOrders();
      const existing = orders.find(o => o.id === id);
      if (!existing) throw new Error('Order not found');
      
      const updated = { ...existing, ...updates };
      const dbOrder = mapOrderToDb(updated, userId);
      const { error } = await supabase.from('orders').update(dbOrder).eq('id', id);
      if (error) throw error;
    }
  } else {
    const orders = getOrdersFromLocalStorage();
    const index = orders.findIndex(o => o.id === id);
    if (index !== -1) {
      orders[index] = { ...orders[index], ...updates };
      saveOrdersToLocalStorage(orders);
    }
  }
};

export const deleteOrder = async (id: string): Promise<void> => {
  const mode = getStorageMode();
  
  if (mode === 'supabase') {
    const { error } = await supabase.from('orders').delete().eq('id', id);
    if (error) throw error;
  } else {
    const orders = getOrdersFromLocalStorage();
    saveOrdersToLocalStorage(orders.filter(o => o.id !== id));
  }
};

// ============================================
// INVOICES - Dual mode
// ============================================

const getInvoicesFromSupabase = async (): Promise<Invoice[]> => {
  const userId = await getUserId();
  if (!userId) return [];

  const { data, error } = await supabase
    .from('invoices')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ Error fetching invoices from Supabase:', error);
    return [];
  }

  console.log('✅ Fetched', data?.length || 0, 'invoices from Supabase');
  return (data || []).map(mapDbToInvoice);
};

const getInvoicesFromLocalStorage = (): Invoice[] => {
  try {
    const data = localStorage.getItem(INVOICES_KEY);
    const invoices = data ? JSON.parse(data) : [];
    console.log('📥 Fetched', invoices.length, 'invoices from localStorage');
    return invoices;
  } catch (error) {
    console.error('❌ Error reading invoices from localStorage:', error);
    return [];
  }
};

const saveInvoicesToLocalStorage = (invoices: Invoice[]): void => {
  try {
    localStorage.setItem(INVOICES_KEY, JSON.stringify(invoices));
    console.log('✅ Saved', invoices.length, 'invoices to localStorage');
  } catch (error) {
    console.error('❌ Error saving invoices to localStorage:', error);
  }
};

export const getInvoices = async (): Promise<Invoice[]> => {
  const mode = getStorageMode();
  
  if (mode === 'supabase') {
    return await getInvoicesFromSupabase();
  }
  return getInvoicesFromLocalStorage();
};

// FIXED: Enhanced error logging for invoice saving
export const saveInvoices = async (invoices: Invoice[]): Promise<void> => {
  const mode = getStorageMode();
  
  if (mode === 'supabase') {
    const userId = await getUserId();
    if (!userId) {
      saveInvoicesToLocalStorage(invoices);
      return;
    }

    for (const invoice of invoices) {
      try {
        const dbInvoice = mapInvoiceToDb(invoice, userId);
        console.log('📤 Sending to Supabase:', JSON.stringify(dbInvoice, null, 2));
        const { error } = await supabase.from('invoices').upsert(dbInvoice);
        if (error) {
          console.error('❌ Supabase error details:', JSON.stringify(error, null, 2));
          console.error('❌ Failed invoice data:', JSON.stringify(invoice, null, 2));
          throw error;
        }
      } catch (err) {
        console.error('❌ Error saving invoice:', invoice.id, err);
        throw err;
      }
    }
    console.log('✅ Saved', invoices.length, 'invoices to Supabase');
  } else {
    saveInvoicesToLocalStorage(invoices);
  }
};

export const addInvoice = async (invoice: Omit<Invoice, 'id'>): Promise<Invoice> => {
  const newInvoice: Invoice = {
    ...invoice,
    id: crypto.randomUUID(),
    createdAt: invoice.createdAt || new Date().toISOString(),
    created_at: invoice.created_at || new Date().toISOString()
  };
  
  const mode = getStorageMode();
  
  if (mode === 'supabase') {
    const userId = await getUserId();
    if (userId) {
      const dbInvoice = mapInvoiceToDb(newInvoice, userId);
      const { error } = await supabase.from('invoices').upsert(dbInvoice);
      if (error) throw error;
    } else {
      const invoices = getInvoicesFromLocalStorage();
      invoices.push(newInvoice);
      saveInvoicesToLocalStorage(invoices);
    }
  } else {
    const invoices = getInvoicesFromLocalStorage();
    invoices.push(newInvoice);
    saveInvoicesToLocalStorage(invoices);
  }
  
  return newInvoice;
};

export const updateInvoice = async (id: string, updates: Partial<Invoice>): Promise<void> => {
  const mode = getStorageMode();
  
  if (mode === 'supabase') {
    const userId = await getUserId();
    if (userId) {
      const invoices = await getInvoices();
      const existing = invoices.find(i => i.id === id);
      if (!existing) throw new Error('Invoice not found');
      
      const updated = { ...existing, ...updates };
      const dbInvoice = mapInvoiceToDb(updated, userId);
      const { error } = await supabase.from('invoices').update(dbInvoice).eq('id', id);
      if (error) throw error;
    }
  } else {
    const invoices = getInvoicesFromLocalStorage();
    const index = invoices.findIndex(i => i.id === id);
    if (index !== -1) {
      invoices[index] = { ...invoices[index], ...updates };
      saveInvoicesToLocalStorage(invoices);
    }
  }
};

export const deleteInvoice = async (id: string): Promise<void> => {
  const mode = getStorageMode();
  
  if (mode === 'supabase') {
    const { error } = await supabase.from('invoices').delete().eq('id', id);
    if (error) throw error;
    console.log('✅ Deleted invoice from Supabase:', id);
  } else {
    const invoices = getInvoicesFromLocalStorage();
    saveInvoicesToLocalStorage(invoices.filter(i => i.id !== id));
    console.log('✅ Deleted invoice from localStorage:', id);
  }
};

export const findDuplicateInvoice = async (invoiceNumber: string, date: string): Promise<Invoice | null> => {
  if (!isValidDate(date)) return null;
  
  const invoices = await getInvoices();
  return invoices.find(inv => 
    isValidDate(inv.date) &&
    (inv.invoiceNumber === invoiceNumber || inv.invoice_number === invoiceNumber) && 
    inv.date === date
  ) || null;
};

// ============================================
// SETTINGS - Dual mode
// ============================================

const getSettingsFromLocalStorage = (): Settings => {
  try {
    const data = localStorage.getItem(SETTINGS_KEY);
    if (data) {
      const settings = JSON.parse(data);
      console.log('📥 [localStorage] Loaded settings:', settings);
      console.log('📥 [localStorage] Country:', settings.country);
      console.log('📥 [localStorage] Currency:', settings.defaultCurrency);
      return settings;
    }
  } catch (error) {
    console.error('❌ [localStorage] Error reading settings:', error);
  }
  
  // FIXED: Default to IT, NOT GB
  const defaultSettings = {
    country: 'IT',
    language: 'it',
    defaultCurrency: 'EUR',
    fontSize: 'medium' as const,
    layoutMode: 'expanded' as const,
    notifications: {
      price_change_threshold: 10,
      recurring_order_reminder_days: 3,
      enable_recurring_reminders: true
    }
  };
  
  console.log('📥 [localStorage] Using default settings:', defaultSettings);
  return defaultSettings;
};

const saveSettingsToLocalStorage = (settings: Settings): void => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    console.log('✅ [localStorage] Saved settings:', settings);
    console.log('✅ [localStorage] Saved country:', settings.country);
    console.log('✅ [localStorage] Saved currency:', settings.defaultCurrency);
  } catch (error) {
    console.error('❌ [localStorage] Error saving settings:', error);
  }
};

export const getSettings = async (): Promise<Settings> => {
  console.log('📥 [1] getSettings() called');
  const mode = getStorageMode();
  console.log('📥 [2] Storage mode:', mode);
  
  if (mode === 'supabase') {
    const userId = await getUserId();
    console.log('📥 [3] User ID:', userId);
    
    if (!userId) {
      console.log('📥 [4] No user, loading from localStorage');
      return getSettingsFromLocalStorage();
    }

    console.log('📥 [5] Querying Supabase for user_settings...');
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.log('📥 [6] Supabase error:', error.code, error.message);
      if (error.code === 'PGRST116') {
        console.log('📥 [7] No settings in Supabase (PGRST116), using defaults');
        const defaults = getSettingsFromLocalStorage();
        console.log('📥 [8] Returning defaults:', defaults);
        return defaults;
      }
      console.error('❌ [9] Error fetching settings from Supabase:', error);
      return getSettingsFromLocalStorage();
    }

    console.log('📥 [10] Raw data from Supabase:', data);
    console.log('📥 [11] Country from DB:', data.country);
    
    const mappedSettings = mapDbToSettings(data);
    console.log('📥 [13] Mapped settings:', mappedSettings);
    console.log('📥 [14] Final country:', mappedSettings.country);
    console.log('📥 [15] Final currency:', mappedSettings.defaultCurrency);
    
    return mappedSettings;
  }
  
  console.log('📥 [16] Using localStorage mode');
  return getSettingsFromLocalStorage();
};

export const saveSettings = async (settings: Settings): Promise<void> => {
  console.log('💾 [1] saveSettings() called with:', settings);
  console.log('💾 [2] Country to save:', settings.country);
  console.log('💾 [3] Currency to save:', settings.defaultCurrency);
  
  const mode = getStorageMode();
  console.log('💾 [4] Storage mode:', mode);
  
  if (mode === 'supabase') {
    const userId = await getUserId();
    console.log('💾 [5] User ID:', userId);
    
    if (!userId) {
      console.warn('💾 [6] No user, saving to localStorage only');
      saveSettingsToLocalStorage(settings);
      return;
    }

    try {
      const dbSettings = mapSettingsToDb(settings, userId);
      console.log('💾 [7] Mapped to DB format:', dbSettings);
      console.log('💾 [8] DB country:', dbSettings.country);
      
      console.log('💾 [10] Calling Supabase upsert...');
      const { data, error } = await supabase
        .from('user_settings')
        .upsert(
          { 
            ...dbSettings, 
            updated_at: new Date().toISOString() 
          },
          { 
            onConflict: 'user_id'
          }
        )
        .select();
      
      if (error) {
        console.error('❌ [11] Supabase error:', error);
        console.error('❌ [12] Error code:', error.code);
        console.error('❌ [13] Error message:', error.message);
        console.error('❌ [14] Error details:', JSON.stringify(error, null, 2));
        saveSettingsToLocalStorage(settings);
        return;
      }

      console.log('✅ [15] Supabase upsert SUCCESS!');
      console.log('✅ [16] Returned data:', data);
      saveSettingsToLocalStorage(settings);
      console.log('✅ [17] Settings saved to both Supabase and localStorage');
    } catch (err) {
      console.error('❌ [18] Exception saving settings:', err);
      saveSettingsToLocalStorage(settings);
    }
  } else {
    console.log('💾 [19] Saving to localStorage only');
    saveSettingsToLocalStorage(settings);
  }
};

// ============================================
// PRICE HISTORY
// ============================================

export const getPriceHistory = async (productId: string): Promise<PriceHistory[]> => {
  const products = await getProducts();
  const product = products.find(p => p.id === productId);
  return product?.priceHistory || [];
};

// ============================================
// STORAGE OBJECT - For compatibility
// ============================================

export const storage = {
  products: {
    getAll: async (): Promise<Product[]> => await getProducts(),
    save: async (products: Product[]): Promise<void> => await saveProducts(products),
    delete: async (id: string): Promise<void> => await deleteProduct(id),
    updatePrice: async (id: string, newPrice: number, source: string, invoiceId?: string): Promise<void> => 
      await updatePrice(id, newPrice, source, invoiceId)
  },
  suppliers: {
    getAll: async (): Promise<Supplier[]> => await getSuppliers(),
    save: async (suppliers: Supplier[]): Promise<void> => await saveSuppliers(suppliers),
    delete: async (id: string): Promise<void> => await deleteSupplier(id)
  },
  orders: {
    getAll: async (): Promise<Order[]> => await getOrders(),
    save: async (orders: Order[]): Promise<void> => await saveOrders(orders),
    delete: async (id: string): Promise<void> => await deleteOrder(id)
  },
  invoices: {
    getAll: async (): Promise<Invoice[]> => await getInvoices(),
    save: async (invoices: Invoice[]): Promise<void> => await saveInvoices(invoices),
    delete: async (id: string): Promise<void> => await deleteInvoice(id)
  },
  settings: {
    get: async (): Promise<Settings> => await getSettings(),
    save: async (settings: Settings): Promise<void> => await saveSettings(settings)
  }
};