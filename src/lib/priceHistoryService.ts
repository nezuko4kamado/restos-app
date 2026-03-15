import { supabase } from './supabase';
import { getCurrentUser } from './supabase';
import type { Product } from '@/types';

export interface PriceHistoryEntry {
  id: string;
  user_id: string;
  product_id: string;
  product_name: string;
  supplier_name: string;
  old_price: number | null;
  new_price: number;
  price_change_percent: number | null;
  invoice_id?: string;
  change_date: string;
  created_at: string;
}

export interface PriceAlert {
  product_id: string;
  product_name: string;
  supplier_name: string;
  old_price: number;
  new_price: number;
  change_percent: number;
  change_amount: number;
  date: string;
}

export class PriceHistoryService {
  /**
   * Track price change for a product
   * Saves the price change to the price_history table
   */
  static async trackPriceChange(
    productId: string,
    productName: string,
    supplierName: string,
    oldPrice: number | null,
    newPrice: number,
    invoiceId?: string
  ): Promise<void> {
    try {
      const user = await getCurrentUser();
      if (!user) {
        console.error('❌ [PRICE HISTORY] User not authenticated');
        return;
      }

      // Calculate percentage change
      let priceChangePercent: number | null = null;
      if (oldPrice && oldPrice > 0 && newPrice !== oldPrice) {
        priceChangePercent = ((newPrice - oldPrice) / oldPrice) * 100;
        priceChangePercent = Math.round(priceChangePercent * 100) / 100; // Round to 2 decimals
      }

      // Only track if there's an actual price change
      if (priceChangePercent === null || priceChangePercent === 0) {
        console.log(`📊 [PRICE HISTORY] No price change for product ${productName}, skipping`);
        return;
      }

      const historyEntry = {
        user_id: user.id,
        product_id: productId,
        product_name: productName,
        supplier_name: supplierName,
        old_price: oldPrice,
        new_price: newPrice,
        price_change_percent: priceChangePercent,
        invoice_id: invoiceId || null,
        change_date: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      console.log(`💰 [PRICE HISTORY] Tracking price change for "${productName}":`, {
        old_price: oldPrice,
        new_price: newPrice,
        change_percent: priceChangePercent,
        supplier: supplierName,
      });

      const { error } = await supabase
        .from('price_history')
        .insert([historyEntry]);

      if (error) {
        console.error('❌ [PRICE HISTORY] Error saving price history:', error);
        return;
      }

      console.log(`✅ [PRICE HISTORY] Price change tracked successfully for "${productName}"`);
    } catch (error) {
      console.error('❌ [PRICE HISTORY] Exception tracking price change:', error);
    }
  }

  /**
   * Get price history for a product
   */
  static async getProductPriceHistory(
    productId: string,
    limit: number = 50
  ): Promise<PriceHistoryEntry[]> {
    try {
      const user = await getCurrentUser();
      if (!user) {
        console.error('❌ [PRICE HISTORY] User not authenticated');
        return [];
      }

      const { data, error } = await supabase
        .from('price_history')
        .select('*')
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .order('change_date', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('❌ [PRICE HISTORY] Error fetching price history:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('❌ [PRICE HISTORY] Exception fetching price history:', error);
      return [];
    }
  }

  /**
   * Get recent price changes (for alerts)
   * Returns products with significant price changes in the last N days
   */
  static async getRecentPriceChanges(
    days: number = 7,
    minChangePercent: number = 5
  ): Promise<PriceAlert[]> {
    try {
      const user = await getCurrentUser();
      if (!user) {
        console.error('❌ [PRICE HISTORY] User not authenticated');
        return [];
      }

      // Calculate date threshold
      const dateThreshold = new Date();
      dateThreshold.setDate(dateThreshold.getDate() - days);

      console.log(`📊 [PRICE HISTORY] Fetching price changes since ${dateThreshold.toISOString()}`);

      const { data, error } = await supabase
        .from('price_history')
        .select('*')
        .eq('user_id', user.id)
        .gte('change_date', dateThreshold.toISOString())
        .order('change_date', { ascending: false });

      if (error) {
        console.error('❌ [PRICE HISTORY] Error fetching recent price changes:', error);
        return [];
      }

      // Filter by minimum change percentage and format as alerts
      const alerts: PriceAlert[] = (data || [])
        .filter(entry => {
          const absChange = Math.abs(entry.price_change_percent || 0);
          return absChange >= minChangePercent;
        })
        .map(entry => ({
          product_id: entry.product_id,
          product_name: entry.product_name,
          supplier_name: entry.supplier_name,
          old_price: entry.old_price || 0,
          new_price: entry.new_price,
          change_percent: entry.price_change_percent || 0,
          change_amount: entry.new_price - (entry.old_price || 0),
          date: entry.change_date,
        }));

      console.log(`✅ [PRICE HISTORY] Found ${alerts.length} significant price changes (>= ${minChangePercent}%)`);
      return alerts;
    } catch (error) {
      console.error('❌ [PRICE HISTORY] Exception fetching recent price changes:', error);
      return [];
    }
  }

  /**
   * Get price trends for dashboard
   */
  static async getPriceTrends(
    limit: number = 10
  ): Promise<Array<{
    product_name: string;
    supplier_name: string;
    trend: 'up' | 'down' | 'stable';
    change_percent: number;
    last_change_date: string;
  }>> {
    try {
      const user = await getCurrentUser();
      if (!user) {
        console.error('❌ [PRICE HISTORY] User not authenticated');
        return [];
      }

      // Get latest price change for each product
      const { data, error } = await supabase
        .from('price_history')
        .select('*')
        .eq('user_id', user.id)
        .order('change_date', { ascending: false })
        .limit(limit * 3); // Fetch more to deduplicate

      if (error) {
        console.error('❌ [PRICE HISTORY] Error fetching price trends:', error);
        return [];
      }

      // Group by product_id and get latest entry for each
      const latestByProduct = new Map<string, typeof data[0]>();
      (data || []).forEach(entry => {
        if (!latestByProduct.has(entry.product_id)) {
          latestByProduct.set(entry.product_id, entry);
        }
      });

      // Convert to trends
      const trends = Array.from(latestByProduct.values())
        .slice(0, limit)
        .map(entry => {
          const changePercent = entry.price_change_percent || 0;
          let trend: 'up' | 'down' | 'stable' = 'stable';
          if (changePercent > 0) trend = 'up';
          else if (changePercent < 0) trend = 'down';

          return {
            product_name: entry.product_name,
            supplier_name: entry.supplier_name,
            trend,
            change_percent: changePercent,
            last_change_date: entry.change_date,
          };
        });

      return trends;
    } catch (error) {
      console.error('❌ [PRICE HISTORY] Exception fetching price trends:', error);
      return [];
    }
  }

  /**
   * Get price statistics for a product
   */
  static async getProductPriceStats(productId: string): Promise<{
    current_price: number;
    min_price: number;
    max_price: number;
    avg_price: number;
    price_volatility: number;
  } | null> {
    try {
      const user = await getCurrentUser();
      if (!user) {
        console.error('❌ [PRICE HISTORY] User not authenticated');
        return null;
      }

      const { data, error } = await supabase
        .from('price_history')
        .select('new_price, old_price')
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .order('change_date', { ascending: false });

      if (error) {
        console.error('❌ [PRICE HISTORY] Error fetching price stats:', error);
        return null;
      }

      if (!data || data.length === 0) {
        return null;
      }

      // Extract all prices
      const prices: number[] = [];
      data.forEach(entry => {
        if (entry.new_price) prices.push(entry.new_price);
        if (entry.old_price) prices.push(entry.old_price);
      });

      if (prices.length === 0) {
        return null;
      }

      const currentPrice = data[0].new_price;
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;

      // Calculate volatility (standard deviation)
      const variance = prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length;
      const volatility = Math.sqrt(variance);

      return {
        current_price: currentPrice,
        min_price: minPrice,
        max_price: maxPrice,
        avg_price: Math.round(avgPrice * 100) / 100,
        price_volatility: Math.round(volatility * 100) / 100,
      };
    } catch (error) {
      console.error('❌ [PRICE HISTORY] Exception fetching price stats:', error);
      return null;
    }
  }

  /**
   * Bulk track price changes from invoice
   * Used when processing invoice with multiple products
   */
  static async trackInvoicePrices(
    items: Array<{
      product_id: string;
      product_name: string;
      supplier_name: string;
      old_price: number | null;
      new_price: number;
    }>,
    invoiceId: string
  ): Promise<void> {
    try {
      const user = await getCurrentUser();
      if (!user) {
        console.error('❌ [PRICE HISTORY] User not authenticated');
        return;
      }

      console.log(`💰 [PRICE HISTORY] Bulk tracking ${items.length} price changes from invoice ${invoiceId}`);

      const historyEntries = items
        .map(item => {
          // Calculate percentage change
          let priceChangePercent: number | null = null;
          if (item.old_price && item.old_price > 0 && item.new_price !== item.old_price) {
            priceChangePercent = ((item.new_price - item.old_price) / item.old_price) * 100;
            priceChangePercent = Math.round(priceChangePercent * 100) / 100;
          }

          // Only include items with actual price changes
          if (priceChangePercent === null || priceChangePercent === 0) {
            return null;
          }

          return {
            user_id: user.id,
            product_id: item.product_id,
            product_name: item.product_name,
            supplier_name: item.supplier_name,
            old_price: item.old_price,
            new_price: item.new_price,
            price_change_percent: priceChangePercent,
            invoice_id: invoiceId,
            change_date: new Date().toISOString(),
            created_at: new Date().toISOString(),
          };
        })
        .filter(entry => entry !== null);

      if (historyEntries.length === 0) {
        console.log('📊 [PRICE HISTORY] No price changes detected in invoice, skipping');
        return;
      }

      const { error } = await supabase
        .from('price_history')
        .insert(historyEntries);

      if (error) {
        console.error('❌ [PRICE HISTORY] Error bulk saving price history:', error);
        return;
      }

      console.log(`✅ [PRICE HISTORY] Tracked ${historyEntries.length} price changes from invoice`);
    } catch (error) {
      console.error('❌ [PRICE HISTORY] Exception bulk tracking prices:', error);
    }
  }
}