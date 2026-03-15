import { supabase } from './supabase';
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
  date: string;
}

export class PriceHistoryService {
  /**
   * Track price change for a product
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Calculate price change percentage
      let priceChangePercent: number | null = null;
      if (oldPrice !== null && oldPrice > 0) {
        priceChangePercent = ((newPrice - oldPrice) / oldPrice) * 100;
      }

      // Insert price history record
      const { error } = await supabase
        .from('app_43909_price_history')
        .insert({
          user_id: user.id,
          product_id: productId,
          product_name: productName,
          supplier_name: supplierName,
          old_price: oldPrice,
          new_price: newPrice,
          price_change_percent: priceChangePercent,
          invoice_id: invoiceId,
        });

      if (error) throw error;

      console.log('✅ Price change tracked:', {
        productName,
        oldPrice,
        newPrice,
        changePercent: priceChangePercent?.toFixed(2),
      });
    } catch (error) {
      console.error('❌ Error tracking price change:', error);
      throw error;
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('app_43909_price_history')
        .select('*')
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .order('change_date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('❌ Error fetching price history:', error);
      return [];
    }
  }

  /**
   * Get recent price changes (for alerts)
   */
  static async getRecentPriceChanges(
    days: number = 7,
    minChangePercent: number = 5
  ): Promise<PriceAlert[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const { data, error } = await supabase
        .from('app_43909_price_history')
        .select('*')
        .eq('user_id', user.id)
        .gte('change_date', cutoffDate.toISOString())
        .not('price_change_percent', 'is', null)
        .order('change_date', { ascending: false });

      if (error) throw error;

      // Filter by minimum change percentage and format
      const alerts: PriceAlert[] = (data || [])
        .filter(entry => 
          entry.price_change_percent !== null && 
          Math.abs(entry.price_change_percent) >= minChangePercent
        )
        .map(entry => ({
          product_id: entry.product_id,
          product_name: entry.product_name,
          supplier_name: entry.supplier_name,
          old_price: entry.old_price || 0,
          new_price: entry.new_price,
          change_percent: entry.price_change_percent || 0,
          date: entry.change_date,
        }));

      return alerts;
    } catch (error) {
      console.error('❌ Error fetching price alerts:', error);
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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('app_43909_price_history')
        .select('*')
        .eq('user_id', user.id)
        .not('price_change_percent', 'is', null)
        .order('change_date', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map(entry => ({
        product_name: entry.product_name,
        supplier_name: entry.supplier_name,
        trend: entry.price_change_percent > 0 ? 'up' : entry.price_change_percent < 0 ? 'down' : 'stable',
        change_percent: Math.abs(entry.price_change_percent || 0),
        last_change_date: entry.change_date,
      }));
    } catch (error) {
      console.error('❌ Error fetching price trends:', error);
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
    price_volatility: number; // Standard deviation
  } | null> {
    try {
      const history = await this.getProductPriceHistory(productId, 100);
      
      if (history.length === 0) return null;

      const prices = history.map(h => h.new_price);
      const currentPrice = history[0].new_price;
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);
      const avgPrice = prices.reduce((sum, p) => sum + p, 0) / prices.length;

      // Calculate standard deviation for volatility
      const variance = prices.reduce((sum, p) => sum + Math.pow(p - avgPrice, 2), 0) / prices.length;
      const volatility = Math.sqrt(variance);

      return {
        current_price: currentPrice,
        min_price: minPrice,
        max_price: maxPrice,
        avg_price: avgPrice,
        price_volatility: volatility,
      };
    } catch (error) {
      console.error('❌ Error calculating price stats:', error);
      return null;
    }
  }

  /**
   * Bulk track price changes from invoice
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
      const promises = items.map(item =>
        this.trackPriceChange(
          item.product_id,
          item.product_name,
          item.supplier_name,
          item.old_price,
          item.new_price,
          invoiceId
        )
      );

      await Promise.all(promises);
      console.log(`✅ Tracked ${items.length} price changes from invoice ${invoiceId}`);
    } catch (error) {
      console.error('❌ Error tracking invoice prices:', error);
      throw error;
    }
  }
}