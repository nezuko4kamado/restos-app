import { supabase, isSupabaseConfigured, getCurrentUser } from './supabase';
import { Product, Supplier, Order, Invoice, Settings } from '@/types';
import type { OrderItem } from '@/types';

// Constants for draft operations
const DRAFT_ID_SUFFIX = '-draft-current';
const CANCELLED_DRAFT_ID_SUFFIX = '-draft-cancelled';

// Fallback keys for localStorage
const LOCAL_DRAFT_KEY = 'draft_order';
const LOCAL_CANCELLED_KEY = 'cancelled_draft_order';

// ============================================================================
// PRODUCTS
// ============================================================================

export const addProduct = async (product: Omit<Product, 'id'>): Promise<Product | null> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, product NOT saved to cloud');
    return null;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return null;
    }

    // CRITICAL FIX: Map only valid database columns, excluding frontend-only properties
    const dbProduct = {
      name: product.name,
      price: product.price,
      category: product.category || 'general',
      original_price: product.original_price,
      discount: product.discount,
      unit: product.unit || 'kg',
      supplier_id: product.supplier_id,
      vat_rate: product.vat_rate || product.vatRate, // Use snake_case for DB
      notes: product.notes,
      user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log('💾 [addProduct] Saving to DB:', {
      name: dbProduct.name,
      price: dbProduct.price,
      supplier_id: dbProduct.supplier_id,
      vat_rate: dbProduct.vat_rate
    });

    const { data, error } = await supabase
      .from('app_43909_products')
      .insert([dbProduct])
      .select()
      .single();

    if (error) {
      console.error('❌ Error adding product:', error);
      console.error('❌ Error details:', JSON.stringify(error, null, 2));
      return null;
    }

    console.log('✅ Product added:', data);
    return data;
  } catch (error) {
    console.error('❌ Exception adding product:', error);
    return null;
  }
};

export const getProducts = async (): Promise<Product[]> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, returning empty products');
    return [];
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return [];
    }

    const { data, error } = await supabase
      .from('app_43909_products')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching products:', error);
      return [];
    }

    // 🔥 FIX: Ensure all products have updated_at field
    const productsWithUpdatedAt = (data || []).map(product => ({
      ...product,
      // If updated_at is missing, use created_at or current timestamp
      updated_at: product.updated_at || product.created_at || new Date().toISOString()
    }));

    console.log('✅ Products fetched:', productsWithUpdatedAt.length);
    console.log('🔧 [FIX] Products with updated_at applied:', productsWithUpdatedAt.length);
    
    return productsWithUpdatedAt;
  } catch (error) {
    console.error('❌ Exception fetching products:', error);
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
      // CRITICAL FIX: Map only valid database columns
      const dbProduct = {
        id: product.id,
        name: product.name,
        price: product.price,
        category: product.category || 'general',
        original_price: product.original_price,
        discount: product.discount,
        unit: product.unit || 'kg',
        supplier_id: product.supplier_id,
        vat_rate: product.vat_rate || product.vatRate,
        notes: product.notes,
        user_id: user.id,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('app_43909_products')
        .upsert(dbProduct, { onConflict: 'id' });

      if (error) {
        console.error('❌ Error saving product:', error);
        return false;
      }
    }

    console.log('✅ Products saved to Supabase:', products.length);
    return true;
  } catch (error) {
    console.error('❌ Exception saving products:', error);
    return false;
  }
};

export const updateProduct = async (id: string, updates: Partial<Product>): Promise<Product | null> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, product NOT updated');
    return null;
  }

  try {
    // CRITICAL FIX: Map only valid database columns
    const dbUpdates: Record<string, unknown> = {};
    
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.price !== undefined) dbUpdates.price = updates.price;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.original_price !== undefined) dbUpdates.original_price = updates.original_price;
    if (updates.discount !== undefined) dbUpdates.discount = updates.discount;
    if (updates.unit !== undefined) dbUpdates.unit = updates.unit;
    if (updates.supplier_id !== undefined) dbUpdates.supplier_id = updates.supplier_id;
    if (updates.vat_rate !== undefined || updates.vatRate !== undefined) {
      dbUpdates.vat_rate = updates.vat_rate || updates.vatRate;
    }
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    
    dbUpdates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('app_43909_products')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating product:', error);
      return null;
    }

    console.log('✅ Product updated:', data);
    return data;
  } catch (error) {
    console.error('❌ Exception updating product:', error);
    return null;
  }
};

export const deleteProduct = async (id: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, product NOT deleted');
    return false;
  }

  try {
    const { error } = await supabase
      .from('app_43909_products')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ Error deleting product:', error);
      return false;
    }

    console.log('✅ Product deleted');
    return true;
  } catch (error) {
    console.error('❌ Exception deleting product:', error);
    return false;
  }
};

// ============================================================================
// SUPPLIERS
// ============================================================================

export const addSupplier = async (supplier: Omit<Supplier, 'id'>): Promise<Supplier | null> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, supplier NOT saved');
    return null;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return null;
    }

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
      console.error('❌ Error adding supplier:', error);
      return null;
    }

    console.log('✅ Supplier added:', data);
    return data;
  } catch (error) {
    console.error('❌ Exception adding supplier:', error);
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
      return [];
    }

    console.log('✅ Suppliers fetched:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('❌ Exception fetching suppliers:', error);
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
        return false;
      }
    }

    console.log('✅ Suppliers saved to Supabase:', suppliers.length);
    return true;
  } catch (error) {
    console.error('❌ Exception saving suppliers:', error);
    return false;
  }
};

export const updateSupplier = async (id: string, updates: Partial<Supplier>): Promise<Supplier | null> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, supplier NOT updated');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('suppliers')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating supplier:', error);
      return null;
    }

    console.log('✅ Supplier updated:', data);
    return data;
  } catch (error) {
    console.error('❌ Exception updating supplier:', error);
    return null;
  }
};

export const deleteSupplier = async (id: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, supplier NOT deleted');
    return false;
  }

  try {
    const { error } = await supabase
      .from('suppliers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ Error deleting supplier:', error);
      return false;
    }

    console.log('✅ Supplier deleted');
    return true;
  } catch (error) {
    console.error('❌ Exception deleting supplier:', error);
    return false;
  }
};

// ============================================================================
// ORDERS
// ============================================================================

export const addOrder = async (order: Omit<Order, 'id'>): Promise<Order | null> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, order NOT saved');
    return null;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
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
      return null;
    }

    console.log('✅ Order added:', data);
    return data;
  } catch (error) {
    console.error('❌ Exception adding order:', error);
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
      return [];
    }

    console.log('✅ Orders fetched:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('❌ Exception fetching orders:', error);
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
        return false;
      }
    }

    console.log('✅ Orders saved to Supabase:', orders.length);
    return true;
  } catch (error) {
    console.error('❌ Exception saving orders:', error);
    return false;
  }
};

export const updateOrder = async (id: string, updates: Partial<Order>): Promise<Order | null> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, order NOT updated');
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
      return null;
    }

    console.log('✅ Order updated:', data);
    return data;
  } catch (error) {
    console.error('❌ Exception updating order:', error);
    return null;
  }
};

export const deleteOrder = async (id: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, order NOT deleted');
    return false;
  }

  try {
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ Error deleting order:', error);
      return false;
    }

    console.log('✅ Order deleted');
    return true;
  } catch (error) {
    console.error('❌ Exception deleting order:', error);
    return false;
  }
};

// ============================================================================
// DRAFT ORDER OPERATIONS (Active Order)
// ============================================================================

interface EnrichedOrderItem extends OrderItem {
  product_name?: string;
}

export const saveDraftOrder = async (items: OrderItem[], temporaryOcrProducts: Product[] = []): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, draft order NOT saved');
    localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify({ items, temporaryOcrProducts }));
    return false;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify({ items, temporaryOcrProducts }));
      return false;
    }

    const draftId = `${user.id}${DRAFT_ID_SUFFIX}`;

    // Get supplier ID from first product
    let supplierId = null;
    if (items.length > 0) {
      const { data } = await supabase
        .from('app_43909_products')
        .select('supplier_id')
        .eq('id', items[0].product_id)
        .single();
      supplierId = data?.supplier_id;
    }

    // 🔥 NUOVO: Arricchisci gli items con i nomi dei prodotti
    const enrichedItems: EnrichedOrderItem[] = items.map(item => {
      const product = temporaryOcrProducts.find(p => p.id === item.product_id);
      return {
        ...item,
        product_name: product?.name // Salva il nome del prodotto
      };
    });

    console.log('💾 Saving draft with enriched items:', enrichedItems);

    const { error } = await supabase
      .from('orders')
      .upsert({
        id: draftId,
        user_id: user.id,
        status: 'draft',
        items: enrichedItems, // ✅ Ora contiene product_name
        supplier_id: supplierId,
        order_date: new Date().toISOString(),
        total_amount: items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        metadata: {
          is_draft: true,
          temporaryOcrProducts // Salva i prodotti completi per ricostruire tutto
        }
      }, { onConflict: 'id' });

    if (error) {
      console.error('❌ Supabase draft save error:', error);
      localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify({ items: enrichedItems, temporaryOcrProducts }));
      return false;
    }

    console.log('✅ Draft saved to Supabase:', items.length, 'items with names');
    return true;
  } catch (error) {
    console.warn('⚠️ Falling back to localStorage for draft save');
    localStorage.setItem(LOCAL_DRAFT_KEY, JSON.stringify({ items, temporaryOcrProducts }));
    return false;
  }
};

export const getDraftOrder = async (): Promise<{ items: OrderItem[], temporaryOcrProducts: Product[] } | null> => {
  try {
    const user = await getCurrentUser();
    if (!user || !isSupabaseConfigured()) {
      const local = localStorage.getItem(LOCAL_DRAFT_KEY);
      return local ? JSON.parse(local) : null;
    }

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'draft')
      .maybeSingle();

    if (error) throw error;

    if (!data) return null;

    console.log('✅ Retrieved draft from Supabase:', data.items?.length || 0, 'items');
    return {
      items: data.items as OrderItem[],
      temporaryOcrProducts: data.metadata?.temporaryOcrProducts || []
    };
  } catch (error) {
    console.error('Error fetching draft:', error);
    const local = localStorage.getItem(LOCAL_DRAFT_KEY);
    return local ? JSON.parse(local) : null;
  }
};

export const clearDraftOrder = async (): Promise<boolean> => {
  try {
    const user = await getCurrentUser();
    if (user && isSupabaseConfigured()) {
      await supabase.from('orders')
        .delete()
        .eq('user_id', user.id)
        .eq('status', 'draft');
    }
    localStorage.removeItem(LOCAL_DRAFT_KEY);
    console.log('✅ Draft order cleared');
    return true;
  } catch (error) {
    console.error('Error clearing draft:', error);
    localStorage.removeItem(LOCAL_DRAFT_KEY);
    return false;
  }
};

// ============================================================================
// CANCELLED DRAFT OPERATIONS (Recovery / Undo)
// ============================================================================

export const saveCancelledDraft = async (items: OrderItem[], temporaryOcrProducts: Product[] = []): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, cancelled draft NOT saved');
    localStorage.setItem(LOCAL_CANCELLED_KEY, JSON.stringify({ items, temporaryOcrProducts }));
    return false;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      localStorage.setItem(LOCAL_CANCELLED_KEY, JSON.stringify({ items, temporaryOcrProducts }));
      return false;
    }

    const draftId = `${user.id}${CANCELLED_DRAFT_ID_SUFFIX}`;

    let supplierId = null;
    if (items.length > 0) {
      const { data } = await supabase
        .from('app_43909_products')
        .select('supplier_id')
        .eq('id', items[0].product_id)
        .single();
      supplierId = data?.supplier_id;
    }

    // 🔥 NUOVO: Arricchisci anche gli items cancellati con nomi
    const enrichedItems: EnrichedOrderItem[] = items.map(item => {
      const product = temporaryOcrProducts.find(p => p.id === item.product_id);
      return {
        ...item,
        product_name: product?.name
      };
    });

    const { error } = await supabase
      .from('orders')
      .upsert({
        id: draftId,
        user_id: user.id,
        status: 'cancelled',
        items: enrichedItems, // ✅ Ora contiene product_name
        supplier_id: supplierId,
        order_date: new Date().toISOString(),
        total_amount: items.reduce((sum, item) => sum + (item.price * item.quantity), 0),
        metadata: {
          is_cancelled_recovery: true,
          temporaryOcrProducts
        }
      }, { onConflict: 'id' });

    if (error) throw error;

    console.log('✅ Cancelled draft saved for recovery with names');
    return true;
  } catch (error) {
    console.error('Error saving cancelled draft:', error);
    localStorage.setItem(LOCAL_CANCELLED_KEY, JSON.stringify({ items, temporaryOcrProducts }));
    return false;
  }
};

export const getCancelledDraft = async (): Promise<{ orderItems: OrderItem[], temporaryOcrProducts: Product[] } | null> => {
  try {
    const user = await getCurrentUser();
    if (!user || !isSupabaseConfigured()) {
      const local = localStorage.getItem(LOCAL_CANCELLED_KEY);
      if (local) {
        const parsed = JSON.parse(local);
        return {
          orderItems: parsed.items,
          temporaryOcrProducts: parsed.temporaryOcrProducts || []
        };
      }
      return null;
    }

    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .eq('user_id', user.id)
      .eq('status', 'cancelled')
      .maybeSingle();

    if (error) throw error;

    if (!data) return null;

    console.log('✅ Retrieved cancelled draft:', data.items?.length || 0, 'items');
    return {
      orderItems: data.items as OrderItem[],
      temporaryOcrProducts: data.metadata?.temporaryOcrProducts || []
    };
  } catch (error) {
    console.error('Error getting cancelled draft:', error);
    const local = localStorage.getItem(LOCAL_CANCELLED_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      return {
        orderItems: parsed.items,
        temporaryOcrProducts: parsed.temporaryOcrProducts || []
      };
    }
    return null;
  }
};

export const clearCancelledDraft = async (): Promise<boolean> => {
  try {
    const user = await getCurrentUser();
    if (user && isSupabaseConfigured()) {
      await supabase.from('orders')
        .delete()
        .eq('user_id', user.id)
        .eq('status', 'cancelled');
    }
    localStorage.removeItem(LOCAL_CANCELLED_KEY);
    console.log('✅ Cancelled draft cleared');
    return true;
  } catch (error) {
    console.error('Error clearing cancelled draft:', error);
    localStorage.removeItem(LOCAL_CANCELLED_KEY);
    return false;
  }
};

// ============================================================================
// INVOICES
// ============================================================================

export const addInvoice = async (invoice: Omit<Invoice, 'id'>): Promise<Invoice | null> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, invoice NOT saved');
    return null;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return null;
    }

    const { data, error } = await supabase
      .from('invoices')
      .insert([
        {
          ...invoice,
          user_id: user.id,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('❌ Error adding invoice:', error);
      return null;
    }

    console.log('✅ Invoice added:', data);
    return data;
  } catch (error) {
    console.error('❌ Exception adding invoice:', error);
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
      .from('invoices')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('❌ Error fetching invoices:', error);
      return [];
    }

    console.log('✅ Invoices fetched:', data?.length || 0);
    return data || [];
  } catch (error) {
    console.error('❌ Exception fetching invoices:', error);
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
      const { error } = await supabase
        .from('invoices')
        .upsert(
          {
            ...invoice,
            user_id: user.id,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );

      if (error) {
        console.error('❌ Error saving invoice:', error);
        return false;
      }
    }

    console.log('✅ Invoices saved to Supabase:', invoices.length);
    return true;
  } catch (error) {
    console.error('❌ Exception saving invoices:', error);
    return false;
  }
};

export const updateInvoice = async (id: string, updates: Partial<Invoice>): Promise<Invoice | null> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, invoice NOT updated');
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('invoices')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('❌ Error updating invoice:', error);
      return null;
    }

    console.log('✅ Invoice updated:', data);
    return data;
  } catch (error) {
    console.error('❌ Exception updating invoice:', error);
    return null;
  }
};

export const deleteInvoice = async (id: string): Promise<boolean> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, invoice NOT deleted');
    return false;
  }

  try {
    const { error } = await supabase
      .from('invoices')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('❌ Error deleting invoice:', error);
      return false;
    }

    console.log('✅ Invoice deleted');
    return true;
  } catch (error) {
    console.error('❌ Exception deleting invoice:', error);
    return false;
  }
};

// ============================================================================
// SETTINGS
// ============================================================================

export const getSettings = async (): Promise<Settings> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, returning default settings');
    return {
      country: 'IT',
      defaultCurrency: 'EUR',
      storeName: 'Il Mio Negozio',
      theme: 'light',
      language: 'it',
    };
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated, returning default settings');
      return {
        country: 'IT',
        defaultCurrency: 'EUR',
        storeName: 'Il Mio Negozio',
        theme: 'light',
        language: 'it',
      };
    }

    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('❌ Error fetching settings:', error);
      return {
        country: 'IT',
        defaultCurrency: 'EUR',
        storeName: 'Il Mio Negozio',
        theme: 'light',
        language: 'it',
      };
    }

    if (!data) {
      console.log('ℹ️ No settings found, creating default settings');
      const defaultSettings = {
        user_id: user.id,
        country: 'IT',
        defaultCurrency: 'EUR',
        storeName: 'Il Mio Negozio',
        theme: 'light',
        language: 'it',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      await supabase.from('settings').insert([defaultSettings]);
      return defaultSettings as unknown as Settings;
    }

    console.log('✅ Settings retrieved:', data);
    return data;
  } catch (error) {
    console.error('❌ Exception fetching settings:', error);
    return {
      country: 'IT',
      defaultCurrency: 'EUR',
      storeName: 'Il Mio Negozio',
      theme: 'light',
      language: 'it',
    };
  }
};

export const loadSettings = async (): Promise<Settings> => {
  try {
    const settings = await getSettings();
    console.log('✅ Settings loaded:', settings);
    return settings;
  } catch (error) {
    console.error('❌ Error loading settings:', error);
    return {
      country: 'IT',
      defaultCurrency: 'EUR',
      storeName: 'Il Mio Negozio',
      theme: 'light',
      language: 'it',
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

    const { error } = await supabase
      .from('settings')
      .upsert(
        {
          ...settings,
          user_id: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      );

    if (error) {
      console.error('❌ Error saving settings:', error);
      return false;
    }

    console.log('✅ Settings saved to Supabase');
    return true;
  } catch (error) {
    console.error('❌ Exception saving settings:', error);
    return false;
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

    await supabase.from('invoices').delete().eq('user_id', user.id);
    await supabase.from('orders').delete().eq('user_id', user.id);
    await supabase.from('app_43909_products').delete().eq('user_id', user.id);
    await supabase.from('suppliers').delete().eq('user_id', user.id);

    console.log('✅ All data cleared');
    return true;
  } catch (error) {
    console.error('❌ Exception clearing data:', error);
    return false;
  }
};

export default {
  addProduct,
  getProducts,
  saveProducts,
  updateProduct,
  deleteProduct,
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
};