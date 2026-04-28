import { supabase, isSupabaseConfigured, getCurrentUser } from './supabase';
import type { Product, Supplier, Order, Invoice, Settings, OrderItem } from '@/types';
import { getDefaultTemplates } from './messageTemplates';
import { toast } from 'sonner';
import { PriceHistoryService } from './priceHistoryService';

// Constants for draft operations
const DRAFT_ID_SUFFIX = '-draft-current';
const CANCELLED_DRAFT_ID_SUFFIX = '-draft-cancelled';

// Fallback keys for localStorage
const LOCAL_DRAFT_KEY = 'draft_order';
const LOCAL_CANCELLED_KEY = 'cancelled_draft_order';

// Draft order structure
interface DraftOrderData {
  orderItems: OrderItem[];
  temporaryOcrProducts?: Product[];
  timestamp: string;
}

// Product Comparison interface - UPDATED to match Supabase schema
export interface ProductComparison {
  id: string;
  user_id: string;
  product_id_1: string;
  product_id_2: string;
  created_at?: string;
}

// Extended product type for internal use
interface ProductWithExtendedFields extends Product {
  unit_price?: number;
  discounted_price?: number;
  discount_percent?: number;
  discount_amount?: number;
  vatRate?: number;
  price_difference?: number;
}

// ✅ OPTIMIZED: Select only essential columns + price_difference + code_description + updated_at
const PRODUCT_DB_COLUMNS = 'id,name,price,category,supplier_id,vat_rate,unit,discount_percent,discount_amount,unit_price,discounted_price,price_difference,code_description,created_at,updated_at';

// CRITICAL: Define the actual invoice table name
const INVOICES_TABLE = 'app_43909_invoices';
const PRODUCTS_TABLE = 'app_43909_products';

// ✅ FIX: Correct table name for product comparisons
const PRODUCT_COMPATIBILITY_TABLE = 'product_compatibility';

// ============================================================================
// SUBSCRIPTION LIMITS TRACKING
// ============================================================================

/**
 * Detailed limit check result
 */
export interface LimitCheckResult {
  allowed: boolean;
  currentCount: number;
  limit: number;
  remaining: number;
}

/**
 * Helper: Ensure user_subscriptions record exists for the current user.
 * Creates a free tier record ONLY if none exists. Uses INSERT (never upsert)
 * to prevent overwriting existing premium/paid records.
 */
const ensureSubscriptionRecord = async (userId: string): Promise<boolean> => {
  try {
    // Check if record exists using maybeSingle to avoid errors
    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('id, current_period_end')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('❌ Error checking subscription record:', error.message);
      return false;
    }

    if (data) {
      // Record exists - check if period has expired and reset counters
      if (data.current_period_end && new Date(data.current_period_end) < new Date()) {
        console.log('🔄 [SUBSCRIPTION] Period expired, resetting monthly counters for user:', userId);
        const now = new Date();
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        
        await supabase
          .from('user_subscriptions')
          .update({
            scans_used: 0,
            invoices_this_month: 0,
            current_period_start: now.toISOString(),
            current_period_end: endOfMonth.toISOString(),
            updated_at: now.toISOString()
          })
          .eq('user_id', userId);
        
        console.log('✅ [SUBSCRIPTION] Monthly counters reset successfully');
      }
      return true; // Record exists
    }

    // Record doesn't exist - create free tier defaults using INSERT (NOT upsert)
    console.warn('⚠️ No subscription record found, creating free tier defaults for user:', userId);
    const now = new Date();
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const { error: insertError } = await supabase
      .from('user_subscriptions')
      .insert({
        user_id: userId,
        subscription_type: 'free',
        status: 'active',
        scans_limit: 10,
        products_limit: 20,
        invoices_limit: 10,
        scans_used: 0,
        products_saved: 0,
        invoices_this_month: 0,
        current_period_start: now.toISOString(),
        current_period_end: endOfMonth.toISOString(),
        cancel_at_period_end: false,
      });

    if (insertError) {
      // If insert fails with duplicate key, that's fine - record already exists
      if (insertError.code === '23505') {
        console.log('ℹ️ Subscription record already exists (concurrent insert), skipping');
        return true;
      }
      console.error('❌ Error creating subscription record:', insertError.message);
      return false;
    }

    console.log('✅ Created free tier subscription record for user:', userId);
    return true;
  } catch (err) {
    console.error('❌ Exception in ensureSubscriptionRecord:', err);
    return false;
  }
};

/**
 * Get current subscription limits and usage for the authenticated user.
 * ✅ Includes automatic monthly counter reset when period has expired.
 */
export const getSubscriptionLimits = async () => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, returning unlimited limits');
    return {
      scans_used: 0,
      scans_limit: -1,
      products_saved: 0,
      products_limit: -1,
      invoices_this_month: 0,
      invoices_limit: -1,
      subscription_type: 'free',
      status: 'active',
      current_period_end: null,
    };
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return null;
    }

    // Ensure record exists before reading
    await ensureSubscriptionRecord(user.id);

    const { data, error } = await supabase
      .from('user_subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (error) {
      console.error('❌ Error fetching subscription limits:', error);
      return null;
    }

    // ✅ Check if period has expired and reset counters automatically
    if (data.current_period_end && new Date(data.current_period_end) < new Date()) {
      console.log('🔄 [SUBSCRIPTION] Period expired in getSubscriptionLimits, resetting counters...');
      const now = new Date();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      
      await supabase
        .from('user_subscriptions')
        .update({
          scans_used: 0,
          invoices_this_month: 0,
          current_period_start: now.toISOString(),
          current_period_end: endOfMonth.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('user_id', user.id);
      
      // Update local data to reflect the reset
      data.scans_used = 0;
      data.invoices_this_month = 0;
      data.current_period_start = now.toISOString();
      data.current_period_end = endOfMonth.toISOString();
      
      console.log('✅ [SUBSCRIPTION] Counters reset in getSubscriptionLimits');
    }

    return data;
  } catch (error) {
    console.error('❌ Exception fetching subscription limits:', error);
    return null;
  }
};

/**
 * Increment scan count after successful invoice OCR.
 * ✅ ROBUST: Tries RPC first, then direct update, then upsert as last resort.
 */
export const incrementScanCount = async (): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, scan count NOT incremented');
    return false;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return false;
    }

    // Ensure record exists first
    await ensureSubscriptionRecord(user.id);

    // Try RPC function first
    const { error: rpcError } = await supabase.rpc('increment_scan_count', {
      p_user_id: user.id,
    });

    if (!rpcError) {
      console.log('✅ Scan count incremented via RPC');
      return true;
    }

    console.warn('⚠️ RPC increment_scan_count failed, using direct update fallback:', rpcError.message);
    
    // Fallback: fetch current value and update directly
    const { data: currentData, error: fetchError } = await supabase
      .from('user_subscriptions')
      .select('scans_used')
      .eq('user_id', user.id)
      .single();

    if (fetchError || !currentData) {
      console.error('❌ Error fetching current scan count:', fetchError?.message);
      return false;
    }

    const newCount = (currentData.scans_used || 0) + 1;
    const { error: updateError } = await supabase
      .from('user_subscriptions')
      .update({ scans_used: newCount, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('❌ Error updating scan count directly:', updateError.message);
      return false;
    }

    console.log('✅ Scan count incremented via direct update to', newCount);
    return true;
  } catch (error) {
    console.error('❌ Exception incrementing scan count:', error);
    return false;
  }
};

/**
 * Increment product count after adding a new product
 * ✅ ROBUST: Ensures record exists before incrementing
 */
export const incrementProductCount = async (): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, product count NOT incremented');
    return false;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return false;
    }

    await ensureSubscriptionRecord(user.id);

    const { error } = await supabase.rpc('increment_product_count', {
      p_user_id: user.id,
    });

    if (!error) {
      console.log('✅ Product count incremented via RPC');
      return true;
    }

    console.warn('⚠️ RPC increment_product_count failed, using direct update fallback:', error.message);
    
    // Fallback: fetch current value and update directly
    const { data: currentData, error: fetchError } = await supabase
      .from('user_subscriptions')
      .select('products_saved')
      .eq('user_id', user.id)
      .single();

    if (fetchError || !currentData) {
      console.error('❌ Error fetching current product count:', fetchError?.message);
      return false;
    }

    const newCount = (currentData.products_saved || 0) + 1;
    const { error: updateError } = await supabase
      .from('user_subscriptions')
      .update({ products_saved: newCount, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('❌ Error updating product count directly:', updateError.message);
      return false;
    }

    console.log('✅ Product count incremented via direct update to', newCount);
    return true;
  } catch (error) {
    console.error('❌ Exception incrementing product count:', error);
    return false;
  }
};

/**
 * Increment invoice count after saving a new invoice
 * ✅ ROBUST: Ensures record exists before incrementing
 */
export const incrementInvoiceCount = async (): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, invoice count NOT incremented');
    return false;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return false;
    }

    await ensureSubscriptionRecord(user.id);

    const { error } = await supabase.rpc('increment_invoice_count', {
      p_user_id: user.id,
    });

    if (!error) {
      console.log('✅ Invoice count incremented via RPC');
      return true;
    }

    console.warn('⚠️ RPC increment_invoice_count failed, using direct update fallback:', error.message);
    
    // Fallback: fetch current value and update directly
    const { data: currentData, error: fetchError } = await supabase
      .from('user_subscriptions')
      .select('invoices_this_month')
      .eq('user_id', user.id)
      .single();

    if (fetchError || !currentData) {
      console.error('❌ Error fetching current invoice count:', fetchError?.message);
      return false;
    }

    const newCount = (currentData.invoices_this_month || 0) + 1;
    const { error: updateError } = await supabase
      .from('user_subscriptions')
      .update({ invoices_this_month: newCount, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('❌ Error updating invoice count directly:', updateError.message);
      return false;
    }

    console.log('✅ Invoice count incremented via direct update to', newCount);
    return true;
  } catch (error) {
    console.error('❌ Exception incrementing invoice count:', error);
    return false;
  }
};

/**
 * Check if user has reached scan limit
 */
export const checkScanLimit = async (): Promise<boolean> => {
  const limits = await getSubscriptionLimits();
  if (!limits) return true; // Allow if can't fetch limits

  // -1 means unlimited
  if (limits.scans_limit === -1) return true;

  return limits.scans_used < limits.scans_limit;
};

/**
 * Check if user has reached product limit - DETAILED version
 * Counts actual products in the database for accuracy.
 */
export const checkProductLimitDetailed = async (): Promise<LimitCheckResult> => {
  // Default: allow everything
  const unlimited: LimitCheckResult = { allowed: true, currentCount: 0, limit: -1, remaining: Infinity };

  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, returning unlimited');
    return unlimited;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return unlimited; // Allow if can't verify
    }

    // 1. Get subscription limits
    const { data: subData, error: subError } = await supabase
      .from('user_subscriptions')
      .select('products_limit, subscription_type')
      .eq('user_id', user.id)
      .single();

    // Default to free tier limits if no subscription record
    const productsLimit = subData?.products_limit ?? 20;

    if (subError) {
      console.warn('⚠️ Could not fetch subscription, using free tier limit (20):', subError.message);
    }

    // Unlimited plan
    if (productsLimit === -1) {
      return { allowed: true, currentCount: 0, limit: -1, remaining: Infinity };
    }

    // 2. Count actual products in the database (robust: fetch IDs)
    let actualCount = 0;
    const { count, error: countError } = await supabase
      .from(PRODUCTS_TABLE)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (!countError && count !== null && count !== undefined) {
      actualCount = count;
    } else {
      // Fallback: fetch IDs and count client-side
      console.warn('⚠️ Product count head query failed, using fallback:', countError?.message);
      const { data: rows, error: fallbackError } = await supabase
        .from(PRODUCTS_TABLE)
        .select('id')
        .eq('user_id', user.id);

      if (!fallbackError && rows) {
        actualCount = rows.length;
      } else {
        console.error('❌ Could not count products:', fallbackError?.message);
        return unlimited; // Allow if can't count
      }
    }

    const remaining = Math.max(productsLimit - actualCount, 0);
    const allowed = actualCount < productsLimit;

    console.log(`📊 [LIMIT CHECK] Products: ${actualCount}/${productsLimit} (remaining: ${remaining}, allowed: ${allowed})`);

    return { allowed, currentCount: actualCount, limit: productsLimit, remaining };
  } catch (error) {
    console.error('❌ Exception checking product limit:', error);
    return unlimited;
  }
};

/**
 * Check if user has reached product limit (simple boolean for backward compatibility)
 */
export const checkProductLimit = async (): Promise<boolean> => {
  const result = await checkProductLimitDetailed();
  return result.allowed;
};

/**
 * Check if user has reached invoice limit - DETAILED version
 * Counts actual invoices in the database for accuracy.
 */
export const checkInvoiceLimitDetailed = async (): Promise<LimitCheckResult> => {
  const unlimited: LimitCheckResult = { allowed: true, currentCount: 0, limit: -1, remaining: Infinity };

  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, returning unlimited');
    return unlimited;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return unlimited;
    }

    // 1. Get subscription limits
    const { data: subData, error: subError } = await supabase
      .from('user_subscriptions')
      .select('invoices_limit, subscription_type')
      .eq('user_id', user.id)
      .single();

    const invoicesLimit = subData?.invoices_limit ?? 10;
    const subscriptionType = subData?.subscription_type ?? 'free';

    if (subError) {
      console.warn('⚠️ Could not fetch subscription, using free tier limit (10):', subError.message);
    }

    // Unlimited plan
    if (invoicesLimit === -1) {
      return { allowed: true, currentCount: 0, limit: -1, remaining: Infinity };
    }

    // 2. Count actual invoices
    let actualCount = 0;

    if (subscriptionType === 'free') {
      // Free tier: count ALL invoices (total)
      const { count, error: countError } = await supabase
        .from(INVOICES_TABLE)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (!countError && count !== null && count !== undefined) {
        actualCount = count;
      } else {
        const { data: rows, error: fallbackError } = await supabase
          .from(INVOICES_TABLE)
          .select('id')
          .eq('user_id', user.id);

        if (!fallbackError && rows) {
          actualCount = rows.length;
        } else {
          console.error('❌ Could not count invoices:', fallbackError?.message);
          return unlimited;
        }
      }
    } else {
      // Paid plans: count invoices this month only
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      const { count, error: countError } = await supabase
        .from(INVOICES_TABLE)
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', startOfMonth)
        .lte('created_at', endOfMonth);

      if (!countError && count !== null && count !== undefined) {
        actualCount = count;
      } else {
        const { data: rows, error: fallbackError } = await supabase
          .from(INVOICES_TABLE)
          .select('id')
          .eq('user_id', user.id)
          .gte('created_at', startOfMonth)
          .lte('created_at', endOfMonth);

        if (!fallbackError && rows) {
          actualCount = rows.length;
        } else {
          console.error('❌ Could not count invoices:', fallbackError?.message);
          return unlimited;
        }
      }
    }

    const remaining = Math.max(invoicesLimit - actualCount, 0);
    const allowed = actualCount < invoicesLimit;

    console.log(`📊 [LIMIT CHECK] Invoices: ${actualCount}/${invoicesLimit} (remaining: ${remaining}, allowed: ${allowed})`);

    return { allowed, currentCount: actualCount, limit: invoicesLimit, remaining };
  } catch (error) {
    console.error('❌ Exception checking invoice limit:', error);
    return unlimited;
  }
};

/**
 * Check if user has reached invoice limit (simple boolean for backward compatibility)
 */
export const checkInvoiceLimit = async (): Promise<boolean> => {
  const result = await checkInvoiceLimitDetailed();
  return result.allowed;
};

// ============================================================================
// PRODUCT COMPARISONS
// ============================================================================

/**
 * Save a product comparison to Supabase
 * ✅ FIXED: Now uses correct column names (product_id_1, product_id_2) matching Supabase schema
 */
export const saveProductComparison = async (
  productAId: string,
  productAName: string,
  productBId: string,
  productBName: string
): Promise<ProductComparison | null> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, comparison NOT saved');
    toast.error('❌ Supabase non configurato. Impossibile salvare la comparazione.');
    return null;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      toast.error('❌ Utente non autenticato. Effettua il login.');
      return null;
    }

    console.log('💾 [COMPARISON] Saving comparison to Supabase...');
    console.log('💾 [COMPARISON] User ID:', user.id);
    console.log('💾 [COMPARISON] Product A:', productAName, productAId);
    console.log('💾 [COMPARISON] Product B:', productBName, productBId);
    console.log('💾 [COMPARISON] Table name:', PRODUCT_COMPATIBILITY_TABLE);

    // ✅ FIX: Use correct column names matching Supabase schema
    const comparisonData = {
      user_id: user.id,
      product_id_1: productAId,
      product_id_2: productBId
    };

    console.log('📝 [COMPARISON] Data to insert:', JSON.stringify(comparisonData, null, 2));

    const { data, error } = await supabase
      .from(PRODUCT_COMPATIBILITY_TABLE)
      .insert([comparisonData])
      .select()
      .single();

    if (error) {
      console.error('❌ [COMPARISON] Supabase error:', error);
      console.error('❌ [COMPARISON] Error message:', error.message);
      console.error('❌ [COMPARISON] Error code:', error.code);
      console.error('❌ [COMPARISON] Error details:', error.details);
      console.error('❌ [COMPARISON] Error hint:', error.hint);
      toast.error(`❌ Errore salvando comparazione: ${error.message}`);
      return null;
    }

    console.log('✅ [COMPARISON] Comparison saved successfully:', data);
    toast.success('✅ Comparazione creata con successo!');
    return data;

  } catch (error) {
    console.error('❌ [COMPARISON] Exception saving comparison:', error);
    console.error('❌ [COMPARISON] Exception type:', typeof error);
    console.error('❌ [COMPARISON] Exception details:', JSON.stringify(error, null, 2));
    toast.error(`❌ Errore imprevisto: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
};

/**
 * Get all product comparisons for the current user
 */
export const getProductComparisons = async (): Promise<ProductComparison[]> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, returning empty comparisons');
    return [];
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return [];
    }

    console.log('📊 [COMPARISON] Fetching comparisons for user:', user.id);

    const { data, error } = await supabase
      .from(PRODUCT_COMPATIBILITY_TABLE)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching comparisons:', error);
      toast.error(`❌ Errore caricando comparazioni: ${error.message}`);
      return [];
    }

    console.log(`✅ [COMPARISON] Fetched ${data?.length || 0} comparisons from Supabase`);
    return data || [];

  } catch (error) {
    console.error('❌ Exception fetching comparisons:', error);
    toast.error(`❌ Errore imprevisto caricando comparazioni: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return [];
  }
};

/**
 * Delete a product comparison
 */
export const deleteProductComparison = async (comparisonId: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, comparison NOT deleted');
    toast.error('❌ Supabase non configurato. Impossibile eliminare la comparazione.');
    return false;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated, cannot delete comparison');
      return false;
    }

    console.log('🗑️ [COMPARISON] Deleting comparison:', comparisonId);

    const { error } = await supabase
      .from(PRODUCT_COMPATIBILITY_TABLE)
      .delete()
      .eq('id', comparisonId)
      .eq('user_id', user.id);

    if (error) {
      console.error('❌ Error deleting comparison:', error);
      toast.error(`❌ Errore eliminando comparazione: ${error.message}`);
      return false;
    }

    console.log('✅ [COMPARISON] Comparison deleted successfully');
    toast.success('✅ Comparazione eliminata con successo!');
    return true;

  } catch (error) {
    console.error('❌ Exception deleting comparison:', error);
    toast.error(`❌ Errore imprevisto: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
};

// ============================================================================
// PRODUCTS - WITH BATCH OPERATIONS
// ============================================================================

/**
 * OPTIMIZED: Batch insert multiple products at once
 * Reduces database round trips from N to 1
 * ✅ ENFORCES subscription product limit before inserting
 * ✅ NEW: Include code_description field
 */
export const batchAddProducts = async (products: Omit<Product, 'id'>[]): Promise<Product[]> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, products NOT saved to cloud');
    return [];
  }

  try {
    const perfStart = performance.now();
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return [];
    }

    // ✅ ENFORCE PRODUCT LIMIT before inserting
    const limitCheck = await checkProductLimitDetailed();
    if (!limitCheck.allowed) {
      console.warn(`🚫 [LIMIT] Product limit reached: ${limitCheck.currentCount}/${limitCheck.limit}. Cannot add any products.`);
      return []; // Return empty - caller should check limit before calling
    }

    // If we can only add some products, truncate the list
    let productsToInsert = products;
    if (limitCheck.limit !== -1) {
      const canAdd = limitCheck.remaining;
      if (products.length > canAdd) {
        console.warn(`⚠️ [LIMIT] Can only add ${canAdd} of ${products.length} products (limit: ${limitCheck.limit}, current: ${limitCheck.currentCount})`);
        productsToInsert = products.slice(0, canAdd);
      }
    }

    if (productsToInsert.length === 0) {
      return [];
    }

    const dbProducts = productsToInsert.map(product => {
      const category = product.category || '';
      const extProduct = product as ProductWithExtendedFields;
      
      return {
        name: product.name,
        price: product.price,
        category: category,
        unit_price: extProduct.unit_price,
        discounted_price: extProduct.discounted_price,
        discount_percent: extProduct.discount_percent,
        discount_amount: extProduct.discount_amount || 0,
        unit: product.unit || 'kg',
        supplier_id: product.supplier_id,
        vat_rate: product.vat_rate || extProduct.vatRate,
        price_difference: 0, // New products have no price change
        code_description: product.code_description || '',
        user_id: user.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    const { data, error } = await supabase
      .from(PRODUCTS_TABLE)
      .insert(dbProducts)
      .select(PRODUCT_DB_COLUMNS);

    const perfEnd = performance.now();
    console.log(`⏱️ [DB] batchAddProducts: ${(perfEnd - perfStart).toFixed(0)}ms for ${productsToInsert.length} products`);

    if (error) {
      console.error('❌ Error batch adding products:', error);
      return [];
    }

    return (data || []).map(product => ({
      ...product,
      vatRate: product.vat_rate,
      unit_price: product.unit_price,
      discounted_price: product.discounted_price,
      discount_percent: product.discount_percent,
      discount_amount: product.discount_amount || 0,
      price_difference: product.price_difference || 0,
      code_description: product.code_description || '',
      updated_at: product.updated_at || product.created_at || new Date().toISOString(),
    }));

  } catch (error) {
    console.error('❌ Exception batch adding products:', error);
    return [];
  }
};

/**
 * ✅ NEW: Get product by ID to fetch old price
 */
export const getProductById = async (productId: string): Promise<Product | null> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from(PRODUCTS_TABLE)
      .select(PRODUCT_DB_COLUMNS)
      .eq('id', productId)
      .single();

    if (error) {
      console.error('❌ Error fetching product:', error);
      return null;
    }

    return data ? {
      ...data,
      vatRate: data.vat_rate,
      unit_price: data.unit_price,
      discounted_price: data.discounted_price,
      discount_percent: data.discount_percent,
      discount_amount: data.discount_amount || 0,
      price_difference: data.price_difference || 0,
      code_description: data.code_description || '',
      updated_at: data.updated_at || data.created_at || new Date().toISOString(),
    } : null;

  } catch (error) {
    console.error('❌ Exception fetching product:', error);
    return null;
  }
};

/**
 * OPTIMIZED: Batch update multiple products at once
 * ✅ UPDATED: Now calculates and saves price_difference percentage + tracks price history
 * ✅ NEW: Include code_description field
 */
export const batchUpdateProducts = async (updates: { id: string; updates: Partial<Product> }[]): Promise<Product[]> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, products NOT updated');
    return [];
  }

  try {
    const perfStart = performance.now();
    
    // ✅ STEP 1: Fetch old prices and supplier info for all products being updated
    const productIds = updates.map(u => u.id);
    const { data: existingProducts, error: fetchError } = await supabase
      .from(PRODUCTS_TABLE)
      .select('id,name,price,supplier_id')
      .in('id', productIds);

    if (fetchError) {
      console.error('❌ Error fetching existing products:', fetchError);
      return [];
    }

    const oldProductsMap = new Map<string, typeof existingProducts[0]>();
    (existingProducts || []).forEach(p => {
      oldProductsMap.set(p.id, p);
    });

    console.log('💰 [PRICE DIFF] Old prices fetched:', Object.fromEntries(
      Array.from(oldProductsMap.entries()).map(([id, p]) => [id, p.price])
    ));

    // Get supplier names for price history
    const supplierIds = Array.from(new Set(
      (existingProducts || []).map(p => p.supplier_id).filter(Boolean)
    ));
    const { data: suppliers } = await supabase
      .from('suppliers')
      .select('id,name')
      .in('id', supplierIds);
    
    const supplierNamesMap = new Map<string, string>();
    (suppliers || []).forEach(s => {
      supplierNamesMap.set(s.id, s.name);
    });

    // ✅ STEP 2: Calculate price_difference for each update and prepare price history data
    const priceHistoryItems: Array<{
      product_id: string;
      product_name: string;
      supplier_name: string;
      old_price: number | null;
      new_price: number;
    }> = [];

    const dbUpdates = updates.map(({ id, updates: productUpdates }) => {
      const dbUpdate: Record<string, unknown> = { id };
      const extUpdates = productUpdates as ProductWithExtendedFields;
      
      if (productUpdates.name !== undefined) dbUpdate.name = productUpdates.name;
      if (productUpdates.price !== undefined) dbUpdate.price = productUpdates.price;
      if (productUpdates.category !== undefined) dbUpdate.category = productUpdates.category || '';
      if (extUpdates.unit_price !== undefined) dbUpdate.unit_price = extUpdates.unit_price;
      if (extUpdates.discounted_price !== undefined) dbUpdate.discounted_price = extUpdates.discounted_price;
      if (extUpdates.discount_percent !== undefined) dbUpdate.discount_percent = extUpdates.discount_percent;
      if (extUpdates.discount_amount !== undefined) dbUpdate.discount_amount = extUpdates.discount_amount;
      if (productUpdates.unit !== undefined) dbUpdate.unit = productUpdates.unit;
      if (productUpdates.supplier_id !== undefined) dbUpdate.supplier_id = productUpdates.supplier_id;
      if (productUpdates.vat_rate !== undefined || extUpdates.vatRate !== undefined) {
        dbUpdate.vat_rate = productUpdates.vat_rate || extUpdates.vatRate;
      }
      if (productUpdates.code_description !== undefined) dbUpdate.code_description = productUpdates.code_description;

      // ✅ CALCULATE PRICE DIFFERENCE PERCENTAGE & PREPARE PRICE HISTORY
      if (productUpdates.price !== undefined) {
        const oldProduct = oldProductsMap.get(id);
        const oldPrice = oldProduct?.price;
        const newPrice = productUpdates.price;

        if (oldPrice && oldPrice > 0 && newPrice !== oldPrice) {
          const percentageChange = ((newPrice - oldPrice) / oldPrice) * 100;
          dbUpdate.price_difference = Math.round(percentageChange * 100) / 100; // Round to 2 decimals
          
          console.log(`💰 [PRICE DIFF] Product ${id}:`);
          console.log(`   Old price: ${oldPrice} €`);
          console.log(`   New price: ${newPrice} €`);
          console.log(`   Difference: ${percentageChange > 0 ? '+' : ''}${dbUpdate.price_difference}%`);

          // Prepare price history data
          if (oldProduct) {
            const supplierName = supplierNamesMap.get(oldProduct.supplier_id) || 'Unknown Supplier';
            priceHistoryItems.push({
              product_id: id,
              product_name: oldProduct.name,
              supplier_name: supplierName,
              old_price: oldPrice,
              new_price: newPrice,
            });
          }
        } else {
          dbUpdate.price_difference = 0;
        }
        
        // ✅ FIX: Update updated_at timestamp when price changes
        dbUpdate.updated_at = new Date().toISOString();
      }
      
      return dbUpdate;
    });

    const { data, error } = await supabase
      .from(PRODUCTS_TABLE)
      .upsert(dbUpdates, { onConflict: 'id' })
      .select(PRODUCT_DB_COLUMNS);

    const perfEnd = performance.now();
    console.log(`⏱️ [DB] batchUpdateProducts: ${(perfEnd - perfStart).toFixed(0)}ms for ${updates.length} products`);

    if (error) {
      console.error('❌ Error batch updating products:', error);
      return [];
    }

    // ✅ STEP 3: Track price changes in price_history (async, don't wait)
    if (priceHistoryItems.length > 0) {
      // Use a dummy invoice ID for batch updates (not from invoice)
      PriceHistoryService.trackInvoicePrices(priceHistoryItems, 'batch-update').catch(err => {
        console.error('❌ Error tracking price history:', err);
      });
    }

    return (data || []).map(product => ({
      ...product,
      vatRate: product.vat_rate,
      unit_price: product.unit_price,
      discounted_price: product.discounted_price,
      discount_percent: product.discount_percent,
      discount_amount: product.discount_amount || 0,
      price_difference: product.price_difference || 0,
      code_description: product.code_description || '',
      updated_at: product.updated_at || product.created_at || new Date().toISOString(),
    }));

  } catch (error) {
    console.error('❌ Exception batch updating products:', error);
    return [];
  }
};

export const addProduct = async (product: Omit<Product, 'id'>): Promise<Product | null> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, product NOT saved to cloud');
    toast.error('❌ Supabase non configurato. Impossibile salvare il prodotto.');
    return null;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      toast.error('❌ Utente non autenticato. Effettua il login.');
      return null;
    }

    // ✅ ENFORCE PRODUCT LIMIT before inserting
    const limitCheck = await checkProductLimitDetailed();
    if (!limitCheck.allowed) {
      console.warn(`🚫 [LIMIT] Product limit reached: ${limitCheck.currentCount}/${limitCheck.limit}. Cannot add product.`);
      // Don't toast here - let the caller handle the UI message
      return null;
    }

    const category = product.category || '';
    const extProduct = product as ProductWithExtendedFields;

    const dbProduct = {
      name: product.name,
      price: product.price,
      category: category,
      unit_price: extProduct.unit_price,
      discounted_price: extProduct.discounted_price,
      discount_percent: extProduct.discount_percent,
      discount_amount: extProduct.discount_amount || 0,
      unit: product.unit || 'kg',
      supplier_id: product.supplier_id,
      vat_rate: product.vat_rate || extProduct.vatRate,
      price_difference: 0, // New product has no price change
      code_description: product.code_description || '',
      user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from(PRODUCTS_TABLE)
      .insert([dbProduct])
      .select(PRODUCT_DB_COLUMNS)
      .single();

    if (error) {
      console.error('❌ Error adding product:', error);
      toast.error(`❌ Errore salvando prodotto: ${error.message}`);
      return null;
    }

    return {
      ...data,
      vatRate: data.vat_rate,
      price_difference: data.price_difference || 0,
      code_description: data.code_description || '',
      updated_at: data.updated_at || data.created_at || new Date().toISOString(),
    };

  } catch (error) {
    console.error('❌ Exception adding product:', error);
    toast.error(`❌ Errore imprevisto: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
};

export const getProducts = async (): Promise<Product[]> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, returning empty products');
    return [];
  }

  try {
    const perfStart = performance.now();
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return [];
    }

    console.log('🔍 [DATABASE] getProducts called - fetching from Supabase...');

    const { data, error } = await supabase
      .from(PRODUCTS_TABLE)
      .select(PRODUCT_DB_COLUMNS)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const perfEnd = performance.now();
    console.log(`⏱️ [DB] getProducts: ${(perfEnd - perfStart).toFixed(0)}ms for ${data?.length || 0} products`);

    if (error) {
      console.error('❌ Error fetching products:', error);
      toast.error(`❌ Errore caricando prodotti: ${error.message}`);
      return [];
    }

    // 🔥 FIX: Ensure all products have updated_at field
    const productsWithUpdatedAt = (data || []).map(product => {
      const result = {
        ...product,
        vatRate: product.vat_rate,
        unit_price: product.unit_price,
        discounted_price: product.discounted_price,
        discount_percent: product.discount_percent,
        discount_amount: product.discount_amount || 0,
        price_difference: product.price_difference || 0,
        code_description: product.code_description || '',
        // If updated_at is missing, use created_at or current timestamp
        updated_at: product.updated_at || product.created_at || new Date().toISOString()
      };
      
      console.log(`🔍 [DATABASE] Product "${product.name}":`, {
        has_updated_at: !!product.updated_at,
        updated_at_value: result.updated_at,
        created_at: product.created_at
      });
      
      return result;
    });

    // 🔥 DEDUPLICATION FIX: Remove duplicate products by code_description (same supplier), then by name+supplier
    const seen = new Map<string, typeof productsWithUpdatedAt[0]>();
    for (const product of productsWithUpdatedAt) {
      const code = product.code_description?.trim();
      const key = code
        ? `code:${code}:${product.supplier_id || ''}`
        : `name:${product.name?.toLowerCase()}:${product.supplier_id || ''}`;
      if (!seen.has(key)) {
        seen.set(key, product);
      } else {
        // Keep the most recently updated one
        const existing = seen.get(key)!;
        const existingDate = new Date(existing.updated_at || existing.created_at || 0).getTime();
        const currentDate = new Date(product.updated_at || product.created_at || 0).getTime();
        if (currentDate > existingDate) {
          seen.set(key, product);
        }
      }
    }
    const dedupedProducts = Array.from(seen.values());
    if (dedupedProducts.length < productsWithUpdatedAt.length) {
      console.log(`🔥 [DEDUP] Removed ${productsWithUpdatedAt.length - dedupedProducts.length} duplicate products`);
    }

    console.log(`🔍 [DATABASE] Returning ${dedupedProducts.length} products with updated_at fixed`);
    return dedupedProducts;

  } catch (error) {
    console.error('❌ Exception fetching products:', error);
    toast.error(`❌ Errore imprevisto caricando prodotti: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return [];
  }
};

export const saveProducts = async (products: Product[]): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, products NOT saved');
    return false;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return false;
    }

    for (const product of products) {
      const category = product.category || '';
      const extProduct = product as ProductWithExtendedFields;
      
      const dbProduct = {
        id: product.id,
        name: product.name,
        price: product.price,
        category: category,
        unit_price: extProduct.unit_price,
        discounted_price: extProduct.discounted_price,
        discount_percent: extProduct.discount_percent,
        discount_amount: extProduct.discount_amount || 0,
        unit: product.unit || 'kg',
        supplier_id: product.supplier_id,
        vat_rate: product.vat_rate || extProduct.vatRate,
        price_difference: extProduct.price_difference || 0,
        code_description: product.code_description || '',
        user_id: user.id,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from(PRODUCTS_TABLE)
        .upsert(dbProduct, { onConflict: 'id' });

      if (error) {
        console.error('❌ Error saving product:', error);
        toast.error(`❌ Errore salvando prodotto "${product.name}": ${error.message}`);
        return false;
      }
    }

    return true;

  } catch (error) {
    console.error('❌ Exception saving products:', error);
    toast.error(`❌ Errore imprevisto salvando prodotti: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
};

export const updateProduct = async (id: string, updates: Partial<Product>): Promise<Product | null> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, product NOT updated');
    toast.error('❌ Supabase non configurato. Impossibile aggiornare il prodotto.');
    return null;
  }

  try {
    // ✅ STEP 1: Fetch old product data if price is being updated
    let priceDifference = 0;
    let oldProduct: Product | null = null;
    
    if (updates.price !== undefined) {
      oldProduct = await getProductById(id);
      if (oldProduct && oldProduct.price > 0 && updates.price !== oldProduct.price) {
        priceDifference = ((updates.price - oldProduct.price) / oldProduct.price) * 100;
        priceDifference = Math.round(priceDifference * 100) / 100; // Round to 2 decimals
        
        console.log(`💰 [PRICE DIFF] Manual update for product ${id}:`);
        console.log(`   Old price: ${oldProduct.price} €`);
        console.log(`   New price: ${updates.price} €`);
        console.log(`   Difference: ${priceDifference > 0 ? '+' : ''}${priceDifference}%`);
      }
    }

    const dbUpdates: Record<string, unknown> = {};
    const extUpdates = updates as ProductWithExtendedFields;
    
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.price !== undefined) {
      dbUpdates.price = updates.price;
      dbUpdates.price_difference = priceDifference;
      dbUpdates.updated_at = new Date().toISOString();
    }
    if (updates.category !== undefined) dbUpdates.category = updates.category || '';
    if (extUpdates.unit_price !== undefined) dbUpdates.unit_price = extUpdates.unit_price;
    if (extUpdates.discounted_price !== undefined) dbUpdates.discounted_price = extUpdates.discounted_price;
    if (extUpdates.discount_percent !== undefined) dbUpdates.discount_percent = extUpdates.discount_percent;
    if (extUpdates.discount_amount !== undefined) dbUpdates.discount_amount = extUpdates.discount_amount;
    if (updates.unit !== undefined) dbUpdates.unit = updates.unit;
    if (updates.supplier_id !== undefined) dbUpdates.supplier_id = updates.supplier_id;
    if (updates.vat_rate !== undefined || extUpdates.vatRate !== undefined) {
      dbUpdates.vat_rate = updates.vat_rate || extUpdates.vatRate;
    }
    if (updates.code_description !== undefined) dbUpdates.code_description = updates.code_description;

    const { data, error } = await supabase
    .from(PRODUCTS_TABLE)
    .update(dbUpdates)
    .eq('id', id)
    .select(PRODUCT_DB_COLUMNS)
    .single();

    if (error) {
      console.error('❌ Error updating product:', error);
      toast.error(`❌ Errore aggiornando prodotto: ${error.message}`);
      return null;
    }

    // ✅ STEP 2: Track price change in price_history (async, don't wait)
    if (updates.price !== undefined && oldProduct && priceDifference !== 0) {
      // Get supplier name
      const { data: supplierData } = await supabase
        .from('suppliers')
        .select('name')
        .eq('id', oldProduct.supplier_id)
        .single();
      
      const supplierName = supplierData?.name || 'Unknown Supplier';
      
      PriceHistoryService.trackPriceChange(
        id,
        oldProduct.name,
        supplierName,
        oldProduct.price,
        updates.price
      ).catch(err => {
        console.error('❌ Error tracking price history:', err);
      });
    }

    return {
      ...data,
      vatRate: data.vat_rate,
      price_difference: data.price_difference || 0,
      code_description: data.code_description || '',
      updated_at: data.updated_at || data.created_at || new Date().toISOString(),
    };

  } catch (error) {
    console.error('❌ Exception updating product:', error);
    toast.error(`❌ Errore imprevisto: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
};

export const deleteProduct = async (id: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, product NOT deleted');
    toast.error('❌ Supabase non configurato. Impossibile eliminare il prodotto.');
    return false;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated, cannot delete product');
      toast.error('❌ Utente non autenticato. Impossibile eliminare il prodotto.');
      return false;
    }

    console.log(`🗑️ [DELETE] Deleting product ${id} for user ${user.id}...`);

    const { error, count } = await supabase
      .from(PRODUCTS_TABLE)
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('❌ Error deleting product:', error);
      toast.error(`❌ Errore eliminando prodotto: ${error.message}`);
      return false;
    }

    console.log(`✅ [DELETE] Product ${id} deleted successfully (count: ${count})`);

    // ✅ Verify deletion
    const { data: verifyData } = await supabase
      .from(PRODUCTS_TABLE)
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id);

    if (verifyData && verifyData.length > 0) {
      console.error(`❌ [DELETE] VERIFICATION FAILED: Product ${id} still exists in database!`);
      toast.error('❌ Il prodotto non è stato eliminato dal database. Riprova.');
      return false;
    }

    console.log(`✅ [DELETE] Verification passed: Product ${id} no longer in database`);
    return true;

  } catch (error) {
    console.error('❌ Exception deleting product:', error);
    toast.error(`❌ Errore imprevisto: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
};

// ============================================================================
// SUPPLIERS
// ============================================================================

export const addSupplier = async (supplier: Omit<Supplier, 'id'>): Promise<Supplier | null> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, supplier NOT saved');
    toast.error('❌ Supabase non configurato. Impossibile salvare il fornitore.');
    return null;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      toast.error('❌ Utente non autenticato. Effettua il login.');
      return null;
    }

    // 🔍 DETAILED LOGGING: Log exactly what data is being saved
    console.log('💾 [ADD SUPPLIER] ===== SAVING SUPPLIER TO DATABASE =====');
    console.log('💾 [ADD SUPPLIER] Supplier name:', supplier.name);
    console.log('💾 [ADD SUPPLIER] Phone:', supplier.phone || '(empty)');
    console.log('💾 [ADD SUPPLIER] Mobile:', supplier.mobile || '(empty)');
    console.log('💾 [ADD SUPPLIER] Email:', supplier.email || '(empty)');
    console.log('💾 [ADD SUPPLIER] Address:', supplier.address || '(empty)');
    console.log('💾 [ADD SUPPLIER] User ID:', user.id);
    console.log('💾 [ADD SUPPLIER] Full supplier object:', JSON.stringify(supplier, null, 2));

    const { data, error } = await supabase
      .from('suppliers')
      .insert([
        {
          ...supplier,
          user_id: user.id,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('❌ [ADD SUPPLIER] Supabase error:', error);
      console.error('❌ [ADD SUPPLIER] Error message:', error.message);
      console.error('❌ [ADD SUPPLIER] Error code:', error.code);
      console.error('❌ [ADD SUPPLIER] Error details:', error.details);
      toast.error(`❌ Errore salvando fornitore: ${error.message}`);
      return null;
    }

    console.log('✅ [ADD SUPPLIER] Supplier saved successfully to database!');
    console.log('✅ [ADD SUPPLIER] Saved supplier ID:', data.id);
    console.log('✅ [ADD SUPPLIER] Saved supplier name:', data.name);
    console.log('✅ [ADD SUPPLIER] Saved phone:', data.phone || '(empty)');
    console.log('✅ [ADD SUPPLIER] Saved mobile:', data.mobile || '(empty)');
    console.log('✅ [ADD SUPPLIER] Saved email:', data.email || '(empty)');
    console.log('✅ [ADD SUPPLIER] Saved address:', data.address || '(empty)');
    console.log('✅ [ADD SUPPLIER] Full saved data:', JSON.stringify(data, null, 2));
    console.log('💾 [ADD SUPPLIER] ========================================');

    return data;

  } catch (error) {
    console.error('❌ [ADD SUPPLIER] Exception:', error);
    console.error('❌ [ADD SUPPLIER] Exception type:', typeof error);
    console.error('❌ [ADD SUPPLIER] Exception details:', JSON.stringify(error, null, 2));
    toast.error(`❌ Errore imprevisto: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
};

export const getSuppliers = async (): Promise<Supplier[]> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, returning empty suppliers');
    return [];
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return [];
    }

    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching suppliers:', error);
      toast.error(`❌ Errore caricando fornitori: ${error.message}`);
      return [];
    }

    return data || [];

  } catch (error) {
    console.error('❌ Exception fetching suppliers:', error);
    toast.error(`❌ Errore imprevisto caricando fornitori: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return [];
  }
};

export const saveSuppliers = async (suppliers: Supplier[]): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, suppliers NOT saved');
    return false;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return false;
    }

    for (const supplier of suppliers) {
      const { error } = await supabase
        .from('suppliers')
        .upsert(
          {
            ...supplier,
            user_id: user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

      if (error) {
        console.error('❌ Error saving supplier:', error);
        toast.error(`❌ Errore salvando fornitore "${supplier.name}": ${error.message}`);
        return false;
      }
    }

    return true;

  } catch (error) {
    console.error('❌ Exception saving suppliers:', error);
    toast.error(`❌ Errore imprevisto salvando fornitori: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
};

export const updateSupplier = async (id: string, updates: Partial<Supplier>): Promise<Supplier | null> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, supplier NOT updated');
    toast.error('❌ Supabase non configurato. Impossibile aggiornare il fornitore.');
    return null;
  }

  try {
    // 🔍 DETAILED LOGGING: Log exactly what data is being updated
    console.log('🔄 [UPDATE SUPPLIER] ===== UPDATING SUPPLIER IN DATABASE =====');
    console.log('🔄 [UPDATE SUPPLIER] Supplier ID:', id);
    console.log('🔄 [UPDATE SUPPLIER] Updates object:', JSON.stringify(updates, null, 2));
    if (updates.phone !== undefined) console.log('🔄 [UPDATE SUPPLIER] New phone:', updates.phone || '(empty)');
    if (updates.mobile !== undefined) console.log('🔄 [UPDATE SUPPLIER] New mobile:', updates.mobile || '(empty)');
    if (updates.email !== undefined) console.log('🔄 [UPDATE SUPPLIER] New email:', updates.email || '(empty)');
    if (updates.address !== undefined) console.log('🔄 [UPDATE SUPPLIER] New address:', updates.address || '(empty)');

    const { data, error } = await supabase
    .from('suppliers')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

    if (error) {
      console.error('❌ [UPDATE SUPPLIER] Supabase error:', error);
      console.error('❌ [UPDATE SUPPLIER] Error message:', error.message);
      toast.error(`❌ Errore aggiornando fornitore: ${error.message}`);
      return null;
    }

    console.log('✅ [UPDATE SUPPLIER] Supplier updated successfully!');
    console.log('✅ [UPDATE SUPPLIER] Updated supplier ID:', data.id);
    console.log('✅ [UPDATE SUPPLIER] Updated phone:', data.phone || '(empty)');
    console.log('✅ [UPDATE SUPPLIER] Updated mobile:', data.mobile || '(empty)');
    console.log('✅ [UPDATE SUPPLIER] Updated email:', data.email || '(empty)');
    console.log('✅ [UPDATE SUPPLIER] Full updated data:', JSON.stringify(data, null, 2));
    console.log('🔄 [UPDATE SUPPLIER] ========================================');

    return data;

  } catch (error) {
    console.error('❌ [UPDATE SUPPLIER] Exception:', error);
    toast.error(`❌ Errore imprevisto: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
};

export const deleteSupplier = async (id: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, supplier NOT deleted');
    toast.error('❌ Supabase non configurato. Impossibile eliminare il fornitore.');
    return false;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated, cannot delete supplier');
      toast.error('❌ Utente non autenticato. Impossibile eliminare il fornitore.');
      return false;
    }

    console.log(`🗑️ [DELETE] Deleting supplier ${id} for user ${user.id}...`);

    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('❌ Error deleting supplier:', error);
      toast.error(`❌ Errore eliminando fornitore: ${error.message}`);
      return false;
    }

    console.log(`✅ [DELETE] Supplier ${id} deleted successfully`);
    return true;

  } catch (error) {
    console.error('❌ Exception deleting supplier:', error);
    toast.error(`❌ Errore imprevisto: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
};

// ============================================================================
// ORDERS
// ============================================================================

export const addOrder = async (order: Omit<Order, 'id'>): Promise<Order | null> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, order NOT saved');
    toast.error('❌ Supabase non configurato. Impossibile salvare l\'ordine.');
    return null;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      toast.error('❌ Utente non autenticato. Effettua il login.');
      return null;
    }

    const { data, error } = await supabase
      .from('orders')
      .insert([
        {
          ...order,
          user_id: user.id,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('❌ Error adding order:', error);
      toast.error(`❌ Errore salvando ordine: ${error.message}`);
      return null;
    }

    return data;

  } catch (error) {
    console.error('❌ Exception adding order:', error);
    toast.error(`❌ Errore imprevisto: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
};

export const getOrders = async (): Promise<Order[]> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, returning empty orders');
    return [];
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return [];
    }

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .neq('status', 'draft')
      .neq('status', 'cancelled')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching orders:', error);
      toast.error(`❌ Errore caricando ordini: ${error.message}`);
      return [];
    }

    return data || [];

  } catch (error) {
    console.error('❌ Exception fetching orders:', error);
    toast.error(`❌ Errore imprevisto caricando ordini: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return [];
  }
};

export const saveOrders = async (orders: Order[]): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, orders NOT saved');
    return false;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return false;
    }

    for (const order of orders) {
      const { error } = await supabase
        .from('orders')
        .upsert(
          {
            ...order,
            user_id: user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

      if (error) {
        console.error('❌ Error saving order:', error);
        toast.error(`❌ Errore salvando ordine: ${error.message}`);
        return false;
      }
    }

    return true;

  } catch (error) {
    console.error('❌ Exception saving orders:', error);
    toast.error(`❌ Errore imprevisto salvando ordini: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
};

export const updateOrder = async (id: string, updates: Partial<Order>): Promise<Order | null> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, order NOT updated');
    toast.error('❌ Supabase non configurato. Impossibile aggiornare l\'ordine.');
    return null;
  }

  try {
    const { data, error } = await supabase
    .from('orders')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

    if (error) {
      console.error('❌ Error updating order:', error);
      toast.error(`❌ Errore aggiornando ordine: ${error.message}`);
      return null;
    }

    return data;

  } catch (error) {
    console.error('❌ Exception updating order:', error);
    toast.error(`❌ Errore imprevisto: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
};

export const deleteOrder = async (id: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, order NOT deleted');
    toast.error('❌ Supabase non configurato. Impossibile eliminare l\'ordine.');
    return false;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated, cannot delete order');
      toast.error('❌ Utente non autenticato. Impossibile eliminare l\'ordine.');
      return false;
    }

    console.log(`🗑️ [DELETE] Deleting order ${id} for user ${user.id}...`);

    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('❌ Error deleting order:', error);
      toast.error(`❌ Errore eliminando ordine: ${error.message}`);
      return false;
    }

    console.log(`✅ [DELETE] Order ${id} deleted successfully`);
    return true;

  } catch (error) {
    console.error('❌ Exception deleting order:', error);
    toast.error(`❌ Errore imprevisto: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
};

// ============================================================================
// DRAFT ORDERS
// ============================================================================

export const saveDraftOrder = async (orderItems: OrderItem[], temporaryOcrProducts: Product[] = []): Promise<boolean> => {
  const draftData: DraftOrderData = {
    orderItems,
    temporaryOcrProducts,
    timestamp: new Date().toISOString()
  };

  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, saving draft to localStorage');
    localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(draftData));
    return true;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated, saving to localStorage');
      localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(draftData));
      return true;
    }

    const draftId = `${user.id}${DRAFT_ID_SUFFIX}`;

    const { error } = await supabase
      .from('draft_orders')
      .upsert({
        id: draftId,
        user_id: user.id,
        order_items: orderItems,
        temporary_ocr_products: temporaryOcrProducts,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (error) {
      console.error('❌ Error saving draft order to Supabase:', error);
      localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(draftData));
      return false;
    }

    localStorage.removeItem(LOCAL_DRAFT_KEY);
    return true;

  } catch (error) {
    console.error('❌ Exception saving draft order:', error);
    localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify(draftData));
    return false;
  }
};

export const getDraftOrder = async (): Promise<DraftOrderData | null> => {
  const localDraft = localStorage.getItem(LOCAL_DRAFT_KEY);
  if (localDraft) {
    try {
      const parsed = JSON.parse(localDraft);
      return parsed;
    } catch (error) {
      console.error('❌ Error parsing localStorage draft:', error);
    }
  }

  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, no draft found');
    return null;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return null;
    }

    const draftId = `${user.id}${DRAFT_ID_SUFFIX}`;

    const { data, error } = await supabase
      .from('draft_orders')
      .select('*')
      .eq('id', draftId)
      .maybeSingle();

    if (error) {
      console.error('❌ Error fetching draft order:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    const draftData: DraftOrderData = {
      orderItems: data.order_items || [],
      temporaryOcrProducts: data.temporary_ocr_products || [],
      timestamp: data.updated_at
    };

    return draftData;

  } catch (error) {
    console.error('❌ Exception fetching draft order:', error);
    return null;
  }
};

export const clearDraftOrder = async (): Promise<boolean> => {
  localStorage.removeItem(LOCAL_DRAFT_KEY);

  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, localStorage draft cleared');
    return true;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return true;
    }

    const draftId = `${user.id}${DRAFT_ID_SUFFIX}`;

    const { error } = await supabase
      .from('draft_orders')
      .delete()
      .eq('id', draftId);

    if (error) {
      console.error('❌ Error deleting draft order:', error);
      return false;
    }

    return true;

  } catch (error) {
    console.error('❌ Exception clearing draft order:', error);
    return false;
  }
};

// ============================================================================
// CANCELLED DRAFT ORDERS
// ============================================================================

export const saveCancelledDraft = async (orderItems: OrderItem[], temporaryOcrProducts: Product[] = []): Promise<boolean> => {
  const cancelledData = {
    orderItems,
    temporaryOcrProducts,
    timestamp: new Date().toISOString()
  };

  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, saving cancelled draft to localStorage');
    localStorage.setItem(LOCAL_CANCELLED_KEY, JSON.stringify(cancelledData));
    return true;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated, saving to localStorage');
      localStorage.setItem(LOCAL_CANCELLED_KEY, JSON.stringify(cancelledData));
      return true;
    }

    const cancelledId = `${user.id}${CANCELLED_DRAFT_ID_SUFFIX}`;

    const { error } = await supabase
      .from('cancelled_draft_orders')
      .upsert({
        id: cancelledId,
        user_id: user.id,
        order_items: orderItems,
        temporary_ocr_products: temporaryOcrProducts,
        cancelled_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (error) {
      console.error('❌ Error saving cancelled draft:', error);
      localStorage.setItem(LOCAL_CANCELLED_KEY, JSON.stringify(cancelledData));
      return false;
    }

    localStorage.removeItem(LOCAL_CANCELLED_KEY);
    return true;

  } catch (error) {
    console.error('❌ Exception saving cancelled draft:', error);
    localStorage.setItem(LOCAL_CANCELLED_KEY, JSON.stringify(cancelledData));
    return false;
  }
};

export const getCancelledDraft = async (): Promise<DraftOrderData | null> => {
  const localCancelled = localStorage.getItem(LOCAL_CANCELLED_KEY);
  if (localCancelled) {
    try {
      const parsed = JSON.parse(localCancelled);
      return parsed;
    } catch (error) {
      console.error('❌ Error parsing localStorage cancelled draft:', error);
    }
  }

  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, no cancelled draft found');
    return null;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return null;
    }

    const cancelledId = `${user.id}${CANCELLED_DRAFT_ID_SUFFIX}`;

    const { data, error } = await supabase
      .from('cancelled_draft_orders')
      .select('*')
      .eq('id', cancelledId)
      .maybeSingle();

    if (error) {
      console.error('❌ Error fetching cancelled draft:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    const cancelledData: DraftOrderData = {
      orderItems: data.order_items || [],
      temporaryOcrProducts: data.temporary_ocr_products || [],
      timestamp: data.cancelled_at
    };

    return cancelledData;

  } catch (error) {
    console.error('❌ Exception fetching cancelled draft:', error);
    return null;
  }
};

export const clearCancelledDraft = async (): Promise<boolean> => {
  localStorage.removeItem(LOCAL_CANCELLED_KEY);

  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, localStorage cancelled draft cleared');
    return true;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return true;
    }

    const cancelledId = `${user.id}${CANCELLED_DRAFT_ID_SUFFIX}`;

    const { error } = await supabase
      .from('cancelled_draft_orders')
      .delete()
      .eq('id', cancelledId);

    if (error) {
      console.error('❌ Error deleting cancelled draft:', error);
      return false;
    }

    return true;

  } catch (error) {
    console.error('❌ Exception clearing cancelled draft:', error);
    return false;
  }
};

// ============================================================================
// INVOICES
// ============================================================================

function convertDateToISO(dateStr: string): string {
  if (!dateStr) return new Date().toISOString().split('T')[0];
  
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [day, month, year] = parts;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  return new Date().toISOString().split('T')[0];
}

export const addInvoice = async (invoice: Omit<Invoice, 'id'>): Promise<Invoice | null> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, invoice NOT saved');
    toast.error('❌ Supabase non configurato. Impossibile salvare la fattura.');
    return null;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      toast.error('❌ Utente non autenticato. Effettua il login.');
      return null;
    }

    // ✅ ENFORCE INVOICE LIMIT before inserting
    const limitCheck = await checkInvoiceLimitDetailed();
    if (!limitCheck.allowed) {
      console.warn(`🚫 [LIMIT] Invoice limit reached: ${limitCheck.currentCount}/${limitCheck.limit}. Cannot add invoice.`);
      // Don't toast here - let the caller handle the UI message
      return null;
    }

    let supplierName = 'Unknown Supplier';
    if (invoice.supplier_id) {
      const { data: supplierData } = await supabase
        .from('suppliers')
        .select('name')
        .eq('id', invoice.supplier_id)
        .single();
      
      if (supplierData) {
        supplierName = supplierData.name;
      }
    }

    const itemsJsonb = typeof invoice.items === 'string' 
      ? JSON.parse(invoice.items) 
      : invoice.items;

    const isoDate = convertDateToISO(invoice.date);

    const dbInvoice = {
      user_id: user.id,
      invoice_number: invoice.invoice_number,
      supplier_name: supplierName,
      date: isoDate,
      total_amount: parseFloat(String(invoice.amount)),
      is_paid: invoice.paid || false,
      payment_date: null,
      notes: '',
      items: itemsJsonb,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from(INVOICES_TABLE)
      .insert([dbInvoice])
      .select()
      .single();

    if (error) {
      console.error('❌ Error adding invoice:', error);
      toast.error(`❌ Errore salvando fattura: ${error.message}`);
      return null;
    }

    // ✅ Increment invoice count after successful save
    await incrementInvoiceCount();

    const savedInvoice: Invoice = {
      id: data.id,
      supplier_id: invoice.supplier_id,
      invoice_number: data.invoice_number,
      date: data.date,
      amount: parseFloat(String(data.total_amount)),
      items: data.items,
      paid: data.is_paid,
      created_at: data.created_at,
      updated_at: data.updated_at,
      user_id: data.user_id
    };

    return savedInvoice;

  } catch (error) {
    console.error('❌ Exception adding invoice:', error);
    toast.error(`❌ Errore imprevisto salvando fattura: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
};

export const getInvoices = async (): Promise<Invoice[]> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, returning empty invoices');
    return [];
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return [];
    }

    const { data, error } = await supabase
      .from(INVOICES_TABLE)
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching invoices:', error);
      toast.error(`❌ Errore caricando fatture: ${error.message}`);
      return [];
    }

    const suppliers = await getSuppliers();
    
    const invoices: Invoice[] = (data || []).map(dbInvoice => {
      const matchedSupplier = suppliers.find(s => s.name === dbInvoice.supplier_name);
      
      return {
        id: dbInvoice.id,
        supplier_id: matchedSupplier?.id || '',
        supplier_name: dbInvoice.supplier_name,
        invoice_number: dbInvoice.invoice_number,
        date: dbInvoice.date,
        amount: parseFloat(String(dbInvoice.total_amount || 0)),
        total_amount: parseFloat(String(dbInvoice.total_amount || 0)),
        vat_amount: 0,
        vat_breakdown: [],
        items: dbInvoice.items,
        paid: dbInvoice.is_paid,
        is_paid: dbInvoice.is_paid,
        payment_date: dbInvoice.payment_date,
        notes: dbInvoice.notes || '',
        created_at: dbInvoice.created_at,
        updated_at: dbInvoice.updated_at,
        user_id: dbInvoice.user_id
      };
    });

    return invoices;

  } catch (error) {
    console.error('❌ Exception fetching invoices:', error);
    toast.error(`❌ Errore imprevisto caricando fatture: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return [];
  }
};

export const saveInvoices = async (invoices: Invoice[]): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, invoices NOT saved');
    return false;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return false;
    }

    for (const invoice of invoices) {
      let supplierName = 'Unknown Supplier';
      if (invoice.supplier_id) {
        const { data: supplierData } = await supabase
          .from('suppliers')
          .select('name')
          .eq('id', invoice.supplier_id)
          .single();
        
        if (supplierData) {
          supplierName = supplierData.name;
        }
      }

      const dbInvoice = {
        id: invoice.id,
        user_id: user.id,
        invoice_number: invoice.invoice_number,
        supplier_name: supplierName,
        date: convertDateToISO(invoice.date),
        total_amount: parseFloat(String(invoice.amount)),
        is_paid: invoice.paid || invoice.is_paid || false,
        payment_date: invoice.payment_date || invoice.paymentDate || null,
        items: typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from(INVOICES_TABLE)
        .upsert(dbInvoice, { onConflict: 'id' });

      if (error) {
        console.error('❌ Error saving invoice:', error);
        toast.error(`❌ Errore salvando fattura: ${error.message}`);
        return false;
      }
    }

    return true;

  } catch (error) {
    console.error('❌ Exception saving invoices:', error);
    toast.error(`❌ Errore imprevisto salvando fatture: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
};

export const updateInvoice = async (id: string, updates: Partial<Invoice>): Promise<Invoice | null> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, invoice NOT updated');
    toast.error('❌ Supabase non configurato. Impossibile aggiornare la fattura.');
    return null;
  }

  try {
    const dbUpdates: Record<string, unknown> = {};
    
    if (updates.invoice_number) dbUpdates.invoice_number = updates.invoice_number;
    if (updates.date) dbUpdates.date = convertDateToISO(updates.date);
    if (updates.amount !== undefined) dbUpdates.total_amount = parseFloat(String(updates.amount));
    if (updates.paid !== undefined) dbUpdates.is_paid = updates.paid;
    if (updates.payment_date !== undefined) dbUpdates.payment_date = updates.payment_date;
    if (updates.items) dbUpdates.items = typeof updates.items === 'string' ? JSON.parse(updates.items) : updates.items;
    
    if (updates.supplier_id) {
      const { data: supplierData } = await supabase
        .from('suppliers')
        .select('name')
        .eq('id', updates.supplier_id)
        .single();
      
      if (supplierData) {
        dbUpdates.supplier_name = supplierData.name;
      }
    }
    
    dbUpdates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
    .from(INVOICES_TABLE)
    .update(dbUpdates)
    .eq('id', id)
    .select()
    .single();

    if (error) {
      console.error('❌ Error updating invoice:', error);
      toast.error(`❌ Errore aggiornando fattura: ${error.message}`);
      return null;
    }

    const suppliers = await getSuppliers();
    const matchedSupplier = suppliers.find(s => s.name === data.supplier_name);
    
    const updatedInvoice: Invoice = {
      id: data.id,
      supplier_id: matchedSupplier?.id || updates.supplier_id || '',
      supplier_name: data.supplier_name,
      invoice_number: data.invoice_number,
      date: data.date,
      amount: parseFloat(String(data.total_amount)),
      total_amount: parseFloat(String(data.total_amount)),
      vat_amount: 0,
      vat_breakdown: [],
      items: data.items,
      paid: data.is_paid,
      is_paid: data.is_paid,
      payment_date: data.payment_date,
      notes: data.notes || '',
      created_at: data.created_at,
      updated_at: data.updated_at,
      user_id: data.user_id
    };

    return updatedInvoice;

  } catch (error) {
    console.error('❌ Exception updating invoice:', error);
    toast.error(`❌ Errore imprevisto: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
};

export const deleteInvoice = async (id: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, invoice NOT deleted');
    toast.error('❌ Supabase non configurato. Impossibile eliminare la fattura.');
    return false;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated, cannot delete invoice');
      toast.error('❌ Utente non autenticato. Impossibile eliminare la fattura.');
      return false;
    }

    console.log(`🗑️ [DELETE] Deleting invoice ${id} for user ${user.id}...`);

    const { error } = await supabase
      .from(INVOICES_TABLE)
      .delete()
      .eq('id', id)
      .eq('user_id', user.id);

    if (error) {
      console.error('❌ Error deleting invoice:', error);
      toast.error(`❌ Errore eliminando fattura: ${error.message}`);
      return false;
    }

    console.log(`✅ [DELETE] Invoice ${id} deleted successfully`);
    return true;

  } catch (error) {
    console.error('❌ Exception deleting invoice:', error);
    toast.error(`❌ Errore imprevisto: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
};

// ============================================================================
// SETTINGS
// ============================================================================

export const getSettings = async (): Promise<Settings> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, returning default settings');
    const defaultTemplates = getDefaultTemplates('it');
    return {
      country: 'IT',
      defaultCurrency: 'EUR',
      storeName: 'Il Mio Ristorante',
      theme: 'light',
      language: 'it',
      fontSize: 'medium',
      layoutMode: 'expanded',
      messageTemplates: defaultTemplates
    };
  }

  try {
    const user = await getCurrentUser();
    
    if (!user) {
      console.error('❌ User not authenticated, returning default settings');
      const defaultTemplates = getDefaultTemplates('it');
      return {
        country: 'IT',
        defaultCurrency: 'EUR',
        storeName: 'Il Mio Ristorante',
        theme: 'light',
        language: 'it',
        fontSize: 'medium',
        layoutMode: 'expanded',
        messageTemplates: defaultTemplates
      };
    }

    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('❌ Error fetching settings:', error);
      const defaultTemplates = getDefaultTemplates('it');
      return {
        country: 'IT',
        defaultCurrency: 'EUR',
        storeName: 'Il Mio Ristorante',
        theme: 'light',
        language: 'it',
        fontSize: 'medium',
        layoutMode: 'expanded',
        messageTemplates: defaultTemplates
      };
    }

    if (!data) {
      const defaultTemplates = getDefaultTemplates('it');
      const defaultSettings = {
        user_id: user.id,
        country: 'IT',
        default_currency: 'EUR',
        store_name: 'Il Mio Ristorante',
        theme: 'light',
        language: 'it',
        font_size: 'medium',
        layout_mode: 'expanded',
        message_template_whatsapp: defaultTemplates.whatsapp,
        message_template_email: defaultTemplates.email,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: insertError } = await supabase.from('user_settings').insert([defaultSettings]);
      
      if (insertError) {
        console.error('❌ Error inserting default settings:', insertError);
      }
      
      return {
        country: defaultSettings.country,
        defaultCurrency: defaultSettings.default_currency,
        storeName: defaultSettings.store_name,
        theme: defaultSettings.theme,
        language: defaultSettings.language,
        fontSize: defaultSettings.font_size as 'small' | 'medium' | 'large',
        layoutMode: defaultSettings.layout_mode as 'compact' | 'expanded',
        messageTemplates: defaultTemplates
      };
    }

    const language = data.language || 'it';
    const defaultTemplates = getDefaultTemplates(language);
    
    const settings: Settings = {
      country: data.country || 'IT',
      defaultCurrency: data.default_currency || data.defaultCurrency || 'EUR',
      storeName: data.store_name || data.storeName || 'Il Mio Ristorante',
      theme: data.theme || 'light',
      language: language,
      fontSize: (data.font_size || data.fontSize || 'medium') as 'small' | 'medium' | 'large',
      layoutMode: (data.layout_mode || data.layoutMode || 'expanded') as 'compact' | 'expanded',
      messageTemplates: {
        whatsapp: data.message_template_whatsapp || defaultTemplates.whatsapp,
        email: data.message_template_email || defaultTemplates.email
      }
    };

    return settings;

  } catch (error) {
    console.error('❌ Exception fetching settings:', error);
    const defaultTemplates = getDefaultTemplates('it');
    return {
      country: 'IT',
      defaultCurrency: 'EUR',
      storeName: 'Il Mio Ristorante',
      theme: 'light',
      language: 'it',
      fontSize: 'medium',
      layoutMode: 'expanded',
      messageTemplates: defaultTemplates
    };
  }
};

export const saveSettings = async (settings: Settings): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, settings NOT saved');
    return false;
  }

  try {
    const user = await getCurrentUser();
    
    if (!user) {
      console.error('❌ User not authenticated');
      return false;
    }

    const dbSettings = {
      user_id: user.id,
      country: settings.country,
      default_currency: settings.defaultCurrency,
      store_name: settings.storeName,
      theme: settings.theme,
      language: settings.language,
      font_size: settings.fontSize,
      layout_mode: settings.layoutMode,
      message_template_whatsapp: settings.messageTemplates?.whatsapp || '',
      message_template_email: settings.messageTemplates?.email || '',
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from('user_settings')
      .upsert(dbSettings, { 
        onConflict: 'user_id',
        ignoreDuplicates: false
      });

    if (error) {
      console.error('❌ Error saving settings:', error);
      return false;
    }

    return true;

  } catch (error) {
    console.error('❌ Exception saving settings:', error);
    return false;
  }
};

export const loadSettings = async (): Promise<Settings> => {
  try {
    const settings = await getSettings();
    return settings;
  } catch (error) {
    console.error('❌ Error loading settings:', error);
    const defaultTemplates = getDefaultTemplates('it');
    return {
      country: 'IT',
      defaultCurrency: 'EUR',
      storeName: 'Il Mio Ristorante',
      theme: 'light',
      language: 'it',
      fontSize: 'medium',
      layoutMode: 'expanded',
      messageTemplates: defaultTemplates
    };
  }
};

// ============================================================================
// BATCH OPERATIONS
// ============================================================================

export const clearAllData = async (): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, data NOT cleared');
    return false;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return false;
    }

    const tables = [
      INVOICES_TABLE,
      'draft_orders',
      'cancelled_draft_orders',
      'orders',
      'products',
      'suppliers',
      'user_settings',
      PRODUCT_COMPATIBILITY_TABLE,
      'price_history_data', // ✅ NEW: Clear price history when clearing all data
    ];

    for (const table of tables) {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('user_id', user.id);

      if (error) {
        console.error(`❌ Error deleting from ${table}:`, error);
      }
    }

    return true;

  } catch (error) {
    console.error('❌ Exception clearing data:', error);
    return false;
  }
};

// Legacy compatibility
export const getDraftOrders = async (): Promise<Order[]> => {
  console.warn('⚠️ getDraftOrders is deprecated, use getDraftOrder instead');
  return [];
};

export const deleteDraftOrder = async (draftOrderId: string): Promise<boolean> => {
  console.warn('⚠️ deleteDraftOrder is deprecated, use clearDraftOrder instead');
  return clearDraftOrder();
};

export const saveCancelledDraftOrder = saveCancelledDraft;
export const getCancelledDraftOrders = async (): Promise<Order[]> => {
  console.warn('⚠️ getCancelledDraftOrders is deprecated, use getCancelledDraft instead');
  return [];
};
export const clearCancelledDraftOrder = clearCancelledDraft;

export default {
  addProduct,
  getProducts,
  saveProducts,
  updateProduct,
  deleteProduct,
  batchAddProducts,
  batchUpdateProducts,
  getProductById,
  addSupplier,
  getSuppliers,
  saveSuppliers,
  updateSupplier,
  deleteSupplier,
  addOrder,
  getOrders,
  saveOrders,
  updateOrder,
  deleteOrder,
  saveDraftOrder,
  getDraftOrder,
  clearDraftOrder,
  saveCancelledDraft,
  getCancelledDraft,
  clearCancelledDraft,
  addInvoice,
  getInvoices,
  saveInvoices,
  updateInvoice,
  deleteInvoice,
  getSettings,
  loadSettings,
  saveSettings,
  clearAllData,
  saveProductComparison,
  getProductComparisons,
  deleteProductComparison,
  getSubscriptionLimits,
  incrementScanCount,
  incrementProductCount,
  incrementInvoiceCount,
  checkScanLimit,
  checkProductLimit,
  checkProductLimitDetailed,
  checkInvoiceLimit,
  checkInvoiceLimitDetailed,
};