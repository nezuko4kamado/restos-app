import { createClient } from '@supabase/supabase-js';
import { OpenFoodFactsProduct } from './openFoodFactsApi';

const supabaseUrl = 'https://tmxmkvinsvuzbzrjrucw.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRteG1rdmluc3Z1emJ6cmpydWN3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5Mzc4ODIsImV4cCI6MjA3ODUxMzg4Mn0.bz5siYBfM4UVV6cerbHPzmII7DnDLP3ynH2OV2Ts3So';

const supabase = createClient(supabaseUrl, supabaseKey);

export interface CachedProduct {
  id: string;
  ean: string;
  product_name: string;
  brand?: string;
  image_url?: string;
  quantity?: string;
  category?: string;
  source: string;
  created_at: string;
  updated_at: string;
}

/**
 * Get product from Supabase cache by EAN
 * @param ean - The EAN barcode
 * @returns Cached product or null if not found
 */
export async function getCachedProduct(ean: string): Promise<OpenFoodFactsProduct | null> {
  try {
    const { data, error } = await supabase
      .from('scanned_products')
      .select('*')
      .eq('ean', ean)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found - this is expected, not an error
        return null;
      }
      console.error('Error fetching cached product:', error);
      return null;
    }

    if (!data) {
      return null;
    }

    return {
      ean: data.ean,
      productName: data.product_name,
      brand: data.brand || undefined,
      imageUrl: data.image_url || undefined,
      quantity: data.quantity || undefined,
      category: data.category || undefined,
      source: 'openfoodfacts'
    };

  } catch (error) {
    console.error('Unexpected error fetching cached product:', error);
    return null;
  }
}

/**
 * Save product to Supabase cache
 * @param product - The product to cache
 * @returns Success status
 */
export async function cacheProduct(product: OpenFoodFactsProduct): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('scanned_products')
      .upsert({
        ean: product.ean,
        product_name: product.productName,
        brand: product.brand || null,
        image_url: product.imageUrl || null,
        quantity: product.quantity || null,
        category: product.category || null,
        source: 'openfoodfacts',
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'ean'
      });

    if (error) {
      console.error('Error caching product:', error);
      return false;
    }

    console.log('Product cached successfully:', product.ean);
    return true;

  } catch (error) {
    console.error('Unexpected error caching product:', error);
    return false;
  }
}

/**
 * Get all cached products (for debugging/admin)
 * @returns Array of cached products
 */
export async function getAllCachedProducts(): Promise<CachedProduct[]> {
  try {
    const { data, error } = await supabase
      .from('scanned_products')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) {
      console.error('Error fetching all cached products:', error);
      return [];
    }

    return data || [];

  } catch (error) {
    console.error('Unexpected error fetching all cached products:', error);
    return [];
  }
}

/**
 * Clear old cached products (older than 30 days)
 * @returns Number of deleted products
 */
export async function clearOldCache(): Promise<number> {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data, error } = await supabase
      .from('scanned_products')
      .delete()
      .lt('updated_at', thirtyDaysAgo.toISOString())
      .select();

    if (error) {
      console.error('Error clearing old cache:', error);
      return 0;
    }

    const count = data?.length || 0;
    console.log(`Cleared ${count} old cached products`);
    return count;

  } catch (error) {
    console.error('Unexpected error clearing old cache:', error);
    return 0;
  }
}