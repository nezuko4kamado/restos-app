import { supabase } from '@/lib/supabase';
import { PriceHistory, PriceAlert } from '@/types/advanced';

export class PriceHistoryService {
  /**
   * Track price change for a product
   */
  static async trackPriceChange(
    productId: string,
    productName: string,
    supplierName: string,
    newPrice: number,
    oldPrice?: number,
    invoiceId?: string
  ): Promise<PriceHistory | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      // Calculate price change percentage
      let priceChangePercent: number | undefined;
      if (oldPrice && oldPrice > 0) {
        priceChangePercent = ((newPrice - oldPrice) / oldPrice) * 100;
      }

      const { data, error } = await supabase
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
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error tracking price change:', error);
      return null;
    }
  }

  /**
   * Get price history for a product
   */
  static async getProductPriceHistory(
    productId: string,
    supplierName?: string
  ): Promise<PriceHistory[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      let query = supabase
        .from('app_43909_price_history')
        .select('*')
        .eq('user_id', user.id)
        .eq('product_id', productId)
        .order('change_date', { ascending: false });

      if (supplierName) {
        query = query.eq('supplier_name', supplierName);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching price history:', error);
      return [];
    }
  }

  /**
   * Get recent price changes (alerts)
   */
  static async getRecentPriceAlerts(
    daysBack: number = 7,
    minChangePercent: number = 5
  ): Promise<PriceAlert[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysBack);

      const { data, error } = await supabase
        .from('app_43909_price_history')
        .select('*')
        .eq('user_id', user.id)
        .gte('change_date', cutoffDate.toISOString())
        .not('price_change_percent', 'is', null)
        .order('change_date', { ascending: false });

      if (error) throw error;

      // Filter and transform to alerts
      const alerts: PriceAlert[] = (data || [])
        .filter(item => Math.abs(item.price_change_percent || 0) >= minChangePercent)
        .map(item => ({
          id: item.id,
          product_id: item.product_id,
          product_name: item.product_name,
          supplier_name: item.supplier_name,
          old_price: item.old_price || 0,
          new_price: item.new_price,
          change_percent: item.price_change_percent || 0,
          change_type: (item.price_change_percent || 0) > 0 ? 'increase' : 'decrease',
          alert_date: item.change_date,
          is_read: false,
        }));

      return alerts;
    } catch (error) {
      console.error('Error fetching price alerts:', error);
      return [];
    }
  }

  /**
   * Get price trends for a supplier
   */
  static async getSupplierPriceTrends(
    supplierName: string,
    limit: number = 50
  ): Promise<PriceHistory[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('app_43909_price_history')
        .select('*')
        .eq('user_id', user.id)
        .eq('supplier_name', supplierName)
        .order('change_date', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching supplier price trends:', error);
      return [];
    }
  }

  /**
   * Calculate average price change for a period
   */
  static async getAveragePriceChange(
    startDate: string,
    endDate: string
  ): Promise<number> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return 0;

      const { data, error } = await supabase
        .from('app_43909_price_history')
        .select('price_change_percent')
        .eq('user_id', user.id)
        .gte('change_date', startDate)
        .lte('change_date', endDate)
        .not('price_change_percent', 'is', null);

      if (error) throw error;

      if (!data || data.length === 0) return 0;

      const sum = data.reduce((acc, item) => acc + (item.price_change_percent || 0), 0);
      return sum / data.length;
    } catch (error) {
      console.error('Error calculating average price change:', error);
      return 0;
    }
  }

  /**
   * Update product price history data in products table
   */
  static async updateProductPriceHistoryData(
    productId: string,
    supplierName: string,
    price: number
  ): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get current product
      const { data: product } = await supabase
        .from('app_43909_products')
        .select('price_history_data')
        .eq('id', productId)
        .eq('user_id', user.id)
        .single();

      if (!product) return;

      const priceHistoryData = product.price_history_data || [];
      
      // Add new price entry
      priceHistoryData.push({
        date: new Date().toISOString(),
        price,
        supplier: supplierName,
      });

      // Keep only last 100 entries
      const trimmedHistory = priceHistoryData.slice(-100);

      // Update product
      await supabase
        .from('app_43909_products')
        .update({ price_history_data: trimmedHistory })
        .eq('id', productId)
        .eq('user_id', user.id);
    } catch (error) {
      console.error('Error updating product price history data:', error);
    }
  }
}