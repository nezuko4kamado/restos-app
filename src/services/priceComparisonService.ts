import { supabase } from '@/lib/supabase';
import { PriceComparison, SupplierPrice } from '@/types/advanced';
import { SupplierWhitelistService } from './supplierWhitelistService';
import { PriceHistoryService } from './priceHistoryService';

export class PriceComparisonService {
  /**
   * Compare prices for a specific product across suppliers
   */
  static async compareProductPrices(productId: string): Promise<PriceComparison | null> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      // Get product details
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('*')
        .eq('id', productId)
        .eq('user_id', user.id)
        .single();

      if (productError) throw productError;
      if (!product) return null;

      // Get price history for this product
      const priceHistory = await PriceHistoryService.getProductPriceHistory(productId);

      // Group by supplier and get latest price
      const supplierPrices = new Map<string, SupplierPrice>();

      for (const history of priceHistory) {
        if (!supplierPrices.has(history.supplier_name)) {
          const isWhitelisted = await SupplierWhitelistService.isSupplierWhitelisted(history.supplier_name);
          
          supplierPrices.set(history.supplier_name, {
            supplier_name: history.supplier_name,
            price: history.new_price,
            last_updated: history.change_date,
            is_available: true,
            is_whitelisted: isWhitelisted,
          });
        }
      }

      const suppliers = Array.from(supplierPrices.values());

      if (suppliers.length === 0) {
        return null;
      }

      // Find best price
      const sortedByPrice = [...suppliers].sort((a, b) => a.price - b.price);
      const bestPrice = sortedByPrice[0].price;
      const bestSupplier = sortedByPrice[0].supplier_name;

      // Calculate potential savings compared to most expensive
      const maxPrice = sortedByPrice[sortedByPrice.length - 1].price;
      const potentialSavings = maxPrice - bestPrice;
      const savingsPercent = maxPrice > 0 ? (potentialSavings / maxPrice) * 100 : 0;

      const comparison: PriceComparison = {
        product_id: productId,
        product_name: product.name,
        ean_code: product.ean_code,
        suppliers,
        best_price: bestPrice,
        best_supplier: bestSupplier,
        potential_savings: potentialSavings,
        savings_percent: savingsPercent,
      };

      return comparison;
    } catch (error) {
      console.error('Error comparing product prices:', error);
      return null;
    }
  }

  /**
   * Get price comparisons for multiple products
   */
  static async batchCompareProducts(productIds: string[]): Promise<PriceComparison[]> {
    const comparisons: PriceComparison[] = [];

    for (const productId of productIds) {
      const comparison = await this.compareProductPrices(productId);
      if (comparison) {
        comparisons.push(comparison);
      }
    }

    return comparisons;
  }

  /**
   * Get products with significant price differences
   */
  static async getProductsWithPriceDifferences(
    minDifferencePercent: number = 10
  ): Promise<PriceComparison[]> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get all products
      const { data: products, error } = await supabase
        .from('products')
        .select('id')
        .eq('user_id', user.id);

      if (error) throw error;
      if (!products) return [];

      const comparisons: PriceComparison[] = [];

      for (const product of products) {
        const comparison = await this.compareProductPrices(product.id);
        if (comparison && comparison.savings_percent >= minDifferencePercent) {
          comparisons.push(comparison);
        }
      }

      // Sort by savings percent (highest first)
      comparisons.sort((a, b) => b.savings_percent - a.savings_percent);

      return comparisons;
    } catch (error) {
      console.error('Error getting products with price differences:', error);
      return [];
    }
  }

  /**
   * Get supplier price comparison summary
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

      // Get all price history
      const { data: priceHistory, error } = await supabase
        .from('price_history')
        .select('*')
        .eq('user_id', user.id)
        .order('change_date', { ascending: false });

      if (error) throw error;
      if (!priceHistory) return [];

      // Group by supplier
      const supplierMap = new Map<string, {
        prices: number[];
        products: Set<string>;
      }>();

      for (const history of priceHistory) {
        if (!supplierMap.has(history.supplier_name)) {
          supplierMap.set(history.supplier_name, {
            prices: [],
            products: new Set(),
          });
        }

        const supplierData = supplierMap.get(history.supplier_name)!;
        supplierData.prices.push(history.new_price);
        supplierData.products.add(history.product_id);
      }

      // Calculate statistics
      const summary = [];

      for (const [supplierName, data] of supplierMap.entries()) {
        const isWhitelisted = await SupplierWhitelistService.isSupplierWhitelisted(supplierName);
        const averagePrice = data.prices.reduce((sum, p) => sum + p, 0) / data.prices.length;
        const totalValue = data.prices.reduce((sum, p) => sum + p, 0);

        summary.push({
          supplier_name: supplierName,
          product_count: data.products.size,
          average_price: averagePrice,
          total_value: totalValue,
          is_whitelisted: isWhitelisted,
        });
      }

      // Sort by total value (descending)
      summary.sort((a, b) => b.total_value - a.total_value);

      return summary;
    } catch (error) {
      console.error('Error getting supplier comparison:', error);
      return [];
    }
  }

  /**
   * Get recommended supplier switches
   */
  static async getRecommendedSwitches(
    minSavingsPercent: number = 15
  ): Promise<Array<{
    product_id: string;
    product_name: string;
    current_supplier: string;
    current_price: number;
    recommended_supplier: string;
    recommended_price: number;
    savings: number;
    savings_percent: number;
  }>> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      // Get products with price differences
      const comparisons = await this.getProductsWithPriceDifferences(minSavingsPercent);

      const recommendations = [];

      for (const comparison of comparisons) {
        // Assume current supplier is the one with highest price (worst deal)
        const sortedSuppliers = [...comparison.suppliers].sort((a, b) => b.price - a.price);
        const currentSupplier = sortedSuppliers[0];
        const bestSupplier = sortedSuppliers[sortedSuppliers.length - 1];

        if (currentSupplier.supplier_name !== bestSupplier.supplier_name) {
          recommendations.push({
            product_id: comparison.product_id,
            product_name: comparison.product_name,
            current_supplier: currentSupplier.supplier_name,
            current_price: currentSupplier.price,
            recommended_supplier: bestSupplier.supplier_name,
            recommended_price: bestSupplier.price,
            savings: currentSupplier.price - bestSupplier.price,
            savings_percent: ((currentSupplier.price - bestSupplier.price) / currentSupplier.price) * 100,
          });
        }
      }

      return recommendations;
    } catch (error) {
      console.error('Error getting recommended switches:', error);
      return [];
    }
  }
}