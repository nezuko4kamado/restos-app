import { supabase } from './supabase';
import type { Product, Supplier } from '@/types';

export interface PriceComparisonResult {
  product_id: string;
  product_name: string;
  ean_code?: string;
  suppliers: Array<{
    supplier_id: string;
    supplier_name: string;
    price: number;
    last_updated: string;
    is_available: boolean;
    is_whitelisted: boolean;
  }>;
  best_price: number;
  worst_price: number;
  price_difference: number;
  potential_savings: number;
}

export interface SupplierRecommendation {
  product_id: string;
  product_name: string;
  current_supplier: string;
  current_price: number;
  recommended_supplier: string;
  recommended_price: number;
  savings: number;
  savings_percent: number;
}

export class PriceComparisonService {
  /**
   * Compare prices across suppliers for a specific product
   */
  static async compareProductPrices(productName: string): Promise<PriceComparisonResult | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Get all products with similar names
      const { data: products, error: productsError } = await supabase
        .from('app_43909_products')
        .select('*')
        .eq('user_id', user.id)
        .ilike('name', `%${productName}%`);

      if (productsError) throw productsError;
      if (!products || products.length === 0) return null;

      // Get whitelist status for suppliers
      const { data: whitelist } = await supabase
        .from('app_43909_supplier_whitelist')
        .select('supplier_name, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true);

      const whitelistedSuppliers = new Set(
        (whitelist || []).map(w => w.supplier_name.toLowerCase())
      );

      // Group by product name and collect supplier prices
      const supplierPrices = products.map(p => ({
        supplier_id: p.supplier_id || '',
        supplier_name: p.supplier_name || 'Unknown',
        price: p.price,
        last_updated: p.updated_at || p.created_at,
        is_available: true,
        is_whitelisted: whitelistedSuppliers.has((p.supplier_name || '').toLowerCase()),
      }));

      if (supplierPrices.length === 0) return null;

      const prices = supplierPrices.map(sp => sp.price);
      const bestPrice = Math.min(...prices);
      const worstPrice = Math.max(...prices);

      return {
        product_id: products[0].id,
        product_name: products[0].name,
        ean_code: products[0].ean_code,
        suppliers: supplierPrices,
        best_price: bestPrice,
        worst_price: worstPrice,
        price_difference: worstPrice - bestPrice,
        potential_savings: worstPrice - bestPrice,
      };
    } catch (error) {
      console.error('❌ Error comparing product prices:', error);
      return null;
    }
  }

  /**
   * Get all products with price differences across suppliers
   */
  static async getProductsWithPriceDifferences(
    minDifferencePercent: number = 5,
    limit: number = 20
  ): Promise<PriceComparisonResult[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get all products
      const { data: products, error } = await supabase
        .from('app_43909_products')
        .select('*')
        .eq('user_id', user.id)
        .order('name');

      if (error) throw error;
      if (!products) return [];

      // Get whitelist
      const { data: whitelist } = await supabase
        .from('app_43909_supplier_whitelist')
        .select('supplier_name, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true);

      const whitelistedSuppliers = new Set(
        (whitelist || []).map(w => w.supplier_name.toLowerCase())
      );

      // Group products by name (case-insensitive)
      const productGroups = new Map<string, typeof products>();
      products.forEach(p => {
        const key = p.name.toLowerCase().trim();
        if (!productGroups.has(key)) {
          productGroups.set(key, []);
        }
        productGroups.get(key)!.push(p);
      });

      // Find products with multiple suppliers and price differences
      const comparisons: PriceComparisonResult[] = [];

      for (const [, group] of productGroups) {
        if (group.length < 2) continue; // Need at least 2 suppliers

        const supplierPrices = group.map(p => ({
          supplier_id: p.supplier_id || '',
          supplier_name: p.supplier_name || 'Unknown',
          price: p.price,
          last_updated: p.updated_at || p.created_at,
          is_available: true,
          is_whitelisted: whitelistedSuppliers.has((p.supplier_name || '').toLowerCase()),
        }));

        const prices = supplierPrices.map(sp => sp.price);
        const bestPrice = Math.min(...prices);
        const worstPrice = Math.max(...prices);
        const priceDiff = worstPrice - bestPrice;
        const diffPercent = (priceDiff / bestPrice) * 100;

        if (diffPercent >= minDifferencePercent) {
          comparisons.push({
            product_id: group[0].id,
            product_name: group[0].name,
            ean_code: group[0].ean_code,
            suppliers: supplierPrices,
            best_price: bestPrice,
            worst_price: worstPrice,
            price_difference: priceDiff,
            potential_savings: priceDiff,
          });
        }
      }

      // Sort by potential savings (descending)
      comparisons.sort((a, b) => b.potential_savings - a.potential_savings);

      return comparisons.slice(0, limit);
    } catch (error) {
      console.error('❌ Error getting price differences:', error);
      return [];
    }
  }

  /**
   * Get supplier switch recommendations
   */
  static async getRecommendedSwitches(
    minSavingsPercent: number = 10,
    limit: number = 20
  ): Promise<SupplierRecommendation[]> {
    try {
      const comparisons = await this.getProductsWithPriceDifferences(minSavingsPercent, limit * 2);
      
      const recommendations: SupplierRecommendation[] = [];

      for (const comp of comparisons) {
        // Find current supplier (highest price) and recommended (lowest price)
        const currentSupplier = comp.suppliers.find(s => s.price === comp.worst_price);
        const recommendedSupplier = comp.suppliers.find(s => s.price === comp.best_price);

        if (!currentSupplier || !recommendedSupplier) continue;

        const savings = currentSupplier.price - recommendedSupplier.price;
        const savingsPercent = (savings / currentSupplier.price) * 100;

        if (savingsPercent >= minSavingsPercent) {
          recommendations.push({
            product_id: comp.product_id,
            product_name: comp.product_name,
            current_supplier: currentSupplier.supplier_name,
            current_price: currentSupplier.price,
            recommended_supplier: recommendedSupplier.supplier_name,
            recommended_price: recommendedSupplier.price,
            savings,
            savings_percent: savingsPercent,
          });
        }
      }

      // Sort by savings amount (descending)
      recommendations.sort((a, b) => b.savings - a.savings);

      return recommendations.slice(0, limit);
    } catch (error) {
      console.error('❌ Error getting supplier recommendations:', error);
      return [];
    }
  }

  /**
   * Get supplier comparison summary
   */
  static async getSupplierComparison(): Promise<Array<{
    supplier_name: string;
    product_count: number;
    average_price: number;
    total_value: number;
    is_whitelisted: boolean;
  }>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data: products, error } = await supabase
        .from('app_43909_products')
        .select('supplier_name, price')
        .eq('user_id', user.id);

      if (error) throw error;
      if (!products) return [];

      // Get whitelist
      const { data: whitelist } = await supabase
        .from('app_43909_supplier_whitelist')
        .select('supplier_name, is_active')
        .eq('user_id', user.id)
        .eq('is_active', true);

      const whitelistedSuppliers = new Set(
        (whitelist || []).map(w => w.supplier_name.toLowerCase())
      );

      // Group by supplier
      const supplierMap = new Map<string, { prices: number[]; count: number }>();

      products.forEach(p => {
        const supplier = p.supplier_name || 'Unknown';
        if (!supplierMap.has(supplier)) {
          supplierMap.set(supplier, { prices: [], count: 0 });
        }
        const data = supplierMap.get(supplier)!;
        data.prices.push(p.price);
        data.count++;
      });

      // Calculate statistics
      const comparison = Array.from(supplierMap.entries()).map(([name, data]) => {
        const totalValue = data.prices.reduce((sum, p) => sum + p, 0);
        return {
          supplier_name: name,
          product_count: data.count,
          average_price: totalValue / data.count,
          total_value: totalValue,
          is_whitelisted: whitelistedSuppliers.has(name.toLowerCase()),
        };
      });

      // Sort by total value (descending)
      comparison.sort((a, b) => b.total_value - a.total_value);

      return comparison;
    } catch (error) {
      console.error('❌ Error getting supplier comparison:', error);
      return [];
    }
  }

  /**
   * Calculate potential annual savings
   */
  static async calculatePotentialSavings(): Promise<{
    total_savings: number;
    savings_by_switching: number;
    number_of_products: number;
  }> {
    try {
      const recommendations = await this.getRecommendedSwitches(5, 100);
      
      const totalSavings = recommendations.reduce((sum, rec) => sum + rec.savings, 0);
      
      return {
        total_savings: totalSavings,
        savings_by_switching: totalSavings,
        number_of_products: recommendations.length,
      };
    } catch (error) {
      console.error('❌ Error calculating potential savings:', error);
      return {
        total_savings: 0,
        savings_by_switching: 0,
        number_of_products: 0,
      };
    }
  }
}