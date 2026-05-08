import { supabase, isSupabaseConfigured, getCurrentUser } from './supabase';
import type { Invoice, Product } from '@/types';

/**
 * Interface for a price alert
 */
export interface PriceAlert {
  productName: string;
  supplierName: string;
  oldPrice: number;
  newPrice: number;
  changePercent: number;
  invoiceDate: string;
  source: 'invoice' | 'product_history';
}

/**
 * Interface for invoice items
 */
interface InvoiceItem {
  name?: string;
  unit_price?: number;
  price?: number;
}

/**
 * Calculate price alerts from product price_history field.
 * For each product that has 2+ entries in price_history, compare the last two entries.
 * Returns both the count and the detailed alerts array.
 *
 * FIXED: Ignores "Confirmed from invoice" and "Original price" entries as the latest
 * entry, so they don't generate false alerts. Uses tolerance (> 0.01) instead of
 * strict equality to avoid floating-point false positives.
 */
export const calculatePriceAlertsFromProducts = (
  products: Product[],
  suppliers: Array<{ id: string; name: string }>
): PriceAlert[] => {
  const alerts: PriceAlert[] = [];

  for (const product of products) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const p = product as any;
    const history: Array<{ price: number; date: string; reason?: string }> =
      p.price_history || p.priceHistory || [];

    if (history.length < 2) continue;

    // Non-alert reasons: these entries should never be the "latest real change"
    const NON_ALERT_REASONS = ['Confirmed from invoice', 'Original price'];

    // Find the most recent entry that represents a REAL price change
    const latestRealChange = [...history]
      .reverse()
      .find(entry => !NON_ALERT_REASONS.includes(entry.reason || ''));

    if (!latestRealChange) continue;

    // Find its index in the original (non-reversed) history array
    const latestIndex = history.findIndex(
      e => e.date === latestRealChange.date && e.price === latestRealChange.price
    );
    if (latestIndex <= 0) continue;

    // Get the entry immediately before this real change
    const previous = history[latestIndex - 1];

    if (
      previous == null ||
      previous.price == null ||
      latestRealChange.price == null ||
      previous.price <= 0
    ) continue;

    // Use tolerance to avoid floating-point false positives
    if (Math.abs(latestRealChange.price - previous.price) <= 0.01) continue;

    const changePercent =
      ((latestRealChange.price - previous.price) / previous.price) * 100;

    const supplierName =
      suppliers.find((s) => s.id === product.supplier_id)?.name || '';

    alerts.push({
      productName: product.name,
      supplierName,
      oldPrice: previous.price,
      newPrice: latestRealChange.price,
      changePercent: Math.round(changePercent * 100) / 100,
      invoiceDate: latestRealChange.date || new Date().toISOString(),
      source: 'product_history',
    });
  }

  // Sort by absolute change percent (highest first)
  alerts.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

  return alerts;
};

/**
 * Calculate price alerts by comparing the last 2 invoices for each supplier
 * Returns the number of products with price increases
 */
export const calculatePriceAlerts = async (): Promise<number> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, returning 0 alerts');
    return 0;
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return 0;
    }

    console.log('🔔 [PRICE ALERTS] Starting price alert calculation...');

    // Fetch all invoices ordered by date (newest first)
    const { data: invoices, error } = await supabase
      .from('app_43909_invoices')
      .select('*')
      .eq('user_id', user.id)
      .order('invoice_date', { ascending: false });

    if (error) {
      console.error('❌ Error fetching invoices:', error);
      return 0;
    }

    if (!invoices || invoices.length < 2) {
      console.log('📊 [PRICE ALERTS] Not enough invoices to compare');
      return 0;
    }

    console.log(`📊 [PRICE ALERTS] Found ${invoices.length} invoices`);

    // Group invoices by supplier
    const invoicesBySupplier = new Map<string, typeof invoices>();
    
    invoices.forEach(invoice => {
      const supplierName = invoice.supplier_name;
      if (!invoicesBySupplier.has(supplierName)) {
        invoicesBySupplier.set(supplierName, []);
      }
      invoicesBySupplier.get(supplierName)!.push(invoice);
    });

    console.log(`📊 [PRICE ALERTS] Found ${invoicesBySupplier.size} unique suppliers`);

    let totalPriceIncreases = 0;

    // For each supplier, compare last 2 invoices
    invoicesBySupplier.forEach((supplierInvoices, supplierName) => {
      if (supplierInvoices.length < 2) {
        console.log(`📊 [PRICE ALERTS] Supplier "${supplierName}" has only 1 invoice, skipping`);
        return;
      }

      // Get the 2 most recent invoices
      const [newestInvoice, previousInvoice] = supplierInvoices.slice(0, 2);

      console.log(`📊 [PRICE ALERTS] Comparing invoices for supplier "${supplierName}":`);
      console.log(`   - Newest: ${newestInvoice.invoice_date} (${newestInvoice.invoice_number})`);
      console.log(`   - Previous: ${previousInvoice.invoice_date} (${previousInvoice.invoice_number})`);

      // Parse items from both invoices
      const newestItems = (newestInvoice.items || []) as InvoiceItem[];
      const previousItems = (previousInvoice.items || []) as InvoiceItem[];

      console.log(`   - Newest items count: ${newestItems.length}`);
      console.log(`   - Previous items count: ${previousItems.length}`);

      // Create a map of product names to prices from previous invoice
      const previousPrices = new Map<string, number>();
      previousItems.forEach((item: InvoiceItem) => {
        const productName = item.name?.toLowerCase().trim();
        const price = parseFloat(String(item.unit_price || item.price || 0));
        if (productName && price > 0) {
          previousPrices.set(productName, price);
        }
      });

      // Compare prices in newest invoice
      newestItems.forEach((item: InvoiceItem) => {
        const productName = item.name?.toLowerCase().trim();
        const newPrice = parseFloat(String(item.unit_price || item.price || 0));

        if (!productName || newPrice <= 0) {
          return;
        }

        const oldPrice = previousPrices.get(productName);

        if (oldPrice && oldPrice > 0 && newPrice > oldPrice) {
          const percentChange = ((newPrice - oldPrice) / oldPrice) * 100;
          
          console.log(`   🔺 PRICE INCREASE DETECTED:`);
          console.log(`      Product: ${item.name}`);
          console.log(`      Old price: €${oldPrice.toFixed(2)}`);
          console.log(`      New price: €${newPrice.toFixed(2)}`);
          console.log(`      Change: +${percentChange.toFixed(1)}%`);
          
          totalPriceIncreases++;
        }
      });
    });

    console.log(`🔔 [PRICE ALERTS] Total price increases detected: ${totalPriceIncreases}`);
    return totalPriceIncreases;

  } catch (error) {
    console.error('❌ Exception calculating price alerts:', error);
    return 0;
  }
};

/**
 * Get detailed price alerts from invoices for display
 */
export const getDetailedPriceAlerts = async (): Promise<PriceAlert[]> => {
  if (!isSupabaseConfigured()) {
    console.warn('⚠️ Supabase not configured, returning empty alerts');
    return [];
  }

  try {
    const user = await getCurrentUser();
    if (!user) {
      console.error('❌ User not authenticated');
      return [];
    }

    // Fetch all invoices ordered by date (newest first)
    const { data: invoices, error } = await supabase
      .from('app_43909_invoices')
      .select('*')
      .eq('user_id', user.id)
      .order('invoice_date', { ascending: false });

    if (error) {
      console.error('❌ Error fetching invoices:', error);
      return [];
    }

    if (!invoices || invoices.length < 2) {
      return [];
    }

    // Group invoices by supplier
    const invoicesBySupplier = new Map<string, typeof invoices>();
    
    invoices.forEach(invoice => {
      const supplierName = invoice.supplier_name;
      if (!invoicesBySupplier.has(supplierName)) {
        invoicesBySupplier.set(supplierName, []);
      }
      invoicesBySupplier.get(supplierName)!.push(invoice);
    });

    const alerts: PriceAlert[] = [];

    // For each supplier, compare last 2 invoices
    invoicesBySupplier.forEach((supplierInvoices, supplierName) => {
      if (supplierInvoices.length < 2) {
        return;
      }

      // Get the 2 most recent invoices
      const [newestInvoice, previousInvoice] = supplierInvoices.slice(0, 2);

      // Parse items from both invoices
      const newestItems = (newestInvoice.items || []) as InvoiceItem[];
      const previousItems = (previousInvoice.items || []) as InvoiceItem[];

      // Create a map of product names to prices from previous invoice
      const previousPrices = new Map<string, number>();
      previousItems.forEach((item: InvoiceItem) => {
        const productName = item.name?.toLowerCase().trim();
        const price = parseFloat(String(item.unit_price || item.price || 0));
        if (productName && price > 0) {
          previousPrices.set(productName, price);
        }
      });

      // Compare prices in newest invoice
      newestItems.forEach((item: InvoiceItem) => {
        const productName = item.name?.toLowerCase().trim();
        const newPrice = parseFloat(String(item.unit_price || item.price || 0));

        if (!productName || newPrice <= 0) {
          return;
        }

        const oldPrice = previousPrices.get(productName);

        if (oldPrice && oldPrice > 0 && newPrice > oldPrice) {
          const percentChange = ((newPrice - oldPrice) / oldPrice) * 100;
          
          alerts.push({
            productName: item.name || '',
            supplierName: supplierName,
            oldPrice: oldPrice,
            newPrice: newPrice,
            changePercent: Math.round(percentChange * 100) / 100,
            invoiceDate: newestInvoice.invoice_date,
            source: 'invoice',
          });
        }
      });
    });

    // Sort by change percent (highest first)
    alerts.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

    return alerts;

  } catch (error) {
    console.error('❌ Exception getting detailed price alerts:', error);
    return [];
  }
};